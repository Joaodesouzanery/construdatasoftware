import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConnectionReport {
  id: string;
  team_name: string;
  report_date: string;
  address: string;
  address_complement: string | null;
  client_name: string;
  water_meter_number: string;
  os_number: string;
  service_type: string;
  observations: string | null;
  photos_urls: string[];
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

export async function generateConnectionReportPDF(report: ConnectionReport) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Header
  doc.setFontSize(20);
  doc.text("Relatório de Ligação", pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    yPos,
    { align: "center" }
  );
  yPos += 15;

  // Report Information
  doc.setFontSize(12);
  doc.setTextColor(0);

  const addField = (label: string, value: string) => {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 50, yPos);
    yPos += 8;
  };

  addField("Equipe", report.team_name);
  addField(
    "Data do Relatório",
    format(new Date(report.report_date), "dd/MM/yyyy", { locale: ptBR })
  );
  addField("Cliente", report.client_name);
  addField(
    "Endereço",
    `${report.address}${report.address_complement ? `, ${report.address_complement}` : ""}`
  );
  addField("Hidrômetro", report.water_meter_number);
  addField("Número da OS", report.os_number);
  addField("Tipo de Serviço", report.service_type);

  if (report.observations) {
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", margin, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    
    const obsLines = doc.splitTextToSize(report.observations, pageWidth - 2 * margin);
    obsLines.forEach((line: string) => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(line, margin, yPos);
      yPos += 6;
    });
  }

  // Photos
  if (report.photos_urls && report.photos_urls.length > 0) {
    yPos += 10;
    
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Fotos do Relatório", margin, yPos);
    yPos += 10;

    const imgWidth = (pageWidth - 3 * margin) / 2;
    const imgHeight = imgWidth * 0.75;
    let xPos = margin;
    let photosInRow = 0;

    for (const photoUrl of report.photos_urls) {
      try {
        if (yPos + imgHeight > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
          xPos = margin;
          photosInRow = 0;
        }

        const img = await loadImage(photoUrl);
        doc.addImage(img, "JPEG", xPos, yPos, imgWidth, imgHeight);

        photosInRow++;
        if (photosInRow === 2) {
          yPos += imgHeight + 10;
          xPos = margin;
          photosInRow = 0;
        } else {
          xPos += imgWidth + margin;
        }
      } catch (error) {
        console.error("Error loading image:", error);
        // Continue with next photo if one fails
      }
    }

    if (photosInRow > 0) {
      yPos += imgHeight + 10;
    }
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  // Save
  const fileName = `relatorio-ligacao-${report.os_number}-${format(
    new Date(report.report_date),
    "yyyy-MM-dd"
  )}.pdf`;
  doc.save(fileName);
}
