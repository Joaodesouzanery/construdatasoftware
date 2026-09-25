import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import {
  agruparEmSessoes,
  reconciliarDia,
  CONFIG_CLT_PADRAO,
  type ConfiguracaoCLT,
  type RegistroPonto,
} from '../_shared/pontoCalculation.ts'

interface CalcularBancoHorasRequest {
  funcionario_id: string;
  competencia: string; // "YYYY-MM" ou "YYYY-MM-DD"
}

function ultimoDiaDoMes(ano: number, mesIndex0: number): number {
  return new Date(Date.UTC(ano, mesIndex0 + 1, 0)).getUTCDate()
}

function formatarData(ano: number, mesIndex0: number, dia: number): string {
  const mm = String(mesIndex0 + 1).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return `${ano}-${mm}-${dd}`
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

    // Client escopado ao gestor chamador - todas as leituras/escritas abaixo
    // respeitam a RLS dele (dono de funcionarios/escalas_clt/faltas_funcionarios/
    // banco_horas_mensal), sem necessidade de service role.
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

    const body: CalcularBancoHorasRequest = await req.json()
    if (!body.funcionario_id || !body.competencia) {
      return new Response(
        JSON.stringify({ error: 'funcionario_id e competencia são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [anoStr, mesStr] = body.competencia.split('-')
    const ano = Number(anoStr)
    const mesIndex0 = Number(mesStr) - 1
    if (!ano || mesIndex0 < 0 || mesIndex0 > 11) {
      return new Response(
        JSON.stringify({ error: 'competencia inválida, use o formato YYYY-MM' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const totalDias = ultimoDiaDoMes(ano, mesIndex0)
    const dataInicio = formatarData(ano, mesIndex0, 1)
    const dataFim = formatarData(ano, mesIndex0, totalDias)

    // Funcionário + RLS: só resolve se o gestor chamador for o dono (owns_funcionario)
    const { data: funcionario, error: funcionarioError } = await supabaseClient
      .from('funcionarios')
      .select('id, unidade_id')
      .eq('id', body.funcionario_id)
      .maybeSingle()

    if (funcionarioError || !funcionario) {
      return new Response(
        JSON.stringify({ error: 'Funcionário não encontrado ou sem permissão de acesso' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Configuração CLT (por unidade, com fallback para os valores padrão)
    let config: ConfiguracaoCLT = CONFIG_CLT_PADRAO
    if (funcionario.unidade_id) {
      const { data: configRow } = await supabaseClient
        .from('configuracoes_clt')
        .select('jornada_diaria_padrao, percentual_hora_extra_50, percentual_hora_extra_100, hora_inicio_noturno, hora_fim_noturno')
        .eq('unidade_id', funcionario.unidade_id)
        .maybeSingle()
      if (configRow) {
        config = {
          jornada_diaria_padrao: Number(configRow.jornada_diaria_padrao),
          percentual_hora_extra_50: Number(configRow.percentual_hora_extra_50),
          percentual_hora_extra_100: Number(configRow.percentual_hora_extra_100),
          hora_inicio_noturno: String(configRow.hora_inicio_noturno).slice(0, 5),
          hora_fim_noturno: String(configRow.hora_fim_noturno).slice(0, 5),
        }
      }
    }

    // Escala planejada do mês
    const { data: escalas } = await supabaseClient
      .from('escalas_clt')
      .select('data, horas_normais, is_domingo, is_feriado, is_folga')
      .eq('funcionario_id', body.funcionario_id)
      .gte('data', dataInicio)
      .lte('data', dataFim)

    const escalasPorData = new Map<string, { horas_normais: number; is_domingo: boolean; is_feriado: boolean; is_folga: boolean }>()
    for (const e of escalas ?? []) {
      escalasPorData.set(e.data, {
        horas_normais: Number(e.horas_normais),
        is_domingo: e.is_domingo,
        is_feriado: e.is_feriado,
        is_folga: e.is_folga,
      })
    }

    // Feriados cadastrados (para dias sem escala explícita)
    const { data: feriados } = await supabaseClient
      .from('feriados')
      .select('data')
      .gte('data', dataInicio)
      .lte('data', dataFim)
    const feriadosSet = new Set((feriados ?? []).map((f) => f.data))

    // Registros de ponto do mês, com um dia de folga no fim para capturar a
    // "saida" de uma sessão que começou no último dia do mês e cruzou a meia-noite.
    const dataFimBuffer = new Date(Date.UTC(ano, mesIndex0, totalDias + 1))
    const dataFimBufferStr = dataFimBuffer.toISOString().split('T')[0]

    const { data: registros } = await supabaseClient
      .from('registros_ponto')
      .select('tipo, momento')
      .eq('funcionario_id', body.funcionario_id)
      .gte('momento', `${dataInicio}T00:00:00Z`)
      .lt('momento', `${dataFimBufferStr}T23:59:59Z`)
      .order('momento', { ascending: true })

    const registrosTipados: RegistroPonto[] = (registros ?? []).map((r) => ({
      tipo: r.tipo,
      momento: r.momento,
    }))

    const sessoes = agruparEmSessoes(registrosTipados).filter(
      (s) => s.dataEntrada >= dataInicio && s.dataEntrada <= dataFim
    )
    const sessoesPorData = new Map<string, typeof sessoes>()
    for (const sessao of sessoes) {
      const lista = sessoesPorData.get(sessao.dataEntrada) ?? []
      lista.push(sessao)
      sessoesPorData.set(sessao.dataEntrada, lista)
    }

    // Faltas já registradas no mês (manuais ou de cálculo anterior), para não
    // duplicar e para somar ao total de horas de falta.
    const { data: faltasExistentes } = await supabaseClient
      .from('faltas_funcionarios')
      .select('data, horas_perdidas, origem')
      .eq('funcionario_id', body.funcionario_id)
      .gte('data', dataInicio)
      .lte('data', dataFim)

    const datasComFalta = new Set((faltasExistentes ?? []).map((f) => f.data))
    let horasFaltasTotal = (faltasExistentes ?? []).reduce((soma, f) => soma + Number(f.horas_perdidas ?? 0), 0)

    let horasNormaisTotal = 0
    let horasExtras50Total = 0
    let horasExtras100Total = 0
    let horasNoturnasTotal = 0
    const detalhesDias: unknown[] = []
    const novasFaltas: { data: string; horas_perdidas: number }[] = []
    const hojeStr = new Date().toISOString().split('T')[0]

    for (let dia = 1; dia <= totalDias; dia++) {
      const dataStr = formatarData(ano, mesIndex0, dia)
      const escalaDoDia = escalasPorData.get(dataStr) ?? null
      const isFeriado = escalaDoDia?.is_feriado ?? feriadosSet.has(dataStr)
      const isDomingo = escalaDoDia?.is_domingo ?? new Date(Date.UTC(ano, mesIndex0, dia)).getUTCDay() === 0
      const sessoesDoDia = sessoesPorData.get(dataStr) ?? []

      if (sessoesDoDia.length === 0) {
        const escalaExigePonto = escalaDoDia && !escalaDoDia.is_folga
        if (escalaExigePonto && dataStr <= hojeStr && !datasComFalta.has(dataStr)) {
          novasFaltas.push({ data: dataStr, horas_perdidas: escalaDoDia!.horas_normais })
        }
        continue
      }

      const resultado = reconciliarDia(
        sessoesDoDia,
        escalaDoDia && !escalaDoDia.is_folga ? escalaDoDia.horas_normais : escalaDoDia?.is_folga ? 0 : null,
        isDomingo || isFeriado,
        config
      )

      if (!resultado) continue

      horasNormaisTotal += resultado.horasNormaisPlanejadas
      horasNoturnasTotal += resultado.horasNoturnas
      if (isDomingo || isFeriado) {
        horasExtras100Total += resultado.horasExtras
      } else {
        horasExtras50Total += resultado.horasExtras
      }

      detalhesDias.push(resultado)
    }

    if (novasFaltas.length > 0) {
      const { error: faltasInsertError } = await supabaseClient
        .from('faltas_funcionarios')
        .insert(
          novasFaltas.map((f) => ({
            user_id: user.id,
            funcionario_id: body.funcionario_id,
            data: f.data,
            tipo: 'falta_nao_justificada',
            horas_perdidas: f.horas_perdidas,
            origem: 'ponto_automatico',
          }))
        )
      if (faltasInsertError) {
        console.error('Error inserting auto faltas:', faltasInsertError)
      } else {
        horasFaltasTotal += novasFaltas.reduce((soma, f) => soma + f.horas_perdidas, 0)
      }
    }

    // Saldo do banco de horas: acumula o saldo do mês anterior + extras deste
    // mês - horas de falta. Simplificação de MVP (crédito de extras, débito de
    // faltas) - regras específicas de convenção coletiva ficam para uma
    // refinamento futuro, fora do escopo desta fase.
    const mesAnterior = mesIndex0 === 0 ? 11 : mesIndex0 - 1
    const anoMesAnterior = mesIndex0 === 0 ? ano - 1 : ano
    const competenciaAnterior = formatarData(anoMesAnterior, mesAnterior, 1)

    const { data: bancoAnterior } = await supabaseClient
      .from('banco_horas_mensal')
      .select('saldo_banco_horas_acumulado')
      .eq('funcionario_id', body.funcionario_id)
      .eq('competencia', competenciaAnterior)
      .maybeSingle()

    const saldoAnterior = Number(bancoAnterior?.saldo_banco_horas_acumulado ?? 0)
    const saldoAtual = horasExtras50Total + horasExtras100Total - horasFaltasTotal
    const saldoAcumulado = saldoAnterior + saldoAtual

    const { data: bancoHoras, error: upsertError } = await supabaseClient
      .from('banco_horas_mensal')
      .upsert(
        {
          user_id: user.id,
          funcionario_id: body.funcionario_id,
          competencia: dataInicio,
          horas_normais_total: horasNormaisTotal,
          horas_extras_50_total: horasExtras50Total,
          horas_extras_100_total: horasExtras100Total,
          horas_noturnas_total: horasNoturnasTotal,
          horas_faltas_total: horasFaltasTotal,
          saldo_banco_horas_anterior: saldoAnterior,
          saldo_banco_horas_atual: saldoAtual,
          saldo_banco_horas_acumulado: saldoAcumulado,
          status: 'calculado',
          calculado_em: new Date().toISOString(),
          calculado_por: user.id,
          detalhes: { dias: detalhesDias },
        },
        { onConflict: 'funcionario_id,competencia' }
      )
      .select()
      .single()

    if (upsertError) {
      throw upsertError
    }

    return new Response(
      JSON.stringify({ success: true, banco_horas: bancoHoras }),
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
