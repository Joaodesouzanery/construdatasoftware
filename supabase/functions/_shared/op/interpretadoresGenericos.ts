// =============================================
// MÓDULO OPERACIONAL: interpretadores genéricos (Fase G2)
// =============================================
// Cobrem qualquer aba que siga um dos 2 padrões estruturais abaixo, sem
// precisar de código novo por aba - só uma entrada de configuração em
// gestaoEmpresaGenericas.ts. Mesmo contrato de retorno dos interpretadores
// dedicados (caixa.ts/operacionalSabesp.ts/gestaoEmpresa.ts), puro, sem
// banco/rede (Regras de Ouro 6/7). Testado em interpretadoresGenericos.test.ts.

import { normalizarRotulo, celulaVazia, localizarCabecalho } from "./parsing.ts";
import type { InterpretedRow, InterpretedException, InterpreterResult } from "./caixa.ts";

function chaveDeCampo(rotulo: string): string {
  return rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Linha é um "título de bloco" (fim do bloco de dados atual) quando só tem
// 1 célula não vazia e essa célula não é numérica - ex. "B · PREVISTO POR
// CONTA" acima de uma nova tabela na mesma aba.
function ehTituloDeBloco(linha: unknown[]): boolean {
  const naoVazias = (linha ?? []).filter((v) => !celulaVazia(v));
  if (naoVazias.length !== 1) return false;
  return typeof naoVazias[0] !== "number" && Number.isNaN(Number(String(naoVazias[0]).replace(",", ".")));
}

export function linhaTotalmenteVazia(linha: unknown[]): boolean {
  return (linha ?? []).every((v) => celulaVazia(v));
}

// TOTAL/TOTAL DA OBRA/TOTAL GERAL etc. - linha de conferência, nunca um
// registro (mesmo quando a chave está vazia, não é um erro de dado).
// Exportada - reaproveitada pelos interpretadores dedicados de obra
// (gestaoEmpresaObras.ts), que têm a mesma regra "TOTAL não é registro".
export function pareceLinhaDeResumo(linha: unknown[]): boolean {
  return (linha ?? []).some((v) => !celulaVazia(v) && normalizarRotulo(v).startsWith("TOTAL"));
}

export function colunaParaLetra(indice: number): string {
  let n = indice;
  let letra = "";
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

// Para diagnóstico na mensagem de exceção - mostra célula a célula o que de
// fato está na linha, em vez de uma mensagem genérica (Regra de Ouro 4: o
// motivo do erro precisa ficar visível).
export function descreverConteudoDaLinha(linha: unknown[]): string {
  const partes = (linha ?? [])
    .map((v, i) => (celulaVazia(v) ? null : `${colunaParaLetra(i)}=${v}`))
    .filter((p): p is string => p !== null);
  return partes.length > 0 ? partes.join(", ") : "(linha vazia)";
}

export interface ConfigLista {
  sheetKey: string;
  colunasChave: string[];
}

const BUSCA_CABECALHO_MAX_LINHAS = 200;

// Acha o cabeçalho por rótulo (>=70% das colunas-chave presentes, não por
// índice fixo), lê até a 1ª linha vazia ou próximo título de bloco, monta a
// chave pelas colunas configuradas. Linha com chave repetida ganha sufixo
// #2, #3... Linha que falha ao extrair a chave gera 1 exceção "aviso" e é
// OMITIDA do diff - nunca derruba o resto da aba (Regra de Ouro 4).
//
// Abas com mais de um bloco no mesmo padrão (ex. "04. ITENS DE CONTRATO":
// um resumo por contrato seguido da lista de itens) são cobertas
// automaticamente - depois que um bloco termina (linha vazia/título), a
// função procura o próximo cabeçalho compatível com as mesmas colunas-chave
// mais adiante na aba, em vez de parar na primeira ocorrência.
export function interpretarComoLista(rows: unknown[][], firstRowNumber: number, config: ConfigLista): InterpreterResult {
  const resultado: InterpretedRow[] = [];
  const exceptions: InterpretedException[] = [];
  let rejectedCount = 0;
  const contagemChaves = new Map<string, number>();
  const colunasChaveNormalizadas = config.colunasChave.map(normalizarRotulo);

  let buscaDesde = 0;
  while (buscaDesde < rows.length) {
    const restante = rows.slice(buscaDesde);
    const headerIdxRelativo = localizarCabecalho(restante, config.colunasChave, BUSCA_CABECALHO_MAX_LINHAS, 0.7);
    if (headerIdxRelativo === null) break;
    const headerIdx = buscaDesde + headerIdxRelativo;

    const headerRow = rows[headerIdx] ?? [];
    const colunaPorRotulo = new Map<string, number>();
    headerRow.forEach((celula, idx) => {
      const rotulo = normalizarRotulo(celula);
      if (rotulo && !colunaPorRotulo.has(rotulo)) colunaPorRotulo.set(rotulo, idx);
    });

    let i = headerIdx + 1;
    for (; i < rows.length; i++) {
      const linha = rows[i] ?? [];
      if (linhaTotalmenteVazia(linha)) break;

      if (ehTituloDeBloco(linha)) {
        // Só é FIM de bloco se um cabeçalho novo (mesmas colunas-chave)
        // aparecer logo a seguir - senão é só uma linha decorativa (ex.
        // título de seção) no meio do mesmo bloco, e os dados continuam
        // sob o cabeçalho atual (casos reais: "14. FONTES", "15. CHANGELOG").
        const restanteAposTitulo = rows.slice(i + 1, i + 1 + BUSCA_CABECALHO_MAX_LINHAS);
        const novoHeaderAdiante = localizarCabecalho(restanteAposTitulo, config.colunasChave, restanteAposTitulo.length, 0.7);
        if (novoHeaderAdiante !== null) break;
        continue;
      }

      const rowNumber = firstRowNumber + i;
      const partesChave = colunasChaveNormalizadas.map((rotulo) => {
        const col = colunaPorRotulo.get(rotulo);
        const valor = col !== undefined ? linha[col] : undefined;
        return celulaVazia(valor) ? "" : normalizarRotulo(valor);
      });

      if (partesChave.every((p) => p === "")) {
        if (!pareceLinhaDeResumo(linha)) {
          exceptions.push({
            row_number: rowNumber,
            severity: "aviso",
            type: "chave_nao_encontrada",
            message: `Linha ignorada - nenhuma das colunas-chave (${config.colunasChave.join(", ")}) tem valor nesta linha. Conteúdo: ${descreverConteudoDaLinha(linha)}`,
          });
          rejectedCount++;
        }
        // Linha de TOTAL/resumo: não é erro, é conferência - pula sem
        // exceção e sem contar como rejeitada.
        continue;
      }

      let chave = partesChave.join("|");
      const vistas = contagemChaves.get(chave) ?? 0;
      contagemChaves.set(chave, vistas + 1);
      if (vistas > 0) chave = `${chave}#${vistas + 1}`;

      const data: Record<string, unknown> = {};
      for (const [rotulo, col] of colunaPorRotulo) {
        const valor = linha[col];
        if (!celulaVazia(valor)) data[chaveDeCampo(rotulo)] = valor;
      }

      resultado.push({ natural_key: chave, data, source_row: rowNumber });
    }

    buscaDesde = i + 1;
  }

  return { sheetKey: config.sheetKey, rows: resultado, exceptions, rejectedCount };
}

export interface ConfigSerieMensal {
  sheetKey: string;
  // Colunas de texto (pelo rótulo do cabeçalho de meses, quando houver, ou
  // ignorado) usadas para montar o rótulo da linha - por padrão, usa todas
  // as colunas à esquerda da primeira coluna de mês.
  colunasRotulo?: string[];
}

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

// Exportada - reaproveitada pelos interpretadores dedicados de obra
// (gestaoEmpresaObras.ts), que também precisam achar colunas de mês.
// Aceita serial do Excel, "AAAA-MM", "DD/MM/AAAA" ou "mmm/aa" (pt-BR);
// devolve "AAAA-MM" ou null se não reconhecer como mês.
export function parseMesDeCelula(valor: unknown): string | null {
  if (celulaVazia(valor)) return null;

  if (typeof valor === "number") {
    if (valor < 20000 || valor > 80000) return null;
    const data = new Date(EXCEL_EPOCH_MS + valor * 86400000);
    if (Number.isNaN(data.getTime())) return null;
    return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  const texto = String(valor).trim().toLowerCase();

  const isoMatch = texto.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const brMatch = texto.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[2]}-${brMatch[1].padStart(2, "0")}`;

  const mesAbreviado = texto.match(/^([a-zç]{3})\/(\d{2})$/i);
  if (mesAbreviado) {
    const idx = MESES_PT.indexOf(mesAbreviado[1]);
    if (idx >= 0) return `20${mesAbreviado[2]}-${String(idx + 1).padStart(2, "0")}`;
  }

  return null;
}

// Exportada - acha, dentro de UMA linha, a sequência mais longa de colunas
// consecutivas reconhecíveis como mês; devolve null se não houver pelo
// menos `minConsecutivos`. Reaproveitada pelos interpretadores dedicados de
// obra (gestaoEmpresaObras.ts: 08A bloco 3, 12A blocos 1/2/3).
export function encontrarColunasDeMesEmLinha(linha: unknown[], minConsecutivos = 6): { col: number; mes: string }[] | null {
  let melhorInicio = -1;
  let melhorFim = -1;
  let inicioAtual = -1;
  for (let c = 0; c < linha.length; c++) {
    if (parseMesDeCelula(linha[c]) !== null) {
      if (inicioAtual === -1) inicioAtual = c;
      if (c - inicioAtual > melhorFim - melhorInicio) {
        melhorInicio = inicioAtual;
        melhorFim = c;
      }
    } else {
      inicioAtual = -1;
    }
  }
  if (melhorFim - melhorInicio + 1 < minConsecutivos) return null;
  const colunasMes: { col: number; mes: string }[] = [];
  for (let c = melhorInicio; c <= melhorFim; c++) {
    const mes = parseMesDeCelula(linha[c]);
    if (mes) colunasMes.push({ col: c, mes });
  }
  return colunasMes;
}

// Acha a linha de meses (>=6 datas consecutivas reconhecíveis); colunas à
// esquerda formam o rótulo; "seção" é o título de bloco mais recente acima
// (linha sem nenhum valor nas colunas de mês). Gera 1 InterpretedRow por
// (seção, rótulo, mês).
export function interpretarComoSerieMensal(rows: unknown[][], firstRowNumber: number, config: ConfigSerieMensal): InterpreterResult {
  const resultado: InterpretedRow[] = [];
  const exceptions: InterpretedException[] = [];
  let rejectedCount = 0;

  let headerIdx = -1;
  let colunasMes: { col: number; mes: string }[] = [];

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const encontradas = encontrarColunasDeMesEmLinha(rows[i] ?? [], 6);
    if (encontradas) {
      headerIdx = i;
      colunasMes = encontradas;
      break;
    }
  }

  if (headerIdx === -1) {
    return { sheetKey: config.sheetKey, rows: [], exceptions: [], rejectedCount: 0 };
  }

  const primeiraColunaMes = colunasMes[0].col;
  const colunasRotuloNormalizadas = config.colunasRotulo?.map(normalizarRotulo);
  const headerRow = rows[headerIdx] ?? [];

  let secaoAtual = "";

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const linha = rows[i] ?? [];
    if (linhaTotalmenteVazia(linha)) continue;

    const temValorNoMes = colunasMes.some(({ col }) => !celulaVazia(linha[col]));
    if (!temValorNoMes) {
      // Título de seção (sem valores sob as colunas de mês) - atualiza a
      // seção corrente e segue, sem gerar registro.
      const naoVazias = linha.filter((v) => !celulaVazia(v));
      if (naoVazias.length > 0) secaoAtual = normalizarRotulo(naoVazias[0]);
      continue;
    }

    const rowNumber = firstRowNumber + i;

    let rotuloPartes: unknown[];
    if (colunasRotuloNormalizadas) {
      rotuloPartes = colunasRotuloNormalizadas.map((rotuloBuscado) => {
        const colEncontrada = headerRow.findIndex((h) => normalizarRotulo(h) === rotuloBuscado);
        return colEncontrada >= 0 ? linha[colEncontrada] : undefined;
      });
    } else {
      rotuloPartes = linha.slice(0, primeiraColunaMes);
    }
    const rotuloTexto = rotuloPartes.filter((v) => !celulaVazia(v)).join(" ").trim();

    if (!rotuloTexto) {
      exceptions.push({
        row_number: rowNumber,
        severity: "aviso",
        type: "rotulo_nao_encontrado",
        message: "Linha ignorada - não foi possível montar o rótulo desta linha",
      });
      rejectedCount++;
      continue;
    }

    const rotuloNormalizado = normalizarRotulo(rotuloTexto);
    for (const { col, mes } of colunasMes) {
      const valor = linha[col];
      if (celulaVazia(valor)) continue;
      resultado.push({
        natural_key: `${secaoAtual}|${rotuloNormalizado}|${mes}`,
        data: { secao: secaoAtual, rotulo: rotuloTexto, mes, valor },
        source_row: rowNumber,
      });
    }
  }

  return { sheetKey: config.sheetKey, rows: resultado, exceptions, rejectedCount };
}
