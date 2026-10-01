import { describe, it, expect } from "vitest";
import { avaliarAlertasCaixa, avaliarAlertasOperacionalSabesp, avaliarAlertasGestaoEmpresa, avaliarFonteSemLeitura } from "./alerts.ts";
import { construirRulesConfig } from "./alertRuleDefaults.ts";

const AGORA = new Date("2026-07-20T12:00:00Z");
const RULES = construirRulesConfig([]); // todas as regras nos valores padrão

describe("avaliarAlertasCaixa", () => {
  it("sinaliza saldo_negativo quando despesas superam entradas", () => {
    const alertas = avaliarAlertasCaixa(
      {
        registrosDespesa: [
          { natural_key: "ent|1", data: { tipo: "receita", valor: 100 } },
          { natural_key: "desp|1", data: { tipo: "despesa", valor: 500 } },
        ],
        registrosHoraExtra: [],
        registrosAusencia: [],
        excecoesAbertas: [],
      },
      RULES,
      AGORA
    );
    expect(alertas.some((a) => a.rule_code === "saldo_negativo")).toBe(true);
  });

  it("não sinaliza saldo_negativo quando o saldo é positivo", () => {
    const alertas = avaliarAlertasCaixa(
      {
        registrosDespesa: [
          { natural_key: "ent|1", data: { tipo: "receita", valor: 500 } },
          { natural_key: "desp|1", data: { tipo: "despesa", valor: 100 } },
        ],
        registrosHoraExtra: [],
        registrosAusencia: [],
        excecoesAbertas: [],
      },
      RULES,
      AGORA
    );
    expect(alertas.some((a) => a.rule_code === "saldo_negativo")).toBe(false);
  });

  it("sinaliza he_pendente_de_pagamento só quando não pago há mais do limite padrão (7 dias)", () => {
    const alertas = avaliarAlertasCaixa(
      {
        registrosDespesa: [],
        registrosHoraExtra: [
          { natural_key: "he|joao|2026-07-01", data: { nome: "João", data: "2026-07-01", pago: false } },
          { natural_key: "he|maria|2026-07-18", data: { nome: "Maria", data: "2026-07-18", pago: false } },
          { natural_key: "he|pedro|2026-07-01", data: { nome: "Pedro", data: "2026-07-01", pago: true } },
        ],
        registrosAusencia: [],
        excecoesAbertas: [],
      },
      RULES,
      AGORA
    );
    const subjects = alertas.filter((a) => a.rule_code === "he_pendente_de_pagamento").map((a) => a.subject_key);
    expect(subjects).toEqual(["he|joao|2026-07-01"]);
  });

  it("respeita um limiar customizado (ex. 3 dias em vez do padrão 7)", () => {
    const rulesCustom = construirRulesConfig([{ code: "he_pendente_de_pagamento", enabled: true, severity: "aviso", params: { dias_limite: 3 } }]);
    const alertas = avaliarAlertasCaixa(
      {
        registrosDespesa: [],
        registrosHoraExtra: [{ natural_key: "he|maria|2026-07-18", data: { nome: "Maria", data: "2026-07-18", pago: false } }],
        registrosAusencia: [],
        excecoesAbertas: [],
      },
      rulesCustom,
      AGORA
    );
    // 2026-07-18 -> 2026-07-20T12:00 = 2.5 dias: não passa do limite padrão (7) mas passa do customizado (3)
    expect(alertas.some((a) => a.rule_code === "he_pendente_de_pagamento")).toBe(false);
  });

  it("traduz exceções abertas conhecidas em alertas", () => {
    const alertas = avaliarAlertasCaixa(
      {
        registrosDespesa: [],
        registrosHoraExtra: [],
        registrosAusencia: [],
        excecoesAbertas: [{ row_number: 10, type: "total_nao_confere", sheet_name: "DESPESAS" }],
      },
      RULES,
      AGORA
    );
    expect(alertas.some((a) => a.rule_code === "total_nao_confere" && a.subject_key === "DESPESAS-10")).toBe(true);
  });
});

describe("avaliarAlertasOperacionalSabesp", () => {
  const base = { chamados: [], ordensServico: [], ocorrencias: [], pessoas: [], medicoes: [], programacoes: [], ultimaDataNaPlanilha: null };

  it("sinaliza servico_vencido para chamado com data_limite no passado", () => {
    const alertas = avaliarAlertasOperacionalSabesp({ ...base, chamados: [{ natural_key: "BER-1", data: { status: "Aberto", data_limite: "2026-07-01" } }] }, RULES, AGORA);
    expect(alertas.some((a) => a.rule_code === "servico_vencido")).toBe(true);
  });

  it("sinaliza prazo_sabesp_em_risco para chamado vencendo em até 2 dias (padrão)", () => {
    const alertas = avaliarAlertasOperacionalSabesp({ ...base, chamados: [{ natural_key: "BER-2", data: { status: "Aberto", data_limite: "2026-07-21" } }] }, RULES, AGORA);
    expect(alertas.some((a) => a.rule_code === "prazo_sabesp_em_risco")).toBe(true);
  });

  it("não sinaliza nada para chamado concluído, mesmo vencido", () => {
    const alertas = avaliarAlertasOperacionalSabesp({ ...base, chamados: [{ natural_key: "BER-3", data: { status: "Concluído", data_limite: "2026-01-01" } }] }, RULES, AGORA);
    expect(alertas).toHaveLength(0);
  });

  it("sinaliza glosa_acima_da_meta quando a glosa passa do limite padrão (2%)", () => {
    const alertas = avaliarAlertasOperacionalSabesp({ ...base, medicoes: [{ natural_key: "m1", data: { valor: 1000, valor_glosado: 50 } }] }, RULES, AGORA);
    expect(alertas.some((a) => a.rule_code === "glosa_acima_da_meta")).toBe(true);
  });

  it("não sinaliza glosa_acima_da_meta quando a glosa está dentro da meta", () => {
    const alertas = avaliarAlertasOperacionalSabesp({ ...base, medicoes: [{ natural_key: "m1", data: { valor: 1000, valor_glosado: 10 } }] }, RULES, AGORA);
    expect(alertas.some((a) => a.rule_code === "glosa_acima_da_meta")).toBe(false);
  });

  it("respeita um limite de glosa customizado (ex. 10% em vez do padrão 2%)", () => {
    const rulesCustom = construirRulesConfig([{ code: "glosa_acima_da_meta", enabled: true, severity: "confirmacao", params: { percentual_limite: 10 } }]);
    const alertas = avaliarAlertasOperacionalSabesp({ ...base, medicoes: [{ natural_key: "m1", data: { valor: 1000, valor_glosado: 50 } }] }, rulesCustom, AGORA);
    expect(alertas.some((a) => a.rule_code === "glosa_acima_da_meta")).toBe(false);
  });

  it("sinaliza aderencia_abaixo_da_meta quando menos de 90% executou", () => {
    const programacoes = [
      { natural_key: "p1", data: { executou: "Sim" } },
      { natural_key: "p2", data: { executou: "Não" } },
    ];
    const alertas = avaliarAlertasOperacionalSabesp({ ...base, programacoes }, RULES, AGORA);
    expect(alertas.some((a) => a.rule_code === "aderencia_abaixo_da_meta")).toBe(true);
  });

  it("documento_vencendo só considera pessoas ativas", () => {
    const pessoas = [
      { natural_key: "M1", data: { nome: "Ana", ativo: "Sim", aso: "2026-07-25" } },
      { natural_key: "M2", data: { nome: "Beto", ativo: "Não", aso: "2026-07-25" } },
    ];
    const alertas = avaliarAlertasOperacionalSabesp({ ...base, pessoas }, RULES, AGORA);
    expect(alertas.filter((a) => a.rule_code === "documento_vencendo")).toHaveLength(1);
  });
});

describe("avaliarAlertasGestaoEmpresa", () => {
  it("sinaliza master_check_erro só quando o master check é ERRO", () => {
    expect(avaliarAlertasGestaoEmpresa({ masterCheck: "ERRO", excecoesFunilAbertas: [] }, RULES).some((a) => a.rule_code === "master_check_erro")).toBe(true);
    expect(avaliarAlertasGestaoEmpresa({ masterCheck: "PENDENTE", excecoesFunilAbertas: [] }, RULES).some((a) => a.rule_code === "master_check_erro")).toBe(false);
  });
});

describe("avaliarFonteSemLeitura", () => {
  it("sinaliza quando nunca foi lida", () => {
    expect(avaliarFonteSemLeitura(null, RULES, AGORA)).toHaveLength(1);
  });

  it("sinaliza quando a última leitura passou do limite padrão (12h)", () => {
    const alertas = avaliarFonteSemLeitura("2026-07-19T00:00:00Z", RULES, AGORA);
    expect(alertas).toHaveLength(1);
  });

  it("não sinaliza dentro das 12h", () => {
    const alertas = avaliarFonteSemLeitura("2026-07-20T06:00:00Z", RULES, AGORA);
    expect(alertas).toHaveLength(0);
  });

  it("respeita um limite customizado (ex. 2h em vez do padrão 12h)", () => {
    const rulesCustom = construirRulesConfig([{ code: "fonte_sem_leitura", enabled: true, severity: "aviso", params: { horas_limite: 2 } }]);
    const alertas = avaliarFonteSemLeitura("2026-07-20T06:00:00Z", rulesCustom, AGORA);
    expect(alertas).toHaveLength(1);
  });
});
