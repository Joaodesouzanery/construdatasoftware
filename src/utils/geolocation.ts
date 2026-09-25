// Cálculo de distância (Haversine) para o Ponto Eletrônico. Duplicado de
// propósito do equivalente em supabase/functions/_shared (runtimes
// diferentes) - a mesma fórmula/constantes em ambos. Uso no frontend é só
// para exibição (ex.: pré-visualização de raio em "Locais de Ponto"); a
// decisão autoritativa de geofence acontece no trigger do banco.

export function calcularDistanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)}m`;
  return `${(metros / 1000).toFixed(1)}km`;
}
