import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RDOReport {
  id: string;
  report_date: string;
  project: { name: string };
  construction_site: { name: string; address: string | null };
  service_front: { name: string };
  temperature: number | null;
  humidity: number | null;
  wind_speed: number | null;
  will_rain: boolean | null;
  weather_description: string | null;
  terrain_condition: string | null;
  gps_location: string | null;
  general_observations: string | null;
  visits: string | null;
  occurrences_summary: string | null;
  executed_services: Array<{
    quantity: number;
    unit: string;
    equipment_used: any;
    services_catalog: { name: string };
    employees: { name: string } | null;
  }>;
  photos: Array<{
    photo_url: string;
    uploaded_at: string;
  }>;
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

export async function generateConsolidatedRDOPdf(
  reports: RDOReport[],
  dateStart: string,
  dateEnd: string,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // Sort reports by date
  const sorted = [...reports].sort(
    (a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime()
  );

  const projectName = sorted[0]?.project?.name || "Projeto";

  // Cover page
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO CONSOLIDADO", pageWidth / 2, 60, { align: "center" });
  doc.text("DE OBRA (RDOs)", pageWidth / 2, 72, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(projectName, pageWidth / 2, 95, { align: "center" });

  doc.setFontSize(12);
  const startFormatted = format(new Date(dateStart + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
  const endFormatted = format(new Date(dateEnd + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
  doc.text(`Período: ${startFormatted} a ${endFormatted}`, pageWidth / 2, 115, { align: "center" });
  doc.text(`Total de RDOs: ${sorted.length}`, pageWidth / 2, 127, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Gerado automaticamente e sem dor de cabeça pelo ConstruData.",
    pageWidth / 2,
    pageHeight - 20,
    { align: "center" }
  );
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");

  // Render each RDO
  for (let ri = 0; ri < sorted.length; ri++) {
    const report = sorted[ri];
    onProgress?.(ri + 1, sorted.length);

    doc.addPage();
    let yPos = margin;
    const contentMargin = margin + 5;

    // Helper: section title
    const addSectionTitle = (title: string) => {
      if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin; }
      doc.setFillColor(59, 130, 246);
      doc.rect(contentMargin, yPos - 4, pageWidth - 2 * margin - 10, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(title, contentMargin + 2, yPos + 1);
      doc.setTextColor(0, 0, 0);
      yPos += 12;
    };

    const addField = (label: string, value: string, inline = false) => {
      if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin + 10; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${label}:`, contentMargin + 2, yPos);
      doc.setFont("helvetica", "normal");
      if (inline) {
        doc.text(value, contentMargin + 45, yPos);
        yPos += 7;
      } else {
        yPos += 6;
        const lines = doc.splitTextToSize(value, pageWidth - 2 * margin - 20);
        lines.forEach((line: string) => {
          if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin + 10; }
          doc.text(line, contentMargin + 4, yPos);
          yPos += 5;
        });
        yPos += 2;
      }
    };

    // RDO header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const rdoDateStr = format(new Date(report.report_date + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR });
    doc.text(`RDO ${ri + 1}/${sorted.length} — ${rdoDateStr}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // Basic info
    addSectionTitle("INFORMAÇÕES BÁSICAS");
    addField("Projeto", report.project?.name || "N/A", true);
    addField("Local da Obra", report.construction_site?.name || "N/A", true);
    if (report.construction_site?.address) addField("Endereço", report.construction_site.address);
    addField("Frente de Serviço", report.service_front?.name || "N/A", true);
    yPos += 3;

    // Weather
    if (report.temperature || report.humidity || report.weather_description) {
      addSectionTitle("CONDIÇÕES CLIMÁTICAS");
      if (report.temperature) addField("Temperatura", `${report.temperature}°C`, true);
      if (report.humidity) addField("Umidade", `${report.humidity}%`, true);
      if (report.wind_speed) addField("Vento", `${report.wind_speed} km/h`, true);
      if (report.will_rain !== null) addField("Chuva", report.will_rain ? "Sim" : "Não", true);
      if (report.weather_description) addField("Descrição", report.weather_description);
      yPos += 3;
    }

    // Terrain
    if (report.terrain_condition) {
      addSectionTitle("CONDIÇÕES DO TERRENO");
      addField("Condição", report.terrain_condition);
      yPos += 3;
    }

    // GPS
    if (report.gps_location) {
      addSectionTitle("LOCALIZAÇÃO GPS");
      addField("Coordenadas", report.gps_location, true);
      yPos += 3;
    }

    // Services
    const services = report.executed_services || [];
    if (services.length > 0) {
      addSectionTitle("SERVIÇOS EXECUTADOS");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      services.forEach((service, idx) => {
        if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin + 10; }
        const sName = service.services_catalog?.name || "Serviço não especificado";
        doc.text(`${idx + 1}. ${sName} — ${service.quantity} ${service.unit}`, contentMargin + 2, yPos);
        yPos += 5;
        if (service.employees) {
          doc.setFont("helvetica", "italic");
          doc.text(`   Responsável: ${service.employees.name}`, contentMargin + 2, yPos);
          doc.setFont("helvetica", "normal");
          yPos += 5;
        }
        if (service.equipment_used) {
          const eq = typeof service.equipment_used === "object" ? service.equipment_used.equipment : service.equipment_used;
          if (eq) {
            doc.setFont("helvetica", "italic");
            doc.text(`   Equipamento: ${eq}`, contentMargin + 2, yPos);
            doc.setFont("helvetica", "normal");
            yPos += 5;
          }
        }
        yPos += 2;
      });
      yPos += 3;
    }

    // Observations
    if (report.general_observations) {
      addSectionTitle("OBSERVAÇÕES GERAIS");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(report.general_observations, pageWidth - 2 * margin - 20);
      lines.forEach((line: string) => {
        if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin + 10; }
        doc.text(line, contentMargin + 2, yPos);
        yPos += 5;
      });
      yPos += 3;
    }

    // Visits
    if (report.visits) {
      addSectionTitle("VISITAS");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(report.visits, pageWidth - 2 * margin - 20);
      lines.forEach((line: string) => {
        if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin + 10; }
        doc.text(line, contentMargin + 2, yPos);
        yPos += 5;
      });
      yPos += 3;
    }

    // Occurrences
    if (report.occurrences_summary) {
      addSectionTitle("OCORRÊNCIAS");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(report.occurrences_summary, pageWidth - 2 * margin - 20);
      lines.forEach((line: string) => {
        if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin + 10; }
        doc.text(line, contentMargin + 2, yPos);
        yPos += 5;
      });
      yPos += 3;
    }

    // Photos
    if (report.photos && report.photos.length > 0) {
      if (yPos > pageHeight - 100) { doc.addPage(); yPos = margin + 10; }
      addSectionTitle("FOTOS DE VALIDAÇÃO");
      yPos += 5;

      const photosPerRow = 2;
      const photoSpacing = 5;
      const availableWidth = pageWidth - 2 * margin - 10;
      const imgWidth = (availableWidth - (photosPerRow - 1) * photoSpacing) / photosPerRow;
      const imgHeight = imgWidth * 0.75;
      let xPos = contentMargin + 2;
      let photosInRow = 0;

      for (let i = 0; i < report.photos.length; i++) {
        try {
          if (yPos + imgHeight > pageHeight - margin - 20) {
            doc.addPage();
            yPos = margin + 10;
            xPos = contentMargin + 2;
            photosInRow = 0;
          }
          const img = await loadImage(report.photos[i].photo_url);
          doc.setDrawColor(200);
          doc.rect(xPos, yPos, imgWidth, imgHeight);
          doc.addImage(img, "JPEG", xPos + 1, yPos + 1, imgWidth - 2, imgHeight - 2);

          doc.setFontSize(7);
          doc.setTextColor(100);
          const ts = format(new Date(report.photos[i].uploaded_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
          doc.text(ts, xPos + imgWidth / 2, yPos + imgHeight + 4, { align: "center" });
          doc.setTextColor(0);

          photosInRow++;
          if (photosInRow === photosPerRow) {
            yPos += imgHeight + photoSpacing + 8;
            xPos = contentMargin + 2;
            photosInRow = 0;
          } else {
            xPos += imgWidth + photoSpacing;
          }
        } catch {
          // skip broken image
        }
      }
      if (photosInRow > 0) yPos += imgHeight + 10;
    }
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `${projectName} | ${startFormatted} a ${endFormatted} | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 15,
      { align: "center" }
    );
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120);
    doc.text(
      "Gerado automaticamente e sem dor de cabeça pelo ConstruData.",
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
    doc.setFont("helvetica", "normal");
  }

  return doc.output("blob");
}
