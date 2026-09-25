import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface RegistrarPontoRequest {
  funcionario_id: string;
  tipo: 'entrada' | 'inicio_intervalo' | 'fim_intervalo' | 'saida';
  latitude: number;
  longitude: number;
  precisao_metros?: number;
  device_timestamp?: string;
}

const TIPOS_VALIDOS = ['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'];

function calcularDistanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function validateInput(body: RegistrarPontoRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body.funcionario_id || typeof body.funcionario_id !== 'string') {
    errors.push('funcionario_id é obrigatório');
  }
  if (!body.tipo || !TIPOS_VALIDOS.includes(body.tipo)) {
    errors.push('tipo inválido');
  }
  if (typeof body.latitude !== 'number' || body.latitude < -90 || body.latitude > 90) {
    errors.push('latitude inválida');
  }
  if (typeof body.longitude !== 'number' || body.longitude < -180 || body.longitude > 180) {
    errors.push('longitude inválida');
  }

  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Client escopado ao próprio funcionário - todas as leituras/escrita abaixo
    // respeitam a RLS dele, sem service role.
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: RegistrarPontoRequest = await req.json()
    const validation = validateInput(body)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.errors.join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Confirma que o chamador é de fato o funcionário informado. A RLS de
    // funcionarios já garante isso na leitura (só devolve linha se
    // auth_user_id = auth.uid()), esta checagem só devolve um erro claro em
    // vez de uma linha vazia.
    const { data: funcionario, error: funcionarioError } = await supabaseClient
      .from('funcionarios')
      .select('id, ativo')
      .eq('id', body.funcionario_id)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (funcionarioError || !funcionario) {
      return new Response(
        JSON.stringify({ error: 'Funcionário não encontrado para este login' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!funcionario.ativo) {
      return new Response(
        JSON.stringify({ error: 'Funcionário inativo não pode bater ponto' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Pré-checagem amigável, NÃO autoritativa: só evita uma viagem redonda para
    // um erro óbvio de fora do raio. A decisão real acontece no trigger do banco.
    const hoje = new Date().toISOString().split('T')[0]
    const { data: locaisAtribuidos } = await supabaseClient
      .from('funcionario_locais_ponto')
      .select('local_ponto_id, locais_ponto(latitude, longitude, raio_metros, ativo)')
      .eq('funcionario_id', body.funcionario_id)
      .lte('data_inicio', hoje)
      .or(`data_fim.is.null,data_fim.gte.${hoje}`)

    if (locaisAtribuidos && locaisAtribuidos.length > 0) {
      const distancias = locaisAtribuidos
        .map((l: any) => l.locais_ponto)
        .filter((lp: any) => lp && lp.ativo)
        .map((lp: any) => ({
          distancia: calcularDistanciaMetros(body.latitude, body.longitude, lp.latitude, lp.longitude),
          raio: lp.raio_metros as number,
        }))

      const dentroDeAlgum = distancias.some((d) => d.distancia <= d.raio)
      if (distancias.length > 0 && !dentroDeAlgum) {
        const maisProximo = distancias.sort((a, b) => a.distancia - b.distancia)[0]
        return new Response(
          JSON.stringify({
            error: `Você está a ${Math.round(maisProximo.distancia)} metros do local de ponto mais próximo, fora do raio permitido (${maisProximo.raio}m).`,
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const userAgent = req.headers.get('user-agent') ?? null

    // Validação definitiva (sequência + geofence) acontece no trigger
    // validar_registro_ponto no banco - não pode ser burlada por este endpoint.
    const { data: registro, error: insertError } = await supabaseClient
      .from('registros_ponto')
      .insert({
        funcionario_id: body.funcionario_id,
        tipo: body.tipo,
        latitude: body.latitude,
        longitude: body.longitude,
        precisao_metros: body.precisao_metros ?? null,
        device_timestamp: body.device_timestamp ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
        origem: 'app',
      })
      .select()
      .single()

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, registro }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
