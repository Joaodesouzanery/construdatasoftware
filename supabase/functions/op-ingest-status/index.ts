import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { autenticarFonte, normalizarToken } from '../_shared/op/ingestAuth.ts'

// =============================================
// MÓDULO OPERACIONAL: status de ingestão (GET, mesma autenticação por token)
// =============================================
// Permite ao n8n (ou a um monitor externo) perguntar "o que você já processou
// desta fonte" sem precisar reenviar nada.

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

    const rawToken = req.headers.get('x-ingest-token')
    if (!normalizarToken(rawToken)) {
      return jsonResponse({ error: 'Header x-ingest-token é obrigatório' }, 401)
    }

    const auth = await autenticarFonte<{ id: string; active: boolean; last_checked_at: string | null; last_file_modified_at: string | null }>(
      supabaseAdmin,
      rawToken,
      'id, active, last_checked_at, last_file_modified_at',
      'op-ingest-status'
    )
    if (!auth.ok) {
      return jsonResponse({ error: 'Token inválido ou fonte inativa' }, 403)
    }
    const source = auth.source


    const { data: sheets } = await supabaseAdmin
      .from('op_snapshots')
      .select('sheet_name, sheet_hash, received_at')
      .eq('source_id', source.id)
      .order('received_at', { ascending: false })

    // Mantém só a leitura mais recente de cada aba.
    const latestBySheet = new Map<string, { name: string; hash: string; received_at: string }>()
    for (const row of sheets ?? []) {
      if (!latestBySheet.has(row.sheet_name)) {
        latestBySheet.set(row.sheet_name, { name: row.sheet_name, hash: row.sheet_hash, received_at: row.received_at })
      }
    }

    return jsonResponse({
      last_check_at: source.last_checked_at,
      file_modified_at: source.last_file_modified_at,
      sheets: Array.from(latestBySheet.values()),
    })
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
