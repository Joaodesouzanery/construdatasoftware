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
  materials_used: any[] | null;
  photos_urls: string[];
  logo_url: string | null;
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

  // Header with Logo
  if (report.logo_url) {
    try {
      const logo = await loadImage(report.logo_url);
      const logoSize = 25;
      doc.addImage(logo, "PNG", margin, yPos, logoSize, logoSize);
    } catch (error) {
      console.error("Error loading logo:", error);
    }
  }

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO DE LIGAÇÃO", pageWidth / 2, yPos + 8, { align: "center" });
  yPos += 25;

  // Draw border around content area
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPos, pageWidth - 2 * margin, pageHeight - yPos - 30);

  // Content padding
  const contentMargin = margin + 5;
  yPos += 5;

  // Report Information with styled sections
  doc.setFontSize(11);
  doc.setTextColor(0);

  const addSectionTitle = (title: string) => {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFillColor(240, 240, 240);
    doc.rect(contentMargin, yPos - 4, pageWidth - 2 * margin - 10, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, contentMargin + 2, yPos + 1);
    yPos += 10;
  };

  const addField = (label: string, value: string, inline: boolean = false) => {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin + 10;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${label}:`, contentMargin + 2, yPos);
    doc.setFont("helvetica", "normal");
    
    if (inline) {
      doc.text(value, contentMargin + 35, yPos);
      yPos += 7;
    } else {
      yPos += 6;
      const valueLines = doc.splitTextToSize(value, pageWidth - 2 * margin - 20);
      valueLines.forEach((line: string) => {
        doc.text(line, contentMargin + 4, yPos);
        yPos += 5;
      });
      yPos += 2;
    }
  };

  // Team and Date Section
  addSectionTitle("INFORMAÇÕES DA EQUIPE");
  addField("Equipe", report.team_name, true);
  addField(
    "Data",
    format(new Date(report.report_date), "dd/MM/yyyy", { locale: ptBR }),
    true
  );
  yPos += 3;

  // Client Information
  addSectionTitle("DADOS DO CLIENTE");
  addField("Cliente", report.client_name, true);
  addField(
    "Endereço",
    `${report.address}${report.address_complement ? `, ${report.address_complement}` : ""}`,
    false
  );
  yPos += 3;

  // Service Information
  addSectionTitle("INFORMAÇÕES DO SERVIÇO");
  addField("Hidrômetro", report.water_meter_number, true);
  addField("Número da OS", report.os_number, true);
  addField("Tipo de Serviço", report.service_type, true);
  yPos += 3;

  // Materials Used
  if (report.materials_used && report.materials_used.length > 0) {
    addSectionTitle("MATERIAIS UTILIZADOS");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    report.materials_used.forEach((material: string) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin + 10;
      }
      doc.text(`• ${material}`, contentMargin + 2, yPos);
      yPos += 5;
    });
    yPos += 3;
  }

  // Observations
  if (report.observations) {
    addSectionTitle("OBSERVAÇÕES");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const obsLines = doc.splitTextToSize(report.observations, pageWidth - 2 * margin - 20);
    obsLines.forEach((line: string) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin + 10;
      }
      doc.text(line, contentMargin + 2, yPos);
      yPos += 5;
    });
    yPos += 3;
  }

  // Photos Section
  if (report.photos_urls && report.photos_urls.length > 0) {
    // Check if we need a new page for photos
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = margin + 10;
    }

    addSectionTitle("FOTOS");
    yPos += 5;

    const photosPerRow = 4;
    const photoSpacing = 3;
    const availableWidth = pageWidth - 2 * margin - 10;
    const imgWidth = (availableWidth - (photosPerRow - 1) * photoSpacing) / photosPerRow;
    const imgHeight = imgWidth * 0.75;
    
    let xPos = contentMargin + 2;
    let photosInRow = 0;

    for (let i = 0; i < report.photos_urls.length; i++) {
      try {
        // Check if we need a new page
        if (yPos + imgHeight > pageHeight - margin - 20) {
          doc.addPage();
          yPos = margin + 10;
          xPos = contentMargin + 2;
          photosInRow = 0;
        }

        const img = await loadImage(report.photos_urls[i]);
        
        // Draw border around photo
        doc.setDrawColor(200);
        doc.rect(xPos, yPos, imgWidth, imgHeight);
        
        // Add photo
        doc.addImage(img, "JPEG", xPos + 1, yPos + 1, imgWidth - 2, imgHeight - 2);

        photosInRow++;
        
        if (photosInRow === photosPerRow) {
          // Move to next row
          yPos += imgHeight + photoSpacing;
          xPos = contentMargin + 2;
          photosInRow = 0;
        } else {
          // Move to next column
          xPos += imgWidth + photoSpacing;
        }
      } catch (error) {
        console.error("Error loading image:", error);
      }
    }

    // Move past the last row if it wasn't completed
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

// Gera relatório consolidado com todos os relatórios do dia
export async function generateConsolidatedReportPDF(reports: ConnectionReport[], date: string) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO CONSOLIDADO DE LIGAÇÕES", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Data: ${format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 5;
  doc.text(`Total de serviços: ${reports.length}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Resumo por equipe
  const byTeam: Record<string, number> = {};
  const byServiceType: Record<string, number> = {};
  reports.forEach(r => {
    byTeam[r.team_name] = (byTeam[r.team_name] || 0) + 1;
    byServiceType[r.service_type] = (byServiceType[r.service_type] || 0) + 1;
  });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO POR EQUIPE:", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  Object.entries(byTeam).forEach(([team, count]) => {
    doc.text(`• ${team}: ${count} serviço(s)`, margin + 5, yPos);
    yPos += 5;
  });
  yPos += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RESUMO POR TIPO DE SERVIÇO:", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  Object.entries(byServiceType).forEach(([type, count]) => {
    doc.text(`• ${type}: ${count}`, margin + 5, yPos);
    yPos += 5;
  });
  yPos += 10;

  // Linha divisória
  doc.setDrawColor(200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Lista de serviços
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DETALHAMENTO DOS SERVIÇOS:", margin, yPos);
  yPos += 8;

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    
    // Verifica se precisa nova página
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }

    // Box do serviço
    doc.setDrawColor(200);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(margin, yPos - 3, pageWidth - 2 * margin, 45, 2, 2, "FD");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. OS: ${report.os_number}`, margin + 3, yPos + 3);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const col1X = margin + 3;
    const col2X = pageWidth / 2;
    let lineY = yPos + 10;

    doc.text(`Equipe: ${report.team_name}`, col1X, lineY);
    doc.text(`Tipo: ${report.service_type}`, col2X, lineY);
    lineY += 5;

    doc.text(`Cliente: ${report.client_name}`, col1X, lineY);
    doc.text(`Hidrômetro: ${report.water_meter_number}`, col2X, lineY);
    lineY += 5;

    const address = report.address + (report.address_complement ? `, ${report.address_complement}` : '');
    const addressLines = doc.splitTextToSize(`Endereço: ${address}`, pageWidth - 2 * margin - 10);
    addressLines.slice(0, 2).forEach((line: string) => {
      doc.text(line, col1X, lineY);
      lineY += 5;
    });

    if (report.observations) {
      const obsText = `Obs: ${report.observations}`;
      const obsLines = doc.splitTextToSize(obsText, pageWidth - 2 * margin - 10);
      obsLines.slice(0, 1).forEach((line: string) => {
        doc.text(line, col1X, lineY);
        lineY += 5;
      });
    }

    yPos += 50;
  }

  // Footer em todas as páginas
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
  const fileName = `relatorio-consolidado-${format(new Date(date), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
