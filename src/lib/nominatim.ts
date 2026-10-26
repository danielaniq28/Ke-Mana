export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export async function searchMalaysia(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "0",
    limit: "6",
    countrycodes: "my",
    viewbox: "99.0,0.8,119.5,7.5",
    bounded: "0",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "Ke-Mana/1.0 (community navigation; contact: local)" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return (await res.json()) as NominatimResult[];
}
