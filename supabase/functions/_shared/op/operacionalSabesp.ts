// =============================================
// MÓDULO OPERACIONAL: interpretadores do perfil "operacional_sabesp"
// =============================================
// Funções puras (sem banco, sem rede) - Regra de Ouro 7. Testadas em
// operacionalSabesp.test.ts. Algumas validações precisam conferir dados de
// OUTRA aba (ex. 04 contra o cadastro da 03) - para não violar "sem acesso a
// banco", quem busca esses dados é a edge function (que tem acesso ao banco);
// a função pura só recebe o resultado já pronto (ex. um Set de IDs
// conhecidos) como parâmetro de contexto, opcional.

import { normalizarRotulo, celulaVazia, parseNumeroBR, parseDataISO, localizarCabecalho } from "./parsing.ts";

export interface InterpretedRow {
  natural_key: string;
  data: Record<string, unknown>;
  source_row: number;
}

export interface InterpretedException {
  row_number: number;
  severity: "bloqueante" | "confirmacao" | "aviso";
  type: string;
  message: string;
  value_current?: unknown;
  value_suggested?: unknown;
}

export interface InterpreterResultSabesp {
  sheetKey: string;
  rows: InterpretedRow[];
  exceptions: InterpretedException[];
  rejectedCount: number;
}

// Rótulo de cabeçalho -> chave de campo estável (ex. "Nº OS SABESP" -> "n_os_sabesp").
function chaveDeCampo(rotulo: string): string {
  return rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function construirColunas(headerRow: string[], rotulos: string[]) {
  return rotulos.map((rotulo) => ({ rotulo, campo: chaveDeCampo(rotulo), idx: headerRow.indexOf(normalizarRotulo(rotulo)) }));
}

function extrairDados(row: unknown[], colunas: { rotulo: string; campo: string; idx: number }[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const { campo, idx } of colunas) {
    data[campo] = idx >= 0 ? row[idx] ?? null : null;
  }
  return data;
}

// --------------------------------------------------------------------------
// 03. CADASTRO DE SERVIÇOS -> chamado
// --------------------------------------------------------------------------
const HEADER_CADASTRO_SERVICOS = ["ID", "CONTRATO", "Nº OS SABESP", "DATA DA SOLICITAÇÃO", "PRAZO", "DATA LIMITE", "TIPO DE SERVIÇO", "ENDEREÇO", "STATUS"];

export function interpretarCadastroServicos(rows: unknown[][], firstRowNumber: number): InterpreterResultSabesp {
  const exceptions: InterpretedException[] = [];
  const interpretedRows: InterpretedRow[] = [];
  let rejectedCount = 0;

  const headerIdx = localizarCabecalho(rows, HEADER_CADASTRO_SERVICOS, 12, 0.7);
  if (headerIdx === null) return { sheetKey: "operacional_sabesp.chamado", rows: [], exceptions: [], rejectedCount: 0 };

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colunas = construirColunas(headerRow, HEADER_CADASTRO_SERVICOS);
  const colId = colunas.find((c) => c.rotulo === "ID")!.idx;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;

    const id = row[colId];
    const outrasPreenchidas = colunas.some((c) => c.idx >= 0 && c.idx !== colId && !celulaVazia(row[c.idx]));

    if (celulaVazia(id)) {
      if (outrasPreenchidas) {
        exceptions.push({ row_number: rowNumber, severity: "bloqueante", type: "id_ausente", message: "Linha de chamado sem ID, mas com outras colunas preenchidas" });
        rejectedCount++;
      }
      continue;
    }

    interpretedRows.push({ natural_key: String(id).trim(), data: extrairDados(row, colunas), source_row: rowNumber });
  }

  return { sheetKey: "operacional_sabesp.chamado", rows: interpretedRows, exceptions, rejectedCount };
}

// --------------------------------------------------------------------------
// 04. PROGRAMAÇÃO DIÁRIA -> programacao
// --------------------------------------------------------------------------
const HEADER_PROGRAMACAO = ["DATA", "CONTRATO", "EQUIPE", "SEQ", "ID DO SERVIÇO", "EXECUTOU?"];

export interface ProgramacaoContext {
  chamadosConhecidos?: Set<string>;
}

export function interpretarProgramacaoDiaria(
  rows: unknown[][],
  firstRowNumber: number,
  context: ProgramacaoContext = {}
): InterpreterResultSabesp {
  const exceptions: InterpretedException[] = [];
  const interpretedRows: InterpretedRow[] = [];

  const headerIdx = localizarCabecalho(rows, HEADER_PROGRAMACAO, 12, 0.7);
  if (headerIdx === null) return { sheetKey: "operacional_sabesp.programacao", rows: [], exceptions: [], rejectedCount: 0 };

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colunas = construirColunas(headerRow, HEADER_PROGRAMACAO);
  const colIndex = (rotulo: string) => headerRow.indexOf(normalizarRotulo(rotulo));
  const colData = colIndex("DATA");
  const colContrato = colIndex("CONTRATO");
  const colEquipe = colIndex("EQUIPE");
  const colIdServico = colIndex("ID DO SERVIÇO");
  const colExecutou = colIndex("EXECUTOU?");
  const colMotivo = colIndex("MOTIVO");

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;

    const data = parseDataISO(row[colData]);
    const contrato = row[colContrato];
    const equipe = row[colEquipe];
    const idServico = row[colIdServico];

    if (celulaVazia(contrato) && celulaVazia(equipe) && celulaVazia(idServico) && celulaVazia(row[colData])) continue;
    if (!data || celulaVazia(contrato) || celulaVazia(equipe) || celulaVazia(idServico)) continue;

    const idServicoStr = String(idServico).trim();
    if (context.chamadosConhecidos && !context.chamadosConhecidos.has(idServicoStr)) {
      exceptions.push({
        row_number: rowNumber,
        severity: "confirmacao",
        type: "id_inexistente_no_cadastro",
        message: `ID do serviço "${idServicoStr}" não encontrado em 03. CADASTRO DE SERVIÇOS`,
        value_current: idServicoStr,
      });
    }

    if (normalizarRotulo(row[colExecutou]) === "NAO") {
      const motivo = colMotivo >= 0 ? row[colMotivo] : undefined;
      if (celulaVazia(motivo)) {
        exceptions.push({ row_number: rowNumber, severity: "aviso", type: "executou_nao_sem_motivo", message: "EXECUTOU? = NÃO sem motivo informado" });
      }
    }

    interpretedRows.push({
      natural_key: `${data}|${String(contrato).trim()}|${String(equipe).trim()}|${idServicoStr}`,
      data: extrairDados(row, colunas),
      source_row: rowNumber,
    });
  }

  return { sheetKey: "operacional_sabesp.programacao", rows: interpretedRows, exceptions, rejectedCount: 0 };
}

// --------------------------------------------------------------------------
// 05. ORDENS DE SERVIÇO -> os
// --------------------------------------------------------------------------
const HEADER_OS = ["ID DO SERVIÇO", "CONTRATO", "EQUIPE", "DATA DE INÍCIO", "DATA DE CONCLUSÃO", "PAVIMENTO REPOSTO?", "FOTO ANTES", "FOTO DEPOIS", "STATUS DA OS"];

export function interpretarOrdensServico(rows: unknown[][], firstRowNumber: number): InterpreterResultSabesp {
  const exceptions: InterpretedException[] = [];
  const interpretedRows: InterpretedRow[] = [];

  const headerIdx = localizarCabecalho(rows, HEADER_OS, 12, 0.7);
  if (headerIdx === null) return { sheetKey: "operacional_sabesp.os", rows: [], exceptions: [], rejectedCount: 0 };

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colunas = construirColunas(headerRow, HEADER_OS);
  const colIndex = (rotulo: string) => headerRow.indexOf(normalizarRotulo(rotulo));
  const colId = colIndex("ID DO SERVIÇO");
  const colPavimento = colIndex("PAVIMENTO REPOSTO?");
  const colFotoAntes = colIndex("FOTO ANTES");
  const colFotoDepois = colIndex("FOTO DEPOIS");
  const colStatus = colIndex("STATUS DA OS");

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;
    const id = row[colId];
    if (celulaVazia(id)) continue;

    const statusOs = normalizarRotulo(row[colStatus]);
    const concluida = statusOs.includes("CONCLUIDA");
    const pavimentoAfirmativo = normalizarRotulo(row[colPavimento]) === "SIM";
    const temFotoAntes = !celulaVazia(row[colFotoAntes]);
    const temFotoDepois = !celulaVazia(row[colFotoDepois]);
    const semEvidencia = concluida && (!temFotoAntes || !temFotoDepois || !pavimentoAfirmativo);

    if (semEvidencia) {
      exceptions.push({
        row_number: rowNumber,
        severity: "confirmacao",
        type: "os_sem_evidencia",
        message: `OS "${id}" concluída sem evidência completa (fotos e/ou pavimento reposto) - não pode ir para medição`,
      });
    }

    interpretedRows.push({
      natural_key: String(id).trim(),
      data: { ...extrairDados(row, colunas), sem_evidencia: semEvidencia },
      source_row: rowNumber,
    });
  }

  return { sheetKey: "operacional_sabesp.os", rows: interpretedRows, exceptions, rejectedCount: 0 };
}

// --------------------------------------------------------------------------
// 06. APONTAMENTO DIÁRIO -> apontamento
// --------------------------------------------------------------------------
const HEADER_APONTAMENTO = ["DATA", "CONTRATO", "EQUIPE", "Nº PESSOAS", "H NORMAIS", "H EXTRAS", "HH TOTAL", "SERV. PROGRAMADOS", "SERV. EXECUTADOS", "VALOR PRODUZIDO"];

export function interpretarApontamentoDiario(rows: unknown[][], firstRowNumber: number): InterpreterResultSabesp {
  const interpretedRows: InterpretedRow[] = [];

  const headerIdx = localizarCabecalho(rows, HEADER_APONTAMENTO, 12, 0.7);
  if (headerIdx === null) return { sheetKey: "operacional_sabesp.apontamento", rows: [], exceptions: [], rejectedCount: 0 };

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colunas = construirColunas(headerRow, HEADER_APONTAMENTO);
  const colIndex = (rotulo: string) => headerRow.indexOf(normalizarRotulo(rotulo));
  const colData = colIndex("DATA");
  const colContrato = colIndex("CONTRATO");
  const colEquipe = colIndex("EQUIPE");

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;

    const data = parseDataISO(row[colData]);
    const contrato = row[colContrato];
    const equipe = row[colEquipe];
    if (!data || celulaVazia(contrato) || celulaVazia(equipe)) continue;

    interpretedRows.push({
      natural_key: `${data}|${String(contrato).trim()}|${String(equipe).trim()}`,
      data: extrairDados(row, colunas),
      source_row: rowNumber,
    });
  }

  return { sheetKey: "operacional_sabesp.apontamento", rows: interpretedRows, exceptions: [], rejectedCount: 0 };
}

// --------------------------------------------------------------------------
// 08. EQUIPE -> pessoa
// --------------------------------------------------------------------------
const HEADER_EQUIPE = ["MATRÍCULA", "CONTRATO", "EQUIPE", "NOME", "FUNÇÃO", "ASO", "NR-06", "NR-10", "NR-18", "NR-33", "NR-35", "CNH", "ATIVO?"];

export function interpretarEquipe(rows: unknown[][], firstRowNumber: number): InterpreterResultSabesp {
  const exceptions: InterpretedException[] = [];
  const interpretedRows: InterpretedRow[] = [];

  const headerIdx = localizarCabecalho(rows, HEADER_EQUIPE, 12, 0.7);
  if (headerIdx === null) return { sheetKey: "operacional_sabesp.pessoa", rows: [], exceptions: [], rejectedCount: 0 };

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colunas = construirColunas(headerRow, HEADER_EQUIPE);
  const colIndex = (rotulo: string) => headerRow.indexOf(normalizarRotulo(rotulo));
  const colMatricula = colIndex("MATRÍCULA");
  const colNome = colIndex("NOME");

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;
    const nome = row[colNome];
    const matricula = row[colMatricula];
    if (celulaVazia(nome) && celulaVazia(matricula)) continue;

    let chave: string;
    if (celulaVazia(matricula)) {
      chave = `pessoa_sem_matricula|${normalizarRotulo(nome)}`;
      exceptions.push({ row_number: rowNumber, severity: "aviso", type: "matricula_ausente", message: `Pessoa "${nome}" sem matrícula - usando nome como chave` });
    } else {
      chave = String(matricula).trim();
    }

    interpretedRows.push({ natural_key: chave, data: extrairDados(row, colunas), source_row: rowNumber });
  }

  return { sheetKey: "operacional_sabesp.pessoa", rows: interpretedRows, exceptions, rejectedCount: 0 };
}

// --------------------------------------------------------------------------
// 09. MEDIÇÃO -> medicao_item
// --------------------------------------------------------------------------
const HEADER_MEDICAO = ["Nº BOLETIM", "MÊS DE MEDIÇÃO", "ID DO SERVIÇO", "CONTRATO", "CÓD. PREÇO", "QTD", "PREÇO UNIT.", "VALOR", "STATUS DA MEDIÇÃO", "VALOR GLOSADO", "VALOR APROVADO"];

export interface MedicaoContext {
  osNaoElegiveis?: Set<string>;
}

export function interpretarMedicao(rows: unknown[][], firstRowNumber: number, context: MedicaoContext = {}): InterpreterResultSabesp {
  const exceptions: InterpretedException[] = [];
  const interpretedRows: InterpretedRow[] = [];

  const headerIdx = localizarCabecalho(rows, HEADER_MEDICAO, 12, 0.7);
  if (headerIdx === null) return { sheetKey: "operacional_sabesp.medicao_item", rows: [], exceptions: [], rejectedCount: 0 };

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colunas = construirColunas(headerRow, HEADER_MEDICAO);
  const colIndex = (rotulo: string) => headerRow.indexOf(normalizarRotulo(rotulo));
  const colBoletim = colIndex("Nº BOLETIM");
  const colIdServico = colIndex("ID DO SERVIÇO");
  const colCodPreco = colIndex("CÓD. PREÇO");
  const colQtd = colIndex("QTD");
  const colPrecoUnit = colIndex("PREÇO UNIT.");
  const colValor = colIndex("VALOR");
  const colValorGlosado = colIndex("VALOR GLOSADO");
  const colMotivoGlosa = colIndex("MOTIVO GLOSA");

  const contadorChave = new Map<string, number>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;
    const boletim = row[colBoletim];
    const idServico = row[colIdServico];
    const codPreco = row[colCodPreco];
    if (celulaVazia(boletim) && celulaVazia(idServico) && celulaVazia(codPreco)) continue;

    const qtd = parseNumeroBR(row[colQtd]) ?? 0;
    const precoUnit = parseNumeroBR(row[colPrecoUnit]) ?? 0;
    const valor = parseNumeroBR(row[colValor]);
    const valorEsperado = qtd * precoUnit;

    if (valor !== null && Math.abs(valor - valorEsperado) > 0.01) {
      exceptions.push({
        row_number: rowNumber,
        severity: "confirmacao",
        type: "valor_item_diverge",
        message: `VALOR (${valor.toFixed(2)}) diverge de QTD × PREÇO UNIT. (${valorEsperado.toFixed(2)})`,
        value_current: valor,
        value_suggested: valorEsperado,
      });
    }

    const valorGlosado = parseNumeroBR(row[colValorGlosado]);
    if (valorGlosado && valorGlosado > 0) {
      const motivoGlosa = colMotivoGlosa >= 0 ? row[colMotivoGlosa] : undefined;
      if (celulaVazia(motivoGlosa)) {
        exceptions.push({ row_number: rowNumber, severity: "aviso", type: "glosa_sem_motivo", message: "Valor glosado sem motivo informado" });
      }
    }

    const idServicoStr = String(idServico).trim();
    if (context.osNaoElegiveis?.has(idServicoStr)) {
      exceptions.push({
        row_number: rowNumber,
        severity: "confirmacao",
        type: "medicao_de_os_nao_elegivel",
        message: `Medição referencia a OS "${idServicoStr}", que está sem evidência completa (não elegível para medição)`,
      });
    }

    const baseChave = `${String(boletim).trim()}|${idServicoStr}|${String(codPreco).trim()}`;
    const n = contadorChave.get(baseChave) ?? 0;
    contadorChave.set(baseChave, n + 1);

    interpretedRows.push({ natural_key: `${baseChave}#${n}`, data: extrairDados(row, colunas), source_row: rowNumber });
  }

  return { sheetKey: "operacional_sabesp.medicao_item", rows: interpretedRows, exceptions, rejectedCount: 0 };
}

// --------------------------------------------------------------------------
// 11. OCORRÊNCIAS -> ocorrencia
// --------------------------------------------------------------------------
const HEADER_OCORRENCIAS = ["Nº", "DATA", "CONTRATO", "TIPO DE OCORRÊNCIA", "GRAVIDADE", "DESCRIÇÃO DO FATO", "STATUS"];

export function interpretarOcorrencias(rows: unknown[][], firstRowNumber: number): InterpreterResultSabesp {
  const interpretedRows: InterpretedRow[] = [];

  const headerIdx = localizarCabecalho(rows, HEADER_OCORRENCIAS, 12, 0.7);
  if (headerIdx === null) return { sheetKey: "operacional_sabesp.ocorrencia", rows: [], exceptions: [], rejectedCount: 0 };

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colunas = construirColunas(headerRow, HEADER_OCORRENCIAS);
  const colNumero = headerRow.indexOf(normalizarRotulo("Nº"));

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;
    const numero = row[colNumero];
    if (celulaVazia(numero)) continue;

    interpretedRows.push({ natural_key: String(numero).trim(), data: extrairDados(row, colunas), source_row: rowNumber });
  }

  return { sheetKey: "operacional_sabesp.ocorrencia", rows: interpretedRows, exceptions: [], rejectedCount: 0 };
}

// --------------------------------------------------------------------------
// 12. FATURAMENTO -> faturamento_mes
// --------------------------------------------------------------------------
const HEADER_FATURAMENTO = ["MÊS", "CONTRATO", "MEDIÇÃO BRUTA", "GLOSA", "MEDIÇÃO APROVADA", "Nº DA NF", "VALOR RECEBIDO", "STATUS"];

export function interpretarFaturamento(rows: unknown[][], firstRowNumber: number): InterpreterResultSabesp {
  const interpretedRows: InterpretedRow[] = [];

  const headerIdx = localizarCabecalho(rows, HEADER_FATURAMENTO, 12, 0.7);
  if (headerIdx === null) return { sheetKey: "operacional_sabesp.faturamento_mes", rows: [], exceptions: [], rejectedCount: 0 };

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colunas = construirColunas(headerRow, HEADER_FATURAMENTO);
  const colIndex = (rotulo: string) => headerRow.indexOf(normalizarRotulo(rotulo));
  const colMes = colIndex("MÊS");
  const colContrato = colIndex("CONTRATO");
  const colMedicaoBruta = colIndex("MEDIÇÃO BRUTA");
  const colGlosa = colIndex("GLOSA");
  const colMedicaoAprovada = colIndex("MEDIÇÃO APROVADA");
  const colNf = colIndex("Nº DA NF");
  const colValorRecebido = colIndex("VALOR RECEBIDO");

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;
    const mes = row[colMes];
    const contrato = row[colContrato];
    if (celulaVazia(mes) && celulaVazia(contrato)) continue;

    // "Moldura vazia": só MÊS/CONTRATO preenchidos, nenhum valor nem NF - ignora.
    const temAlgumValor = [colMedicaoBruta, colGlosa, colMedicaoAprovada, colNf, colValorRecebido].some((idx) => idx >= 0 && !celulaVazia(row[idx]));
    if (!temAlgumValor) continue;

    interpretedRows.push({
      natural_key: `${String(mes).trim()}|${String(contrato).trim()}`,
      data: extrairDados(row, colunas),
      source_row: rowNumber,
    });
  }

  return { sheetKey: "operacional_sabesp.faturamento_mes", rows: interpretedRows, exceptions: [], rejectedCount: 0 };
}
