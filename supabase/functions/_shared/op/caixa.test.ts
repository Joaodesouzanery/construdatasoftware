import { describe, it, expect } from "vitest";
import { interpretarDespesas, interpretarHorasExtras, interpretarAusenciaPontoSaida, interpretarPlanilha1 } from "./caixa.ts";

// Nota: o prompt original cita um "aceite" contra o arquivo real "CONTROLE DE
// CAIXA ATUAL" (219 despesas, 18 entradas, saldo -R$246,06...). Não temos
// acesso a esse arquivo aqui, então os testes abaixo cobrem o COMPORTAMENTO
// descrito (blocos independentes, períodos, validações, idempotência da
// chave) com fixtures pequenas e controladas - o aceite contra o arquivo real
// deve ser conferido separadamente pelo usuário via o Simulador.

const HEADER_DESPESAS = ["ENTRADA", "DATA", "DESCRIÇÃO", "VALOR", "DATA DA DESPESA", "CLASSIFICAÇÃO", "SOLICITANTE"];

describe("interpretarDespesas", () => {
  it("interpreta receita e despesa como registros independentes na mesma linha", () => {
    const rows = [
      ["RECEITAS", null, "CONTAS A PAGAR"],
      HEADER_DESPESAS,
      [5000, "2026-07-06", "CONSERTO DE 2 PNEUS DA RETRO", 400, "2026-07-06", "FROTA", "DAMIÃO"],
    ];
    const resultado = interpretarDespesas(rows, 1);

    expect(resultado.rows).toHaveLength(2);
    const receita = resultado.rows.find((r) => r.data.tipo === "receita");
    const despesa = resultado.rows.find((r) => r.data.tipo === "despesa");

    expect(receita?.data).toMatchObject({ tipo: "receita", valor: 5000, descricao: null });
    expect(despesa?.data).toMatchObject({ tipo: "despesa", valor: 400, classificacao: "FROTA" });
    expect(despesa?.natural_key).toMatch(/^desp\|2026-07-06\|/);
  });

  it("não copia a descrição da despesa para a receita e sinaliza aviso", () => {
    const rows = [HEADER_DESPESAS, [1000, "2026-07-10", "ALGO", 200, "2026-07-10", "OUTROS", ""]];
    const resultado = interpretarDespesas(rows, 1);
    const avisoReceita = resultado.exceptions.find((e) => e.type === "entrada_sem_descricao");
    expect(avisoReceita).toBeDefined();
    expect(avisoReceita?.severity).toBe("aviso");
  });

  it("entrada vazia ou zero não gera receita", () => {
    const rows = [HEADER_DESPESAS, ["", "2026-07-10", "ALGO", 200, "2026-07-10", "OUTROS", ""]];
    const resultado = interpretarDespesas(rows, 1);
    expect(resultado.rows.every((r) => r.data.tipo !== "receita")).toBe(true);
  });

  it("interpreta período em texto na DATA DA DESPESA", () => {
    const rows = [HEADER_DESPESAS, ["", "", "ALUGUEL", 1500, "01 A 10/07/2026", "LOCAÇÃO IMÓVEIS", ""]];
    const resultado = interpretarDespesas(rows, 1);
    expect(resultado.rows[0].data).toMatchObject({ data_inicio: "2026-07-01", data_fim: "2026-07-10" });
  });

  it("DATA DA DESPESA inválida gera exceção bloqueante e a linha não é aplicada", () => {
    const rows = [HEADER_DESPESAS, ["", "", "ALGO ESTRANHO", 100, "não é uma data", "OUTROS", ""]];
    const resultado = interpretarDespesas(rows, 1);
    expect(resultado.rows).toHaveLength(0);
    expect(resultado.rejectedCount).toBe(1);
    expect(resultado.exceptions[0]).toMatchObject({ severity: "bloqueante", type: "data_invalida" });
  });

  it("classificação vazia gera aviso mas aplica a linha mesmo assim", () => {
    const rows = [HEADER_DESPESAS, ["", "", "ALGO", 100, "2026-07-10", "", ""]];
    const resultado = interpretarDespesas(rows, 1);
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.exceptions.some((e) => e.type === "sem_classificacao")).toBe(true);
  });

  it("classificação desconhecida gera aviso mas aplica a linha mesmo assim", () => {
    const rows = [HEADER_DESPESAS, ["", "", "ALGO", 100, "2026-07-10", "CATEGORIA QUE NAO EXISTE", ""]];
    const resultado = interpretarDespesas(rows, 1);
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.exceptions.some((e) => e.type === "classificacao_desconhecida")).toBe(true);
  });

  it("separa múltiplos solicitantes", () => {
    const rows = [HEADER_DESPESAS, ["", "", "ALGO", 100, "2026-07-10", "OUTROS", "DAMIÃO/WELLINGTON"]];
    const resultado = interpretarDespesas(rows, 1);
    expect(resultado.rows[0].data.solicitantes).toEqual(["DAMIÃO", "WELLINGTON"]);
  });

  it("linha SALDO==>> não é aplicada como registro e valida o total", () => {
    const rows = [
      HEADER_DESPESAS,
      ["", "", "A", 100, "2026-07-01", "OUTROS", ""],
      [500, "2026-07-02", "", "", "", "", ""],
      [500, "", "", 100, "SALDO==>>", "", ""],
    ];
    const resultado = interpretarDespesas(rows, 1);
    expect(resultado.rows.every((r) => r.source_row !== 4)).toBe(true);
    // soma despesas aplicadas = 100, total da planilha na linha SALDO = 100 -> confere, sem exceção de total
    expect(resultado.exceptions.some((e) => e.type === "total_nao_confere")).toBe(false);
  });

  it("sinaliza total_nao_confere quando a soma diverge da linha SALDO==>>", () => {
    const rows = [
      HEADER_DESPESAS,
      ["", "", "A", 100, "2026-07-01", "OUTROS", ""],
      [0, "", "", 999, "SALDO==>>", "", ""],
    ];
    const resultado = interpretarDespesas(rows, 1);
    expect(resultado.exceptions.some((e) => e.type === "total_nao_confere")).toBe(true);
  });

  it("linha placeholder (descrição vazia, valor zero, sem data) é ignorada sem gerar registro nem exceção", () => {
    const rows = [HEADER_DESPESAS, ["", "", "", 0, "", "", ""]];
    const resultado = interpretarDespesas(rows, 1);
    expect(resultado.rows).toHaveLength(0);
    expect(resultado.rejectedCount).toBe(0);
    expect(resultado.exceptions).toHaveLength(0);
  });

  it("usa a lista de classificações do contexto (Planilha1) em vez da fixa, quando fornecida", () => {
    const rows = [HEADER_DESPESAS, ["", "", "ALGO", 100, "2026-07-10", "BENEFICIOS", ""]];
    const resultado = interpretarDespesas(rows, 1, {
      sheetName: "DESPESAS",
      fileModifiedAt: "2026-07-15T00:00:00Z",
      classificacoesValidas: ["BENEFICIOS"],
    });
    expect(resultado.exceptions.some((e) => e.type === "classificacao_desconhecida")).toBe(false);
  });
});

describe("interpretarHorasExtras", () => {
  const header = ["NOME", "CARGO", "DIA 05", "PG", "DIA 06"];

  it("gera um registro por célula numérica em coluna DIA, com PG do bloco à esquerda", () => {
    const rows = [header, ["João Silva", "Pedreiro", 100, "X", 150]];
    const resultado = interpretarHorasExtras(rows, 1, { sheetName: "HORAS EXTRAS JULHO", fileModifiedAt: "2026-07-15T00:00:00Z" });

    expect(resultado.rows).toHaveLength(2);
    const dia5 = resultado.rows.find((r) => r.data.data === "2026-07-05");
    const dia6 = resultado.rows.find((r) => r.data.data === "2026-07-06");
    expect(dia5?.data).toMatchObject({ valor: 100, pago: true });
    expect(dia6?.data).toMatchObject({ valor: 150, pago: false });
  });

  it("ignora linhas TOTAL, sem nome, e cargo MORADOR", () => {
    const rows = [header, ["TOTAL", "", 999], ["", "Pedreiro", 100], ["Fulano", "MORADOR BLOCO A", 100]];
    const resultado = interpretarHorasExtras(rows, 1, { sheetName: "HORAS EXTRAS JULHO", fileModifiedAt: "2026-07-15T00:00:00Z" });
    expect(resultado.rows).toHaveLength(0);
  });

  it("sinaliza cargo_ausente quando cargo é vazio ou '-'", () => {
    const rows = [header, ["João Silva", "-", 100]];
    const resultado = interpretarHorasExtras(rows, 1, { sheetName: "HORAS EXTRAS JULHO", fileModifiedAt: "2026-07-15T00:00:00Z" });
    expect(resultado.exceptions.some((e) => e.type === "cargo_ausente")).toBe(true);
  });

  it("sinaliza valor_acima_do_habitual acima do parâmetro", () => {
    const rows = [header, ["João Silva", "Pedreiro", 400]];
    const resultado = interpretarHorasExtras(rows, 1, { sheetName: "HORAS EXTRAS JULHO", fileModifiedAt: "2026-07-15T00:00:00Z" });
    expect(resultado.exceptions.some((e) => e.type === "valor_acima_do_habitual")).toBe(true);
  });

  it("marca corretamente fim de semana", () => {
    // 04/07/2026 é sábado
    const rows = [["NOME", "CARGO", "DIA 04"], ["João Silva", "Pedreiro", 100]];
    const resultado = interpretarHorasExtras(rows, 1, { sheetName: "HORAS EXTRAS JULHO", fileModifiedAt: "2026-07-15T00:00:00Z" });
    expect(resultado.rows[0].data.fim_de_semana).toBe(true);
  });

  it("sinaliza total_nao_confere quando a soma aplicada diverge da linha TOTAL da própria aba", () => {
    const rows = [header, ["João Silva", "Pedreiro", 100, "X", 150], ["TOTAL", "", 999, "", 999]];
    const resultado = interpretarHorasExtras(rows, 1, { sheetName: "HORAS EXTRAS JULHO", fileModifiedAt: "2026-07-15T00:00:00Z" });
    expect(resultado.exceptions.some((e) => e.type === "total_nao_confere")).toBe(true);
  });

  it("não sinaliza total_nao_confere quando a soma aplicada bate com a linha TOTAL", () => {
    const rows = [header, ["João Silva", "Pedreiro", 100, "X", 150], ["TOTAL", "", 100, "", 150]];
    const resultado = interpretarHorasExtras(rows, 1, { sheetName: "HORAS EXTRAS JULHO", fileModifiedAt: "2026-07-15T00:00:00Z" });
    expect(resultado.exceptions.some((e) => e.type === "total_nao_confere")).toBe(false);
  });
});

describe("interpretarAusenciaPontoSaida", () => {
  const header = ["COLABORADOR", "DIA", "HORAS DESCONTADAS", "HORAS EXTRAS", "SALÁRIO", "VALOR HORA", "VALOR HORA + 60%", "VALOR HORAS EXTRAS", "VALOR REF. HORAS DESCONTADAS", "TOTAL"];

  it("recalcula e não gera exceção quando o total da planilha confere", () => {
    // salario=2200 -> valor_hora=10; valor_hora_mais=16; 2h extra=32; 1h desconto=10; total=42
    const rows = [header, ["Maria", "2026-07-10", 1, 2, 2200, "", "", "", "", 42]];
    const resultado = interpretarAusenciaPontoSaida(rows, 1);
    expect(resultado.exceptions.some((e) => e.type === "formula_divergente")).toBe(false);
    expect(resultado.rows[0].data.total).toBe(42);
  });

  it("sinaliza formula_divergente sem corrigir o valor quando a planilha diverge", () => {
    const rows = [header, ["Maria", "2026-07-10", 1, 2, 2200, "", "", "", "", 999]];
    const resultado = interpretarAusenciaPontoSaida(rows, 1);
    const divergencia = resultado.exceptions.find((e) => e.type === "formula_divergente");
    expect(divergencia).toBeDefined();
    expect(divergencia?.severity).toBe("confirmacao");
    // Regra de Ouro 4: nunca corrige - guarda o valor da PLANILHA, não o recalculado
    expect(resultado.rows[0].data.total).toBe(999);
  });

  it("aceita DIA com múltiplas datas em texto (ano do arquivo) e usa o texto normalizado na chave", () => {
    const rows = [header, ["Kauê", "13 e 20/08", 1, 2, 2200, "", "", "", "", 42]];
    const resultado = interpretarAusenciaPontoSaida(rows, 1, { sheetName: "AUSÊNCIA PONTO SAÍDA", fileModifiedAt: "2026-08-15T00:00:00Z" });
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0].data.dia).toBeNull();
    expect(resultado.rows[0].data.dia_texto).toBe("13 e 20/08");
    expect(resultado.rows[0].data.dias).toEqual(["2026-08-13", "2026-08-20"]);
    expect(resultado.rows[0].natural_key).toContain("13 E 20/08");
  });

  it("DIA com texto não reconhecível continua sendo ignorado (comportamento anterior preservado)", () => {
    const rows = [header, ["Fulano", "texto qualquer", 1, 2, 2200, "", "", "", "", 42]];
    const resultado = interpretarAusenciaPontoSaida(rows, 1, { sheetName: "AUSÊNCIA PONTO SAÍDA", fileModifiedAt: "2026-08-15T00:00:00Z" });
    expect(resultado.rows).toHaveLength(0);
  });
});

describe("interpretarPlanilha1", () => {
  it("transforma a grade em uma lista de categorias não vazias", () => {
    const resultado = interpretarPlanilha1([["FROTA", "OUTROS"], [null, "COMBUSTÍVEL"]]);
    expect(resultado.listKey).toBe("caixa.categorias");
    expect(resultado.items).toEqual(["FROTA", "OUTROS", "COMBUSTÍVEL"]);
  });
});
