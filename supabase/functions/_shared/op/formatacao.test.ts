import { describe, it, expect } from "vitest";
import { formatarCelula, formatarLinhas } from "./formatacao.ts";

describe("formatarCelula", () => {
  it("formata número como moeda quando não há coluna de data/percentual", () => {
    expect(formatarCelula(3329907.97)).toContain("3.329.907,97");
    expect(formatarCelula(1000)).toContain("1.000");
  });

  it("formata serial do Excel como mmm/aa quando a coluna é de mês/data", () => {
    // 46023 = 01/01/2026 (serial do Excel, base 30/12/1899)
    expect(formatarCelula(46023, "MÊS")).toBe("jan/26");
    expect(formatarCelula(46023, "DATA")).toBe("jan/26");
  });

  it("não trata serial como data fora da faixa plausível de anos", () => {
    expect(formatarCelula(39999, "MÊS")).not.toMatch(/\/\d{2}$/);
  });

  it("formata fração como percentual quando a coluna indica percentual", () => {
    expect(formatarCelula(0.4129, "MARGEM")).toBe("41,29%");
    expect(formatarCelula(0.9, "PROBABILIDADE")).toBe("90,00%");
  });

  it("não trata fração como percentual sem coluna compatível", () => {
    expect(formatarCelula(0.4129, "OUTRA COISA")).not.toMatch(/%$/);
  });

  it("texto permanece como está", () => {
    expect(formatarCelula("CONSERTO DE 2 PNEUS")).toBe("CONSERTO DE 2 PNEUS");
  });

  it("célula vazia vira string vazia, nunca inventa valor", () => {
    expect(formatarCelula(null)).toBe("");
    expect(formatarCelula(undefined)).toBe("");
    expect(formatarCelula("")).toBe("");
  });
});

describe("formatarLinhas", () => {
  it("formata cada célula usando o rótulo da sua própria coluna", () => {
    const cabecalho = ["DESCRIÇÃO", "MARGEM"];
    const linhas = [["Obra A", 0.5]];
    expect(formatarLinhas(linhas, cabecalho)).toEqual([["Obra A", "50,00%"]]);
  });
});
