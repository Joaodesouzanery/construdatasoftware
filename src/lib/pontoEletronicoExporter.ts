import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatarHoras } from "@/utils/pontoCalculation";
import { downloadJson, downloadMarkdown, triggerBlobDownload } from "./exportUtils";

export interface LinhaExportPonto {
  data: string;
  funcionarioNome?: string;
  horaEntrada?: string;
  horaSaida?: string;
  horaInicioIntervalo?: string;
  horaFimIntervalo?: string;
  horasTrabalhadas: number;
  horasExtras?: number;
  horasNoturnas?: number;
  falta?: boolean;
}

export interface ResumoExportPonto {
  funcionarioNome?: string;
  competencia: string;
  horasNormaisTotal: number;
  horasExtras50Total: number;
  horasExtras100Total: number;
  horasNoturnasTotal: number;
  horasFaltasTotal: number;
  saldoBancoHoras: number;
  calculadoEm?: string;
}

const CABECALHO = ["Data", "Funcionário", "Entrada", "Início Int.", "Fim Int.", "Saída", "Horas", "Extras", "Situação"];

const linhaParaTabela = (linha: LinhaExportPonto) => [
  linha.data,
  linha.funcionarioNome ?? "",
  linha.horaEntrada ?? "-",
  linha.horaInicioIntervalo ?? "-",
  linha.horaFimIntervalo ?? "-",
  linha.horaSaida ?? "-",
  formatarHoras(linha.horasTrabalhadas),
  linha.horasExtras ? formatarHoras(linha.horasExtras) : "-",
  linha.falta ? "Falta" : "-",
];

const linhasResumo = (resumo: ResumoExportPonto) => [
  ["Horas normais", formatarHoras(resumo.horasNormaisTotal)],
  ["Horas extras 50%", formatarHoras(resumo.horasExtras50Total)],
  ["Horas extras 100%", formatarHoras(resumo.horasExtras100Total)],
  ["Horas noturnas", formatarHoras(resumo.horasNoturnasTotal)],
  ["Horas de falta", formatarHoras(resumo.horasFaltasTotal)],
  ["Saldo banco de horas", formatarHoras(resumo.saldoBancoHoras)],
];

export async function exportPontoPDF(
  titulo: string,
  resumo: ResumoExportPonto,
  linhas: LinhaExportPonto[],
  filename: string
) {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text(titulo, 14, 16);
  doc.setFontSize(10);
  doc.text(`Competência: ${resumo.competencia}`, 14, 23);
  if (resumo.funcionarioNome) {
    doc.text(`Funcionário: ${resumo.funcionarioNome}`, 14, 29);
  }

  (doc as any).autoTable({
    startY: resumo.funcionarioNome ? 34 : 28,
    head: [["Resumo", "Valor"]],
    body: linhasResumo(resumo),
    theme: "grid",
    styles: { fontSize: 9 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 60;

  (doc as any).autoTable({
    startY: finalY + 6,
    head: [CABECALHO],
    body: linhas.map(linhaParaTabela),
    theme: "striped",
    styles: { fontSize: 8 },
    headStyles: { fillColor: [51, 65, 85] },
  });

  if (resumo.calculadoEm) {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.text(`Calculado em: ${resumo.calculadoEm}`, 14, pageHeight - 8);
  }

  await triggerBlobDownload(doc.output("blob"), filename);
}

export async function exportPontoExcel(
  _titulo: string,
  resumo: ResumoExportPonto,
  linhas: LinhaExportPonto[],
  filename: string
) {
  const wb = XLSX.utils.book_new();

  const resumoSheet = XLSX.utils.json_to_sheet([
    { Campo: "Competência", Valor: resumo.competencia },
    { Campo: "Funcionário", Valor: resumo.funcionarioNome ?? "Todos" },
    { Campo: "Horas normais", Valor: formatarHoras(resumo.horasNormaisTotal) },
    { Campo: "Horas extras 50%", Valor: formatarHoras(resumo.horasExtras50Total) },
    { Campo: "Horas extras 100%", Valor: formatarHoras(resumo.horasExtras100Total) },
    { Campo: "Horas noturnas", Valor: formatarHoras(resumo.horasNoturnasTotal) },
    { Campo: "Horas de falta", Valor: formatarHoras(resumo.horasFaltasTotal) },
    { Campo: "Saldo banco de horas", Valor: formatarHoras(resumo.saldoBancoHoras) },
  ]);
  XLSX.utils.book_append_sheet(wb, resumoSheet, "Resumo");

  const registrosSheet = XLSX.utils.json_to_sheet(
    linhas.map((linha) => ({
      Data: linha.data,
      Funcionário: linha.funcionarioNome ?? "",
      Entrada: linha.horaEntrada ?? "",
      "Início Intervalo": linha.horaInicioIntervalo ?? "",
      "Fim Intervalo": linha.horaFimIntervalo ?? "",
      Saída: linha.horaSaida ?? "",
      Horas: formatarHoras(linha.horasTrabalhadas),
      Extras: linha.horasExtras ? formatarHoras(linha.horasExtras) : "",
      Situação: linha.falta ? "Falta" : "",
    }))
  );
  XLSX.utils.book_append_sheet(wb, registrosSheet, "Registros");

  XLSX.writeFile(wb, filename);
}

export async function exportPontoMarkdown(
  titulo: string,
  resumo: ResumoExportPonto,
  linhas: LinhaExportPonto[],
  filename: string
) {
  const linhasMd = [
    `# ${titulo}`,
    "",
    `**Competência:** ${resumo.competencia}`,
    resumo.funcionarioNome ? `**Funcionário:** ${resumo.funcionarioNome}` : "",
    "",
    "## Resumo",
    "",
    "| Métrica | Valor |",
    "| --- | --- |",
    ...linhasResumo(resumo).map(([label, valor]) => `| ${label} | ${valor} |`),
    "",
    "## Registros",
    "",
    `| ${CABECALHO.join(" | ")} |`,
    `| ${CABECALHO.map(() => "---").join(" | ")} |`,
    ...linhas.map((linha) => `| ${linhaParaTabela(linha).join(" | ")} |`),
    "",
    resumo.calculadoEm ? `_Calculado em: ${resumo.calculadoEm}_` : "",
  ]
    .filter((linha) => linha !== "")
    .join("\n");

  await downloadMarkdown(linhasMd, filename);
}

export async function exportPontoJSON(
  titulo: string,
  resumo: ResumoExportPonto,
  linhas: LinhaExportPonto[],
  filename: string
) {
  await downloadJson({ titulo, resumo, registros: linhas }, filename);
}
