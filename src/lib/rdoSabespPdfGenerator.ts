import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoSabesp from "@/assets/logo-sabesp.png";
import logoCslnr from "@/assets/logo-cslnr.jpg";
import { CRIADOUROS } from "./rdoSabespCatalog";

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
  horarios?: any;
  mao_de_obra?: any[];
  equipamentos?: any[];
  servicos_esgoto?: any[];
  servicos_agua?: any[];
  observacoes?: string | null;
  responsavel_empreiteira?: string | null;
  responsavel_consorcio?: string | null;
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
  for (const c of CRIADOUROS.filter((c) => c.value !== "outro")) {
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

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, cellPadding: 1.2, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [220, 230, 241], textColor: 0, fontStyle: "bold", halign: "center" },
    head: [["CONDIÇÕES CLIMÁTICAS", "QUALIDADE", "PARALISAÇÕES", "HORÁRIO"]],
    body: [
      [
        `Manhã: ${cc.manha || "—"}\nTarde: ${cc.tarde || "—"}\nNoite: ${cc.noite || "—"}`,
        `Ordem de Serviço: ${checkbox(!!q.ordem_servico)}\nBandeirola: ${checkbox(!!q.bandeirola)}\nProjeto: ${checkbox(!!q.projeto)}\nObs: ${q.obs || "—"}`,
        para.length
          ? para.map((p: any) => `• ${p.motivo}${p.descricao ? ": " + p.descricao : ""}`).join("\n")
          : "—",
        `Diurno: ${horarios?.diurno?.inicio || "—"} → ${horarios?.diurno?.fim || "—"}\nNoturno: ${horarios?.noturno?.inicio || "—"} → ${horarios?.noturno?.fim || "—"}`,
      ],
    ],
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 50 }, 2: { cellWidth: 50 }, 3: { cellWidth: 48 } },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  // === Mão de obra ===
  const mo = (rdo.mao_de_obra || []).filter((m: any) => m.cargo);
  if (mo.length) {
    autoTable(doc, {
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
    autoTable(doc, {
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
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [200, 220, 240], textColor: 0, halign: "center" },
      head: [[`${titulo} - CÓD.`, "ATIVIDADE EXECUTADA", "UN.", "EXEC."]],
      body: filt.map((s: any) => [s.codigo || "—", s.descricao, s.unidade, String(s.quantidade)]),
      columnStyles: {
        0: { cellWidth: 22 },
        2: { halign: "center", cellWidth: 14 },
        3: { halign: "center", cellWidth: 18 },
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