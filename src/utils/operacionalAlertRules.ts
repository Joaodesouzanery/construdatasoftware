// Catálogo das regras de alerta do módulo Operacional, para a tela de
// configuração (src/components/operacional/ConfiguracaoAlertas.tsx).
// Duplicado de propósito do equivalente em
// supabase/functions/_shared/op/alertRuleDefaults.ts (runtimes diferentes) -
// os valores default aqui têm que bater com os de lá.

export type Severidade = "bloqueante" | "confirmacao" | "aviso";

export interface ParamDef {
  key: string;
  label: string;
  default: number;
  sufixo?: string;
}

export interface AlertRuleDef {
  code: string;
  label: string;
  perfil: "caixa" | "operacional_sabesp" | "gestao_empresa" | "geral";
  severidadePadrao: Severidade;
  params: ParamDef[];
}

export const ALERT_RULES: AlertRuleDef[] = [
  { code: "saldo_negativo", label: "Saldo de caixa negativo", perfil: "caixa", severidadePadrao: "confirmacao", params: [] },
  {
    code: "he_pendente_de_pagamento",
    label: "Hora extra pendente de pagamento",
    perfil: "caixa",
    severidadePadrao: "aviso",
    params: [{ key: "dias_limite", label: "Dias sem pagamento", default: 7, sufixo: "dias" }],
  },
  {
    code: "ausencia_nao_paga",
    label: "Ausência não paga",
    perfil: "caixa",
    severidadePadrao: "aviso",
    params: [{ key: "dias_limite", label: "Dias sem pagamento", default: 7, sufixo: "dias" }],
  },
  { code: "total_nao_confere", label: "Total de DESPESAS não confere com a planilha", perfil: "caixa", severidadePadrao: "confirmacao", params: [] },
  { code: "formula_divergente", label: "Fórmula diverge da planilha", perfil: "caixa", severidadePadrao: "confirmacao", params: [] },
  { code: "sem_classificacao", label: "Despesa sem classificação", perfil: "caixa", severidadePadrao: "aviso", params: [] },
  {
    code: "prazo_sabesp_em_risco",
    label: "Prazo Sabesp em risco",
    perfil: "operacional_sabesp",
    severidadePadrao: "confirmacao",
    params: [{ key: "dias_limite", label: "Dias de antecedência", default: 2, sufixo: "dias" }],
  },
  { code: "servico_vencido", label: "Serviço vencido", perfil: "operacional_sabesp", severidadePadrao: "bloqueante", params: [] },
  { code: "os_sem_evidencia", label: "OS concluída sem evidência", perfil: "operacional_sabesp", severidadePadrao: "confirmacao", params: [] },
  {
    code: "ocorrencia_aberta_mais_de_7_dias",
    label: "Ocorrência aberta há muito tempo",
    perfil: "operacional_sabesp",
    severidadePadrao: "aviso",
    params: [{ key: "dias_limite", label: "Dias em aberto", default: 7, sufixo: "dias" }],
  },
  {
    code: "documento_vencendo",
    label: "Documento de pessoa vencendo",
    perfil: "operacional_sabesp",
    severidadePadrao: "aviso",
    params: [{ key: "dias_limite", label: "Dias de antecedência", default: 30, sufixo: "dias" }],
  },
  {
    code: "glosa_acima_da_meta",
    label: "Glosa acima da meta",
    perfil: "operacional_sabesp",
    severidadePadrao: "confirmacao",
    params: [{ key: "percentual_limite", label: "Limite de glosa", default: 2, sufixo: "%" }],
  },
  {
    code: "aderencia_abaixo_da_meta",
    label: "Aderência da programação abaixo da meta",
    perfil: "operacional_sabesp",
    severidadePadrao: "confirmacao",
    params: [{ key: "percentual_minimo", label: "Aderência mínima", default: 90, sufixo: "%" }],
  },
  {
    code: "planilha_desatualizada",
    label: "Planilha sem data nova",
    perfil: "operacional_sabesp",
    severidadePadrao: "aviso",
    params: [{ key: "dias_uteis_limite", label: "Dias úteis sem atualização", default: 2, sufixo: "dias úteis" }],
  },
  { code: "master_check_erro", label: "Master Check em erro", perfil: "gestao_empresa", severidadePadrao: "bloqueante", params: [] },
  { code: "funil_ponderado_diverge", label: "Funil: valor ponderado divergente", perfil: "gestao_empresa", severidadePadrao: "aviso", params: [] },
  {
    code: "fonte_sem_leitura",
    label: "Fonte sem leitura da automação",
    perfil: "geral",
    severidadePadrao: "aviso",
    params: [{ key: "horas_limite", label: "Horas sem leitura", default: 12, sufixo: "horas" }],
  },
];

export const PERFIL_LABEL: Record<AlertRuleDef["perfil"], string> = {
  caixa: "Caixa",
  operacional_sabesp: "Operacional Sabesp",
  gestao_empresa: "Gestão da Empresa",
  geral: "Geral",
};
