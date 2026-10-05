// =============================================
// MÓDULO OPERACIONAL: interpretadores dedicados das abas com seletor de obra
// (08A. CUSTO POR OBRA, 08D. PASSIVO E ESTOQUE, 12A. REPLANEJAMENTO)
// =============================================
// Diferente das abas do G2 (um bloco só, motor genérico LISTA/SÉRIE
// MENSAL), estas 3 abas têm MÚLTIPLOS blocos com layouts diferentes na
// mesma aba - cada bloco é localizado pelo TEXTO de uma âncora (título ou
// cabeçalho), nunca por número de linha fixo. Regras comuns (confirmadas
// pelo usuário a partir do arquivo real):
//  - cabeçalhos comparados por PREFIXO normalizado (texto entre parênteses
//    muda, ex. "antes de set/26");
//  - colunas vazias à esquerda são normais, nunca assumir índice fixo;
//  - cada aba traz UMA obra por vez (célula "OBRA:") - todo registro grava
//    obra_selecionada e tem a chave prefixada pela obra, EXCETO o bloco
//    HISTOGRAMA da 12A (várias obras na mesma leitura, usa a própria coluna
//    OBRA da linha);
//  - linha "TOTAL"/"TOTAL DA OBRA" é conferência, nunca um registro;
//  - âncora não encontrada abre aviso "layout_inesperado" sem derrubar o
//    resto da aba.
// Puro, sem banco/rede (Regras de Ouro 6/7). Testado em
// gestaoEmpresaObras.test.ts.

import { normalizarRotulo, celulaVazia } from "./parsing.ts";
import type { InterpretedRow, InterpretedException, InterpreterResult } from "./caixa.ts";
import { buscarValorPorRotulo } from "./gestaoEmpresa.ts";
import { linhaTotalmenteVazia, pareceLinhaDeResumo, descreverConteudoDaLinha, encontrarColunasDeMesEmLinha } from "./interpretadoresGenericos.ts";

function excecaoLayoutInesperado(rowNumber: number, bloco: string): InterpretedException {
  return {
    row_number: rowNumber,
    severity: "aviso",
    type: "layout_inesperado",
    message: `Bloco "${bloco}" não foi encontrado nesta leitura - verifique se o layout da aba mudou`,
  };
}

// Acha a linha que contém, em QUALQUER coluna, uma célula cujo texto
// normalizado inclui o texto de âncora normalizado - nunca por posição.
function localizarAncora(rows: unknown[][], textoAncora: string, desde = 0): number {
  const ancoraNormalizada = normalizarRotulo(textoAncora);
  for (let i = desde; i < rows.length; i++) {
    if ((rows[i] ?? []).some((c) => normalizarRotulo(c).includes(ancoraNormalizada))) return i;
  }
  return -1;
}

// Rótulo e valor em colunas FIXAS (não "a próxima célula não vazia") -
// necessário quando duas listas de rótulo-valor coexistem na mesma aba em
// colunas diferentes (ex. 12A: grupo 1 em B/C, grupo 2 em F/J) e usar
// "próxima célula não vazia" arriscaria pegar o valor do grupo errado.
function buscarValorEmColunaFixa(rows: unknown[][], rotulo: string, colRotulo: number, colValor: number): unknown {
  const rotuloNormalizado = normalizarRotulo(rotulo);
  for (const linha of rows) {
    if (normalizarRotulo((linha ?? [])[colRotulo]).startsWith(rotuloNormalizado)) {
      return (linha ?? [])[colValor];
    }
  }
  return undefined;
}

// "o valor é a primeira célula numérica à direita, na mesma linha" (08D).
// Exige o TIPO number, não só "parseNumeroBR não deu null" - um rótulo como
// "ENCARGOS SOBRE 13º E FÉRIAS" contém um dígito e parseNumeroBR("13º...")
// extrairia "13" dele, o que faria esta função devolver um rótulo da seção
// de parâmetros como se fosse o valor do indicador (dado errado e silencioso
// - exatamente o que a Regra de Ouro 4 proíbe). O payload de ingestão
// preserva o tipo original da célula (número do Excel chega como number,
// texto como string), então checar o tipo é seguro aqui.
function primeiraCelulaNumericaADireita(linha: unknown[], colInicio: number): unknown {
  for (let c = colInicio; c < linha.length; c++) {
    if (typeof linha[c] === "number") return linha[c];
  }
  return undefined;
}

interface ColunaPrefixo {
  prefixo: string;
  campo: string;
}

interface TabelaPorPrefixoResultado {
  registros: { data: Record<string, unknown>; chave: string; source_row: number }[];
  exceptions: InterpretedException[];
  rejectedCount: number;
  headerIdx: number | null;
}

// Lê uma tabela tipo LISTA cujo cabeçalho é reconhecido por PREFIXO (não
// igualdade exata) coluna a coluna - usada pelos blocos "LISTA" das 3 abas
// desta aba (08A bloco 1, 08D blocos A/B, 12A não usa isto - seus blocos
// são todos série mensal). `rows` já deve vir recortado a partir de perto
// da âncora do bloco (ver cada interpretador). Linha TOTAL é conferência,
// nunca registro; linha com as colunas-chave vazias (e não é TOTAL) gera 1
// exceção "aviso" com o conteúdo da linha, e é omitida (Regra de Ouro 4).
function lerTabelaPorPrefixo(
  rows: unknown[][],
  firstRowNumber: number,
  colunas: ColunaPrefixo[],
  camposChave: string[],
  maxLinhasCabecalho = 30
): TabelaPorPrefixoResultado {
  let headerIdx: number | null = null;
  let colIndices: Map<string, number> | null = null;

  for (let i = 0; i < Math.min(maxLinhasCabecalho, rows.length); i++) {
    const linha = rows[i] ?? [];
    const mapa = new Map<string, number>();
    for (const { prefixo, campo } of colunas) {
      const prefixoNormalizado = normalizarRotulo(prefixo);
      const idx = linha.findIndex((c) => normalizarRotulo(c).startsWith(prefixoNormalizado));
      if (idx >= 0) mapa.set(campo, idx);
    }
    if (mapa.size / colunas.length >= 0.7) {
      headerIdx = i;
      colIndices = mapa;
      break;
    }
  }

  if (headerIdx === null || !colIndices) {
    return { registros: [], exceptions: [], rejectedCount: 0, headerIdx: null };
  }

  const registros: TabelaPorPrefixoResultado["registros"] = [];
  const exceptions: InterpretedException[] = [];
  let rejectedCount = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const linha = rows[i] ?? [];
    if (linhaTotalmenteVazia(linha)) break;

    const rowNumber = firstRowNumber + i;

    if (pareceLinhaDeResumo(linha)) continue;

    const data: Record<string, unknown> = {};
    for (const [campo, idx] of colIndices) {
      const valor = linha[idx];
      if (!celulaVazia(valor)) data[campo] = valor;
    }

    const partesChave = camposChave.map((c) => (celulaVazia(data[c]) ? "" : normalizarRotulo(String(data[c]))));
    if (partesChave.every((p) => p === "")) {
      exceptions.push({
        row_number: rowNumber,
        severity: "aviso",
        type: "chave_nao_encontrada",
        message: `Linha ignorada - colunas-chave (${camposChave.join(", ")}) vazias. Conteúdo: ${descreverConteudoDaLinha(linha)}`,
      });
      rejectedCount++;
      continue;
    }

    registros.push({ data, chave: partesChave.join("|"), source_row: rowNumber });
  }

  return { registros, exceptions, rejectedCount, headerIdx };
}

function paraInterpretedRows(
  tabela: TabelaPorPrefixoResultado,
  obraNormalizada: string,
  obraTexto: string
): InterpretedRow[] {
  return tabela.registros.map((r) => ({
    natural_key: `${obraNormalizada}|${r.chave}`,
    data: { ...r.data, obra_selecionada: obraTexto },
    source_row: r.source_row,
  }));
}

// =============================================================================
// 08A. CUSTO POR OBRA
// =============================================================================
const SHEET_KEY_08A = "gestao_empresa.custo_por_obra";

const COLUNAS_08A_BLOCO1: ColunaPrefixo[] = [
  { prefixo: "CONTA", campo: "conta" },
  { prefixo: "NOME", campo: "nome" },
  { prefixo: "NATUREZA", campo: "natureza" },
  { prefixo: "PAGO ANTES DO FLUXO", campo: "pago_antes_do_fluxo" },
  { prefixo: "ORCADO NO FLUXO", campo: "orcado_no_fluxo" },
  { prefixo: "PREVISTO ATE O CORTE", campo: "previsto_ate_o_corte" },
  { prefixo: "PAGO ATE O CORTE", campo: "pago_ate_o_corte" },
  { prefixo: "A PAGAR + COMPROMETIDO", campo: "a_pagar_comprometido" },
  { prefixo: "PREVISTO LANCADO", campo: "previsto_lancado" },
  { prefixo: "A REALIZAR NO FLUXO", campo: "a_realizar_no_fluxo" },
  { prefixo: "PROJETADO NO TERMINO", campo: "projetado_no_termino" },
  { prefixo: "DESVIO R$", campo: "desvio_reais" },
  { prefixo: "DESVIO %", campo: "desvio_percentual" },
  { prefixo: "CAUSA DO DESVIO", campo: "causa_do_desvio" },
  { prefixo: "COMENTARIO", campo: "comentario" },
];

const ROTULOS_FAROL = [
  "FAROL",
  "Desvios acima de 5%",
  "Lançamentos desta obra",
  "Previsto",
];

export function interpretarCustoPorObra(rows: unknown[][], firstRowNumber: number): InterpreterResult {
  const exceptions: InterpretedException[] = [];
  let rejectedCount = 0;
  const resultado: InterpretedRow[] = [];

  const obra = buscarValorPorRotulo(rows, "OBRA:");
  if (celulaVazia(obra)) {
    return {
      sheetKey: SHEET_KEY_08A,
      rows: [],
      exceptions: [excecaoLayoutInesperado(firstRowNumber, 'seletor "OBRA:"')],
      rejectedCount: 0,
    };
  }
  const obraTexto = String(obra).trim();
  const obraNormalizada = normalizarRotulo(obraTexto);

  // Bloco 1 - custo por conta (LISTA), chave obra|CONTA.
  const bloco1 = lerTabelaPorPrefixo(rows, firstRowNumber, COLUNAS_08A_BLOCO1, ["conta"]);
  if (bloco1.headerIdx === null) {
    exceptions.push(excecaoLayoutInesperado(firstRowNumber, "08A bloco 1 (custo por conta)"));
  } else {
    resultado.push(...paraInterpretedRows(bloco1, obraNormalizada, obraTexto));
    exceptions.push(...bloco1.exceptions);
    rejectedCount += bloco1.rejectedCount;
  }

  // Bloco 2 - FAROL (rótulo-valor), chave obra|rotulo.
  for (const rotulo of ROTULOS_FAROL) {
    const valor = buscarValorPorRotulo(rows, rotulo);
    if (!celulaVazia(valor)) {
      resultado.push({
        natural_key: `${obraNormalizada}|${normalizarRotulo(rotulo)}`,
        data: { rotulo, valor, obra_selecionada: obraTexto },
        source_row: firstRowNumber,
      });
    }
  }

  // Bloco 3 - pago por mês (SÉRIE MENSAL), âncora "PAGO POR MÊS DESTA OBRA".
  const idxAncora3 = localizarAncora(rows, "PAGO POR MES DESTA OBRA");
  if (idxAncora3 === -1) {
    exceptions.push(excecaoLayoutInesperado(firstRowNumber, "08A bloco 3 (pago por mês)"));
  } else {
    const trechoBloco3 = rows.slice(idxAncora3 + 1);
    let headerIdxRel = -1;
    let colunasMes: { col: number; mes: string }[] = [];
    for (let i = 0; i < Math.min(trechoBloco3.length, 10); i++) {
      const encontradas = encontrarColunasDeMesEmLinha(trechoBloco3[i] ?? [], 6);
      if (encontradas) {
        headerIdxRel = i;
        colunasMes = encontradas;
        break;
      }
    }
    if (headerIdxRel === -1) {
      exceptions.push(excecaoLayoutInesperado(firstRowNumber + idxAncora3, "08A bloco 3 (cabeçalho de meses)"));
    } else {
      const headerAbs = idxAncora3 + 1 + headerIdxRel;
      const headerRow = rows[headerAbs] ?? [];
      const colConta = headerRow.findIndex((c) => normalizarRotulo(c).startsWith("CONTA"));
      for (let i = headerAbs + 1; i < rows.length; i++) {
        const linha = rows[i] ?? [];
        if (linhaTotalmenteVazia(linha)) break;
        if (pareceLinhaDeResumo(linha)) continue;

        const conta = colConta >= 0 ? linha[colConta] : undefined;
        if (celulaVazia(conta)) continue;
        const rowNumber = firstRowNumber + i;

        for (const { col, mes } of colunasMes) {
          const valor = linha[col];
          if (celulaVazia(valor)) continue;
          resultado.push({
            natural_key: `${obraNormalizada}|${normalizarRotulo(String(conta))}|${mes}`,
            data: { conta: String(conta), mes, valor, obra_selecionada: obraTexto },
            source_row: rowNumber,
          });
        }
      }
    }
  }

  return { sheetKey: SHEET_KEY_08A, rows: resultado, exceptions, rejectedCount };
}

// =============================================================================
// 08D. PASSIVO E ESTOQUE
// =============================================================================
const SHEET_KEY_08D = "gestao_empresa.passivo_e_estoque";

const INDICADORES_08D = [
  "PASSIVO HOJE",
  "RESERVADO NO FLUXO PARA RESCISAO",
  "ESTOQUE HOJE",
  "MAIOR PASSIVO NO PERIODO",
  "FALTA RESERVAR NO FLUXO",
];

const PARAMETROS_08D = [
  "ENCARGOS SOBRE 13 E FERIAS",
  "FGTS DEPOSITADO NO MES",
  "MULTA DO FGTS NA DEMISSAO",
  "AVISO PREVIO INDENIZADO",
];

const COLUNAS_08D_BLOCO_A: ColunaPrefixo[] = [
  { prefixo: "CONTA", campo: "conta" },
  { prefixo: "NOME", campo: "nome" },
  { prefixo: "E CLT", campo: "e_clt" },
  { prefixo: "PARTE QUE E SALARIO", campo: "parte_que_e_salario" },
];

// As 18 colunas do bloco B, na ordem dada pelo usuário - nomes de campo
// mais curtos, mas preservando a ordem/sentido de cada uma.
const COLUNAS_08D_BLOCO_B: ColunaPrefixo[] = [
  { prefixo: "MES", campo: "mes_rotulo" },
  { prefixo: "FOLHA LANCADA", campo: "folha_lancada" },
  { prefixo: "FOLHA NO FLUXO", campo: "folha_no_fluxo" },
  { prefixo: "SALARIOS DO MES", campo: "salarios_do_mes" },
  // "º" (indicador ordinal) não é um acento - normalizarRotulo não remove,
  // então precisa estar aqui literalmente ou o prefixo nunca bate.
  { prefixo: "13º DO MES", campo: "decimo_terceiro_do_mes" },
  { prefixo: "FERIAS + 1/3 DO MES", campo: "ferias_do_mes" },
  { prefixo: "ENCARGOS S/ 13", campo: "encargos_sobre_13_e_ferias" },
  { prefixo: "MULTA FGTS DO MES", campo: "multa_fgts_do_mes" },
  { prefixo: "PROVISAO DO MES", campo: "provisao_do_mes" },
  { prefixo: "13º A PAGAR", campo: "decimo_terceiro_a_pagar" },
  { prefixo: "FERIAS A PAGAR", campo: "ferias_a_pagar" },
  { prefixo: "MULTA FGTS ACUMULADA", campo: "multa_fgts_acumulada" },
  { prefixo: "AVISO PREVIO", campo: "aviso_previo" },
  { prefixo: "PASSIVO SE DESMOBILIZAR", campo: "passivo_se_desmobilizar" },
  { prefixo: "RESCISAO PREVISTA NO FLUXO", campo: "rescisao_prevista_no_fluxo" },
  { prefixo: "RESCISOES LANCADAS", campo: "rescisoes_lancadas" },
  { prefixo: "MATERIAL LANCADO", campo: "material_lancado" },
  { prefixo: "ESTOQUE NO FIM DO MES", campo: "estoque_no_fim_do_mes" },
  { prefixo: "MATERIAL APLICADO", campo: "material_aplicado" },
];

const COLUNAS_08D_BLOCO_C: ColunaPrefixo[] = [
  { prefixo: "MES DA CONTAGEM", campo: "mes_da_contagem" },
  { prefixo: "OBRA", campo: "obra" },
  { prefixo: "MATERIAL", campo: "material" },
  { prefixo: "UN", campo: "unidade" },
  { prefixo: "QUANTIDADE", campo: "quantidade" },
  { prefixo: "PRECO UNIT", campo: "preco_unitario" },
  { prefixo: "VALOR", campo: "valor" },
  { prefixo: "ONDE ESTA", campo: "onde_esta" },
];

export function interpretarPassivoEEstoque(rows: unknown[][], firstRowNumber: number): InterpreterResult {
  const exceptions: InterpretedException[] = [];
  let rejectedCount = 0;
  const resultado: InterpretedRow[] = [];

  // "OBRA:" em A3 (não em qualquer coluna, mas localizarAncora já não
  // assume posição - funciona igual).
  const obra = buscarValorPorRotulo(rows, "OBRA:");
  if (celulaVazia(obra)) {
    return {
      sheetKey: SHEET_KEY_08D,
      rows: [],
      exceptions: [excecaoLayoutInesperado(firstRowNumber, 'seletor "OBRA:"')],
      rejectedCount: 0,
    };
  }
  const obraTexto = String(obra).trim();
  const obraNormalizada = normalizarRotulo(obraTexto);

  // Indicadores (rótulo-valor; valor = primeira célula numérica à direita
  // na mesma linha, não "próxima célula não vazia" - evita pegar texto).
  for (const rotulo of INDICADORES_08D) {
    const rotuloNormalizado = normalizarRotulo(rotulo);
    for (const linha of rows) {
      const colRotulo = (linha ?? []).findIndex((c) => normalizarRotulo(c).startsWith(rotuloNormalizado));
      if (colRotulo >= 0) {
        const valor = primeiraCelulaNumericaADireita(linha ?? [], colRotulo + 1);
        resultado.push({
          natural_key: `${obraNormalizada}|${rotuloNormalizado}`,
          data: { rotulo, valor: valor ?? null, obra_selecionada: obraTexto },
          source_row: firstRowNumber,
        });
        break;
      }
    }
  }

  // Bloco A - por conta (LISTA), chave obra|CONTA.
  const blocoA = lerTabelaPorPrefixo(rows, firstRowNumber, COLUNAS_08D_BLOCO_A, ["conta"]);
  if (blocoA.headerIdx === null) {
    exceptions.push(excecaoLayoutInesperado(firstRowNumber, "08D bloco A (por conta)"));
  } else {
    resultado.push(...paraInterpretedRows(blocoA, obraNormalizada, obraTexto));
    exceptions.push(...blocoA.exceptions);
    rejectedCount += blocoA.rejectedCount;
  }

  // Parâmetros (rótulo-valor, coluna F=rótulo / J=valor - fixas, diferentes
  // das colunas dos indicadores acima).
  const COL_F = 5;
  const COL_J = 9;
  for (const rotulo of PARAMETROS_08D) {
    const valor = buscarValorEmColunaFixa(rows, rotulo, COL_F, COL_J);
    if (valor !== undefined && !celulaVazia(valor)) {
      resultado.push({
        natural_key: `${obraNormalizada}|${normalizarRotulo(rotulo)}`,
        data: { rotulo, valor, obra_selecionada: obraTexto },
        source_row: firstRowNumber,
      });
    }
  }

  // Bloco B - passivo mês a mês. É uma LISTA cuja chave é o próprio MÊS
  // (não série mensal - os meses estão nas LINHAS, não em colunas).
  const blocoB = lerTabelaPorPrefixo(rows, firstRowNumber, COLUNAS_08D_BLOCO_B, ["mes_rotulo"]);
  if (blocoB.headerIdx === null) {
    exceptions.push(excecaoLayoutInesperado(firstRowNumber, "08D bloco B (passivo mês a mês)"));
  } else {
    resultado.push(...paraInterpretedRows(blocoB, obraNormalizada, obraTexto));
    exceptions.push(...blocoB.exceptions);
    rejectedCount += blocoB.rejectedCount;
  }

  // Bloco C - contagem de estoque, LISTA de entrada hoje vazia POR DESENHO
  // - 0 registros aqui é NORMAL, não abre layout_inesperado nem
  // aba_sem_registros (os outros blocos já garantem a aba não ficar vazia
  // no total). Chave MÊS|OBRA|MATERIAL (sem prefixo de obra_selecionada -
  // a própria linha já carrega OBRA, igual ao histograma da 12A).
  const idxAncoraC = localizarAncora(rows, "CONTAGEM DE ESTOQUE");
  if (idxAncoraC >= 0) {
    const blocoC = lerTabelaPorPrefixo(rows.slice(idxAncoraC), firstRowNumber + idxAncoraC, COLUNAS_08D_BLOCO_C, [
      "mes_da_contagem",
      "obra",
      "material",
    ]);
    for (const r of blocoC.registros) {
      resultado.push({ natural_key: r.chave, data: r.data, source_row: r.source_row });
    }
    exceptions.push(...blocoC.exceptions);
    rejectedCount += blocoC.rejectedCount;
  }

  return { sheetKey: SHEET_KEY_08D, rows: resultado, exceptions, rejectedCount };
}

// =============================================================================
// 12A. REPLANEJAMENTO
// =============================================================================
const SHEET_KEY_12A = "gestao_empresa.replanejamento";

// Grupo 1: rótulo em B (1), valor em C (2).
const INDICADORES_12A_GRUPO1 = [
  "VALOR DO CONTRATO (03)",
  "VALOR DO CONTRATO DIGITADO",
  "MEDIDO ATE HOJE",
  "SALDO A MEDIR",
  "MES DE PARTIDA",
  "TERMINO",
  "CURVA",
  "ARREDONDAR EQUIPES E EQUIPAMENTOS",
];
// Grupo 2: rótulo em F (5), valor em J (9).
const INDICADORES_12A_GRUPO2 = [
  "SALDO A MEDIR",
  "PICO DE PRODUCAO NUM MES",
  "PICO DE MAO DE OBRA",
  "PICO DE EQUIPAMENTOS",
  "CUSTO REPLANEJADO",
  "PRODUCAO",
];

function lerIndicadoresEmColuna(
  rows: unknown[][],
  firstRowNumber: number,
  rotulos: string[],
  colRotulo: number,
  colValor: number,
  grupo: string,
  obraNormalizada: string,
  obraTexto: string
): InterpretedRow[] {
  const resultado: InterpretedRow[] = [];
  for (const rotulo of rotulos) {
    const valor = buscarValorEmColunaFixa(rows, rotulo, colRotulo, colValor);
    const rotuloNormalizado = normalizarRotulo(rotulo);
    resultado.push({
      // Valor vazio = "sem dado" (nunca 0) - guarda null explicitamente,
      // nunca inventa (Regra de Ouro 2).
      natural_key: `${obraNormalizada}|${grupo}|${rotuloNormalizado}`,
      data: { grupo, rotulo, valor: valor === undefined || celulaVazia(valor) ? null : valor, obra_selecionada: obraTexto },
      source_row: firstRowNumber,
    });
  }
  return resultado;
}

export function interpretarReplanejamento(rows: unknown[][], firstRowNumber: number): InterpreterResult {
  const exceptions: InterpretedException[] = [];
  const rejectedCount = 0;
  const resultado: InterpretedRow[] = [];

  const obra = buscarValorPorRotulo(rows, "OBRA:");
  if (celulaVazia(obra)) {
    return {
      sheetKey: SHEET_KEY_12A,
      rows: [],
      exceptions: [excecaoLayoutInesperado(firstRowNumber, 'seletor "OBRA:"')],
      rejectedCount: 0,
    };
  }
  const obraTexto = String(obra).trim();
  const obraNormalizada = normalizarRotulo(obraTexto);

  const COL_B = 1;
  const COL_C = 2;
  const COL_F = 5;
  const COL_J = 9;
  resultado.push(...lerIndicadoresEmColuna(rows, firstRowNumber, INDICADORES_12A_GRUPO1, COL_B, COL_C, "1", obraNormalizada, obraTexto));
  resultado.push(...lerIndicadoresEmColuna(rows, firstRowNumber, INDICADORES_12A_GRUPO2, COL_F, COL_J, "2", obraNormalizada, obraTexto));

  // Âncoras dos blocos 2 e 3 localizadas ANTES de processar o bloco 1, só
  // para limitar onde o bloco 1 para de ler - sem isso, o loop do bloco 1
  // (que só para em linha totalmente vazia) invadiria o cabeçalho do
  // HISTOGRAMA (que tem meses nas mesmas colunas J-AA) e geraria registro
  // lixo a partir dali.
  const idxAncoraHistogramaAntecipado = localizarAncora(rows, "HISTOGRAMA");
  const idxAncoraResumoAntecipado = localizarAncora(rows, "RESUMO DA OBRA ESCOLHIDA");
  const limiteBloco1 = Math.min(
    idxAncoraHistogramaAntecipado === -1 ? rows.length : idxAncoraHistogramaAntecipado,
    idxAncoraResumoAntecipado === -1 ? rows.length : idxAncoraResumoAntecipado
  );

  // Bloco 1 - curva mensal (SÉRIE MENSAL), âncora "MÊS" na linha de meses
  // (a mesma célula B14 do enunciado) - localizamos pela PRÓPRIA linha de
  // meses (>=6 meses consecutivos a partir da coluna J em diante), não por
  // número de linha.
  const idxMeses1 = encontrarLinhaDeMesesAPartirDe(rows, 9, 0);
  // Reaproveitado pelo bloco 3 abaixo - ele usa as MESMAS colunas de mês do
  // bloco 1 (B73 é só um título, sem cabeçalho de meses próprio - "meses em
  // J a AA" no enunciado do bloco 3 são as mesmas J-AA já definidas aqui).
  let colunasMesCurva: { col: number; mes: string }[] | null = null;
  if (idxMeses1 === -1) {
    exceptions.push(excecaoLayoutInesperado(firstRowNumber, "12A bloco 1 (curva mensal)"));
  } else if (idxMeses1 >= limiteBloco1) {
    // A linha de meses encontrada já cai DENTRO do território do
    // HISTOGRAMA/RESUMO (ex. se a aba real não tiver uma linha de meses
    // reconhecível antes desses blocos, a busca "acha" a de um deles em vez
    // da do bloco 1) - sem esta guarda, o loop abaixo iteraria 0 vezes em
    // silêncio (i já começa depois do limite), parecendo só "poucos
    // registros" sem explicação nenhuma.
    exceptions.push(
      excecaoLayoutInesperado(firstRowNumber + idxMeses1, "12A bloco 1 (linha de meses caiu dentro do histograma/resumo)")
    );
  } else {
    colunasMesCurva = encontrarColunasDeMesEmLinha((rows[idxMeses1] ?? []).slice(9), 6)!.map((c) => ({ col: c.col + 9, mes: c.mes }));
    for (let i = idxMeses1 + 1; i < limiteBloco1; i++) {
      const linha = rows[i] ?? [];
      if (linhaTotalmenteVazia(linha)) break;
      const rotulo = linha[COL_B];
      if (celulaVazia(rotulo)) continue;
      const rowNumber = firstRowNumber + i;
      const rotuloTexto = String(rotulo).trim();
      const rotuloNormalizado = normalizarRotulo(rotuloTexto);
      for (const { col, mes } of colunasMesCurva) {
        const valor = linha[col];
        if (celulaVazia(valor)) continue; // "manual"/"% DO CONTRATO EXECUTADO" vazias hoje = normal
        resultado.push({
          natural_key: `${obraNormalizada}|${rotuloNormalizado}|${mes}`,
          data: { rotulo: rotuloTexto, mes, valor, obra_selecionada: obraTexto },
          source_row: rowNumber,
        });
      }
    }
  }

  // Bloco 2 - HISTOGRAMA (SÉRIE MENSAL, várias obras) - âncora própria.
  const idxAncoraHistograma = idxAncoraHistogramaAntecipado;
  if (idxAncoraHistograma === -1) {
    exceptions.push(excecaoLayoutInesperado(firstRowNumber, "12A bloco 2 (histograma)"));
  } else {
    const idxCabecalhoHistograma = idxAncoraHistograma + 1;
    const headerRow = rows[idxCabecalhoHistograma] ?? [];
    const colObra = headerRow.findIndex((c) => normalizarRotulo(c) === "OBRA");
    const colRecurso = headerRow.findIndex((c) => normalizarRotulo(c).startsWith("RECURSO"));
    const colunasMesHistograma = encontrarColunasDeMesEmLinha(headerRow, 6);
    if (colObra === -1 || colRecurso === -1 || !colunasMesHistograma) {
      exceptions.push(excecaoLayoutInesperado(firstRowNumber + idxAncoraHistograma, "12A bloco 2 (cabeçalho do histograma)"));
    } else {
      for (let i = idxCabecalhoHistograma + 1; i < rows.length; i++) {
        const linha = rows[i] ?? [];
        if (linhaTotalmenteVazia(linha)) break;
        if (pareceLinhaDeResumo(linha)) continue;

        const obraDaLinha = linha[colObra];
        const recurso = linha[colRecurso];
        if (celulaVazia(obraDaLinha) || celulaVazia(recurso)) continue;
        const rowNumber = firstRowNumber + i;
        // Este bloco cobre várias obras - usa a OBRA da própria linha na
        // chave, não o seletor da aba (único bloco das 3 abas assim).
        const obraDaLinhaNormalizada = normalizarRotulo(String(obraDaLinha));
        const recursoNormalizado = normalizarRotulo(String(recurso));
        for (const { col, mes } of colunasMesHistograma) {
          const valor = linha[col];
          if (celulaVazia(valor)) continue;
          resultado.push({
            natural_key: `${obraDaLinhaNormalizada}|${recursoNormalizado}|${mes}`,
            data: { obra: String(obraDaLinha), recurso: String(recurso), mes, valor },
            source_row: rowNumber,
          });
        }
      }
    }
  }

  // Bloco 3 - RESUMO DA OBRA ESCOLHIDA (SÉRIE MENSAL) - âncora própria, mas
  // SEM cabeçalho de meses próprio: reaproveita as mesmas colunas J-AA já
  // encontradas no bloco 1 (o enunciado não descreve uma 2ª linha de meses
  // aqui, só um título seguido direto das linhas de dado).
  const idxAncoraResumo = idxAncoraResumoAntecipado;
  if (idxAncoraResumo === -1) {
    exceptions.push(excecaoLayoutInesperado(firstRowNumber, "12A bloco 3 (resumo da obra escolhida)"));
  } else if (!colunasMesCurva) {
    exceptions.push(excecaoLayoutInesperado(firstRowNumber + idxAncoraResumo, "12A bloco 3 (depende das colunas de mês do bloco 1, não encontradas)"));
  } else {
    for (let i = idxAncoraResumo + 1; i < rows.length; i++) {
      const linha = rows[i] ?? [];
      if (linhaTotalmenteVazia(linha)) break;
      const rotulo = linha[COL_B];
      if (celulaVazia(rotulo)) continue;
      const rowNumber = firstRowNumber + i;
      const rotuloTexto = String(rotulo).trim();
      const rotuloNormalizado = normalizarRotulo(rotuloTexto);
      for (const { col, mes } of colunasMesCurva) {
        const valor = linha[col];
        if (celulaVazia(valor)) continue;
        resultado.push({
          natural_key: `${obraNormalizada}|${rotuloNormalizado}|${mes}`,
          data: { rotulo: rotuloTexto, mes, valor, obra_selecionada: obraTexto },
          source_row: rowNumber,
        });
      }
    }
  }

  return { sheetKey: SHEET_KEY_12A, rows: resultado, exceptions, rejectedCount };
}

// Acha, a partir de `desde`, a primeira linha com >=6 meses consecutivos
// começando na coluna `colMinima` em diante (12A: "meses a partir da
// coluna J") - evita que outra sequência de números mais à esquerda
// (ex. indicadores) seja confundida com a linha de meses.
function encontrarLinhaDeMesesAPartirDe(rows: unknown[][], colMinima: number, desde: number): number {
  for (let i = desde; i < rows.length; i++) {
    const linha = (rows[i] ?? []).slice(colMinima);
    if (encontrarColunasDeMesEmLinha(linha, 6)) return i;
  }
  return -1;
}
