/**
 * DXF Exporter for RDO (Relatório Diário de Obra)
 * Generates AutoCAD DXF files with all RDO information including GPS coordinates
 */

interface DXFPoint {
  x: number;
  y: number;
}

interface RDOForDXF {
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

function parseGPS(gps: string | null): DXFPoint | null {
  if (!gps) return null;
  // Try common formats: "-23.550520, -46.633308" or "-23.550520,-46.633308"
  const parts = gps.split(',').map(s => parseFloat(s.trim()));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { x: parts[1], y: parts[0] }; // lon=x, lat=y
  }
  return null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\P');
}

export function generateRDODXF(report: RDOForDXF): string {
  const lines: string[] = [];
  const gpsPoint = parseGPS(report.gps_location);
  
  // Base coordinates for layout
  const baseX = gpsPoint?.x || 0;
  const baseY = gpsPoint?.y || 0;

  // DXF Header
  lines.push('0', 'SECTION');
  lines.push('2', 'HEADER');
  lines.push('9', '$ACADVER');
  lines.push('1', 'AC1015'); // AutoCAD 2000
  lines.push('9', '$INSBASE');
  lines.push('10', '0.0', '20', '0.0', '30', '0.0');
  lines.push('9', '$EXTMIN');
  lines.push('10', String(baseX - 0.01), '20', String(baseY - 0.01), '30', '0.0');
  lines.push('9', '$EXTMAX');
  lines.push('10', String(baseX + 0.01), '20', String(baseY + 0.01), '30', '0.0');
  lines.push('0', 'ENDSEC');

  // Tables Section (Layers)
  lines.push('0', 'SECTION');
  lines.push('2', 'TABLES');
  
  // Layer table
  lines.push('0', 'TABLE');
  lines.push('2', 'LAYER');
  lines.push('70', '6');

  const layers = [
    { name: 'INFO_BASICA', color: 7 },    // White
    { name: 'CLIMA', color: 5 },            // Blue
    { name: 'SERVICOS', color: 3 },         // Green
    { name: 'OBSERVACOES', color: 1 },      // Red
    { name: 'GPS', color: 6 },              // Magenta
    { name: 'FOTOS', color: 4 },            // Cyan
  ];

  layers.forEach(layer => {
    lines.push('0', 'LAYER');
    lines.push('2', layer.name);
    lines.push('70', '0');
    lines.push('62', String(layer.color));
    lines.push('6', 'CONTINUOUS');
  });

  lines.push('0', 'ENDTAB');
  lines.push('0', 'ENDSEC');

  // Entities Section
  lines.push('0', 'SECTION');
  lines.push('2', 'ENTITIES');

  let textY = baseY + 0.005; // Start offset for text layout
  const textHeight = 0.0002;
  const lineSpacing = 0.0004;

  // Helper to add MTEXT entity
  const addText = (layer: string, x: number, y: number, text: string, height: number = textHeight) => {
    lines.push('0', 'MTEXT');
    lines.push('8', layer);
    lines.push('10', String(x));
    lines.push('20', String(y));
    lines.push('30', '0.0');
    lines.push('40', String(height));
    lines.push('71', '1'); // top-left attachment
    lines.push('1', escapeText(text));
  };

  // Title
  addText('INFO_BASICA', baseX, textY, `RELATÓRIO DIÁRIO DE OBRA (RDO)`, textHeight * 2);
  textY -= lineSpacing * 2;

  // Basic Info
  addText('INFO_BASICA', baseX, textY, `Data: ${formatDate(report.report_date)}`);
  textY -= lineSpacing;
  addText('INFO_BASICA', baseX, textY, `Projeto: ${report.project.name}`);
  textY -= lineSpacing;
  addText('INFO_BASICA', baseX, textY, `Local: ${report.construction_site.name}`);
  textY -= lineSpacing;
  if (report.construction_site.address) {
    addText('INFO_BASICA', baseX, textY, `Endereço: ${report.construction_site.address}`);
    textY -= lineSpacing;
  }
  addText('INFO_BASICA', baseX, textY, `Frente de Serviço: ${report.service_front.name}`);
  textY -= lineSpacing * 2;

  // Weather
  if (report.temperature || report.humidity || report.weather_description) {
    addText('CLIMA', baseX, textY, `--- CONDIÇÕES CLIMÁTICAS ---`, textHeight * 1.2);
    textY -= lineSpacing;
    if (report.temperature) {
      addText('CLIMA', baseX, textY, `Temperatura: ${report.temperature}°C`);
      textY -= lineSpacing;
    }
    if (report.humidity) {
      addText('CLIMA', baseX, textY, `Umidade: ${report.humidity}%`);
      textY -= lineSpacing;
    }
    if (report.wind_speed) {
      addText('CLIMA', baseX, textY, `Vento: ${report.wind_speed} km/h`);
      textY -= lineSpacing;
    }
    if (report.will_rain !== null) {
      addText('CLIMA', baseX, textY, `Chuva: ${report.will_rain ? 'Sim' : 'Não'}`);
      textY -= lineSpacing;
    }
    if (report.weather_description) {
      addText('CLIMA', baseX, textY, `Descrição: ${report.weather_description}`);
      textY -= lineSpacing;
    }
    textY -= lineSpacing;
  }

  // Terrain
  if (report.terrain_condition) {
    addText('CLIMA', baseX, textY, `Condição do Terreno: ${report.terrain_condition}`);
    textY -= lineSpacing * 2;
  }

  // GPS Point
  if (gpsPoint) {
    addText('GPS', baseX, textY, `GPS: ${report.gps_location}`);
    textY -= lineSpacing;

    // Add a POINT entity at GPS location
    lines.push('0', 'POINT');
    lines.push('8', 'GPS');
    lines.push('10', String(gpsPoint.x));
    lines.push('20', String(gpsPoint.y));
    lines.push('30', '0.0');

    // Add a circle marker around the GPS point
    lines.push('0', 'CIRCLE');
    lines.push('8', 'GPS');
    lines.push('10', String(gpsPoint.x));
    lines.push('20', String(gpsPoint.y));
    lines.push('30', '0.0');
    lines.push('40', '0.0005'); // radius

    textY -= lineSpacing;
  }

  // Executed Services
  if (report.executed_services && report.executed_services.length > 0) {
    addText('SERVICOS', baseX, textY, `--- SERVIÇOS EXECUTADOS ---`, textHeight * 1.2);
    textY -= lineSpacing;

    report.executed_services.forEach((service, index) => {
      const serviceName = service.services_catalog?.name || 'N/A';
      addText('SERVICOS', baseX, textY, `${index + 1}. ${serviceName} - ${service.quantity} ${service.unit}`);
      textY -= lineSpacing;

      if (service.employees) {
        addText('SERVICOS', baseX + 0.001, textY, `Responsável: ${service.employees.name}`);
        textY -= lineSpacing;
      }

      const equipment = typeof service.equipment_used === 'object'
        ? service.equipment_used?.equipment
        : service.equipment_used;
      if (equipment) {
        addText('SERVICOS', baseX + 0.001, textY, `Equipamento: ${equipment}`);
        textY -= lineSpacing;
      }
    });
    textY -= lineSpacing;
  }

  // Observations
  if (report.general_observations) {
    addText('OBSERVACOES', baseX, textY, `--- OBSERVAÇÕES GERAIS ---`, textHeight * 1.2);
    textY -= lineSpacing;
    addText('OBSERVACOES', baseX, textY, report.general_observations);
    textY -= lineSpacing * 2;
  }

  if (report.visits) {
    addText('OBSERVACOES', baseX, textY, `--- VISITAS ---`, textHeight * 1.2);
    textY -= lineSpacing;
    addText('OBSERVACOES', baseX, textY, report.visits);
    textY -= lineSpacing * 2;
  }

  if (report.occurrences_summary) {
    addText('OBSERVACOES', baseX, textY, `--- OCORRÊNCIAS ---`, textHeight * 1.2);
    textY -= lineSpacing;
    addText('OBSERVACOES', baseX, textY, report.occurrences_summary);
    textY -= lineSpacing * 2;
  }

  // Photos references
  if (report.photos && report.photos.length > 0) {
    addText('FOTOS', baseX, textY, `--- FOTOS DE VALIDAÇÃO (${report.photos.length}) ---`, textHeight * 1.2);
    textY -= lineSpacing;

    report.photos.forEach((photo, i) => {
      const timestamp = new Date(photo.uploaded_at).toLocaleString('pt-BR');
      addText('FOTOS', baseX, textY, `Foto ${i + 1}: ${timestamp}`);
      textY -= lineSpacing;
      addText('FOTOS', baseX, textY, `URL: ${photo.photo_url}`);
      textY -= lineSpacing;
    });
  }

  // Footer
  textY -= lineSpacing * 2;
  addText('INFO_BASICA', baseX, textY, 'Gerado automaticamente pelo ConstruData.');

  lines.push('0', 'ENDSEC');

  // EOF
  lines.push('0', 'EOF');

  return lines.join('\n');
}

export function downloadDXF(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
