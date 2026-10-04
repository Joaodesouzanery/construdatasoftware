import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Autenticação por token de fonte (header x-ingest-token), compartilhada por
// op-ingest-sheet e op-ingest-status. O token NUNCA é logado; só um prefixo
// curto do hash, para correlacionar linhas de log.

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Tokens gerados pela tela Fontes são 64 caracteres hex minúsculos. Colagens
// manuais (n8n, credenciais) costumam trazer espaço, quebra de linha, NBSP,
// caractere invisível, aspas ou o prefixo "Bearer " - tudo isso muda o hash.
// Normalizamos para o mesmo formato que a tela Fontes usou ao gerar o hash.
export function normalizarToken(raw: string | null): string | null {
  if (!raw) return null
  let t = raw.replace(/[\s\u00A0\u200B-\u200D\uFEFF]/g, '')
  t = t.replace(/^bearer/i, '')
  t = t.replace(/^["'`]+|["'`]+$/g, '')
  if (/^[0-9a-fA-F]+$/.test(t)) t = t.toLowerCase()
  return t || null
}

// Mesma sujeira de colagem manual que afeta token também afeta o ID do
// Google Drive colado em "Nova/Editar Fonte" - um TAB ou espaço invisível no
// fim faz `source.drive_file_id !== body.file.drive_file_id` nunca bater,
// mesmo com o ID "certo" nos dois lados.
export function normalizarDriveFileId(raw: string): string {
  let t = raw.replace(/[\s ​-‍﻿]/g, '')
  // Aceita o ID colado como URL completa do Drive, não só o ID puro.
  const matchCaminho = t.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (matchCaminho) return matchCaminho[1]
  const matchQuery = t.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (matchQuery) return matchQuery[1]
  return t
}

type Motivo = 'fonte_nao_encontrada' | 'fonte_inativa' | 'hash_divergente' | 'erro_consulta'

export interface AuthOk<T> {
  ok: true
  source: T
  hashPrefix: string
}
export interface AuthFail {
  ok: false
  motivo: Motivo
  hashPrefix: string
}

export async function autenticarFonte<T extends { id: string; active: boolean }>(
  admin: SupabaseClient,
  rawToken: string | null,
  columns: string,
  fn: string,
  driveFileIdHint?: string | null
): Promise<AuthOk<T> | AuthFail> {
  const token = normalizarToken(rawToken)!
  const tokenHash = await sha256Hex(token)
  const hashPrefix = tokenHash.slice(0, 8)
  const rawLen = rawToken?.length ?? 0
  const meta = `hash_prefix=${hashPrefix} token_len=${token.length} raw_len=${rawLen} formato_hex64=${/^[0-9a-f]{64}$/.test(token)}`

  const { data: source, error } = await admin
    .from('op_sources')
    .select(columns)
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    console.error(`${fn}: 403 motivo=erro_consulta ${meta}`, error.message)
    return { ok: false, motivo: 'erro_consulta', hashPrefix }
  }

  if (!source) {
    // Distingue "hash divergente" (existe a fonte desse arquivo, mas o hash
    // guardado é de outro token) de "fonte não encontrada".
    let motivo: Motivo = 'fonte_nao_encontrada'
    let extra = ''
    if (driveFileIdHint) {
      const { data: porArquivo } = await admin
        .from('op_sources')
        .select('id, active, token_hash')
        .eq('drive_file_id', driveFileIdHint)
      if (porArquivo && porArquivo.length > 0) {
        motivo = 'hash_divergente'
        extra = ` fontes_do_arquivo=${porArquivo
          .map((s: { id: string; active: boolean; token_hash: string }) => `${s.id}(active=${s.active},hash_salvo_prefix=${String(s.token_hash).slice(0, 8)})`)
          .join(',')}`
      }
    } else {
      const { count } = await admin.from('op_sources').select('id', { count: 'exact', head: true })
      motivo = count && count > 0 ? 'hash_divergente' : 'fonte_nao_encontrada'
      extra = ` total_fontes_cadastradas=${count ?? 0}`
    }
    console.warn(`${fn}: 403 motivo=${motivo} ${meta}${extra} - o token enviado não é o último gerado na tela Fontes (gere novo e copie pelo botão)`)
    return { ok: false, motivo, hashPrefix }
  }

  const src = source as unknown as T
  if (!src.active) {
    console.warn(`${fn}: 403 motivo=fonte_inativa fonte=${src.id} ${meta}`)
    return { ok: false, motivo: 'fonte_inativa', hashPrefix }
  }

  console.log(`${fn}: token aceito fonte=${src.id} ${meta}`)
  return { ok: true, source: src, hashPrefix }
}
