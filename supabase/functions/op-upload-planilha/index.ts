import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// =============================================
// MÓDULO OPERACIONAL: upload manual de planilha (botão "Atualizar agora")
// =============================================
// Autenticado por JWT do usuário logado (verify_jwt = true em config.toml) -
// diferente de op-ingest-sheet/op-ingest-status, que são chamadas pelo n8n
// por token. Aqui o usuário escolhe um .xlsx na tela Fontes; esta function só
// valida e repassa os bytes ao webhook do n8n, que converte/lê e chama
// op-ingest-sheet como sempre - NENHUMA lógica de interpretação nova aqui.

const MAX_FILE_BYTES = 10 * 1024 * 1024

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'No authorization header' }, 401)
    }

    // Client escopado ao usuário só para resolver quem está chamando - todas
    // as escritas (op_uploads, consulta de op_sources) usam o client de
    // service role abaixo, igual ao resto do módulo Operacional.
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return jsonResponse({ error: 'Requisição deve ser multipart/form-data' }, 400)
    }

    const sourceId = formData.get('source_id')
    const file = formData.get('arquivo')

    if (typeof sourceId !== 'string' || !sourceId) {
      return jsonResponse({ error: 'source_id é obrigatório' }, 400)
    }
    if (!(file instanceof File)) {
      return jsonResponse({ error: 'arquivo é obrigatório' }, 400)
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return jsonResponse({ error: 'Apenas arquivos .xlsx são aceitos' }, 400)
    }
    if (file.size > MAX_FILE_BYTES) {
      return jsonResponse({ error: 'Arquivo excede o limite de 10 MB' }, 400)
    }

    // Só o dono da fonte pode subir arquivo para ela - mesma regra de
    // owns_op_source usada nas policies de RLS das telas administrativas.
    const { data: source, error: sourceError } = await supabaseAdmin
      .from('op_sources')
      .select('id, organization_id, active, upload_webhook_url, upload_webhook_secret')
      .eq('id', sourceId)
      .maybeSingle()

    if (sourceError || !source || source.organization_id !== user.id) {
      return jsonResponse({ error: 'Fonte não encontrada para este usuário' }, 403)
    }
    if (!source.active) {
      return jsonResponse({ error: 'Fonte inativa' }, 409)
    }
    if (!source.upload_webhook_url || !source.upload_webhook_secret) {
      return jsonResponse({ error: 'Upload ainda não configurado para esta fonte' }, 409)
    }

    const uploadedAt = new Date().toISOString()

    const { data: uploadRow, error: uploadInsertError } = await supabaseAdmin
      .from('op_uploads')
      .insert({
        source_id: source.id,
        user_id: user.id,
        filename: file.name,
        size: file.size,
        status: 'pending',
      })
      .select('id')
      .single()

    if (uploadInsertError || !uploadRow) {
      return jsonResponse({ error: 'Erro ao registrar upload' }, 500)
    }

    // Repassa os bytes do arquivo ao n8n como Blob com o Content-Type correto
    // de planilha .xlsx (em vez de deixar o tipo em branco) - NUNCA loga o
    // conteúdo do arquivo, só metadados (nome, tamanho) para diagnóstico.
    const arquivoXlsx = new Blob([await file.arrayBuffer()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const forwardForm = new FormData()
    forwardForm.set('source_id', source.id)
    forwardForm.set('filename', file.name)
    forwardForm.set('uploaded_by', user.email ?? user.id)
    forwardForm.set('uploaded_at', uploadedAt)
    forwardForm.set('arquivo', arquivoXlsx, file.name)

    let n8nResponseBody: unknown = null
    try {
      const webhookResponse = await fetch(source.upload_webhook_url, {
        method: 'POST',
        headers: { 'x-upload-secret': source.upload_webhook_secret },
        body: forwardForm,
      })

      try {
        n8nResponseBody = await webhookResponse.json()
      } catch {
        // Resposta do n8n sem corpo JSON - segue sem ela, não é erro.
      }

      if (!webhookResponse.ok) {
        console.error(`op-upload-planilha: webhook do n8n respondeu ${webhookResponse.status} para upload ${uploadRow.id}`)
        await supabaseAdmin
          .from('op_uploads')
          .update({ status: 'erro', error_message: `Webhook respondeu ${webhookResponse.status}` })
          .eq('id', uploadRow.id)
        return jsonResponse({ error: 'n8n não aceitou o arquivo', n8n_response: n8nResponseBody }, 502)
      }
    } catch (webhookException) {
      console.error(`op-upload-planilha: falha ao chamar o webhook do n8n para upload ${uploadRow.id}`, webhookException)
      await supabaseAdmin
        .from('op_uploads')
        .update({ status: 'erro', error_message: 'Falha de rede ao chamar o webhook do n8n' })
        .eq('id', uploadRow.id)
      return jsonResponse({ error: 'Não foi possível contatar o n8n' }, 502)
    }

    await supabaseAdmin.from('op_uploads').update({ status: 'enviado' }).eq('id', uploadRow.id)

    return jsonResponse({ ok: true, upload_id: uploadRow.id, n8n_response: n8nResponseBody }, 202)
  } catch (error) {
    console.error('op-upload-planilha: erro inesperado', error)
    return jsonResponse({ error: 'Erro interno' }, 500)
  }
})
