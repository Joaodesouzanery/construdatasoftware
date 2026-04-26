import jsPDF from "jspdf";
import "jspdf-autotable";
import * as pdfjsLib from "pdfjs-dist";
import logoSabesp from "@/assets/logo-sabesp.png";
import logoCslnr from "@/assets/logo-cslnr.jpg";
import { CRIADOUROS } from "./rdoSabespCatalog";
import { getServiceDisplayLabel } from "./rdoSabespUtils";

const loadDataUrl = (src: string) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = src;
  });

const fmtDate = (d: string) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const checkbox = (checked: boolean) => (checked ? "[X]" : "[ ]");
let workerConfigured = false;

const ensurePdfWorker = async () => {
  if (workerConfigured) return;

  try {
    const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  }

  workerConfigured = true;
};

export interface RdoSabespData {
  id?: string;
  report_date: string;
  encarregado?: string | null;
  rua_beco?: string | null;
  criadouro?: string | null;
  criadouro_outro?: string | null;
  epi_utilizado?: boolean | null;
  condicoes_climaticas?: any;
  qualidade?: any;
  paralisacoes?: any[];
  paralisacao_outro?: string | null;
  horarios?: any;
  mao_de_obra?: any[];
  equipamentos?: any[];
  servicos_esgoto?: any[];
  servicos_agua?: any[];
  observacoes?: string | null;
  responsavel_empreiteira?: string | null;
  responsavel_consorcio?: string | null;
  assinatura_empreiteira_url?: string | null;
  assinatura_consorcio_url?: string | null;
  planilha_foto_url?: string | null;
}

export async function generateRdoSabespPdf(rdo: RdoSabespData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 8;

  // === Header com logos ===
  try {
    const sabesp = await loadDataUrl(logoSabesp);
    doc.addImage(sabesp, "PNG", margin, 6, 28, 18);
  } catch {}
  try {
    const cslnr = await loadDataUrl(logoCslnr);
    doc.addImage(cslnr, "PNG", pageW - margin - 22, 6, 22, 22);
  } catch {}

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("RELATÓRIO DIÁRIO DE OBRA (RDO)", pageW / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.text("SABESP - Consórcio Se Liga Na Rede", pageW / 2, 19, { align: "center" });

  let y = 30;

  // === Linha: Criadouros ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CRIADOUROS:", margin, y);
  doc.setFont("helvetica", "normal");
  let x = margin + 22;
  for (const c of CRIADOUROS.filter((item) => item.value !== "outro")) {
    const sel = rdo.criadouro === c.value;
    doc.text(`${checkbox(sel)} ${c.label}`, x, y);
    x += 32;
  }
  if (rdo.criadouro === "outro" && rdo.criadouro_outro) {
    doc.text(`[X] Outro: ${rdo.criadouro_outro}`, x, y);
  }
  y += 5;

  // === Rua/Beco, Encarregado, Data ===
  doc.setFont("helvetica", "bold");
  doc.text("RUA/BECO:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(rdo.rua_beco || "—", margin + 18, y);
  doc.setFont("helvetica", "bold");
  doc.text("ENCARREGADO:", 90, y);
  doc.setFont("helvetica", "normal");
  doc.text(rdo.encarregado || "—", 117, y);
  doc.setFont("helvetica", "bold");
  doc.text("DATA:", 165, y);
  doc.setFont("helvetica", "normal");
  doc.text(fmtDate(rdo.report_date), 175, y);
  y += 5;

  // === EPI ===
  doc.setFont("helvetica", "bold");
  doc.text(
    "1. TODOS OS FUNCIONÁRIOS ESTÃO UTILIZANDO OS EPIs?",
    margin,
    y,
  );
  doc.setFont("helvetica", "normal");
  doc.text(`${checkbox(!!rdo.epi_utilizado)} SIM   ${checkbox(!rdo.epi_utilizado)} NÃO`, 105, y);
  y += 4;

  // === Condições / Qualidade / Paralisações / Horários ===
  const cc = rdo.condicoes_climaticas || {};
  const q = rdo.qualidade || {};
  const horarios = rdo.horarios || {};
  const para = rdo.paralisacoes || [];

  (doc as any).autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, cellPadding: 1.2, lineColor: [0, 0, 0], lineWidth: 0.1, overflow: "linebreak", cellWidth: "wrap" },
    headStyles: { fillColor: [220, 230, 241], textColor: 0, fontStyle: "bold", halign: "center" },
    head: [["CONDIÇÕES CLIMÁTICAS", "QUALIDADE", "PARALISAÇÕES", "HORÁRIO"]],
    body: [
      [
        `Manhã: ${cc.manha || "—"}\nTarde: ${cc.tarde || "—"}\nNoite: ${cc.noite || "—"}`,
        `Ordem de Serviço: ${checkbox(!!q.ordem_servico)}\nBandeirola: ${checkbox(!!q.bandeirola)}\nProjeto: ${checkbox(!!q.projeto)}\nObs: ${q.obs || "—"}`,
        (() => {
          const lines = para.length
            ? para.map((p: any) => `• ${p.motivo || "—"}${p.inicio ? ` ${p.inicio}` : ""}${p.fim ? `→${p.fim}` : ""}`)
            : [];
          if (rdo.paralisacao_outro) lines.push(`Outro: ${rdo.paralisacao_outro}`);
          return lines.length ? lines.join("\n") : "—";
        })(),
        `Diurno: ${horarios?.diurno?.inicio || "—"} → ${horarios?.diurno?.fim || "—"}\nNoturno: ${horarios?.noturno?.inicio || "—"} → ${horarios?.noturno?.fim || "—"}`,
      ],
    ],
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 50 }, 2: { cellWidth: 50 }, 3: { cellWidth: 48 } },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  // === Mão de obra ===
  const mo = (rdo.mao_de_obra || []).filter((m: any) => m.cargo);
  if (mo.length) {
    (doc as any).autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [220, 230, 241], textColor: 0, halign: "center" },
      head: [["MÃO DE OBRA - CARGO", "TERC.", "CONTRAT."]],
      body: mo.map((m: any) => [m.cargo, String(m.terc ?? 0), String(m.contrat ?? 0)]),
      columnStyles: { 1: { halign: "center", cellWidth: 25 }, 2: { halign: "center", cellWidth: 25 } },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  }

  // === Equipamentos ===
  const eq = (rdo.equipamentos || []).filter((e: any) => e.descricao);
  if (eq.length) {
    (doc as any).autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [220, 230, 241], textColor: 0, halign: "center" },
      head: [["EQUIPAMENTOS / VEÍCULOS", "TERC.", "CONTRAT."]],
      body: eq.map((e: any) => [e.descricao, String(e.terc ?? 0), String(e.contrat ?? 0)]),
      columnStyles: { 1: { halign: "center", cellWidth: 25 }, 2: { halign: "center", cellWidth: 25 } },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  }

  // === Serviços ===
  const renderServicos = (titulo: string, lista: any[]) => {
    const filt = (lista || []).filter((s: any) => Number(s.quantidade) > 0);
    if (!filt.length) return;
    (doc as any).autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fillColor: [200, 220, 240], textColor: 0, halign: "center" },
      head: [[`${titulo} - CÓD.`, "ATIVIDADE EXECUTADA", "EXEC.", "UN."]],
      body: filt.map((s: any) => [s.codigo || "—", getServiceDisplayLabel(s) || s.descricao || "—", String(s.quantidade), s.unidade]),
      columnStyles: {
        0: { cellWidth: 22 },
        2: { halign: "center", cellWidth: 18 },
        3: { halign: "center", cellWidth: 14 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  };
  renderServicos("ESGOTO", rdo.servicos_esgoto || []);
  renderServicos("ÁGUA", rdo.servicos_agua || []);

  // === Observações ===
  if (rdo.observacoes) {
    if (y > 250) {
      doc.addPage();
      y = 15;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("OBSERVAÇÕES:", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(rdo.observacoes, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  }

  // === Assinaturas ===
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  y = Math.max(y, 270);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  // Assinaturas (imagem) acima da linha, se houver
  const drawSig = async (url: string | null | undefined, cx: number) => {
    if (!url) return;
    try {
      const dataUrl = url.startsWith("data:") ? url : await loadDataUrl(url);
      doc.addImage(dataUrl, "PNG", cx - 25, y - 18, 50, 16);
    } catch (e) {
      console.warn("sig load fail", e);
    }
  };
  await drawSig(rdo.assinatura_empreiteira_url, margin + 40);
  await drawSig(rdo.assinatura_consorcio_url, pageW - margin - 40);
  doc.line(margin + 5, y, margin + 75, y);
  doc.line(pageW - margin - 75, y, pageW - margin - 5, y);
  doc.text(rdo.responsavel_empreiteira || "RESPONSÁVEL DA EMPREITEIRA", margin + 40, y + 4, { align: "center" });
  doc.text(rdo.responsavel_consorcio || "RESPONSÁVEL DO CONSÓRCIO", pageW - margin - 40, y + 4, { align: "center" });

  // Rodapé
  doc.setFontSize(6);
  doc.setTextColor(120);
  doc.text(
    "Gerado automaticamente pela ConstruData",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 5,
    { align: "center" },
  );

  return doc;
}

export async function downloadRdoSabespPdf(rdo: RdoSabespData) {
  const doc = await generateRdoSabespPdf(rdo);
  doc.save(`RDO-Sabesp_${rdo.report_date || "sem-data"}.pdf`);
}

export async function generateRdoSabespPdfBlob(rdo: RdoSabespData) {
  const doc = await generateRdoSabespPdf(rdo);
  return doc.output("blob");
}

export async function renderRdoSabespPdfPreviewPages(rdo: RdoSabespData, scale = 1.35) {
  await ensurePdfWorker();

  const blob = await generateRdoSabespPdfBlob(rdo);
  return renderPdfBlobToImages(blob, scale);
}

export async function renderPdfBlobToImages(blob: Blob, scale = 1.35) {
  await ensurePdfWorker();

  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const images: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL("image/png"));

    try {
      await (page as any).cleanup?.();
    } catch {
      // ignore cleanup failures
    }
  }

  try {
    await (pdf as any).destroy?.();
  } catch {
    // ignore destroy failures
  }

  return images;
}

export async function mergePdfBlobsIntoSinglePdf(blobs: Blob[]) {
  const merged = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let firstPage = true;

  for (const blob of blobs) {
    const pages = await renderPdfBlobToImages(blob, 1.5);
    for (const page of pages) {
      if (!firstPage) merged.addPage("a4", "portrait");
      firstPage = false;
      merged.addImage(page, "PNG", 0, 0, 210, 297);
    }
  }

  return merged.output("blob");
}

export async function generateRdoSabespCombinedPdfBlob(rdos: RdoSabespData[]) {
  const blobs: Blob[] = [];
  for (const rdo of rdos) {
    blobs.push(await generateRdoSabespPdfBlob(rdo));
  }
  return mergePdfBlobsIntoSinglePdf(blobs);
}

export async function downloadRdoSabespBatchZip(rdos: RdoSabespData[]) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const r of rdos) {
    const d = await generateRdoSabespPdf(r);
    const blob = d.output("blob");
    zip.file(`RDO-Sabesp_${r.report_date}_${(r.id || "").slice(0, 8)}.pdf`, blob);
  }
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RDOs-Sabesp_${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadRdoSabespCombinedPdf(rdos: RdoSabespData[], filename?: string) {
  const blob = await generateRdoSabespCombinedPdfBlob(rdos);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `RDOs-Sabesp_${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
