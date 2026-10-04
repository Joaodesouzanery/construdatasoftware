import { describe, it, expect } from "vitest";
import { interpretarComoLista, interpretarComoSerieMensal } from "./interpretadoresGenericos.ts";

describe("interpretarComoLista", () => {
  const config = { sheetKey: "gestao_empresa.contratos", colunasChave: ["CONTRATO"] };

  it("acha o cabeçalho por rótulo e monta um registro por linha", () => {
    const rows = [
      ["Planilha de contratos"],
      ["CONTRATO", "CLIENTE", "VALOR"],
      ["C001", "Sabesp", 1000],
      ["C002", "Prefeitura", 2000],
    ];
    const resultado = interpretarComoLista(rows, 1, config);
    expect(resultado.rows).toHaveLength(2);
    expect(resultado.rows[0]).toMatchObject({ natural_key: "C001", source_row: 3, data: { contrato: "C001", cliente: "Sabesp", valor: 1000 } });
    expect(resultado.rejectedCount).toBe(0);
  });

  it("para na primeira linha vazia", () => {
    const rows = [
      ["CONTRATO", "CLIENTE"],
      ["C001", "Sabesp"],
      [null, null],
      ["C002", "Prefeitura"],
    ];
    const resultado = interpretarComoLista(rows, 1, config);
    expect(resultado.rows).toHaveLength(1);
  });

  it("para no próximo título de bloco", () => {
    const rows = [
      ["CONTRATO", "CLIENTE"],
      ["C001", "Sabesp"],
      ["RESUMO POR CONTRATO"],
      ["C002", "Prefeitura"],
    ];
    const resultado = interpretarComoLista(rows, 1, config);
    expect(resultado.rows).toHaveLength(1);
  });

  it("chave repetida ganha sufixo #2", () => {
    const rows = [
      ["CONTRATO", "CLIENTE"],
      ["C001", "Sabesp"],
      ["C001", "Sabesp Aditivo"],
    ];
    const resultado = interpretarComoLista(rows, 1, config);
    expect(resultado.rows.map((r) => r.natural_key)).toEqual(["C001", "C001#2"]);
  });

  it("linha sem nenhuma coluna-chave preenchida vira exceção aviso e não derruba a aba", () => {
    const rows = [
      ["CONTRATO", "CLIENTE"],
      ["C001", "Sabesp"],
      [null, "Sem contrato"],
      ["C002", "Prefeitura"],
    ];
    const resultado = interpretarComoLista(rows, 1, config);
    expect(resultado.rows).toHaveLength(3);
    expect(resultado.rejectedCount).toBe(1);
    expect(resultado.exceptions[0]).toMatchObject({ severity: "aviso", row_number: 3 });
  });

  it("sem cabeçalho reconhecível, devolve vazio sem lançar erro", () => {
    const rows = [["nada a ver com isso"]];
    const resultado = interpretarComoLista(rows, 1, config);
    expect(resultado.rows).toHaveLength(0);
  });
});

describe("interpretarComoSerieMensal", () => {
  const config = { sheetKey: "gestao_empresa.custos" };

  it("acha a linha de meses e gera um registro por (rótulo, mês)", () => {
    const rows = [
      ["CONTA", "jan/26", "fev/26", "mar/26", "abr/26", "mai/26", "jun/26"],
      ["Combustível", 100, 200, 300, 400, 500, 600],
    ];
    const resultado = interpretarComoSerieMensal(rows, 1, config);
    expect(resultado.rows).toHaveLength(6);
    expect(resultado.rows[0]).toMatchObject({
      natural_key: "|COMBUSTIVEL|2026-01",
      source_row: 2,
      data: { rotulo: "Combustível", mes: "2026-01", valor: 100 },
    });
  });

  it("usa o título de bloco mais recente como seção", () => {
    const rows = [
      ["CONTA", "jan/26", "fev/26", "mar/26", "abr/26", "mai/26", "jun/26"],
      ["A · PREVISTO POR CONTA"],
      ["Combustível", 100, 200, 300, 400, 500, 600],
      ["B · REALIZADO POR CONTA"],
      ["Combustível", 10, 20, 30, 40, 50, 60],
    ];
    const resultado = interpretarComoSerieMensal(rows, 1, config);
    expect(resultado.rows[0].natural_key).toBe("A · PREVISTO POR CONTA|COMBUSTIVEL|2026-01");
    expect(resultado.rows[6].natural_key).toBe("B · REALIZADO POR CONTA|COMBUSTIVEL|2026-01");
  });

  it("não inventa valor para célula vazia - só gera registro para mês com valor", () => {
    const rows = [
      ["CONTA", "jan/26", "fev/26", "mar/26", "abr/26", "mai/26", "jun/26"],
      ["Combustível", 100, null, 300, null, 500, 600],
    ];
    const resultado = interpretarComoSerieMensal(rows, 1, config);
    expect(resultado.rows).toHaveLength(4);
    expect(resultado.rows.map((r) => r.data.mes)).toEqual(["2026-01", "2026-03", "2026-05", "2026-06"]);
  });

  it("linha sem rótulo vira exceção aviso e não derruba a aba", () => {
    const rows = [
      ["CONTA", "jan/26", "fev/26", "mar/26", "abr/26", "mai/26", "jun/26"],
      [null, 100, 200, 300, 400, 500, 600],
      ["Combustível", 10, 20, 30, 40, 50, 60],
    ];
    const resultado = interpretarComoSerieMensal(rows, 1, config);
    expect(resultado.rows).toHaveLength(6);
    expect(resultado.rejectedCount).toBe(1);
    expect(resultado.exceptions[0].severity).toBe("aviso");
  });

  it("sem 6 meses consecutivos reconhecíveis, devolve vazio sem lançar erro", () => {
    const rows = [["CONTA", "jan/26", "qualquer coisa", "mar/26"]];
    const resultado = interpretarComoSerieMensal(rows, 1, config);
    expect(resultado.rows).toHaveLength(0);
  });
});
