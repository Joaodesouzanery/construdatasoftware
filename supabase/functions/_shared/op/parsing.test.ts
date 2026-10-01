import { describe, it, expect } from "vitest";
import { normalizarRotulo, celulaVazia, parseNumeroBR, parseDataISO, localizarCabecalho } from "./parsing.ts";

describe("normalizarRotulo", () => {
  it("maiusculiza, remove acento e colapsa espaços", () => {
    expect(normalizarRotulo("  Descrição   da Despesa ")).toBe("DESCRICAO DA DESPESA");
  });

  it("trata valores vazios", () => {
    expect(normalizarRotulo(null)).toBe("");
    expect(normalizarRotulo(undefined)).toBe("");
  });
});

describe("celulaVazia", () => {
  it("detecta vazio/nulo/espaço, mas não zero", () => {
    expect(celulaVazia(null)).toBe(true);
    expect(celulaVazia(undefined)).toBe(true);
    expect(celulaVazia("   ")).toBe(true);
    expect(celulaVazia(0)).toBe(false);
    expect(celulaVazia("0")).toBe(false);
  });
});

describe("parseNumeroBR", () => {
  it("aceita formato brasileiro com milhar e decimal", () => {
    expect(parseNumeroBR("1.234,56")).toBeCloseTo(1234.56);
  });

  it("aceita só vírgula decimal", () => {
    expect(parseNumeroBR("400,00")).toBeCloseTo(400);
  });

  it("aceita número puro", () => {
    expect(parseNumeroBR(5000)).toBe(5000);
  });

  it("aceita texto com símbolo de moeda", () => {
    expect(parseNumeroBR("R$ 112.050,00")).toBeCloseTo(112050);
  });

  it("devolve null para vazio", () => {
    expect(parseNumeroBR("")).toBeNull();
    expect(parseNumeroBR(null)).toBeNull();
  });
});

describe("parseDataISO", () => {
  it("aceita AAAA-MM-DD", () => {
    expect(parseDataISO("2026-07-06")).toBe("2026-07-06");
  });

  it("aceita DD/MM/AAAA", () => {
    expect(parseDataISO("06/07/2026")).toBe("2026-07-06");
  });

  it("aceita número serial do Excel", () => {
    // 25569 = 01/01/1970, constante padrão de conversão serial Excel -> época Unix
    expect(parseDataISO(25569)).toBe("1970-01-01");
  });

  it("devolve null para vazio ou inválido", () => {
    expect(parseDataISO("")).toBeNull();
    expect(parseDataISO("abc")).toBeNull();
  });
});

describe("localizarCabecalho", () => {
  it("encontra a linha certa dentro do limite de linhas", () => {
    const linhas = [
      ["RECEITAS", null, "CONTAS A PAGAR"],
      ["ENTRADA", "DATA", "DESCRIÇÃO", "VALOR"],
      [5000, "2026-07-06", "CONSERTO", 400],
    ];
    expect(localizarCabecalho(linhas, ["ENTRADA", "DATA", "DESCRIÇÃO", "VALOR"])).toBe(1);
  });

  it("devolve null se não encontrar nenhuma linha suficiente", () => {
    const linhas = [["X", "Y"]];
    expect(localizarCabecalho(linhas, ["ENTRADA", "DATA"])).toBeNull();
  });

  it("aceita proporção mínima parcial", () => {
    const linhas = [["ID", "CONTRATO", "OUTRA COISA"]];
    expect(localizarCabecalho(linhas, ["ID", "CONTRATO", "DATA", "STATUS"], 12, 0.5)).toBe(0);
  });
});
