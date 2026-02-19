type GeoPoint = {
  latitude: number;
  longitude: number;
};

type NominatimResult = {
  lat?: string;
  lon?: string;
};

const geocodeCache = new Map<string, GeoPoint | null>();

const normalizeAddress = (address: string): string => address.trim().toLowerCase();

export const geocodeAddress = async (address: string): Promise<GeoPoint | null> => {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;

  if (geocodeCache.has(normalized)) {
    return geocodeCache.get(normalized) ?? null;
  }

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      limit: "1",
      q: address,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "User-Agent": "MTSS-Pulse/1.0",
      },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeout);
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as NominatimResult[];
    const first = payload[0];
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const point = { latitude, longitude };
    geocodeCache.set(normalized, point);
    return point;
  } catch {
    return null;
  }
};
