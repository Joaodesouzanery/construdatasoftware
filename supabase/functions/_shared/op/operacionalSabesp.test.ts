import { describe, it, expect } from "vitest";
import {
  interpretarCadastroServicos,
  interpretarProgramacaoDiaria,
  interpretarOrdensServico,
  interpretarApontamentoDiario,
  interpretarEquipe,
  interpretarMedicao,
  interpretarOcorrencias,
  interpretarFaturamento,
} from "./operacionalSabesp.ts";

describe("interpretarCadastroServicos", () => {
  const header = ["ID", "CONTRATO", "Nº OS SABESP", "DATA DA SOLICITAÇÃO", "PRAZO", "DATA LIMITE", "TIPO DE SERVIÇO", "ENDEREÇO", "STATUS"];

  it("usa ID como chave natural", () => {
    const rows = [header, ["BER-0001", "C1", "OS-1", "2026-07-01", "10", "2026-07-11", "VAZAMENTO", "RUA A", "ABERTO"]];
    const resultado = interpretarCadastroServicos(rows, 1);
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0].natural_key).toBe("BER-0001");
  });

  it("ID ausente com outras colunas preenchidas gera bloqueante e rejeita a linha", () => {
    const rows = [header, ["", "C1", "OS-1", "", "", "", "", "", ""]];
    const resultado = interpretarCadastroServicos(rows, 1);
    expect(resultado.rows).toHaveLength(0);
    expect(resultado.rejectedCount).toBe(1);
    expect(resultado.exceptions[0].type).toBe("id_ausente");
  });

  it("linha completamente vazia é ignorada sem exceção", () => {
    const rows = [header, ["", "", "", "", "", "", "", "", ""]];
    const resultado = interpretarCadastroServicos(rows, 1);
    expect(resultado.rows).toHaveLength(0);
    expect(resultado.exceptions).toHaveLength(0);
  });
});

describe("interpretarProgramacaoDiaria", () => {
  const header = ["DATA", "CONTRATO", "EQUIPE", "SEQ", "ID DO SERVIÇO", "EXECUTOU?"];

  it("gera confirmacao quando o ID do serviço não está no cadastro conhecido", () => {
    const rows = [header, ["2026-07-05", "C1", "EQ-01", 1, "BER-9999", "SIM"]];
    const resultado = interpretarProgramacaoDiaria(rows, 1, { chamadosConhecidos: new Set(["BER-0001"]) });
    expect(resultado.exceptions.some((e) => e.type === "id_inexistente_no_cadastro")).toBe(true);
  });

  it("não gera confirmacao quando o ID está no cadastro conhecido", () => {
    const rows = [header, ["2026-07-05", "C1", "EQ-01", 1, "BER-0001", "SIM"]];
    const resultado = interpretarProgramacaoDiaria(rows, 1, { chamadosConhecidos: new Set(["BER-0001"]) });
    expect(resultado.exceptions.some((e) => e.type === "id_inexistente_no_cadastro")).toBe(false);
  });

  it("EXECUTOU?=NÃO sem motivo gera aviso", () => {
    const rows = [header, ["2026-07-05", "C1", "EQ-01", 1, "BER-0001", "Não"]];
    const resultado = interpretarProgramacaoDiaria(rows, 1);
    expect(resultado.exceptions.some((e) => e.type === "executou_nao_sem_motivo")).toBe(true);
  });

  it("chave natural combina data, contrato, equipe e id do serviço", () => {
    const rows = [header, ["2026-07-05", "C1", "EQ-01", 1, "BER-0001", "SIM"]];
    const resultado = interpretarProgramacaoDiaria(rows, 1);
    expect(resultado.rows[0].natural_key).toBe("2026-07-05|C1|EQ-01|BER-0001");
  });
});

describe("interpretarOrdensServico", () => {
  const header = ["ID DO SERVIÇO", "CONTRATO", "EQUIPE", "DATA DE INÍCIO", "DATA DE CONCLUSÃO", "PAVIMENTO REPOSTO?", "FOTO ANTES", "FOTO DEPOIS", "STATUS DA OS"];

  it("OS concluída com evidência completa não gera exceção", () => {
    const rows = [header, ["BER-0001", "C1", "EQ-01", "2026-07-01", "2026-07-05", "Sim", "foto1.jpg", "foto2.jpg", "Concluída"]];
    const resultado = interpretarOrdensServico(rows, 1);
    expect(resultado.exceptions).toHaveLength(0);
    expect(resultado.rows[0].data.sem_evidencia).toBe(false);
  });

  it("OS concluída sem foto gera confirmacao os_sem_evidencia", () => {
    const rows = [header, ["BER-0001", "C1", "EQ-01", "2026-07-01", "2026-07-05", "Sim", "", "foto2.jpg", "Concluída"]];
    const resultado = interpretarOrdensServico(rows, 1);
    expect(resultado.exceptions.some((e) => e.type === "os_sem_evidencia")).toBe(true);
    expect(resultado.rows[0].data.sem_evidencia).toBe(true);
  });

  it("OS em aberto (não concluída) não exige evidência", () => {
    const rows = [header, ["BER-0001", "C1", "EQ-01", "2026-07-01", "", "Não", "", "", "Em andamento"]];
    const resultado = interpretarOrdensServico(rows, 1);
    expect(resultado.exceptions).toHaveLength(0);
  });
});

describe("interpretarApontamentoDiario", () => {
  const header = ["DATA", "CONTRATO", "EQUIPE", "Nº PESSOAS", "H NORMAIS", "H EXTRAS", "HH TOTAL", "SERV. PROGRAMADOS", "SERV. EXECUTADOS", "VALOR PRODUZIDO"];

  it("chave combina data, contrato e equipe", () => {
    const rows = [header, ["2026-07-05", "C1", "EQ-01", 5, 40, 4, 44, 3, 3, 5000]];
    const resultado = interpretarApontamentoDiario(rows, 1);
    expect(resultado.rows[0].natural_key).toBe("2026-07-05|C1|EQ-01");
  });
});

describe("interpretarEquipe", () => {
  const header = ["MATRÍCULA", "CONTRATO", "EQUIPE", "NOME", "FUNÇÃO", "ASO", "NR-06", "NR-10", "NR-18", "NR-33", "NR-35", "CNH", "ATIVO?"];

  it("usa matrícula como chave quando presente", () => {
    const rows = [header, ["M001", "C1", "EQ-01", "João Silva", "Pedreiro", "OK", "OK", "", "", "", "", "", "Sim"]];
    const resultado = interpretarEquipe(rows, 1);
    expect(resultado.rows[0].natural_key).toBe("M001");
    expect(resultado.exceptions).toHaveLength(0);
  });

  it("sem matrícula usa nome normalizado como chave e gera aviso", () => {
    const rows = [header, ["", "C1", "EQ-01", "João Silva", "Pedreiro", "", "", "", "", "", "", "", "Sim"]];
    const resultado = interpretarEquipe(rows, 1);
    expect(resultado.exceptions[0].type).toBe("matricula_ausente");
    expect(resultado.rows[0].natural_key).toContain("JOAO SILVA");
  });
});

describe("interpretarMedicao", () => {
  const header = ["Nº BOLETIM", "MÊS DE MEDIÇÃO", "ID DO SERVIÇO", "CONTRATO", "CÓD. PREÇO", "QTD", "PREÇO UNIT.", "VALOR", "STATUS DA MEDIÇÃO", "VALOR GLOSADO", "VALOR APROVADO"];

  it("não gera exceção quando VALOR confere com QTD x PREÇO UNIT.", () => {
    const rows = [header, ["B001", "2026-07", "BER-0001", "C1", "P001", 10, 5, 50, "Aprovada", 0, 50]];
    const resultado = interpretarMedicao(rows, 1);
    expect(resultado.exceptions.some((e) => e.type === "valor_item_diverge")).toBe(false);
  });

  it("gera confirmacao valor_item_diverge quando VALOR não confere", () => {
    const rows = [header, ["B001", "2026-07", "BER-0001", "C1", "P001", 10, 5, 999, "Aprovada", 0, 50]];
    const resultado = interpretarMedicao(rows, 1);
    const divergencia = resultado.exceptions.find((e) => e.type === "valor_item_diverge");
    expect(divergencia).toBeDefined();
    expect(divergencia?.severity).toBe("confirmacao");
  });

  it("glosa sem motivo gera aviso", () => {
    const rows = [header, ["B001", "2026-07", "BER-0001", "C1", "P001", 10, 5, 50, "Aprovada", 10, 40]];
    const resultado = interpretarMedicao(rows, 1);
    expect(resultado.exceptions.some((e) => e.type === "glosa_sem_motivo")).toBe(true);
  });

  it("item referenciando OS não elegível gera confirmacao", () => {
    const rows = [header, ["B001", "2026-07", "BER-0001", "C1", "P001", 10, 5, 50, "Aprovada", 0, 50]];
    const resultado = interpretarMedicao(rows, 1, { osNaoElegiveis: new Set(["BER-0001"]) });
    expect(resultado.exceptions.some((e) => e.type === "medicao_de_os_nao_elegivel")).toBe(true);
  });

  it("disambigua chaves duplicadas de boletim+id+código com sufixo incremental", () => {
    const rows = [header, ["B001", "2026-07", "BER-0001", "C1", "P001", 1, 1, 1, "Aprovada", 0, 1], ["B001", "2026-07", "BER-0001", "C1", "P001", 2, 1, 2, "Aprovada", 0, 2]];
    const resultado = interpretarMedicao(rows, 1);
    const chaves = resultado.rows.map((r) => r.natural_key);
    expect(chaves).toEqual(["B001|BER-0001|P001#0", "B001|BER-0001|P001#1"]);
  });
});

describe("interpretarOcorrencias", () => {
  const header = ["Nº", "DATA", "CONTRATO", "TIPO DE OCORRÊNCIA", "GRAVIDADE", "DESCRIÇÃO DO FATO", "STATUS"];

  it("usa Nº como chave natural", () => {
    const rows = [header, [1, "2026-07-05", "C1", "VAZAMENTO", "ALTA", "Vazamento na rua A", "Aberta"]];
    const resultado = interpretarOcorrencias(rows, 1);
    expect(resultado.rows[0].natural_key).toBe("1");
  });
});

describe("interpretarFaturamento", () => {
  const header = ["MÊS", "CONTRATO", "MEDIÇÃO BRUTA", "GLOSA", "MEDIÇÃO APROVADA", "Nº DA NF", "VALOR RECEBIDO", "STATUS"];

  it("ignora linha 'moldura vazia' (só mês/contrato, sem nenhum valor)", () => {
    const rows = [header, ["2026-07", "C1", "", "", "", "", "", ""]];
    const resultado = interpretarFaturamento(rows, 1);
    expect(resultado.rows).toHaveLength(0);
  });

  it("aplica a linha quando há pelo menos um valor preenchido", () => {
    const rows = [header, ["2026-07", "C1", 100000, 2000, 98000, "NF-123", 98000, "Pago"]];
    const resultado = interpretarFaturamento(rows, 1);
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0].natural_key).toBe("2026-07|C1");
  });
});
