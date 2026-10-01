// =============================================
// MÓDULO OPERACIONAL: primitivas puras de interpretação de planilha
// =============================================
// Compartilhadas por todos os perfis (caixa, operacional_sabesp,
// gestao_empresa) - sem acesso a banco, sem chamadas de rede, 100%
// determinístico (Regras de Ouro 6 e 7). Testadas em parsing.test.ts.
// Usado tanto pela edge function op-ingest-sheet (Deno, import relativo)
// quanto pelos testes (vitest/Node, mesmo import relativo) - um único arquivo,
// dois runtimes, sem duplicação.

export function normalizarRotulo(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function celulaVazia(valor: unknown): boolean {
  return valor === null || valor === undefined || String(valor).trim() === "";
}

// Aceita "1.234,56", "400,00", "1234.56" ou número puro; ignora símbolos como "R$".
export function parseNumeroBR(valor: unknown): number | null {
  if (typeof valor === "number") return valor;
  if (celulaVazia(valor)) return null;

  let texto = String(valor).trim().replace(/[^\d,.\-]/g, "");
  if (texto === "") return null;

  const temVirgula = texto.includes(",");
  const temPonto = texto.includes(".");

  if (temVirgula && temPonto) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    texto = texto.replace(",", ".");
  }

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

// Base do sistema de datas do Excel (30/12/1899) - soma de dias em ms.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

// Aceita "AAAA-MM-DD", "DD/MM/AAAA" ou número serial do Excel; devolve
// "AAAA-MM-DD" ou null se não conseguir interpretar.
export function parseDataISO(valor: unknown): string | null {
  if (celulaVazia(valor)) return null;

  if (typeof valor === "number") {
    const ms = EXCEL_EPOCH_MS + valor * 86400000;
    const data = new Date(ms);
    return Number.isNaN(data.getTime()) ? null : data.toISOString().split("T")[0];
  }

  const texto = String(valor).trim();

  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  const numero = Number(texto);
  if (Number.isFinite(numero) && texto !== "") return parseDataISO(numero);

  return null;
}

// Localiza, dentro das primeiras `maxLinhas` linhas, a linha cujos rótulos
// (normalizados) cobrem pelo menos `minProporcao` dos rótulos obrigatórios.
// Retorna o índice da linha (0-based) ou null se nenhuma atingir o mínimo.
export function localizarCabecalho(
  linhas: unknown[][],
  rotulosObrigatorios: string[],
  maxLinhas = 12,
  minProporcao = 1
): number | null {
  const obrigatorios = rotulosObrigatorios.map(normalizarRotulo);
  const limite = Math.min(maxLinhas, linhas.length);

  for (let i = 0; i < limite; i++) {
    const linhaNormalizada = (linhas[i] ?? []).map(normalizarRotulo);
    const encontrados = obrigatorios.filter((rotulo) => linhaNormalizada.includes(rotulo));
    if (encontrados.length / obrigatorios.length >= minProporcao) {
      return i;
    }
  }

  return null;
}
