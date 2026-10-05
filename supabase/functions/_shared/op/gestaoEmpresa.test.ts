import { describe, it, expect } from "vitest";
import {
  interpretarPlacarSemanal,
  interpretarResultadoPorObra,
  interpretarFunilComercial,
  interpretarPonteLucroCaixa,
  interpretarChecksIntegridade,
} from "./gestaoEmpresa.ts";

describe("interpretarPlacarSemanal", () => {
  const rows = [
    ["AVISO — PPC da semana está abaixo da meta"],
    [],
    ["OS NÚMEROS DA SEMANA"],
    ["INDICADOR", "VALOR", "DE ONDE VEM / COMO LER"],
    ["Caixa hoje (empresa toda)", "R$ 38.890,25", "saldo bancário consolidado"],
    ["Devo hoje (vencido, não pago)", "R$ 599.045,26", "contas a pagar vencidas"],
    ["Margem real acumulada", "0,2887", "resultado / receita"],
    [],
    ["texto solto depois da lista, não deve ser lido"],
  ];

  it("lê os indicadores até a primeira linha vazia, batendo com o fixture real", () => {
    const resultado = interpretarPlacarSemanal(rows, 1);
    const caixaHoje = resultado.rows.find((r) => r.natural_key === "CAIXA HOJE (EMPRESA TODA)");
    const devoHoje = resultado.rows.find((r) => r.natural_key === "DEVO HOJE (VENCIDO, NAO PAGO)");
    const margem = resultado.rows.find((r) => r.natural_key === "MARGEM REAL ACUMULADA");

    expect(caixaHoje?.data.valor).toBeCloseTo(38890.25);
    expect(devoHoje?.data.valor).toBeCloseTo(599045.26);
    expect(margem?.data.valor).toBeCloseTo(0.2887);
    // 3 indicadores + a nota de leitura = 4; o texto solto após a linha vazia não entra
    expect(resultado.rows).toHaveLength(4);
  });

  it("captura o aviso como nota_de_leitura, nunca escondido", () => {
    const resultado = interpretarPlacarSemanal(rows, 1);
    const nota = resultado.rows.find((r) => r.natural_key === "_nota_de_leitura");
    expect(nota?.data.origem_texto).toContain("AVISO");
  });
});

describe("interpretarResultadoPorObra", () => {
  const rows = [
    ["OBRA:", "ZN"],
    ["CARGA TRIBUTOS", "12%"],
    ["RESULTADO REAL ACUMULADO", "R$ 3.329.907,97"],
    ["MARGEM REAL", "41,29%"],
    [],
    ["MÊS", "MEDIÇÃO PREVISTA", "MEDIÇÃO REAL", "NF PREVISTA", "NF EMITIDA", "TRIBUTOS PREVISTOS", "TRIBUTOS SOBRE NF EMITIDA", "CUSTO PREVISTO", "CUSTO LANÇADO", "RESULTADO PREVISTO", "RESULTADO REAL"],
    ["2026-07", 100, 90, 100, 90, 10, 9, 50, 45, 40, 38],
    [],
  ];

  it("identifica a obra pelo rótulo 'OBRA:' e extrai o bloco de cabeçalho", () => {
    const resultado = interpretarResultadoPorObra(rows, 1);
    const header = resultado.rows.find((r) => r.data.tipo === "header");
    expect(header?.natural_key).toBe("ZN");
    expect(header?.data.resultado_real_acumulado).toBe("R$ 3.329.907,97");
    expect(header?.data.margem_real).toBe("41,29%");
  });

  it("extrai a linha mensal com a chave obra|mês, incluindo a coluna RESULTADO REAL (11ª)", () => {
    const resultado = interpretarResultadoPorObra(rows, 1);
    const mensal = resultado.rows.find((r) => r.data.tipo === "mensal");
    expect(mensal?.natural_key).toBe("ZN|2026-07");
    expect(mensal?.data.medicao_real).toBe(90);
    expect(mensal?.data.resultado_real).toBe(38);
  });

  it("sem 'OBRA:' no conteúdo, não interpreta nada", () => {
    const resultado = interpretarResultadoPorObra([["sem nada relevante"]], 1);
    expect(resultado.rows).toHaveLength(0);
  });
});

describe("interpretarFunilComercial", () => {
  const header = ["Nº", "CLIENTE/CONTRATANTE", "OBJETO", "CIDADE", "ETAPA", "VALOR ESTIMADO", "PROBAB.", "VALOR PONDERADO", "PRÓXIMO PASSO", "QUEM"];

  it("bate com o fixture real (COC 38, 50%, ponderado R$21.657.500)", () => {
    const rows = [header, [38, "COC", "Rede de água", "SP", "Negociação", 43315000, "50%", 21657500, "Enviar proposta", "Fulano"]];
    const resultado = interpretarFunilComercial(rows, 1);
    expect(resultado.rows[0].data.valor_ponderado).toBe(21657500);
    expect(resultado.exceptions.some((e) => e.type === "funil_ponderado_diverge")).toBe(false);
  });

  it("sinaliza funil_ponderado_diverge quando o ponderado não bate com estimado × probabilidade", () => {
    const rows = [header, [1, "Cliente", "Objeto", "SP", "Etapa", 100000, "50%", 999, "", ""]];
    const resultado = interpretarFunilComercial(rows, 1);
    expect(resultado.exceptions.some((e) => e.type === "funil_ponderado_diverge")).toBe(true);
  });

  it("linha sem valor estimado guarda null, nunca zero", () => {
    const rows = [header, [2, "Cliente", "Objeto", "SP", "Etapa", "", "", "", "", ""]];
    const resultado = interpretarFunilComercial(rows, 1);
    expect(resultado.rows[0].data.valor_estimado).toBeNull();
    expect(resultado.exceptions).toHaveLength(0);
  });
});

describe("interpretarPonteLucroCaixa", () => {
  // Os meses ficam na MESMA linha do marcador "A · PONTE LUCRO → CAIXA",
  // nas colunas ao lado - não numa linha separada abaixo.
  const rows = [
    ["A · PONTE LUCRO → CAIXA", "set/26"],
    ["(+) Recebimentos", 2000000],
    ["(−) Pagamentos", -800000],
    ["Lucro líquido do mês", 1200898.99],
    [],
  ];

  it("bate com o fixture real: Lucro líquido do mês de set/26", () => {
    const resultado = interpretarPonteLucroCaixa(rows, 1);
    const lucro = resultado.rows.find((r) => r.data.componente === "Lucro líquido do mês");
    expect(lucro?.data.valor).toBeCloseTo(1200898.99);
    expect(lucro?.data.mes).toBe("set/26");
  });

  it("preserva a ordem das linhas em ordem_linha", () => {
    const resultado = interpretarPonteLucroCaixa(rows, 1);
    const ordens = resultado.rows.map((r) => r.data.ordem_linha);
    expect(ordens).toEqual([0, 1, 2]);
  });

  it("para na primeira linha cujo rótulo não é um componente válido", () => {
    const rowsComLixo = [...rows.slice(0, 3), ["Nota qualquer, não é componente", 999], ["(+) Não deveria ser lido", 1]];
    const resultado = interpretarPonteLucroCaixa(rowsComLixo, 1);
    expect(resultado.rows.every((r) => r.data.componente !== "(+) Não deveria ser lido")).toBe(true);
  });

  it("funciona com o marcador na coluna B (margem vazia na coluna A), caso real da planilha", () => {
    const rowsColunaB = [
      [null, "A · PONTE LUCRO → CAIXA", "set/26"],
      [null, "(+) Recebimentos", 2000000],
      [null, "(−) Pagamentos", -800000],
      [null, "Lucro líquido do mês", 1200898.99],
      [],
    ];
    const resultado = interpretarPonteLucroCaixa(rowsColunaB, 1);
    const lucro = resultado.rows.find((r) => r.data.componente === "Lucro líquido do mês");
    expect(lucro?.data.valor).toBeCloseTo(1200898.99);
    expect(lucro?.data.mes).toBe("set/26");
    expect(resultado.rows).toHaveLength(3);
  });
});

describe("interpretarChecksIntegridade", () => {
  const rows = [
    ["MASTER CHECK", "PENDENTE", "0 erro(s)", "3 pendente(s)", "26 ok"],
    [],
    ["Nº", "CONFERÊNCIA", "VALOR", "RESULTADO", "O QUE FAZER", "ONDE"],
    [1, "Caixa bate com banco", "OK", "OK", "-", "aba 02"],
    [2, "Medição bate com faturamento", "divergente", "PENDENTE", "revisar aba 09", "aba 09"],
  ];

  it("bate com o fixture real: MASTER CHECK = PENDENTE com o resumo", () => {
    const resultado = interpretarChecksIntegridade(rows, 1);
    const master = resultado.rows.find((r) => r.natural_key === "_master_check");
    expect(master?.data.master_check).toBe("PENDENTE");
    expect(master?.data.resumo_texto).toContain("3 pendente(s)");
  });

  it("extrai cada linha de conferência pelo número", () => {
    const resultado = interpretarChecksIntegridade(rows, 1);
    const item2 = resultado.rows.find((r) => r.natural_key === "2");
    expect(item2?.data.resultado).toBe("PENDENTE");
  });
});
