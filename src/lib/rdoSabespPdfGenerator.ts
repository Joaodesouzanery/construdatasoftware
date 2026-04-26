import jsPDF from "jspdf";
import "jspdf-autotable";
import JSZip from "jszip";
import logoSabesp from "@/assets/logo-sabesp.png";
import logoCslnr from "@/assets/logo-cslnr.jpg";
import { CRIADOUROS } from "./rdoSabespCatalog";
import { getServiceDisplayLabel } from "./rdoSabespUtils";
import { supabase } from "./supabase";

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
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = reject;
    img.src = src;
  });

const fmtDate = (dateValue: string) => {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
};

const checkbox = (checked: boolean) => (checked ? "[X]" : "[ ]");
let workerConfigured = false;
let pdfjsLibPromise: Promise<any> | null = null;

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const triggerBlobDownload = async (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.appendChild(anchor);

  try {
    await waitForNextFrame();
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  } finally {
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
};

const getPdfjsLib = async () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist");
  }
  return pdfjsLibPromise;
};

const ensurePdfWorker = async () => {
  if (workerConfigured) return;
  const pdfjsLib = await getPdfjsLib();

  try {
    const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  }

  workerConfigured = true;
};

const resolveSabespPhotoUrls = async (photoPaths?: string[] | null) => {
  if (!Array.isArray(photoPaths) || photoPaths.length === 0) return [];

  const signedPhotos = await Promise.all(
    photoPaths.map(async (path) => {
      try {
        const { data } = await supabase.storage.from("rdo-sabesp-photos").createSignedUrl(path, 60 * 60);
        return data?.signedUrl || null;
      } catch (error) {
        console.error("Erro ao assinar foto do RDO Sabesp:", error);
        return null;
      }
    }),
  );

  return signedPhotos.filter((url): url is string => Boolean(url));
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
  photo_paths?: string[] | null;
  responsavel_empreiteira?: string | null;
  responsavel_consorcio?: string | null;
  assinatura_empreiteira_url?: string | null;
  assinatura_consorcio_url?: string | null;
  planilha_foto_url?: string | null;
}

export async function generateRdoSabespPdf(rdo: RdoSabespData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;

  try {
    const sabesp = await loadDataUrl(logoSabesp);
    doc.addImage(sabesp, "PNG", margin, 6, 28, 18);
  } catch {}

  try {
    const cslnr = await loadDataUrl(logoCslnr);
    doc.addImage(cslnr, "PNG", pageWidth - margin - 22, 6, 22, 22);
  } catch {}

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("RELATÓRIO DIÁRIO DE OBRA (RDO)", pageWidth / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.text("SABESP - Consórcio Se Liga Na Rede", pageWidth / 2, 19, { align: "center" });

  let y = 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CRIADOUROS:", margin, y);
  doc.setFont("helvetica", "normal");
  let x = margin + 22;
  for (const item of CRIADOUROS.filter((criadouro) => criadouro.value !== "outro")) {
    const selected = rdo.criadouro === item.value;
    doc.text(`${checkbox(selected)} ${item.label}`, x, y);
    x += 32;
  }
  if (rdo.criadouro === "outro" && rdo.criadouro_outro) {
    doc.text(`[X] Outro: ${rdo.criadouro_outro}`, x, y);
  }
  y += 5;

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

  doc.setFont("helvetica", "bold");
  doc.text("1. TODOS OS FUNCIONÁRIOS ESTÃO UTILIZANDO OS EPIs?", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${checkbox(!!rdo.epi_utilizado)} SIM   ${checkbox(rdo.epi_utilizado === false)} NÃO`, 105, y);
  y += 4;

  const clima = rdo.condicoes_climaticas || {};
  const qualidade = rdo.qualidade || {};
  const horarios = rdo.horarios || {};
  const paralisacoes = rdo.paralisacoes || [];

  (doc as any).autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      overflow: "linebreak",
      cellWidth: "wrap",
    },
    headStyles: { fillColor: [220, 230, 241], textColor: 0, fontStyle: "bold", halign: "center" },
    head: [["CONDIÇÕES CLIMÁTICAS", "QUALIDADE", "PARALISAÇÕES", "HORÁRIO"]],
    body: [
      [
        `Manhã: ${clima.manha || "—"}\nTarde: ${clima.tarde || "—"}\nNoite: ${clima.noite || "—"}`,
        `Ordem de Serviço: ${checkbox(!!qualidade.ordem_servico)}\nBandeirola: ${checkbox(!!qualidade.bandeirola)}\nProjeto: ${checkbox(!!qualidade.projeto)}\nObs: ${qualidade.obs || "—"}`,
        (() => {
          const lines = paralisacoes.length
            ? paralisacoes.map((item: any) => `• ${item.motivo || "—"}${item.inicio ? ` ${item.inicio}` : ""}${item.fim ? `→${item.fim}` : ""}`)
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

  const maoDeObra = (rdo.mao_de_obra || []).filter((item: any) => item.cargo);
  if (maoDeObra.length > 0) {
    (doc as any).autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [220, 230, 241], textColor: 0, halign: "center" },
      head: [["MÃO DE OBRA - CARGO", "TERC.", "CONTRAT."]],
      body: maoDeObra.map((item: any) => [item.cargo, String(item.terc ?? 0), String(item.contrat ?? 0)]),
      columnStyles: { 1: { halign: "center", cellWidth: 25 }, 2: { halign: "center", cellWidth: 25 } },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  }

  const equipamentos = (rdo.equipamentos || []).filter((item: any) => item.descricao);
  if (equipamentos.length > 0) {
    (doc as any).autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [220, 230, 241], textColor: 0, halign: "center" },
      head: [["EQUIPAMENTOS / VEÍCULOS", "TERC.", "CONTRAT."]],
      body: equipamentos.map((item: any) => [item.descricao, String(item.terc ?? 0), String(item.contrat ?? 0)]),
      columnStyles: { 1: { halign: "center", cellWidth: 25 }, 2: { halign: "center", cellWidth: 25 } },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  }

  const renderServicos = (titulo: string, lista: any[]) => {
    const services = (lista || []).filter((item: any) => Number(item.quantidade) > 0);
    if (!services.length) return;

    (doc as any).autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fillColor: [200, 220, 240], textColor: 0, halign: "center" },
      head: [[`${titulo} - CÓD.`, "ATIVIDADE EXECUTADA", "EXEC.", "UN."]],
      body: services.map((item: any) => [
        item.codigo || "—",
        getServiceDisplayLabel(item) || item.descricao || "—",
        String(item.quantidade),
        item.unidade,
      ]),
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
    const lines = doc.splitTextToSize(rdo.observacoes, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  }

  if (y > 260) {
    doc.addPage();
    y = 20;
  }

  y = Math.max(y, 270);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const drawSig = async (url: string | null | undefined, centerX: number) => {
    if (!url) return;
    try {
      const dataUrl = url.startsWith("data:") ? url : await loadDataUrl(url);
      doc.addImage(dataUrl, "PNG", centerX - 25, y - 18, 50, 16);
    } catch (error) {
      console.warn("sig load fail", error);
    }
  };

  await drawSig(rdo.assinatura_empreiteira_url, margin + 40);
  await drawSig(rdo.assinatura_consorcio_url, pageWidth - margin - 40);
  doc.line(margin + 5, y, margin + 75, y);
  doc.line(pageWidth - margin - 75, y, pageWidth - margin - 5, y);
  doc.text(rdo.responsavel_empreiteira || "RESPONSÁVEL DA EMPREITEIRA", margin + 40, y + 4, { align: "center" });
  doc.text(rdo.responsavel_consorcio || "RESPONSÁVEL DO CONSÓRCIO", pageWidth - margin - 40, y + 4, { align: "center" });

  const photoUrls = await resolveSabespPhotoUrls(rdo.photo_paths);
  if (photoUrls.length > 0) {
    doc.addPage();
    let photoY = 16;
    const gap = 6;
    const photoWidth = (pageWidth - margin * 2 - gap) / 2;
    const photoHeight = 58;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("FOTOS DO RDO", margin, photoY);
    photoY += 6;

    for (let index = 0; index < photoUrls.length; index += 1) {
      if (index > 0 && index % 4 === 0) {
        doc.addPage();
        photoY = 16;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("FOTOS DO RDO", margin, photoY);
        photoY += 6;
      }

      const column = index % 2;
      const row = Math.floor((index % 4) / 2);
      const imageX = margin + column * (photoWidth + gap);
      const imageY = photoY + row * (photoHeight + 14);

      doc.setDrawColor(210);
      doc.rect(imageX, imageY, photoWidth, photoHeight);

      try {
        const dataUrl = await loadDataUrl(photoUrls[index]);
        doc.addImage(dataUrl, "PNG", imageX + 1, imageY + 1, photoWidth - 2, photoHeight - 2);
      } catch (error) {
        console.warn("Não foi possível carregar foto do RDO Sabesp para o PDF:", error);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Foto indisponível", imageX + photoWidth / 2, imageY + photoHeight / 2, { align: "center" });
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Foto ${index + 1}`, imageX, imageY + photoHeight + 5);
    }
  }

  doc.setFontSize(6);
  doc.setTextColor(120);
  doc.text("Gerado automaticamente pela ConstruData", pageWidth / 2, pageHeight - 5, { align: "center" });

  return doc;
}

export async function downloadRdoSabespPdf(rdo: RdoSabespData) {
  const blob = await generateRdoSabespPdfBlob(rdo);
  await triggerBlobDownload(blob, `RDO-Sabesp_${rdo.report_date || "sem-data"}.pdf`);
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
  const pdfjsLib = await getPdfjsLib();

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
  const zip = new JSZip();
  for (const rdo of rdos) {
    const doc = await generateRdoSabespPdf(rdo);
    const blob = doc.output("blob");
    zip.file(`RDO-Sabesp_${rdo.report_date}_${(rdo.id || "").slice(0, 8)}.pdf`, blob);
  }
  const content = await zip.generateAsync({ type: "blob" });
  await triggerBlobDownload(content, `RDOs-Sabesp_${new Date().toISOString().slice(0, 10)}.zip`);
}

export async function downloadRdoSabespCombinedPdf(rdos: RdoSabespData[], filename?: string) {
  const blob = await generateRdoSabespCombinedPdfBlob(rdos);
  await triggerBlobDownload(blob, filename || `RDOs-Sabesp_${new Date().toISOString().slice(0, 10)}.pdf`);
}
