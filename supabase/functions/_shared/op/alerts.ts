// =============================================
// MÓDULO OPERACIONAL: Fase 6 - regras de alerta
// =============================================
// Funções puras (sem banco, sem rede) que recebem dados JÁ BUSCADOS pelo
// orquestrador (op-ingest-sheet) e devolvem os alertas que DEVERIAM estar
// abertos agora. A aplicação (abrir o que é novo, fechar o que não se repetiu)
// é feita atomicamente por op_reconcile_alerts (SQL) - mesma arquitetura do
// motor de diff da Fase 1.
//
// Limitação conhecida: os limiares abaixo (>2% de glosa, <90% de aderência,
// >7 dias, >30 dias, >12h, >2 dias úteis) são fixos no código. A tabela
// op_alert_rules já existe (Fase 1) para no futuro guardar enabled/params por
// organização e regra, mas esta fase não a consulta ainda - é a extensão
// natural caso os limiares precisem variar por cliente/contrato.

export interface AlertaCandidato {
  rule_code: string;
  severity: "bloqueante" | "confirmacao" | "aviso";
  message: string;
  subject_key: string;
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

// Sempre em UTC, nunca no fuso local do processo - estas funções correm numa
// edge function (Deno, tipicamente UTC) mas também em testes locais, que
// podem rodar em qualquer fuso; usar hora local faria o resultado variar
// conforme a máquina.
function diasDesde(dataStr: string, agora: Date): number | null {
  const data = new Date(`${dataStr}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return null;
  return (agora.getTime() - data.getTime()) / UM_DIA_MS;
}

function diasAte(dataStr: string, agora: Date): number | null {
  const dias = diasDesde(dataStr, agora);
  return dias === null ? null : -dias;
}

// --------------------------------------------------------------------------
// Perfil caixa
// --------------------------------------------------------------------------
export function avaliarAlertasCaixa(
  params: {
    registrosDespesa: { natural_key: string; data: Record<string, any> }[];
    registrosHoraExtra: { natural_key: string; data: Record<string, any> }[];
    registrosAusencia: { natural_key: string; data: Record<string, any> }[];
    excecoesAbertas: { row_number: number; type: string; sheet_name: string }[];
  },
  agora: Date = new Date()
): AlertaCandidato[] {
  const alertas: AlertaCandidato[] = [];

  const totalEntradas = params.registrosDespesa.filter((d) => d.data.tipo === "receita").reduce((s, d) => s + Number(d.data.valor || 0), 0);
  const totalDespesas = params.registrosDespesa.filter((d) => d.data.tipo === "despesa").reduce((s, d) => s + Number(d.data.valor || 0), 0);
  const saldo = totalEntradas - totalDespesas;
  if (saldo < 0) {
    alertas.push({ rule_code: "saldo_negativo", severity: "confirmacao", message: `Saldo de caixa negativo: ${saldo.toFixed(2)}`, subject_key: "saldo_caixa" });
  }

  for (const he of params.registrosHoraExtra) {
    if (he.data.pago) continue;
    const dias = diasDesde(he.data.data, agora);
    if (dias !== null && dias > 7) {
      alertas.push({
        rule_code: "he_pendente_de_pagamento",
        severity: "aviso",
        message: `Hora extra de ${he.data.nome} em ${he.data.data} pendente de pagamento há mais de 7 dias`,
        subject_key: he.natural_key,
      });
    }
  }

  for (const aus of params.registrosAusencia) {
    if (aus.data.pago) continue;
    const dias = diasDesde(aus.data.dia, agora);
    if (dias !== null && dias > 7) {
      alertas.push({
        rule_code: "ausencia_nao_paga",
        severity: "aviso",
        message: `Ausência de ${aus.data.colaborador} em ${aus.data.dia} ainda não paga`,
        subject_key: aus.natural_key,
      });
    }
  }

  const RULE_BY_EXCEPTION_TYPE: Record<string, { rule_code: string; severity: AlertaCandidato["severity"]; message: string }> = {
    total_nao_confere: { rule_code: "total_nao_confere", severity: "confirmacao", message: "Total de DESPESAS não confere com a planilha" },
    formula_divergente: { rule_code: "formula_divergente", severity: "confirmacao", message: "Fórmula de ausência/hora extra diverge da planilha" },
    sem_classificacao: { rule_code: "sem_classificacao", severity: "aviso", message: "Despesa sem classificação" },
  };

  for (const exc of params.excecoesAbertas) {
    const regra = RULE_BY_EXCEPTION_TYPE[exc.type];
    if (regra) alertas.push({ ...regra, subject_key: `${exc.sheet_name}-${exc.row_number}` });
  }

  return alertas;
}

// --------------------------------------------------------------------------
// Perfil operacional_sabesp
// --------------------------------------------------------------------------
export function avaliarAlertasOperacionalSabesp(
  params: {
    chamados: { natural_key: string; data: Record<string, any> }[];
    ordensServico: { natural_key: string; data: Record<string, any> }[];
    ocorrencias: { natural_key: string; data: Record<string, any> }[];
    pessoas: { natural_key: string; data: Record<string, any> }[];
    medicoes: { natural_key: string; data: Record<string, any> }[];
    programacoes: { natural_key: string; data: Record<string, any> }[];
    ultimaDataNaPlanilha: string | null;
  },
  agora: Date = new Date()
): AlertaCandidato[] {
  const alertas: AlertaCandidato[] = [];
  const DOCUMENTOS_CAMPOS = ["aso", "nr_06", "nr_10", "nr_18", "nr_33", "nr_35", "cnh"];

  for (const c of params.chamados) {
    const status = String(c.data.status ?? "").toUpperCase();
    const concluido = status.includes("CONCLU") || status.includes("FECHAD");
    if (concluido || !c.data.data_limite) continue;
    const diasRestantes = diasAte(String(c.data.data_limite), agora);
    if (diasRestantes === null) continue;
    if (diasRestantes < 0) {
      alertas.push({ rule_code: "servico_vencido", severity: "bloqueante", message: `Chamado "${c.natural_key}" venceu em ${c.data.data_limite}`, subject_key: c.natural_key });
    } else if (diasRestantes <= 2) {
      alertas.push({ rule_code: "prazo_sabesp_em_risco", severity: "confirmacao", message: `Chamado "${c.natural_key}" vence em ${c.data.data_limite}`, subject_key: c.natural_key });
    }
  }

  for (const os of params.ordensServico) {
    if (os.data.sem_evidencia) {
      alertas.push({ rule_code: "os_sem_evidencia", severity: "confirmacao", message: `OS "${os.natural_key}" concluída sem evidência completa`, subject_key: os.natural_key });
    }
  }

  for (const o of params.ocorrencias) {
    const status = String(o.data.status ?? "").toUpperCase();
    if (!status.includes("ABERT") || !o.data.data) continue;
    const dias = diasDesde(String(o.data.data), agora);
    if (dias !== null && dias > 7) {
      alertas.push({ rule_code: "ocorrencia_aberta_mais_de_7_dias", severity: "aviso", message: `Ocorrência "${o.natural_key}" aberta há mais de 7 dias`, subject_key: o.natural_key });
    }
  }

  for (const p of params.pessoas) {
    const ativo = String(p.data.ativo ?? "").toUpperCase().startsWith("S");
    if (!ativo) continue;
    for (const campo of DOCUMENTOS_CAMPOS) {
      const valor = p.data[campo];
      if (!valor) continue;
      const dias = diasAte(String(valor), agora);
      if (dias !== null && dias <= 30) {
        alertas.push({
          rule_code: "documento_vencendo",
          severity: "aviso",
          message: `Documento "${campo}" de "${p.data.nome ?? p.natural_key}" vence em ${valor}`,
          subject_key: `${p.natural_key}-${campo}`,
        });
      }
    }
  }

  const apresentado = params.medicoes.reduce((s, m) => s + Number(m.data.valor || 0), 0);
  const glosado = params.medicoes.reduce((s, m) => s + Number(m.data.valor_glosado || 0), 0);
  if (apresentado > 0 && (glosado / apresentado) * 100 > 2) {
    alertas.push({
      rule_code: "glosa_acima_da_meta",
      severity: "confirmacao",
      message: `Glosa em ${((glosado / apresentado) * 100).toFixed(1)}% da medição, acima da meta de 2%`,
      subject_key: "glosa_geral",
    });
  }

  if (params.programacoes.length > 0) {
    const executados = params.programacoes.filter((p) => String(p.data.executou ?? "").toUpperCase().startsWith("S")).length;
    const aderencia = (executados / params.programacoes.length) * 100;
    if (aderencia < 90) {
      alertas.push({
        rule_code: "aderencia_abaixo_da_meta",
        severity: "confirmacao",
        message: `Aderência da programação em ${aderencia.toFixed(1)}%, abaixo da meta de 90%`,
        subject_key: "aderencia_geral",
      });
    }
  }

  if (params.ultimaDataNaPlanilha) {
    const diasUteis = diasUteisEntre(new Date(`${params.ultimaDataNaPlanilha}T00:00:00Z`), agora);
    if (diasUteis > 2) {
      alertas.push({
        rule_code: "planilha_desatualizada",
        severity: "aviso",
        message: `Nenhuma data nova na planilha há ${diasUteis} dias úteis (última: ${params.ultimaDataNaPlanilha})`,
        subject_key: "planilha_desatualizada",
      });
    }
  }

  return alertas;
}

function diasUteisEntre(de: Date, ate: Date): number {
  let dias = 0;
  const cursor = new Date(de);
  while (cursor < ate) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const diaSemana = cursor.getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias++;
  }
  return dias;
}

// --------------------------------------------------------------------------
// Perfil gestao_empresa
// --------------------------------------------------------------------------
export function avaliarAlertasGestaoEmpresa(params: {
  masterCheck: string | null;
  excecoesFunilAbertas: { row_number: number }[];
}): AlertaCandidato[] {
  const alertas: AlertaCandidato[] = [];

  if (params.masterCheck === "ERRO") {
    alertas.push({ rule_code: "master_check_erro", severity: "bloqueante", message: "MASTER CHECK dos indicadores virou ERRO", subject_key: "master_check" });
  }

  for (const exc of params.excecoesFunilAbertas) {
    alertas.push({
      rule_code: "funil_ponderado_diverge",
      severity: "aviso",
      message: `Oportunidade na linha ${exc.row_number} tem valor ponderado divergente`,
      subject_key: `linha-${exc.row_number}`,
    });
  }

  return alertas;
}

// --------------------------------------------------------------------------
// Geral (qualquer perfil)
// --------------------------------------------------------------------------
export function avaliarFonteSemLeitura(ultimaVerificacao: string | null, agora: Date = new Date()): AlertaCandidato[] {
  if (!ultimaVerificacao) return [{ rule_code: "fonte_sem_leitura", severity: "aviso", message: "Esta fonte nunca foi lida pela automação", subject_key: "fonte_sem_leitura" }];
  const horas = (agora.getTime() - new Date(ultimaVerificacao).getTime()) / (60 * 60 * 1000);
  if (horas > 12) {
    return [{ rule_code: "fonte_sem_leitura", severity: "aviso", message: `Sem leitura da automação há ${horas.toFixed(1)}h`, subject_key: "fonte_sem_leitura" }];
  }
  return [];
}
