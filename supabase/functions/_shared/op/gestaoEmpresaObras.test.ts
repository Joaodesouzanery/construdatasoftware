import { describe, it, expect } from "vitest";
import { interpretarCustoPorObra, interpretarPassivoEEstoque, interpretarReplanejamento } from "./gestaoEmpresaObras.ts";

// Monta uma linha esparsa: índice -> valor, resto null. Usado para testar
// posições de coluna fixas (ex. rótulo em F, valor em J) sem precisar
// escrever um array literal gigante cheio de null.
function linha(mapa: Record<number, unknown>, comprimento = 12): unknown[] {
  const l = new Array(comprimento).fill(null);
  for (const [idx, valor] of Object.entries(mapa)) l[Number(idx)] = valor;
  return l;
}

describe("interpretarCustoPorObra (08A)", () => {
  const rows = [
    ["OBRA:", "ZN"],
    ["MÊS DE CORTE:", "2026-09-01"],
    [],
    [],
    ["CONTA", "NOME", "NATUREZA", "PAGO ANTES DO FLUXO (antes de set/26)", "ORÇADO NO FLUXO (14 meses)", "PREVISTO ATÉ O CORTE", "PAGO ATÉ O CORTE (desde jan/26)", "A PAGAR + COMPROMETIDO", "PREVISTO LANÇADO (08)", "A REALIZAR NO FLUXO (depois do corte)", "PROJETADO NO TÉRMINO", "DESVIO R$ (projetado − orçado)", "DESVIO %", "CAUSA DO DESVIO", "COMENTÁRIO"],
    ["4.1", "Fundação", "Material", 1000, 2000, 1500, 900, 100, 1900, 50, 1950, -50, -2.5, "atraso", ""],
    ["4.5", "Elétrica", "Serviço", 500, 1000, 800, 450, 50, 950, 25, 975, -25, -2.5, "", ""],
    ["7.2", "Pintura", "Serviço", 300, 600, 500, 280, 20, 580, 15, 595, -5, -0.8, "", ""],
    ["TOTAL DA OBRA", "", "", 1800, 3600, 2800, 1630, 170, 3430, 90, 3520, -80, "", "", ""],
    [],
    [],
    ["FAROL"],
    ["Desvios acima de 5% da obra", "2 contas"],
    ["Lançamentos desta obra no mês", "R$ 15.000,00"],
    ["Previsto × pago até o corte", "91%"],
    [],
    ["PAGO POR MÊS DESTA OBRA (08, SITUAÇÃO = PAGO)"],
    ["CONTA", "NOME", "dez/25", "jan/26", "fev/26", "mar/26", "abr/26", "mai/26", "jun/26", "jul/26", "ago/26", "set/26", "out/26", "nov/26", "P = TOTAL"],
    ["4.1", "Fundação", 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 1200],
    ["4.5", "Elétrica", null, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 550],
    ["TOTAL", "", 100, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 150, 1750],
  ];

  it("lê o bloco 1 com cabeçalho reconhecido por PREFIXO (parênteses variam) e chave obra|CONTA", () => {
    const resultado = interpretarCustoPorObra(rows, 1);
    const fundacao = resultado.rows.find((r) => r.natural_key === "ZN|4.1");
    expect(fundacao?.data).toMatchObject({ conta: "4.1", nome: "Fundação", pago_antes_do_fluxo: 1000, obra_selecionada: "ZN" });
  });

  it("não derruba o bloco 1 por conta fora de ordem (4.5 depois de 7.2 na planilha real) - só preserva o que veio", () => {
    const resultado = interpretarCustoPorObra(rows, 1);
    const contas = resultado.rows.filter((r) => r.data.conta).map((r) => r.data.conta);
    expect(contas).toContain("4.1");
    expect(contas).toContain("4.5");
    expect(contas).toContain("7.2");
  });

  it("linha TOTAL DA OBRA não é um registro", () => {
    const resultado = interpretarCustoPorObra(rows, 1);
    expect(resultado.rows.some((r) => String(r.data.conta ?? "").includes("TOTAL"))).toBe(false);
  });

  it("lê o bloco FAROL (rótulo-valor) com chave obra|rotulo", () => {
    const resultado = interpretarCustoPorObra(rows, 1);
    const farol = resultado.rows.find((r) => r.natural_key === "ZN|FAROL");
    expect(farol).toBeUndefined(); // "FAROL" sozinho é só o título do bloco, buscarValorPorRotulo busca o próximo não-vazio na mesma linha - sem valor ao lado, não gera registro
    const desvios = resultado.rows.find((r) => String(r.natural_key).startsWith("ZN|DESVIOS"));
    expect(desvios?.data.valor).toBe("2 contas");
  });

  it("lê o bloco 3 (pago por mês) com chave obra|CONTA|mês, ignorando a linha TOTAL final", () => {
    const resultado = interpretarCustoPorObra(rows, 1);
    const jan = resultado.rows.find((r) => r.natural_key === "ZN|4.1|2026-01");
    expect(jan?.data).toMatchObject({ conta: "4.1", mes: "2026-01", valor: 100 });
    expect(resultado.rows.some((r) => String(r.natural_key).includes("|TOTAL|"))).toBe(false);
  });

  it("não inventa valor para célula vazia no bloco 3 (4.5 não tem dez/25)", () => {
    const resultado = interpretarCustoPorObra(rows, 1);
    const dez = resultado.rows.find((r) => r.natural_key === "ZN|4.5|2025-12");
    expect(dez).toBeUndefined();
  });

  it("sem 'OBRA:' no conteúdo, abre layout_inesperado e não interpreta nada", () => {
    const resultado = interpretarCustoPorObra([["nada a ver"]], 1);
    expect(resultado.rows).toHaveLength(0);
    expect(resultado.exceptions[0]).toMatchObject({ severity: "aviso", type: "layout_inesperado" });
  });
});

describe("interpretarPassivoEEstoque (08D)", () => {
  const rows: unknown[][] = [
    [],
    [],
    linha({ 0: "OBRA:", 1: "ZN", 2: "Obra da Zona Norte" }),
    linha({ 4: "PASSIVO HOJE (acumulado)", 8: 424144.08, 10: "RESERVADO NO FLUXO PARA RESCISÃO (2026)", 14: 250000, 15: "ESTOQUE HOJE", 19: 0 }),
    linha({ 4: "MAIOR PASSIVO NO PERÍODO", 8: 504512.77, 10: "FALTA RESERVAR NO FLUXO", 14: 254512.77 }),
    ["CONTA", "NOME", "É CLT?", "PARTE QUE É SALÁRIO"],
    ["5.1", "João", "SIM", "70%"],
    ["5.2", "Maria", "NÃO", "0%"],
    ["5.3", "Pedro", "SIM", "65%"],
    [],
    [],
    [
      "MÊS",
      "FOLHA LANÇADA (08) × parte salário",
      "FOLHA NO FLUXO × parte salário",
      "SALÁRIOS DO MÊS (base)",
      "13º DO MÊS",
      "FÉRIAS + 1/3 DO MÊS",
      "ENCARGOS S/ 13º E FÉRIAS",
      "MULTA FGTS DO MÊS",
      "PROVISÃO DO MÊS",
      "13º A PAGAR (zera em dez)",
      "FÉRIAS A PAGAR (12 meses)",
      "MULTA FGTS ACUMULADA",
      "AVISO PRÉVIO",
      "PASSIVO SE DESMOBILIZAR NO FIM DO MÊS",
      "RESCISÃO PREVISTA NO FLUXO (2.5)",
      "RESCISÕES LANÇADAS (08, 2.5)",
      "MATERIAL LANÇADO (08)",
      "ESTOQUE NO FIM DO MÊS",
      "MATERIAL APLICADO (lançado − variação do estoque)",
    ],
    ["jan/26", 1000, 1000, 5000, 400, 400, 300, 0, 500, 400, 400, 0, 0, 2000, 0, 0, 100, 100, 100],
    ["fev/26", 1000, 1000, 5000, 400, 400, 300, 0, 500, 800, 800, 0, 0, 2000, 0, 0, 100, 200, 0],
    ["TOTAL", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    [],
  ];
  // Insere a célula F/J dos parâmetros (colunas fixas 5 e 9) nas mesmas
  // linhas 4-5 dos indicadores, sem conflitar com as colunas 4/8/10/14/15/19
  // já usadas pelos indicadores acima.
  rows[3] = linha({ 4: "PASSIVO HOJE (acumulado)", 8: 424144.08, 10: "RESERVADO NO FLUXO PARA RESCISÃO (2026)", 14: 250000, 15: "ESTOQUE HOJE", 19: 0, 5: "ENCARGOS SOBRE 13º E FÉRIAS", 9: 0.368 });
  rows[4] = linha({ 4: "MAIOR PASSIVO NO PERÍODO", 8: 504512.77, 10: "FALTA RESERVAR NO FLUXO", 14: 254512.77, 5: "FGTS DEPOSITADO NO MÊS (% do salário)", 9: 0.08 });

  it("lê os indicadores (valor = primeira célula numérica à direita, mesmo com colunas vazias entre o rótulo e o valor)", () => {
    const resultado = interpretarPassivoEEstoque(rows, 1);
    const passivoHoje = resultado.rows.find((r) => r.natural_key === "ZN|PASSIVO HOJE");
    expect(passivoHoje?.data.valor).toBeCloseTo(424144.08);
    const estoqueHoje = resultado.rows.find((r) => r.natural_key === "ZN|ESTOQUE HOJE");
    expect(estoqueHoje?.data.valor).toBe(0);
  });

  it("lê o bloco A (por conta) com chave obra|CONTA", () => {
    const resultado = interpretarPassivoEEstoque(rows, 1);
    const joao = resultado.rows.find((r) => r.natural_key === "ZN|5.1");
    expect(joao?.data).toMatchObject({ conta: "5.1", nome: "João", e_clt: "SIM" });
  });

  it("lê os parâmetros em colunas fixas (F/J) sem se confundir com os indicadores (E/F/I/J misturados na mesma linha)", () => {
    const resultado = interpretarPassivoEEstoque(rows, 1);
    const encargos = resultado.rows.find((r) => r.natural_key === "ZN|ENCARGOS SOBRE 13 E FERIAS");
    expect(encargos?.data.valor).toBeCloseTo(0.368);
    const fgts = resultado.rows.find((r) => r.natural_key === "ZN|FGTS DEPOSITADO NO MES");
    expect(fgts?.data.valor).toBeCloseTo(0.08);
  });

  it("lê o bloco B como LISTA com chave obra|MÊS (não série mensal), ignorando a linha TOTAL", () => {
    const resultado = interpretarPassivoEEstoque(rows, 1);
    const jan = resultado.rows.find((r) => r.natural_key === "ZN|JAN/26");
    expect(jan?.data).toMatchObject({ mes_rotulo: "jan/26", salarios_do_mes: 5000 });
    expect(resultado.rows.some((r) => String(r.natural_key).endsWith("|TOTAL"))).toBe(false);
  });

  it("bloco C vazio (por desenho) não gera exceção nem derruba os outros blocos", () => {
    const resultado = interpretarPassivoEEstoque(rows, 1);
    expect(resultado.exceptions.some((e) => e.type === "layout_inesperado" && e.message.includes("bloco C"))).toBe(false);
    expect(resultado.rows.length).toBeGreaterThan(0);
  });
});

describe("interpretarReplanejamento (12A)", () => {
  // Colunas: B=1,C=2,F=5,J=9. Meses a partir de J (9) até AA (26).
  const linhaIndicadores1 = linha({ 0: null, 1: "OBRA:", 2: "BERTIOGA", 3: "obra de Bertioga" });
  const rows: unknown[][] = [
    [],
    [],
    linhaIndicadores1,
    linha({ 1: "VALOR DO CONTRATO (03)", 2: null, 5: "SALDO A MEDIR", 9: 4196334.57 }),
    linha({ 1: "VALOR DO CONTRATO DIGITADO (se a 03 está vazia)", 2: null, 5: "PICO DE PRODUÇÃO NUM MÊS", 9: 355621.57 }),
    linha({ 1: "MEDIDO ATÉ HOJE (06, …)", 2: 47130.57, 5: "PICO DE MÃO DE OBRA (…)", 9: 18 }),
    linha({ 1: "SALDO A MEDIR", 2: 4196334.57, 5: "PICO DE EQUIPAMENTOS (…)", 9: 11 }),
    linha({ 1: "MÊS DE PARTIDA", 2: "2026-10-01", 5: "CUSTO REPLANEJADO (WCR…)", 9: null }),
    linha({ 1: "TÉRMINO (último mês …)", 2: "2028-03-01", 5: "PRODUÇÃO − CUSTO REPLANEJADO", 9: null }),
    linha({ 1: "CURVA", 2: "S" }),
    linha({ 1: "ARREDONDAR EQUIPES E EQUIPAMENTOS?", 2: "SIM" }),
    [],
    [],
    [],
    linha({ 1: "MÊS", 9: "out/26", 10: "nov/26", 11: "dez/26", 12: "jan/27", 13: "fev/27", 14: "mar/27" }, 15),
    linha({ 1: "MEDIÇÃO BRUTA PREVISTA", 9: 100, 10: 200, 11: 300, 12: 400, 13: 500, 14: 600 }, 15),
    linha({ 1: "PRODUÇÃO A MEDIR NO MÊS", 9: 50, 10: 60, 11: 70, 12: 80, 13: 90, 14: 100 }, 15),
    linha({ 1: "% DO CONTRATO EXECUTADO" }, 15), // vazia hoje - normal
    [],
    ["HISTOGRAMA — quantidade…"],
    [
      "OBRA", "RECURSO (linha da aba de contrato)", "TIPO", "COMO VARIA", "QTD NO FLUXO", "CUSTO POR UNIDADE (R$/mês)", "PRODUÇÃO POR UNIDADE (R$/mês)", "QUEM PAGA", "CONTA",
      "out/26", "nov/26", "dez/26", "jan/27", "fev/27", "mar/27",
    ],
    ["BERTIOGA", "Pedreiro", "MDO", "fixo", 2, 5000, 8000, "WCR", "5.1", 10000, 10000, 10000, 10000, 10000, 10000],
    ["SANTOS", "Encarregado", "MDO", "fixo", 1, 7000, 9000, "WCR", "5.2", 7000, 7000, 7000, 7000, 7000, 7000],
    ["TOTAL", "", "", "", "", "", "", "", "", 17000, 17000, 17000, 17000, 17000, 17000],
    [],
    linha({ 1: "RESUMO DA OBRA ESCOLHIDA" }, 15),
    linha({ 1: "MÃO DE OBRA — quantidade…", 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2 }, 15),
    linha({ 1: "CUSTO REPLANEJADO TOTAL", 9: 50000, 10: 50000, 11: 50000, 12: 50000, 13: 50000, 14: 50000 }, 15),
  ];

  it("lê os indicadores do grupo 1 (B/C) e do grupo 2 (F/J) sem cruzar colunas", () => {
    const resultado = interpretarReplanejamento(rows, 1);
    const medido = resultado.rows.find((r) => r.natural_key === "BERTIOGA|1|MEDIDO ATE HOJE");
    expect(medido?.data.valor).toBeCloseTo(47130.57);
    const saldoGrupo2 = resultado.rows.find((r) => r.natural_key === "BERTIOGA|2|SALDO A MEDIR");
    expect(saldoGrupo2?.data.valor).toBeCloseTo(4196334.57);
  });

  it("valor vazio do indicador vira null, nunca 0 (Regra de Ouro 2)", () => {
    const resultado = interpretarReplanejamento(rows, 1);
    const custoReplanejado = resultado.rows.find((r) => r.natural_key === "BERTIOGA|2|CUSTO REPLANEJADO");
    expect(custoReplanejado?.data.valor).toBeNull();
  });

  it("lê o bloco 1 (curva mensal) com chave obra|rotulo|mês, parando antes do HISTOGRAMA", () => {
    const resultado = interpretarReplanejamento(rows, 1);
    const medicao = resultado.rows.find((r) => r.natural_key === "BERTIOGA|MEDICAO BRUTA PREVISTA|2026-10");
    expect(medicao?.data.valor).toBe(100);
    // linha "% DO CONTRATO EXECUTADO" vazia hoje - não gera registro, mas também não derruba nada
    expect(resultado.rows.some((r) => String(r.natural_key).includes("CONTRATO EXECUTADO"))).toBe(false);
  });

  it("não deixa o cabeçalho do HISTOGRAMA (meses nas mesmas colunas J-AA) contaminar o bloco 1", () => {
    const resultado = interpretarReplanejamento(rows, 1);
    expect(resultado.rows.some((r) => String(r.data.rotulo ?? "").includes("RECURSO"))).toBe(false);
  });

  it("lê o bloco 2 (HISTOGRAMA) com chave OBRA|RECURSO|mês usando a OBRA da própria linha, não o seletor", () => {
    const resultado = interpretarReplanejamento(rows, 1);
    const pedreiro = resultado.rows.find((r) => r.natural_key === "BERTIOGA|PEDREIRO|2026-10");
    expect(pedreiro?.data).toMatchObject({ obra: "BERTIOGA", recurso: "Pedreiro", valor: 10000 });
    const encarregadoSantos = resultado.rows.find((r) => r.natural_key === "SANTOS|ENCARREGADO|2026-10");
    expect(encarregadoSantos?.data.obra).toBe("SANTOS");
  });

  it("linha TOTAL do histograma não é um registro", () => {
    const resultado = interpretarReplanejamento(rows, 1);
    expect(resultado.rows.some((r) => String(r.data.recurso ?? "").includes("TOTAL"))).toBe(false);
  });

  it("lê o bloco 3 (resumo) reaproveitando as colunas de mês do bloco 1, chave obra_selecionada|rotulo|mês", () => {
    const resultado = interpretarReplanejamento(rows, 1);
    const custoTotal = resultado.rows.find((r) => r.natural_key === "BERTIOGA|CUSTO REPLANEJADO TOTAL|2026-10");
    expect(custoTotal?.data.valor).toBe(50000);
  });

  it("sem 'OBRA:' no conteúdo, abre layout_inesperado e não interpreta nada", () => {
    const resultado = interpretarReplanejamento([["nada a ver"]], 1);
    expect(resultado.rows).toHaveLength(0);
    expect(resultado.exceptions[0]).toMatchObject({ severity: "aviso", type: "layout_inesperado" });
  });
});
