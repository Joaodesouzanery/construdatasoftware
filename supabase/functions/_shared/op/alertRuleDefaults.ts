// =============================================
// MÓDULO OPERACIONAL: valores padrão dos limiares de alerta
// =============================================
// Usados pelo orquestrador (evaluateSource.ts) como fallback para qualquer
// regra sem linha em op_alert_rules ainda - assim que o usuário editar algo
// na tela de configuração, o valor do banco passa a vencer. Duplicado de
// propósito do catálogo do frontend (src/utils/operacionalAlertRules.ts) -
// runtimes diferentes (Deno vs. Vite/Node), mesmo princípio de outras
// duplicações deste projeto (ex. cálculo de distância do Ponto Eletrônico).

export type Severidade = "bloqueante" | "confirmacao" | "aviso";

export const ALERT_RULE_DEFAULT_PARAMS: Record<string, Record<string, number>> = {
  he_pendente_de_pagamento: { dias_limite: 7 },
  ausencia_nao_paga: { dias_limite: 7 },
  prazo_sabesp_em_risco: { dias_limite: 2 },
  ocorrencia_aberta_mais_de_7_dias: { dias_limite: 7 },
  documento_vencendo: { dias_limite: 30 },
  glosa_acima_da_meta: { percentual_limite: 2 },
  aderencia_abaixo_da_meta: { percentual_minimo: 90 },
  planilha_desatualizada: { dias_uteis_limite: 2 },
  fonte_sem_leitura: { horas_limite: 12 },
};

export const ALERT_RULE_DEFAULT_SEVERITY: Record<string, Severidade> = {
  saldo_negativo: "confirmacao",
  he_pendente_de_pagamento: "aviso",
  ausencia_nao_paga: "aviso",
  total_nao_confere: "confirmacao",
  formula_divergente: "confirmacao",
  sem_classificacao: "aviso",
  prazo_sabesp_em_risco: "confirmacao",
  servico_vencido: "bloqueante",
  os_sem_evidencia: "confirmacao",
  ocorrencia_aberta_mais_de_7_dias: "aviso",
  documento_vencendo: "aviso",
  glosa_acima_da_meta: "confirmacao",
  aderencia_abaixo_da_meta: "confirmacao",
  planilha_desatualizada: "aviso",
  master_check_erro: "bloqueante",
  funil_ponderado_diverge: "aviso",
  fonte_sem_leitura: "aviso",
};

export interface RuleConfig {
  enabled: boolean;
  severity: Severidade;
  params: Record<string, number>;
}

export type RulesConfig = Record<string, RuleConfig>;

// Monta a config completa (todas as regras conhecidas) a partir das linhas
// de op_alert_rules já cadastradas - qualquer regra sem linha usa o default.
export function construirRulesConfig(linhas: { code: string; enabled: boolean; severity: Severidade; params: Record<string, number> }[]): RulesConfig {
  const config: RulesConfig = {};
  const porCodigo = new Map(linhas.map((l) => [l.code, l]));

  const todosOsCodigos = new Set([...Object.keys(ALERT_RULE_DEFAULT_SEVERITY), ...porCodigo.keys()]);

  for (const code of todosOsCodigos) {
    const linha = porCodigo.get(code);
    const defaultParams = ALERT_RULE_DEFAULT_PARAMS[code] ?? {};
    config[code] = {
      enabled: linha?.enabled ?? true,
      severity: linha?.severity ?? ALERT_RULE_DEFAULT_SEVERITY[code] ?? "aviso",
      params: { ...defaultParams, ...(linha?.params ?? {}) },
    };
  }

  return config;
}
