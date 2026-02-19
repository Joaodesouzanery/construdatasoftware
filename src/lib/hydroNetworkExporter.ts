/**
 * HydroNetwork Exporter
 * Exports RDO data in a structured JSON format compatible with HydroNetwork.
 */

import { supabase } from "@/lib/supabase";

interface HydroNetworkRDO {
  id: string;
  report_date: string;
  project: { name: string };
  construction_site: { name: string; address: string | null };
  service_front: { name: string };
  weather: {
    temperature: number | null;
    humidity: number | null;
    wind_speed: number | null;
    will_rain: boolean | null;
    description: string | null;
  };
  terrain_condition: string | null;
  gps_location: string | null;
  general_observations: string | null;
  visits: string | null;
  occurrences_summary: string | null;
  executed_services: Array<{
    service_name: string;
    quantity: number;
    unit: string;
    equipment: string | null;
    responsible: string | null;
  }>;
  photos: Array<{
    url: string;
    uploaded_at: string;
  }>;
}

export async function fetchCompleteRDO(rdoId: string): Promise<HydroNetworkRDO | null> {
  const { data, error } = await supabase
    .from('daily_reports')
    .select(`
      *,
      project:projects!inner(name),
      construction_site:construction_sites!inner(name, address),
      service_front:service_fronts!inner(name),
      executed_services(
        quantity, unit, equipment_used,
        services_catalog(name),
        employees(name)
      )
    `)
    .eq('id', rdoId)
    .single();

  if (error || !data) return null;

  const { data: photos } = await supabase
    .from('rdo_validation_photos')
    .select('photo_url, uploaded_at')
    .eq('daily_report_id', rdoId)
    .order('uploaded_at', { ascending: true });

  // Generate signed URLs for photos
  const photosWithUrls = await Promise.all(
    (photos || []).map(async (photo: any) => {
      const rawPath: string = photo.photo_url || "";
      const path = rawPath.includes('rdo-photos/') ? rawPath.split('rdo-photos/')[1] : rawPath;
      let signedUrl = rawPath;
      try {
        const { data: signed } = await supabase.storage
          .from('rdo-photos')
          .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
        if (signed?.signedUrl) signedUrl = signed.signedUrl;
      } catch { /* keep raw */ }
      return { url: signedUrl, uploaded_at: photo.uploaded_at };
    })
  );

  return {
    id: data.id,
    report_date: data.report_date,
    project: { name: data.project.name },
    construction_site: { name: data.construction_site.name, address: data.construction_site.address },
    service_front: { name: data.service_front.name },
    weather: {
      temperature: data.temperature,
      humidity: data.humidity,
      wind_speed: data.wind_speed,
      will_rain: data.will_rain,
      description: data.weather_description,
    },
    terrain_condition: data.terrain_condition,
    gps_location: data.gps_location,
    general_observations: data.general_observations,
    visits: data.visits,
    occurrences_summary: data.occurrences_summary,
    executed_services: (data.executed_services || []).map((es: any) => ({
      service_name: es.services_catalog?.name || 'N/A',
      quantity: es.quantity,
      unit: es.unit,
      equipment: typeof es.equipment_used === 'object' ? es.equipment_used?.equipment : es.equipment_used || null,
      responsible: es.employees?.name || null,
    })),
    photos: photosWithUrls,
  };
}

export function downloadJSON(data: any, fileName: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
