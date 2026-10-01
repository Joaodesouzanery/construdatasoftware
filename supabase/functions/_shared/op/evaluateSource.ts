// =============================================
// MÓDULO OPERACIONAL: Fase 6 - orquestração de avaliação de alertas
// =============================================
// Busca os dados de UMA fonte (todas as regras aplicáveis ao perfil dela de
// uma vez, nunca parcial - uma reconciliação parcial fecharia por engano
// alertas de regras que não foram reavaliadas nesta chamada), chama os
// avaliadores puros de alerts.ts, e aplica tudo atomicamente via
// op_reconcile_alerts. Usado tanto por op-ingest-sheet (após cada ingestão
// bem-sucedida) quanto por op-evaluate-alerts (checagem manual, pronta para
// um agendamento/cron futuro).

import { avaliarAlertasCaixa, avaliarAlertasOperacionalSabesp, avaliarAlertasGestaoEmpresa, avaliarFonteSemLeitura, type AlertaCandidato } from "./alerts.ts";

export interface FonteParaAvaliar {
  id: string;
  organization_id: string;
  profile: string;
}

// `lastCheckedAtIso` é passado explicitamente (não lido de novo do banco)
// porque, no caminho de ingestão, a leitura mais recente é a desta própria
// chamada - usar o valor já em mãos evita uma corrida com o UPDATE que
// acabou de gravar esse mesmo timestamp.
export async function avaliarEReconciliarAlertasDeFonte(
  supabaseAdmin: any,
  source: FonteParaAvaliar,
  lastCheckedAtIso: string | null
): Promise<number> {
  let candidatos: AlertaCandidato[] = [];

  if (source.profile === "caixa") {
    const [despesas, horasExtras, ausencias, excecoes] = await Promise.all([
      supabaseAdmin.from("op_records").select("natural_key, data").eq("source_id", source.id).eq("sheet_key", "caixa.despesa").eq("status", "ativo"),
      supabaseAdmin.from("op_records").select("natural_key, data").eq("source_id", source.id).eq("sheet_key", "caixa.hora_extra").eq("status", "ativo"),
      supabaseAdmin.from("op_records").select("natural_key, data").eq("source_id", source.id).eq("sheet_key", "caixa.ausencia_ponto").eq("status", "ativo"),
      supabaseAdmin.from("op_exceptions").select("row_number, type, sheet_name").eq("source_id", source.id).eq("status", "aberta"),
    ]);
    candidatos = avaliarAlertasCaixa({
      registrosDespesa: despesas.data ?? [],
      registrosHoraExtra: horasExtras.data ?? [],
      registrosAusencia: ausencias.data ?? [],
      excecoesAbertas: excecoes.data ?? [],
    });
  } else if (source.profile === "operacional_sabesp") {
    const [chamados, ordensServico, ocorrencias, pessoas, medicoes, programacoes] = await Promise.all([
      supabaseAdmin.from("op_records").select("natural_key, data").eq("source_id", source.id).eq("sheet_key", "operacional_sabesp.chamado").eq("status", "ativo"),
      supabaseAdmin.from("op_records").select("natural_key, data").eq("source_id", source.id).eq("sheet_key", "operacional_sabesp.os").eq("status", "ativo"),
      supabaseAdmin.from("op_records").select("natural_key, data").eq("source_id", source.id).eq("sheet_key", "operacional_sabesp.ocorrencia").eq("status", "ativo"),
      supabaseAdmin.from("op_records").select("natural_key, data").eq("source_id", source.id).eq("sheet_key", "operacional_sabesp.pessoa").eq("status", "ativo"),
      supabaseAdmin.from("op_records").select("natural_key, data").eq("source_id", source.id).eq("sheet_key", "operacional_sabesp.medicao_item").eq("status", "ativo"),
      supabaseAdmin.from("op_records").select("natural_key, data").eq("source_id", source.id).eq("sheet_key", "operacional_sabesp.programacao").eq("status", "ativo"),
    ]);

    const datas = (programacoes.data ?? []).map((p: any) => p.data?.data).filter(Boolean).sort();
    const ultimaDataNaPlanilha = datas.length > 0 ? datas[datas.length - 1] : null;

    candidatos = avaliarAlertasOperacionalSabesp({
      chamados: chamados.data ?? [],
      ordensServico: ordensServico.data ?? [],
      ocorrencias: ocorrencias.data ?? [],
      pessoas: pessoas.data ?? [],
      medicoes: medicoes.data ?? [],
      programacoes: programacoes.data ?? [],
      ultimaDataNaPlanilha,
    });
  } else if (source.profile === "gestao_empresa") {
    const [masterCheckRow, excFunil] = await Promise.all([
      supabaseAdmin
        .from("op_records")
        .select("data")
        .eq("source_id", source.id)
        .eq("sheet_key", "gestao_empresa.checks_integridade")
        .eq("natural_key", "_master_check")
        .eq("status", "ativo")
        .maybeSingle(),
      supabaseAdmin.from("op_exceptions").select("row_number").eq("source_id", source.id).eq("type", "funil_ponderado_diverge").eq("status", "aberta"),
    ]);

    candidatos = avaliarAlertasGestaoEmpresa({
      masterCheck: masterCheckRow.data?.data?.master_check ?? null,
      excecoesFunilAbertas: excFunil.data ?? [],
    });
  }

  candidatos = [...candidatos, ...avaliarFonteSemLeitura(lastCheckedAtIso)];

  const { data: abertos } = await supabaseAdmin.rpc("op_reconcile_alerts", {
    p_organization_id: source.organization_id,
    p_source_id: source.id,
    p_alerts: candidatos,
  });

  return (abertos as number) ?? 0;
}
