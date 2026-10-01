import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { normalizarRotulo } from '../_shared/op/parsing.ts'
import {
  interpretarDespesas,
  interpretarHorasExtras,
  interpretarAusenciaPontoSaida,
  interpretarPlanilha1,
  type InterpreterContext,
} from '../_shared/op/caixa.ts'

// =============================================
// MÓDULO OPERACIONAL: ingestão de planilhas (n8n -> este endpoint)
// =============================================
// Autenticação por token por fonte (header x-ingest-token, comparado por
// hash), NÃO por JWT de usuário - por isso verify_jwt=false em config.toml e
// um client de service role para todas as escritas (não há auth.uid() aqui).
//
// Regras de Ouro aplicadas neste arquivo:
// 1. Espelho somente-leitura: este endpoint só recebe e guarda, nunca aceita
//    edição manual de dado de planilha.
// 2/3. Nunca inventa valor, nunca apaga - ver op_apply_interpreted_rows.
// 6. Sem IA/LLM - toda a lógica abaixo é determinística.
// 7. A interpretação por aba (Fases 2-4) vive em módulos puros em
//    ../_shared/op/*.ts, registrados em getInterpreter/getListInterpreter
//    abaixo - este arquivo só orquestra.

const MAX_BODY_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 20000
const MAX_COLS = 60

interface IngestBody {
  schema_version: number
  run_id: string
  sent_at: string
  file: { drive_file_id: string; name: string; modified_at: string }
  sheet?: {
    name: string
    hash: string
    first_row_number: number
    rows: unknown[][]
  }
}

interface InterpretedRow {
  natural_key: string
  data: Record<string, unknown>
  source_row: number
}

interface InterpretedException {
  row_number: number
  severity: 'bloqueante' | 'confirmacao' | 'aviso'
  type: string
  message: string
  value_current?: unknown
  value_suggested?: unknown
}

interface InterpreterResult {
  sheetKey: string
  rows: InterpretedRow[]
  exceptions: InterpretedException[]
  rejectedCount: number
}

type Interpreter = (rows: unknown[][], firstRowNumber: number, context: InterpreterContext) => InterpreterResult
type ListInterpreter = (rows: unknown[][]) => { listKey: string; items: unknown[] }

// Interpretadores de registros versionados (vão para op_records/op_changes
// via op_apply_interpreted_rows). Abas sem interpretador aqui ficam
// "nao_interpretada" (nunca descartadas - o snapshot bruto é sempre guardado).
// "HORAS EXTRAS <MÊS>" é tratada por prefixo porque o nome da aba muda todo
// mês - Fases 3 e 4 populam os outros dois perfis.
function getInterpreter(profile: string, sheetName: string): Interpreter | null {
  const nome = normalizarRotulo(sheetName)
  if (profile === 'caixa') {
    if (nome === 'DESPESAS') return interpretarDespesas
    if (nome === 'AUSENCIA PONTO SAIDA') return interpretarAusenciaPontoSaida
    if (nome.startsWith('HORAS EXTRAS')) return interpretarHorasExtras
  }
  return null
}

// Interpretadores de LISTA (vão para op_lists, sem diff/histórico - só o
// conteúdo mais recente).
function getListInterpreter(profile: string, sheetName: string): ListInterpreter | null {
  const nome = normalizarRotulo(sheetName)
  if (profile === 'caixa' && nome === 'PLANILHA1') return interpretarPlanilha1
  return null
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

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
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const token = req.headers.get('x-ingest-token')
    if (!token) {
      return jsonResponse({ error: 'Header x-ingest-token é obrigatório' }, 401)
    }

    const rawBody = await req.text()
    const bodyBytes = new TextEncoder().encode(rawBody).length
    if (bodyBytes > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Corpo da requisição excede o limite de 5 MB' }, 413)
    }

    let body: IngestBody
    try {
      body = JSON.parse(rawBody)
    } catch {
      return jsonResponse({ error: 'JSON inválido' }, 400)
    }

    if (!body.run_id || !body.file?.drive_file_id) {
      return jsonResponse({ error: 'run_id e file.drive_file_id são obrigatórios' }, 400)
    }

    if (body.sheet) {
      if (!Array.isArray(body.sheet.rows)) {
        return jsonResponse({ error: 'sheet.rows deve ser uma matriz' }, 400)
      }
      if (body.sheet.rows.length > MAX_ROWS) {
        return jsonResponse({ error: `sheet.rows excede o limite de ${MAX_ROWS} linhas` }, 413)
      }
      const maxCols = body.sheet.rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0)
      if (maxCols > MAX_COLS) {
        return jsonResponse({ error: `sheet.rows excede o limite de ${MAX_COLS} colunas` }, 413)
      }
    }

    const tokenHash = await sha256Hex(token)
    const { data: source, error: sourceError } = await supabaseAdmin
      .from('op_sources')
      .select('id, organization_id, profile, drive_file_id, active')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (sourceError || !source || !source.active) {
      return jsonResponse({ error: 'Token inválido ou fonte inativa' }, 403)
    }

    if (source.drive_file_id !== body.file.drive_file_id) {
      return jsonResponse({ error: 'drive_file_id não corresponde ao cadastrado para esta fonte' }, 403)
    }

    await supabaseAdmin
      .from('op_sources')
      .update({
        last_checked_at: new Date().toISOString(),
        last_file_name: body.file.name,
        last_file_modified_at: body.file.modified_at,
      })
      .eq('id', source.id)

    // Batimento: nenhuma aba enviada nesta chamada, só confirma que a
    // automação está rodando.
    if (!body.sheet) {
      await supabaseAdmin.from('op_runs').insert({
        source_id: source.id,
        run_id: body.run_id,
        sheet_name: null,
        file_name: body.file.name,
        file_modified_at: body.file.modified_at,
        status: 'batimento',
        counts: {},
      })
      return jsonResponse({ ok: true, run_id: body.run_id, status: 'batimento' })
    }

    const sheetName = body.sheet.name

    // Idempotência: mesma (fonte, run_id, aba) já processada -> devolve o
    // resultado guardado, sem reprocessar nada.
    const { data: existingRun } = await supabaseAdmin
      .from('op_runs')
      .select('response')
      .eq('source_id', source.id)
      .eq('run_id', body.run_id)
      .eq('sheet_name', sheetName)
      .maybeSingle()

    if (existingRun?.response) {
      return jsonResponse(existingRun.response)
    }

    const emptyCounts = { novo: 0, alterado: 0, inalterado: 0, ausente: 0, reapareceu: 0, rejeitadas: 0 }
    const emptyExceptions = { bloqueante: 0, confirmacao: 0, aviso: 0 }

    // Compara só com o ÚLTIMO snapshot processado desta aba (não todo o histórico).
    const { data: lastSnapshot } = await supabaseAdmin
      .from('op_snapshots')
      .select('sheet_hash')
      .eq('source_id', source.id)
      .eq('sheet_name', sheetName)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastSnapshot && lastSnapshot.sheet_hash === body.sheet.hash) {
      await supabaseAdmin.from('op_runs').insert({
        source_id: source.id,
        run_id: body.run_id,
        sheet_name: sheetName,
        file_name: body.file.name,
        file_modified_at: body.file.modified_at,
        status: 'inalterada',
        counts: emptyCounts,
      })
      const response = {
        ok: true,
        run_id: body.run_id,
        sheet: sheetName,
        status: 'inalterada',
        counts: emptyCounts,
        exceptions: emptyExceptions,
        alerts_opened: 0,
        inbox_url: `/operacional/mudancas?run=${body.run_id}`,
      }
      await supabaseAdmin
        .from('op_runs')
        .update({ response })
        .eq('source_id', source.id)
        .eq('run_id', body.run_id)
        .eq('sheet_name', sheetName)
      return jsonResponse(response)
    }

    // Hash mudou (ou é a primeira leitura desta aba) - guarda o snapshot bruto
    // SEMPRE, interpretado ou não (Regra de Ouro 3: nunca descarta).
    await supabaseAdmin.from('op_snapshots').insert({
      source_id: source.id,
      sheet_name: sheetName,
      sheet_hash: body.sheet.hash,
      run_id: body.run_id,
      rows: body.sheet.rows,
    })

    const interpreter = getInterpreter(source.profile, sheetName)
    const listInterpreter = getListInterpreter(source.profile, sheetName)

    let status: string
    let counts = emptyCounts
    let exceptionCounts = emptyExceptions
    let alertsOpened = 0

    if (listInterpreter) {
      // Lista de referência (ex. categorias) - vai para op_lists, não entra
      // no diff de op_records/op_changes.
      const { listKey, items } = listInterpreter(body.sheet.rows)
      await supabaseAdmin
        .from('op_lists')
        .upsert({ source_id: source.id, list_key: listKey, items, updated_at: new Date().toISOString() }, { onConflict: 'source_id,list_key' })
      status = 'processada'
    } else if (!interpreter) {
      status = 'nao_interpretada'
    } else {
      const context: InterpreterContext = { sheetName, fileModifiedAt: body.file.modified_at }
      const result = interpreter(body.sheet.rows, body.sheet.first_row_number, context)

      const { data: applyCounts, error: applyError } = await supabaseAdmin.rpc('op_apply_interpreted_rows', {
        p_source_id: source.id,
        p_run_id: body.run_id,
        p_sheet_key: result.sheetKey,
        p_rows: result.rows,
        p_skip_ausente_check: result.rejectedCount > 0,
      })

      if (applyError) {
        return jsonResponse({ error: applyError.message }, 500)
      }

      const { data: excCounts, error: excError } = await supabaseAdmin.rpc('op_reconcile_exceptions', {
        p_source_id: source.id,
        p_run_id: body.run_id,
        p_sheet_name: sheetName,
        p_exceptions: result.exceptions,
      })

      if (excError) {
        return jsonResponse({ error: excError.message }, 500)
      }

      counts = { ...(applyCounts as typeof emptyCounts), rejeitadas: result.rejectedCount }
      exceptionCounts = excCounts as typeof emptyExceptions
      status = 'processada'
      // alertsOpened é preenchido na Fase 6, quando as regras de op_alert_rules
      // passarem a ser avaliadas aqui.
    }

    await supabaseAdmin.from('op_runs').insert({
      source_id: source.id,
      run_id: body.run_id,
      sheet_name: sheetName,
      file_name: body.file.name,
      file_modified_at: body.file.modified_at,
      status,
      counts,
    })

    const response = {
      ok: true,
      run_id: body.run_id,
      sheet: sheetName,
      status,
      counts,
      exceptions: exceptionCounts,
      alerts_opened: alertsOpened,
      inbox_url: `/operacional/mudancas?run=${body.run_id}`,
    }

    await supabaseAdmin
      .from('op_runs')
      .update({ response })
      .eq('source_id', source.id)
      .eq('run_id', body.run_id)
      .eq('sheet_name', sheetName)

    return jsonResponse(response)
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
