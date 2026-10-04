// =============================================
// MÓDULO OPERACIONAL: heurística de formatação para o Espelho de abas (G1)
// =============================================
// Puro, sem acesso a banco/rede (Regra de Ouro 6/7) - usada só quando o
// payload do n8n NÃO trouxe `sheet.formatted_rows` (o texto exato do Excel).
// Nesse caso, tenta reconstituir como a célula provavelmente aparece na
// planilha, a partir do rótulo da coluna e do valor bruto. Nunca é usada para
// decidir nada além de exibição - o hash de mudança e os interpretadores
// continuam olhando só para o valor bruto (`rows`), nunca para este texto.

import { celulaVazia, normalizarRotulo } from "./parsing.ts";

const SERIAL_EXCEL_MIN = 40000;
const SERIAL_EXCEL_MAX = 60000;

const MESES_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatarSerialComoMesAno(serial: number): string {
  const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
  const data = new Date(EXCEL_EPOCH_MS + serial * 86400000);
  const mes = MESES_PT[data.getUTCMonth()];
  const ano = String(data.getUTCFullYear()).slice(-2);
  return `${mes}/${ano}`;
}

function formatarReaisBR(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPercentualBR(valor: number): string {
  return `${(valor * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

const RÓTULOS_DATA = ["MES", "MÊS", "DATA"];
const RÓTULOS_PERCENTUAL = ["%", "PROBAB", "MARGEM", "ALIQUOTA", "ALÍQUOTA", "CARGA"];

function rotuloContemAlgum(rotulo: string, candidatos: string[]): boolean {
  const rotuloNormalizado = normalizarRotulo(rotulo);
  return candidatos.some((c) => rotuloNormalizado.includes(normalizarRotulo(c)));
}

// `rotuloColuna` é o cabeçalho da coluna dessa célula (quando conhecido) -
// usado só para decidir entre data/percentual/moeda quando o valor é
// ambíguo (ex. 0.9 pode ser 90% ou quase R$ 1,00 dependendo da coluna).
export function formatarCelula(valor: unknown, rotuloColuna?: string): string {
  if (celulaVazia(valor)) return "";

  if (typeof valor === "number") {
    if (
      valor >= SERIAL_EXCEL_MIN &&
      valor <= SERIAL_EXCEL_MAX &&
      rotuloColuna &&
      rotuloContemAlgum(rotuloColuna, RÓTULOS_DATA)
    ) {
      return formatarSerialComoMesAno(valor);
    }
    if (valor > 0 && valor < 1 && rotuloColuna && rotuloContemAlgum(rotuloColuna, RÓTULOS_PERCENTUAL)) {
      return formatarPercentualBR(valor);
    }
    return formatarReaisBR(valor);
  }

  return String(valor);
}

// Formata uma matriz inteira - `cabecalho` (rótulos de coluna, mesma ordem
// de `linhas[i]`) é opcional; sem ele, todo número vira moeda (nunca
// data/percentual, que dependem do rótulo da coluna para não inventar).
export function formatarLinhas(linhas: unknown[][], cabecalho?: unknown[]): string[][] {
  return linhas.map((linha) =>
    linha.map((valor, col) => formatarCelula(valor, cabecalho ? String(cabecalho[col] ?? "") : undefined))
  );
}
