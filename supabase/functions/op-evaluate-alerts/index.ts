import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { avaliarEReconciliarAlertasDeFonte } from '../_shared/op/evaluateSource.ts'

// =============================================
// MÓDULO OPERACIONAL: Fase 6 - avaliação manual de alertas
// =============================================
// Chamada pelo botão "Verificar agora" da tela Alertas (e, se um dia houver
// um agendamento/cron, pode ser chamada por ele também sem mudanças) -
// percorre TODAS as fontes do usuário chamador e reavalia o conjunto
// completo de alertas de cada uma. Diferente de op-ingest-sheet (que avalia
// só a fonte que acabou de receber dados), esta é a forma de detectar fontes
// que simplesmente pararam de enviar qualquer coisa.

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
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Client escopado ao usuário só para resolver quem está chamando e
    // checar o papel - a leitura/escrita de dado em si usa o client admin
    // abaixo, já que op_sources agora é admin-only por RLS e esta function
    // precisa ver TODAS as fontes (de qualquer admin/gestor), não só as do
    // chamador.
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Controle de acesso do módulo: só admin/gestor podem avaliar alertas.
    const { data: papel } = await supabaseClient.rpc('op_papel')
    if (papel !== 'admin' && papel !== 'gestor') {
      return new Response(JSON.stringify({ error: 'Sem permissão para esta ação' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: fontes, error: fontesError } = await supabaseAdmin
      .from('op_sources')
      .select('id, organization_id, profile, last_checked_at')
      .eq('active', true)

    if (fontesError) {
      return new Response(JSON.stringify({ error: fontesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let totalAbertos = 0
    const resultados: { source_id: string; alerts_opened: number }[] = []

    for (const fonte of fontes ?? []) {
      const abertos = await avaliarEReconciliarAlertasDeFonte(supabaseAdmin, fonte, fonte.last_checked_at)
      totalAbertos += abertos
      resultados.push({ source_id: fonte.id, alerts_opened: abertos })
    }

    return new Response(
      JSON.stringify({
        success: true,
        fontes_avaliadas: (fontes ?? []).length,
        alerts_opened: totalAbertos,
        detalhes: resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
