import jsPDF from "jspdf";
import "jspdf-autotable";
import logoSabesp from "@/assets/logo-sabesp.png";
import logoCslnr from "@/assets/logo-cslnr.jpg";
import { CRIADOUROS } from "./rdoSabespCatalog";
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
  doc.text("RELATORIO DIARIO DE OBRA (RDO)", pageWidth / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.text("SABESP - Consorcio Se Liga Na Rede", pageWidth / 2, 19, { align: "center" });

  let y = 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CRIADOUROS:", margin, y);
  doc.setFont("helvetica", "normal");
  let x = margin + 22;
  for (const criadouro of CRIADOUROS.filter((item) => item.value !== "outro")) {
    const selected = rdo.criadouro === criadouro.value;
    doc.text(`${checkbox(selected)} ${criadouro.label}`, x, y);
    x += 32;
  }
  if (rdo.criadouro === "outro" && rdo.criadouro_outro) {
    doc.text(`[X] Outro: ${rdo.criadouro_outro}`, x, y);
  }
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("RUA/BECO:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(rdo.rua_beco || "-", margin + 18, y);
  doc.setFont("helvetica", "bold");
  doc.text("ENCARREGADO:", 90, y);
  doc.setFont("helvetica", "normal");
  doc.text(rdo.encarregado || "-", 117, y);
  doc.setFont("helvetica", "bold");
  doc.text("DATA:", 165, y);
  doc.setFont("helvetica", "normal");
  doc.text(fmtDate(rdo.report_date), 175, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("1. TODOS OS FUNCIONARIOS ESTAO UTILIZANDO OS EPIs?", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${checkbox(!!rdo.epi_utilizado)} SIM   ${checkbox(rdo.epi_utilizado === false)} NAO`, 105, y);
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
    head: [["CONDICOES CLIMATICAS", "QUALIDADE", "PARALISACOES", "HORARIO"]],
    body: [
      [
        `Manha: ${clima.manha || "-"}\nTarde: ${clima.tarde || "-"}\nNoite: ${clima.noite || "-"}`,
        `Ordem de Servico: ${checkbox(!!qualidade.ordem_servico)}\nBandeirola: ${checkbox(!!qualidade.bandeirola)}\nProjeto: ${checkbox(!!qualidade.projeto)}\nObs: ${qualidade.obs || "-"}`,
        (() => {
          const lines = paralisacoes.length
            ? paralisacoes.map((item: any) => `* ${item.motivo || "-"}${item.inicio ? ` ${item.inicio}` : ""}${item.fim ? ` -> ${item.fim}` : ""}`)
            : [];
          if (rdo.paralisacao_outro) lines.push(`Outro: ${rdo.paralisacao_outro}`);
          return lines.length ? lines.join("\n") : "-";
        })(),
        `Diurno: ${horarios?.diurno?.inicio || "-"} -> ${horarios?.diurno?.fim || "-"}\nNoturno: ${horarios?.noturno?.inicio || "-"} -> ${horarios?.noturno?.fim || "-"}`,
      ],
    ],
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 50 },
      2: { cellWidth: 50 },
      3: { cellWidth: 48 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  const maoDeObra = (rdo.mao_de_obra || []).filter((item: any) => item.cargo);
  if (maoDeObra.length > 0) {
    (doc as any).autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [220, 230, 241], textColor: 0, halign: "center" },
      head: [["MAO DE OBRA - CARGO", "TERC.", "CONTRAT."]],
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
      head: [["EQUIPAMENTOS / VEICULOS", "TERC.", "CONTRAT."]],
      body: equipamentos.map((item: any) => [item.descricao, String(item.terc ?? 0), String(item.contrat ?? 0)]),
      columnStyles: { 1: { halign: "center", cellWidth: 25 }, 2: { halign: "center", cellWidth: 25 } },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  }

  const renderServicos = (titulo: string, lista: any[]) => {
    const servicos = (lista || []).filter((item: any) => Number(item.quantidade) > 0);
    if (servicos.length === 0) return;

    (doc as any).autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fillColor: [200, 220, 240], textColor: 0, halign: "center" },
      head: [[`${titulo} - COD.`, "ATIVIDADE EXECUTADA", "EXEC.", "UN."]],
      body: servicos.map((item: any) => [item.codigo || "-", item.descricao, String(item.quantidade), item.unidade]),
      columnStyles: {
        0: { cellWidth: 22 },
        2: { halign: "center", cellWidth: 18 },
        3: { halign: "center", cellWidth: 14 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  };

  renderServicos("ESGOTO", rdo.servicos_esgoto || []);
  renderServicos("AGUA", rdo.servicos_agua || []);

  if (rdo.observacoes) {
    if (y > 250) {
      doc.addPage();
      y = 15;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("OBSERVACOES:", margin, y);
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

  const drawSignature = async (url: string | null | undefined, centerX: number) => {
    if (!url) return;
    try {
      const dataUrl = url.startsWith("data:") ? url : await loadDataUrl(url);
      doc.addImage(dataUrl, "PNG", centerX - 25, y - 18, 50, 16);
    } catch (error) {
      console.warn("Nao foi possivel carregar assinatura do RDO Sabesp:", error);
    }
  };

  await drawSignature(rdo.assinatura_empreiteira_url, margin + 40);
  await drawSignature(rdo.assinatura_consorcio_url, pageWidth - margin - 40);
  doc.line(margin + 5, y, margin + 75, y);
  doc.line(pageWidth - margin - 75, y, pageWidth - margin - 5, y);
  doc.text(rdo.responsavel_empreiteira || "RESPONSAVEL DA EMPREITEIRA", margin + 40, y + 4, { align: "center" });
  doc.text(rdo.responsavel_consorcio || "RESPONSAVEL DO CONSORCIO", pageWidth - margin - 40, y + 4, {
    align: "center",
  });

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

    for (let index = 0; index < photoUrls.length; index++) {
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
        console.warn("Nao foi possivel carregar foto do RDO Sabesp para o PDF:", error);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Foto indisponivel", imageX + photoWidth / 2, imageY + photoHeight / 2, { align: "center" });
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
  const doc = await generateRdoSabespPdf(rdo);
  doc.save(`RDO-Sabesp_${rdo.report_date || "sem-data"}.pdf`);
}

export async function downloadRdoSabespBatchZip(rdos: RdoSabespData[]) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const rdo of rdos) {
    const doc = await generateRdoSabespPdf(rdo);
    const blob = doc.output("blob");
    zip.file(`RDO-Sabesp_${rdo.report_date}_${(rdo.id || "").slice(0, 8)}.pdf`, blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `RDOs-Sabesp_${new Date().toISOString().slice(0, 10)}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}
