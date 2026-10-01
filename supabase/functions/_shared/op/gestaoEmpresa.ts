// =============================================
// MÓDULO OPERACIONAL: interpretadores do perfil "gestao_empresa"
// =============================================
// Funções puras (sem banco, sem rede) - Regra de Ouro 7. Testadas em
// gestaoEmpresa.test.ts. Diferente dos perfis caixa/operacional_sabesp, estas
// 5 abas não são tabelas simples - são blocos de texto/indicadores com
// marcadores (ex. "OS NÚMEROS DA SEMANA", "A · PONTE LUCRO → CAIXA",
// "MASTER CHECK") que precisam ser localizados por conteúdo, não por posição
// fixa. As ~26 abas restantes do perfil ficam "nao_interpretada" por
// enquanto, conforme o escopo combinado para esta fase.

import { normalizarRotulo, celulaVazia, parseNumeroBR, localizarCabecalho } from "./parsing.ts";

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

export interface InterpreterResultGestao {
  sheetKey: string;
  rows: InterpretedRow[];
  exceptions: InterpretedException[];
  rejectedCount: number;
}

function chaveDeCampo(rotulo: string): string {
  return rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Procura uma célula cujo texto comece com `rotulo` e devolve o valor que vem
// depois de ":" na mesma célula, ou a próxima célula não vazia na mesma linha.
function buscarValorPorRotulo(rows: unknown[][], rotulo: string): unknown {
  const rotuloNormalizado = normalizarRotulo(rotulo);
  for (const linha of rows) {
    for (let c = 0; c < (linha ?? []).length; c++) {
      if (normalizarRotulo(linha[c]).startsWith(rotuloNormalizado)) {
        const partes = String(linha[c] ?? "").split(":");
        if (partes.length > 1 && partes[1].trim() !== "") return partes[1].trim();
        for (let c2 = c + 1; c2 < linha.length; c2++) {
          if (!celulaVazia(linha[c2])) return linha[c2];
        }
      }
    }
  }
  return null;
}

// --------------------------------------------------------------------------
// "01C. PLACAR SEMANAL" -> placar_semanal
// --------------------------------------------------------------------------
export function interpretarPlacarSemanal(rows: unknown[][], firstRowNumber: number): InterpreterResultGestao {
  const interpretedRows: InterpretedRow[] = [];

  let idxMarcador = -1;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i] ?? []).some((celula) => normalizarRotulo(celula).includes("OS NUMEROS DA SEMANA"))) {
      idxMarcador = i;
      break;
    }
  }
  if (idxMarcador === -1) return { sheetKey: "gestao_empresa.placar_semanal", rows: [], exceptions: [], rejectedCount: 0 };

  // O aviso (ex. "AVISO — PPC...") fica ANTES do marcador - nunca escondido no dashboard (Fase 5).
  let notaDeLeitura: string | null = null;
  for (let i = 0; i < idxMarcador; i++) {
    const linha = (rows[i] ?? []).filter((c) => !celulaVazia(c));
    if (linha.some((c) => normalizarRotulo(c).includes("AVISO"))) {
      notaDeLeitura = linha.map((c) => String(c)).join(" ");
    }
  }

  const trecho = rows.slice(idxMarcador + 1, idxMarcador + 4);
  const headerIdxRelativo = localizarCabecalho(trecho, ["INDICADOR", "VALOR"], 3, 1);
  if (headerIdxRelativo === null) return { sheetKey: "gestao_empresa.placar_semanal", rows: [], exceptions: [], rejectedCount: 0 };

  const headerAbsoluto = idxMarcador + 1 + headerIdxRelativo;
  const headerRow = (rows[headerAbsoluto] ?? []).map(normalizarRotulo);
  const colIndicador = headerRow.indexOf("INDICADOR");
  const colValor = headerRow.indexOf("VALOR");
  const colOrigem = headerRow.findIndex((c) => c.includes("DE ONDE VEM") || c.includes("COMO LER"));

  for (let i = headerAbsoluto + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const indicador = row[colIndicador];
    if (celulaVazia(indicador)) break; // primeira linha vazia encerra a lista

    const rowNumber = firstRowNumber + i;
    interpretedRows.push({
      natural_key: normalizarRotulo(indicador),
      data: {
        indicador: String(indicador),
        valor: parseNumeroBR(row[colValor]),
        origem_texto: colOrigem >= 0 ? row[colOrigem] ?? null : null,
      },
      source_row: rowNumber,
    });
  }

  if (notaDeLeitura) {
    interpretedRows.push({
      natural_key: "_nota_de_leitura",
      data: { indicador: "_nota_de_leitura", valor: null, origem_texto: notaDeLeitura },
      source_row: firstRowNumber,
    });
  }

  return { sheetKey: "gestao_empresa.placar_semanal", rows: interpretedRows, exceptions: [], rejectedCount: 0 };
}

// --------------------------------------------------------------------------
// "08C. RESULTADO POR OBRA" -> resultado_por_obra
// --------------------------------------------------------------------------
const CAMPOS_HEADER_OBRA = [
  "CARGA TRIBUTOS",
  "RESULTADO REAL ACUMULADO",
  "MARGEM REAL",
  "RESULTADO PREVISTO 14 MESES",
  "CAIXA ACUMULADO OBRA",
  "PIOR CAIXA ACUMULADO",
  "NF EM ATRASO",
];

const HEADER_MENSAL_OBRA = [
  "MÊS",
  "MEDIÇÃO PREVISTA",
  "MEDIÇÃO REAL",
  "NF PREVISTA",
  "NF EMITIDA",
  "TRIBUTOS PREVISTOS",
  "TRIBUTOS SOBRE NF EMITIDA",
  "CUSTO PREVISTO",
  "CUSTO LANÇADO",
  "RESULTADO PREVISTO",
];

// A aba pode chegar como uma cópia por obra, ou como aba única com um
// seletor manual - em ambos os casos só existe UMA "OBRA:" no conteúdo
// recebido, então este interpretador simplesmente registra essa obra, sem
// tentar adivinhar se há outras (nunca assume - ver nota no prompt original).
export function interpretarResultadoPorObra(rows: unknown[][], firstRowNumber: number): InterpreterResultGestao {
  const interpretedRows: InterpretedRow[] = [];

  const obra = buscarValorPorRotulo(rows, "OBRA:");
  if (celulaVazia(obra)) return { sheetKey: "gestao_empresa.resultado_por_obra", rows: [], exceptions: [], rejectedCount: 0 };

  const obraTexto = String(obra).trim();
  const obraNormalizada = normalizarRotulo(obraTexto);

  const headerBlock: Record<string, unknown> = { tipo: "header", obra: obraTexto };
  for (const campo of CAMPOS_HEADER_OBRA) {
    headerBlock[chaveDeCampo(campo)] = buscarValorPorRotulo(rows, campo);
  }
  interpretedRows.push({ natural_key: obraNormalizada, data: headerBlock, source_row: firstRowNumber });

  const headerIdx = localizarCabecalho(rows, HEADER_MENSAL_OBRA, 40, 0.8);
  if (headerIdx !== null) {
    const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
    const colunas = HEADER_MENSAL_OBRA.map((rotulo) => ({
      campo: chaveDeCampo(rotulo),
      idx: headerRow.indexOf(normalizarRotulo(rotulo)),
    }));
    const colMes = headerRow.indexOf(normalizarRotulo("MÊS"));

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const mes = row[colMes];
      if (celulaVazia(mes)) break;

      const rowNumber = firstRowNumber + i;
      const data: Record<string, unknown> = { tipo: "mensal", obra: obraTexto };
      for (const { campo, idx } of colunas) data[campo] = idx >= 0 ? row[idx] ?? null : null;

      interpretedRows.push({ natural_key: `${obraNormalizada}|${String(mes).trim()}`, data, source_row: rowNumber });
    }
  }

  return { sheetKey: "gestao_empresa.resultado_por_obra", rows: interpretedRows, exceptions: [], rejectedCount: 0 };
}

// --------------------------------------------------------------------------
// "01B. FUNIL COMERCIAL" -> funil_comercial
// --------------------------------------------------------------------------
const HEADER_FUNIL = ["Nº", "CLIENTE/CONTRATANTE", "OBJETO", "CIDADE", "ETAPA", "VALOR ESTIMADO", "PROBAB.", "VALOR PONDERADO", "PRÓXIMO PASSO", "QUEM"];

export function interpretarFunilComercial(rows: unknown[][], firstRowNumber: number): InterpreterResultGestao {
  const exceptions: InterpretedException[] = [];
  const interpretedRows: InterpretedRow[] = [];

  const headerIdx = localizarCabecalho(rows, HEADER_FUNIL, 12, 0.7);
  if (headerIdx === null) return { sheetKey: "gestao_empresa.funil_comercial", rows: [], exceptions: [], rejectedCount: 0 };

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colIndex = (rotulo: string) => headerRow.indexOf(normalizarRotulo(rotulo));
  const colNumero = colIndex("Nº");
  const colCliente = colIndex("CLIENTE/CONTRATANTE");
  const colObjeto = colIndex("OBJETO");
  const colCidade = colIndex("CIDADE");
  const colEtapa = colIndex("ETAPA");
  const colValorEstimado = colIndex("VALOR ESTIMADO");
  const colProbabilidade = colIndex("PROBAB.");
  const colValorPonderado = colIndex("VALOR PONDERADO");
  const colProximoPasso = colIndex("PRÓXIMO PASSO");
  const colResponsavel = colIndex("QUEM");

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const numero = row[colNumero];
    if (celulaVazia(numero)) continue;

    const rowNumber = firstRowNumber + i;
    const valorEstimado = parseNumeroBR(row[colValorEstimado]);
    const probabilidade = parseNumeroBR(row[colProbabilidade]);
    const valorPonderado = parseNumeroBR(row[colValorPonderado]);

    if (valorEstimado !== null && probabilidade !== null && valorPonderado !== null) {
      const fracao = probabilidade > 1 ? probabilidade / 100 : probabilidade;
      const esperado = valorEstimado * fracao;
      if (Math.abs(esperado - valorPonderado) > 0.01) {
        exceptions.push({
          row_number: rowNumber,
          severity: "aviso",
          type: "funil_ponderado_diverge",
          message: `Valor ponderado (${valorPonderado}) diverge de estimado × probabilidade (${esperado.toFixed(2)})`,
          value_current: valorPonderado,
          value_suggested: esperado,
        });
      }
    }

    interpretedRows.push({
      natural_key: String(numero).trim(),
      data: {
        numero: String(numero),
        cliente: colCliente >= 0 ? row[colCliente] ?? null : null,
        objeto: colObjeto >= 0 ? row[colObjeto] ?? null : null,
        cidade: colCidade >= 0 ? row[colCidade] ?? null : null,
        etapa: colEtapa >= 0 ? row[colEtapa] ?? null : null,
        valor_estimado: valorEstimado,
        probabilidade,
        valor_ponderado: valorPonderado,
        proximo_passo: colProximoPasso >= 0 ? row[colProximoPasso] ?? null : null,
        responsavel: colResponsavel >= 0 ? row[colResponsavel] ?? null : null,
      },
      source_row: rowNumber,
    });
  }

  return { sheetKey: "gestao_empresa.funil_comercial", rows: interpretedRows, exceptions, rejectedCount: 0 };
}

// --------------------------------------------------------------------------
// "11. CONCILIAÇÃO E WIP" (só Bloco A) -> ponte_lucro_caixa
// --------------------------------------------------------------------------
export function interpretarPonteLucroCaixa(rows: unknown[][], firstRowNumber: number): InterpreterResultGestao {
  const interpretedRows: InterpretedRow[] = [];

  let idxMarcador = -1;
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i] ?? []).some((c) => normalizarRotulo(c).includes("PONTE LUCRO"))) {
      idxMarcador = i;
      break;
    }
  }
  if (idxMarcador === -1) return { sheetKey: "gestao_empresa.ponte_lucro_caixa", rows: [], exceptions: [], rejectedCount: 0 };

  const idxMeses = idxMarcador + 1;
  const linhaMeses = rows[idxMeses] ?? [];
  const colunasMes = linhaMeses
    .map((valor, idx) => ({ idx, mes: valor }))
    .filter(({ idx, mes }) => idx > 0 && !celulaVazia(mes));

  let ordem = 0;
  for (let i = idxMeses + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rotulo = row[0];
    if (celulaVazia(rotulo)) break;

    const rotuloTexto = String(rotulo).trim();
    const ehComponente = /^\(\+\)|^\(-\)|^\(−\)/.test(rotuloTexto) || normalizarRotulo(rotuloTexto).startsWith("LUCRO LIQUIDO DO MES");
    if (!ehComponente) break;

    const rowNumber = firstRowNumber + i;
    for (const { idx, mes } of colunasMes) {
      const valor = parseNumeroBR(row[idx]);
      if (valor === null) continue;
      interpretedRows.push({
        natural_key: `${String(mes).trim()}|${normalizarRotulo(rotuloTexto)}`,
        data: { mes: String(mes), componente: rotuloTexto, valor, ordem_linha: ordem },
        source_row: rowNumber,
      });
    }
    ordem++;
  }

  return { sheetKey: "gestao_empresa.ponte_lucro_caixa", rows: interpretedRows, exceptions: [], rejectedCount: 0 };
}

// --------------------------------------------------------------------------
// "13. CHECKS" -> checks_integridade
// --------------------------------------------------------------------------
const HEADER_CHECKS = ["Nº", "CONFERÊNCIA", "VALOR", "RESULTADO", "O QUE FAZER", "ONDE"];

export function interpretarChecksIntegridade(rows: unknown[][], firstRowNumber: number): InterpreterResultGestao {
  const interpretedRows: InterpretedRow[] = [];

  let masterCheck: unknown = null;
  let resumoTexto: string | null = null;
  for (const linha of rows) {
    const idx = (linha ?? []).findIndex((c) => normalizarRotulo(c).includes("MASTER CHECK"));
    if (idx >= 0) {
      const restante = (linha ?? []).slice(idx + 1).filter((c) => !celulaVazia(c));
      masterCheck = restante[0] ?? null;
      resumoTexto = restante.length > 1 ? restante.slice(1).map((c) => String(c)).join(" ") : null;
      break;
    }
  }

  const headerIdx = localizarCabecalho(rows, HEADER_CHECKS, 30, 0.8);
  if (headerIdx === null) {
    const rows2 = masterCheck !== null ? [{ natural_key: "_master_check", data: { master_check: masterCheck, resumo_texto: resumoTexto }, source_row: firstRowNumber }] : [];
    return { sheetKey: "gestao_empresa.checks_integridade", rows: rows2, exceptions: [], rejectedCount: 0 };
  }

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colIndex = (rotulo: string) => headerRow.indexOf(normalizarRotulo(rotulo));
  const colNumero = colIndex("Nº");
  const colConferencia = colIndex("CONFERÊNCIA");
  const colValor = colIndex("VALOR");
  const colResultado = colIndex("RESULTADO");
  const colOQueFazer = colIndex("O QUE FAZER");
  const colOnde = colIndex("ONDE");

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const numero = row[colNumero];
    if (celulaVazia(numero)) continue;

    const rowNumber = firstRowNumber + i;
    interpretedRows.push({
      natural_key: String(numero).trim(),
      data: {
        numero: String(numero),
        conferencia: colConferencia >= 0 ? row[colConferencia] ?? null : null,
        valor: colValor >= 0 ? row[colValor] ?? null : null,
        resultado: colResultado >= 0 ? row[colResultado] ?? null : null,
        o_que_fazer: colOQueFazer >= 0 ? row[colOQueFazer] ?? null : null,
        onde: colOnde >= 0 ? row[colOnde] ?? null : null,
      },
      source_row: rowNumber,
    });
  }

  if (masterCheck !== null) {
    interpretedRows.push({
      natural_key: "_master_check",
      data: { master_check: masterCheck, resumo_texto: resumoTexto },
      source_row: firstRowNumber,
    });
  }

  return { sheetKey: "gestao_empresa.checks_integridade", rows: interpretedRows, exceptions: [], rejectedCount: 0 };
}
