// =============================================
// MÓDULO OPERACIONAL: interpretadores do perfil "caixa"
// =============================================
// Funções puras (sem banco, sem rede) - Regra de Ouro 7. Testadas em
// caixa.test.ts. Cada função devolve o formato que op-ingest-sheet espera
// (rows/exceptions/rejectedCount para op_apply_interpreted_rows, ou
// listKey/items para op_lists no caso de Planilha1).

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

export interface InterpreterResult {
  sheetKey: string;
  rows: InterpretedRow[];
  exceptions: InterpretedException[];
  rejectedCount: number;
}

export interface ListInterpreterResult {
  listKey: string;
  items: unknown[];
}

export interface InterpreterContext {
  sheetName: string;
  fileModifiedAt: string;
}

const CLASSIFICACOES_VALIDAS = [
  "FOLHA PAGAMENTO",
  "TRANSPORTE EQUIPE",
  "MATERIAL OBRAS",
  "FROTA",
  "OUTROS",
  "COMBUSTIVEL",
  "ALIMENTACAO",
  "SINISTRO",
  "EQUIPAMENTOS",
  "MATERIAL ESCRITORIO",
  "BAIXADA",
  "LOCACAO IMOVEIS",
].map(normalizarRotulo);

function centavos(valor: number): number {
  return Math.round(valor * 100);
}

// Tenta interpretar DATA DA DESPESA como data única ou período em texto
// ("01 A 10/07/2026"). Devolve { data_inicio, data_fim } ou null se não
// conseguir interpretar (vira exceção bloqueante, linha não aplicada).
function parsePeriodoOuData(valor: unknown): { data_inicio: string; data_fim: string } | null {
  if (celulaVazia(valor)) return null;

  const texto = String(valor).trim();
  const periodoMatch = texto.match(/^(\d{1,2})\s*a\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/i);
  if (periodoMatch) {
    const [, dia1, dia2, mes, ano] = periodoMatch;
    const mm = mes.padStart(2, "0");
    return {
      data_inicio: `${ano}-${mm}-${dia1.padStart(2, "0")}`,
      data_fim: `${ano}-${mm}-${dia2.padStart(2, "0")}`,
    };
  }

  const dataUnica = parseDataISO(valor);
  if (dataUnica) return { data_inicio: dataUnica, data_fim: dataUnica };

  return null;
}

const HEADER_DESPESAS = ["ENTRADA", "DATA", "DESCRICAO", "VALOR", "DATA DA DESPESA", "CLASSIFICACAO", "SOLICITANTE"];

export function interpretarDespesas(rows: unknown[][], firstRowNumber: number): InterpreterResult {
  const exceptions: InterpretedException[] = [];
  const interpretedRows: InterpretedRow[] = [];
  let rejectedCount = 0;

  const headerIdx = localizarCabecalho(rows, HEADER_DESPESAS);
  if (headerIdx === null) {
    return { sheetKey: "caixa.despesa", rows: [], exceptions: [], rejectedCount: 0 };
  }

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colIndex = (rotulo: string) => headerRow.indexOf(normalizarRotulo(rotulo));

  const colEntrada = colIndex("ENTRADA");
  const colData = colIndex("DATA");
  const colDescricao = colIndex("DESCRICAO");
  const colValor = colIndex("VALOR");
  const colDataDespesa = colIndex("DATA DA DESPESA");
  const colClassificacao = colIndex("CLASSIFICACAO");
  const colSolicitante = colIndex("SOLICITANTE");

  const contadorChave = new Map<string, number>();
  const proximoSufixo = (base: string): number => {
    const n = contadorChave.get(base) ?? 0;
    contadorChave.set(base, n + 1);
    return n;
  };

  let somaEntradas = 0;
  let somaDespesas = 0;
  let linhaTotais: number | null = null;
  let totalEntradaPlanilha: number | null = null;
  let totalDespesaPlanilha: number | null = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;

    const dataDespesaCelula = row[colDataDespesa];
    if (!celulaVazia(dataDespesaCelula) && normalizarRotulo(dataDespesaCelula).includes("SALDO")) {
      linhaTotais = rowNumber;
      totalEntradaPlanilha = parseNumeroBR(row[colEntrada]);
      totalDespesaPlanilha = parseNumeroBR(row[colValor]);
      continue;
    }

    // Bloco RECEITA (independente do bloco despesa na mesma linha)
    const entradaValor = parseNumeroBR(row[colEntrada]);
    if (entradaValor !== null && entradaValor !== 0) {
      const dataReceita = parseDataISO(row[colData]);
      if (!dataReceita) {
        exceptions.push({
          row_number: rowNumber,
          severity: "bloqueante",
          type: "data_invalida",
          message: `Receita com DATA inválida: "${String(row[colData] ?? "")}"`,
          value_current: row[colData],
        });
        rejectedCount++;
      } else {
        const baseChave = `ent|${dataReceita}|${centavos(entradaValor)}`;
        const chave = `${baseChave}#${proximoSufixo(baseChave)}`;
        interpretedRows.push({
          natural_key: chave,
          data: { tipo: "receita", data: dataReceita, valor: entradaValor, descricao: null },
          source_row: rowNumber,
        });
        exceptions.push({
          row_number: rowNumber,
          severity: "aviso",
          type: "entrada_sem_descricao",
          message: "Receita não tem campo de descrição própria - bloco independente da despesa na mesma linha",
        });
        somaEntradas += entradaValor;
      }
    }

    // Bloco DESPESA (independente do bloco receita na mesma linha)
    const descricao = row[colDescricao];
    const valorDespesaCelula = row[colValor];
    const classificacaoCelula = row[colClassificacao];
    const solicitanteCelula = row[colSolicitante];

    const blocoDespesaVazio =
      celulaVazia(descricao) && celulaVazia(valorDespesaCelula) && celulaVazia(dataDespesaCelula) && celulaVazia(classificacaoCelula) && celulaVazia(solicitanteCelula);

    if (!blocoDespesaVazio) {
      const periodo = parsePeriodoOuData(dataDespesaCelula);
      if (!periodo) {
        exceptions.push({
          row_number: rowNumber,
          severity: "bloqueante",
          type: "data_invalida",
          message: `DATA DA DESPESA inválida: "${String(dataDespesaCelula ?? "")}"`,
          value_current: dataDespesaCelula,
        });
        rejectedCount++;
      } else {
        const descricaoNormalizada = normalizarRotulo(descricao);
        const baseChave = `desp|${periodo.data_inicio}|${descricaoNormalizada}`;
        const chave = `${baseChave}#${proximoSufixo(baseChave)}`;

        const classificacaoNormalizada = normalizarRotulo(classificacaoCelula);
        if (celulaVazia(classificacaoCelula)) {
          exceptions.push({ row_number: rowNumber, severity: "aviso", type: "sem_classificacao", message: "Despesa sem classificação" });
        } else if (!CLASSIFICACOES_VALIDAS.includes(classificacaoNormalizada)) {
          exceptions.push({
            row_number: rowNumber,
            severity: "aviso",
            type: "classificacao_desconhecida",
            message: `Classificação "${classificacaoCelula}" não está na lista conhecida`,
            value_current: classificacaoCelula,
          });
        }

        const valorDespesa = parseNumeroBR(valorDespesaCelula) ?? 0;
        const solicitantes = celulaVazia(solicitanteCelula)
          ? []
          : String(solicitanteCelula)
              .split("/")
              .map((s) => s.trim())
              .filter((s) => s !== "");

        interpretedRows.push({
          natural_key: chave,
          data: {
            tipo: "despesa",
            data_inicio: periodo.data_inicio,
            data_fim: periodo.data_fim,
            descricao: typeof descricao === "string" ? descricao : String(descricao ?? ""),
            valor: valorDespesa,
            classificacao: celulaVazia(classificacaoCelula) ? null : String(classificacaoCelula),
            solicitantes,
          },
          source_row: rowNumber,
        });

        somaDespesas += valorDespesa;
      }
    }
  }

  if (linhaTotais !== null) {
    const TOLERANCIA = 0.01;
    if (totalEntradaPlanilha !== null && Math.abs(totalEntradaPlanilha - somaEntradas) > TOLERANCIA) {
      exceptions.push({
        row_number: linhaTotais,
        severity: "confirmacao",
        type: "total_nao_confere",
        message: `Soma das receitas aplicadas (${somaEntradas.toFixed(2)}) difere do total da planilha (${totalEntradaPlanilha.toFixed(2)})`,
        value_current: somaEntradas,
        value_suggested: totalEntradaPlanilha,
      });
    }
    if (totalDespesaPlanilha !== null && Math.abs(totalDespesaPlanilha - somaDespesas) > TOLERANCIA) {
      exceptions.push({
        row_number: linhaTotais,
        severity: "confirmacao",
        type: "total_nao_confere",
        message: `Soma das despesas aplicadas (${somaDespesas.toFixed(2)}) difere do total da planilha (${totalDespesaPlanilha.toFixed(2)})`,
        value_current: somaDespesas,
        value_suggested: totalDespesaPlanilha,
      });
    }
  }

  return { sheetKey: "caixa.despesa", rows: interpretedRows, exceptions, rejectedCount };
}

const MESES_PT: Record<string, number> = {
  JANEIRO: 1,
  FEVEREIRO: 2,
  MARCO: 3,
  ABRIL: 4,
  MAIO: 5,
  JUNHO: 6,
  JULHO: 7,
  AGOSTO: 8,
  SETEMBRO: 9,
  OUTUBRO: 10,
  NOVEMBRO: 11,
  DEZEMBRO: 12,
};

function extrairMesDoNomeAba(sheetName: string): number | null {
  const normalizado = normalizarRotulo(sheetName);
  for (const [nome, numero] of Object.entries(MESES_PT)) {
    if (normalizado.includes(nome)) return numero;
  }
  return null;
}

const VALOR_HABITUAL_MAXIMO = 350;

// Aba "HORAS EXTRAS <MÊS>": colunas NOME, CARGO e blocos "DIA nn"/"PG" (o PG
// pertence ao DIA imediatamente à esquerda). Mês vem do nome da aba, ano do
// file.modified_at (contexto que o rows[][] não traz por si só).
export function interpretarHorasExtras(rows: unknown[][], firstRowNumber: number, context: InterpreterContext): InterpreterResult {
  const exceptions: InterpretedException[] = [];
  const interpretedRows: InterpretedRow[] = [];

  const mes = extrairMesDoNomeAba(context.sheetName);
  const ano = new Date(context.fileModifiedAt).getUTCFullYear();

  if (!mes) {
    return { sheetKey: "caixa.hora_extra", rows: [], exceptions: [], rejectedCount: 0 };
  }

  const headerIdx = localizarCabecalho(rows, ["NOME", "CARGO"]);
  if (headerIdx === null) {
    return { sheetKey: "caixa.hora_extra", rows: [], exceptions: [], rejectedCount: 0 };
  }

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colNome = headerRow.indexOf("NOME");
  const colCargo = headerRow.indexOf("CARGO");

  const colunasDia: { col: number; dia: number }[] = [];
  const colunaPgParaDia = new Map<number, number>();
  let ultimoDiaCol: { col: number; dia: number } | null = null;

  for (let c = 0; c < headerRow.length; c++) {
    const rotulo = headerRow[c];
    const diaMatch = rotulo.match(/^DIA\s*(\d{1,2})$/);
    if (diaMatch) {
      ultimoDiaCol = { col: c, dia: Number(diaMatch[1]) };
      colunasDia.push(ultimoDiaCol);
    } else if (rotulo === "PG" && ultimoDiaCol) {
      colunaPgParaDia.set(ultimoDiaCol.col, c);
    }
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;
    const nomeCelula = row[colNome];
    const cargoCelula = colCargo >= 0 ? row[colCargo] : undefined;

    if (celulaVazia(nomeCelula)) continue;
    const nomeNormalizado = normalizarRotulo(nomeCelula);
    if (nomeNormalizado.includes("TOTAL")) continue;
    if (normalizarRotulo(cargoCelula).startsWith("MORADOR")) continue;

    const cargoAusente = celulaVazia(cargoCelula) || String(cargoCelula).trim() === "-";
    if (cargoAusente) {
      exceptions.push({
        row_number: rowNumber,
        severity: "aviso",
        type: "cargo_ausente",
        message: `Funcionário "${nomeCelula}" sem cargo definido`,
      });
    }

    for (const { col, dia } of colunasDia) {
      const valor = parseNumeroBR(row[col]);
      if (valor === null) continue;

      const dataStr = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const diaSemana = new Date(`${dataStr}T00:00:00Z`).getUTCDay();
      const fimDeSemana = diaSemana === 0 || diaSemana === 6;

      const pgCol = colunaPgParaDia.get(col);
      const pago = pgCol !== undefined ? !celulaVazia(row[pgCol]) : false;

      if (valor > VALOR_HABITUAL_MAXIMO) {
        exceptions.push({
          row_number: rowNumber,
          severity: "aviso",
          type: "valor_acima_do_habitual",
          message: `Hora extra de ${nomeCelula} em ${dataStr} (${valor}) acima do habitual (${VALOR_HABITUAL_MAXIMO})`,
          value_current: valor,
        });
      }

      interpretedRows.push({
        natural_key: `he|${nomeNormalizado}|${dataStr}`,
        data: {
          nome: typeof nomeCelula === "string" ? nomeCelula : String(nomeCelula),
          cargo: cargoAusente ? null : String(cargoCelula),
          data: dataStr,
          valor,
          fim_de_semana: fimDeSemana,
          pago,
        },
        source_row: rowNumber,
      });
    }
  }

  return { sheetKey: "caixa.hora_extra", rows: interpretedRows, exceptions, rejectedCount: 0 };
}

const PERCENTUAL_HORA_MAIS = 1.6;
const HORAS_MES_PADRAO = 220;

const HEADER_AUSENCIA = [
  "COLABORADOR",
  "DIA",
  "HORAS DESCONTADAS",
  "HORAS EXTRAS",
  "SALARIO",
  "VALOR HORA",
  "VALOR HORA + 60%",
  "VALOR HORAS EXTRAS",
  "VALOR REF. HORAS DESCONTADAS",
  "TOTAL",
];

// Aba "AUSÊNCIA PONTO SAÍDA": a planilha já devolve os valores calculados,
// este interpretador RECALCULA e só sinaliza divergência (nunca corrige -
// Regra de Ouro 4). SALÁRIO é sensível: guardado no registro, mas o
// dashboard/exportação desta aba não deve exibi-lo por padrão.
export function interpretarAusenciaPontoSaida(rows: unknown[][], firstRowNumber: number): InterpreterResult {
  const exceptions: InterpretedException[] = [];
  const interpretedRows: InterpretedRow[] = [];

  const headerIdx = localizarCabecalho(rows, HEADER_AUSENCIA, 12, 0.8);
  if (headerIdx === null) {
    return { sheetKey: "caixa.ausencia_ponto", rows: [], exceptions: [], rejectedCount: 0 };
  }

  const headerRow = (rows[headerIdx] ?? []).map(normalizarRotulo);
  const colIndex = (rotulo: string) => headerRow.indexOf(normalizarRotulo(rotulo));

  const colColaborador = colIndex("COLABORADOR");
  const colDia = colIndex("DIA");
  const colHorasDescontadas = colIndex("HORAS DESCONTADAS");
  const colHorasExtras = colIndex("HORAS EXTRAS");
  const colSalario = colIndex("SALARIO");
  const colTotal = colIndex("TOTAL");
  // "Coluna seguinte pode ter 'Pago em dd/mm'" - não é um rótulo fixo do
  // cabeçalho obrigatório, então olhamos a coluna logo após TOTAL.
  const colPagoEm = colTotal >= 0 ? colTotal + 1 : -1;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;
    const colaborador = row[colColaborador];
    if (celulaVazia(colaborador)) continue;

    const dia = parseDataISO(row[colDia]);
    if (!dia) continue;

    const salario = parseNumeroBR(row[colSalario]) ?? 0;
    const horasDescontadas = parseNumeroBR(row[colHorasDescontadas]) ?? 0;
    const horasExtras = parseNumeroBR(row[colHorasExtras]) ?? 0;
    const totalPlanilha = parseNumeroBR(row[colTotal]);

    const valorHora = salario / HORAS_MES_PADRAO;
    const valorHoraMais = valorHora * PERCENTUAL_HORA_MAIS;
    const valorHe = horasExtras * valorHoraMais;
    const valorDesc = horasDescontadas * valorHora;
    const totalCalculado = valorHe + valorDesc;

    if (totalPlanilha !== null && Math.abs(totalPlanilha - totalCalculado) > 0.01) {
      exceptions.push({
        row_number: rowNumber,
        severity: "confirmacao",
        type: "formula_divergente",
        message: `Total recalculado (${totalCalculado.toFixed(2)}) diverge do total da planilha (${totalPlanilha.toFixed(2)}) para ${colaborador}`,
        value_current: totalCalculado,
        value_suggested: totalPlanilha,
      });
    }

    const pagoEmCelula = colPagoEm >= 0 ? row[colPagoEm] : undefined;
    const pago = !celulaVazia(pagoEmCelula);

    interpretedRows.push({
      natural_key: `aus|${normalizarRotulo(colaborador)}|${dia}`,
      data: {
        colaborador: String(colaborador),
        dia,
        horas_descontadas: horasDescontadas,
        horas_extras: horasExtras,
        salario,
        valor_hora: valorHora,
        valor_hora_mais: valorHoraMais,
        valor_he: valorHe,
        valor_desc: valorDesc,
        total: totalPlanilha ?? totalCalculado,
        pago,
        pago_em: pago ? String(pagoEmCelula) : null,
      },
      source_row: rowNumber,
    });
  }

  return { sheetKey: "caixa.ausencia_ponto", rows: interpretedRows, exceptions, rejectedCount: 0 };
}

// Aba "Planilha1": lista de categorias de referência - não é um registro
// versionado por diff, só o conteúdo mais recente (op_lists).
export function interpretarPlanilha1(rows: unknown[][]): ListInterpreterResult {
  const items = rows
    .flat()
    .filter((celula) => !celulaVazia(celula))
    .map((celula) => String(celula).trim());

  return { listKey: "caixa.categorias", items };
}
