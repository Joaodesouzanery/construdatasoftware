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

import { normalizarRotulo, celulaVazia, parseNumeroBR, localizarCabecalho, localizarCabecalhoPorPrefixo } from "./parsing.ts";
import { parseMesDeCelula } from "./interpretadoresGenericos.ts";

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

// Procura uma célula cujo texto comece com `rotulo` e devolve o valor que vem
// depois de ":" na mesma célula, ou a próxima célula não vazia na mesma linha.
// Exportada - reaproveitada pelos interpretadores dedicados de obra
// (gestaoEmpresaObras.ts): mesmo padrão de busca por rótulo, não por posição.
export function buscarValorPorRotulo(rows: unknown[][], rotulo: string): unknown {
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
// { buscar, campo } em vez de derivar o campo do rótulo de busca: o rótulo
// de busca precisa bater com o texto real da planilha (corrigido contra o snapshot
// real - "CARGA TRIBUTOS", "RESULTADO PREVISTO 14 MESES" e "CAIXA
// ACUMULADO OBRA" nunca bateram, faltava "DE"/"NOS"/"DA" no meio do rótulo
// real), mas o CAMPO salvo precisa continuar o mesmo de sempre -
// DashboardGestaoExecutiva.tsx já lê estes nomes de campo fixos.
const CAMPOS_HEADER_OBRA: { buscar: string; campo: string }[] = [
  { buscar: "CARGA DE TRIBUTOS", campo: "carga_tributos" },
  { buscar: "RESULTADO REAL ACUMULADO", campo: "resultado_real_acumulado" },
  { buscar: "MARGEM REAL", campo: "margem_real" },
  { buscar: "RESULTADO PREVISTO NOS 14 MESES", campo: "resultado_previsto_14_meses" },
  { buscar: "CAIXA ACUMULADO DA OBRA", campo: "caixa_acumulado_obra" },
  { buscar: "PIOR CAIXA ACUMULADO", campo: "pior_caixa_acumulado" },
  { buscar: "NF EM ATRASO", campo: "nf_em_atraso" },
];

// Prefixos (não igualdade exata) - o cabeçalho real tem um trecho entre
// parênteses explicando a coluna (ex. "MEDIÇÃO PREVISTA (líquida)", "NF
// EMITIDA (07)") que varia e nunca bateria por igualdade. Confirmado no
// snapshot real - a aba tem 19 colunas, não as 10-11 descritas antes.
// "RESULTADO REAL" e "RESULTADO REAL ACUMULADO" convivem na mesma linha:
// como são buscados por prefixo INDEPENDENTE um do outro (não é uma busca
// textual única), "RESULTADO REAL" acha a primeira (coluna K) e o prefixo
// mais longo "RESULTADO REAL ACUMULADO" acha a outra (coluna M) sem
// confundir as duas.
const HEADER_MENSAL_OBRA: { prefixo: string; campo: string }[] = [
  { prefixo: "MÊS", campo: "mes" },
  { prefixo: "MEDIÇÃO PREVISTA", campo: "medicao_prevista" },
  { prefixo: "MEDIÇÃO REAL", campo: "medicao_real" },
  { prefixo: "NF PREVISTA", campo: "nf_prevista" },
  { prefixo: "NF EMITIDA", campo: "nf_emitida" },
  { prefixo: "TRIBUTOS PREVISTOS", campo: "tributos_previstos" },
  { prefixo: "TRIBUTOS SOBRE", campo: "tributos_sobre_nf_emitida" },
  { prefixo: "CUSTO PREVISTO", campo: "custo_previsto" },
  { prefixo: "CUSTO LANÇADO", campo: "custo_lancado" },
  { prefixo: "RESULTADO PREVISTO", campo: "resultado_previsto" },
  { prefixo: "RESULTADO REAL ACUMULADO", campo: "resultado_real_acumulado_mensal" },
  { prefixo: "RESULTADO REAL", campo: "resultado_real" },
  { prefixo: "MARGEM REAL", campo: "margem_real_mensal" },
  { prefixo: "RECEBIDO", campo: "recebido" },
  { prefixo: "PAGO", campo: "pago" },
  { prefixo: "CAIXA DA OBRA", campo: "caixa_da_obra_no_mes" },
  { prefixo: "CAIXA ACUMULADO", campo: "caixa_acumulado_da_obra" },
  { prefixo: "A RECEBER", campo: "a_receber" },
  { prefixo: "A PAGAR", campo: "a_pagar_comprometido" },
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
  for (const { buscar, campo } of CAMPOS_HEADER_OBRA) {
    headerBlock[campo] = buscarValorPorRotulo(rows, buscar);
  }
  interpretedRows.push({ natural_key: obraNormalizada, data: headerBlock, source_row: firstRowNumber });

  // Janela de busca ampla (não por posição fixa) - a tabela mensal pode
  // aparecer bem mais abaixo do topo da aba, depois do bloco de cabeçalho
  // da obra (OBRA:, CARGA TRIBUTOS etc.). Por PREFIXO - ver comentário de
  // HEADER_MENSAL_OBRA.
  const prefixos = HEADER_MENSAL_OBRA.map((c) => c.prefixo);
  const encontrado = localizarCabecalhoPorPrefixo(rows, prefixos, 200, 0.7);
  if (encontrado !== null) {
    const { linha: headerIdx, colunas: colPorPrefixo } = encontrado;
    const colMes = colPorPrefixo.get(normalizarRotulo("MÊS"));

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const mes = colMes !== undefined ? row[colMes] : undefined;
      if (celulaVazia(mes)) break;

      const rowNumber = firstRowNumber + i;
      const data: Record<string, unknown> = { tipo: "mensal", obra: obraTexto };
      for (const { prefixo, campo } of HEADER_MENSAL_OBRA) {
        const idx = colPorPrefixo.get(normalizarRotulo(prefixo));
        data[campo] = idx !== undefined ? row[idx] ?? null : null;
      }

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
  let colMarcador = -1;
  for (let i = 0; i < rows.length; i++) {
    const col = (rows[i] ?? []).findIndex((c) => normalizarRotulo(c).includes("PONTE LUCRO"));
    if (col >= 0) {
      idxMarcador = i;
      colMarcador = col;
      break;
    }
  }
  if (idxMarcador === -1) return { sheetKey: "gestao_empresa.ponte_lucro_caixa", rows: [], exceptions: [], rejectedCount: 0 };

  // Os meses ficam na MESMA linha do marcador ("A · PONTE LUCRO → CAIXA"),
  // nas colunas DEPOIS da coluna onde o marcador foi achado - não
  // necessariamente a partir da coluna A (o marcador pode estar em B, C...).
  const linhaMeses = rows[idxMarcador] ?? [];
  // parseMesDeCelula (não só "não vazio") exclui colunas de fechamento como
  // "TOTAL / FIM" no fim da linha - confirmado no snapshot real, essa
  // coluna vinha sendo tratada como se fosse mais um mês.
  const colunasMes = linhaMeses
    .map((valor, idx) => ({ idx, mes: valor }))
    .filter(({ idx, mes }) => idx > colMarcador && parseMesDeCelula(mes) !== null);

  let ordem = 0;
  for (let i = idxMarcador + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    // O rótulo do componente fica na MESMA coluna do marcador, não
    // necessariamente na coluna A.
    const rotulo = row[colMarcador];
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
