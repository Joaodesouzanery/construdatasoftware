// Cópia frontend de supabase/functions/_shared/op/formatacao.ts - mesmo
// padrão de duplicação já usado em operacionalAlertRules.ts (Deno e Vite não
// compartilham módulos entre si neste repositório). Mudar um lado sem mudar
// o outro faz o Espelho (tela "Planilha") mostrar formatação diferente do
// que o backend gravaria como fallback - manter os dois iguais.

function celulaVazia(valor: unknown): boolean {
  return valor === null || valor === undefined || String(valor).trim() === "";
}

function normalizarRotulo(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SERIAL_EXCEL_MIN = 40000;
const SERIAL_EXCEL_MAX = 60000;

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

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

const ROTULOS_DATA = ["MES", "MÊS", "DATA"];
const ROTULOS_PERCENTUAL = ["%", "PROBAB", "MARGEM", "ALIQUOTA", "ALÍQUOTA", "CARGA"];

function rotuloContemAlgum(rotulo: string, candidatos: string[]): boolean {
  const rotuloNormalizado = normalizarRotulo(rotulo);
  return candidatos.some((c) => rotuloNormalizado.includes(normalizarRotulo(c)));
}

export function formatarCelula(valor: unknown, rotuloColuna?: string): string {
  if (celulaVazia(valor)) return "";

  if (typeof valor === "number") {
    if (
      valor >= SERIAL_EXCEL_MIN &&
      valor <= SERIAL_EXCEL_MAX &&
      rotuloColuna &&
      rotuloContemAlgum(rotuloColuna, ROTULOS_DATA)
    ) {
      return formatarSerialComoMesAno(valor);
    }
    if (valor > 0 && valor < 1 && rotuloColuna && rotuloContemAlgum(rotuloColuna, ROTULOS_PERCENTUAL)) {
      return formatarPercentualBR(valor);
    }
    return formatarReaisBR(valor);
  }

  return String(valor);
}
