/* shop feature — locating the home and what's around it, from OpenStreetMap.
 * Nominatim geocodes the address; Overpass finds the nearest fire station, hydrant and
 * river/lake. Either can fail (offline, rate-limited) — then we fall back to a clearly
 * labelled demo estimate so the flow never breaks on stage. */

const UA = "Hera-hackathon-demo/1.0";

export type LatLon = { lat: number; lon: number };
export type Place = { name: string | null; distanceM: number; bearing: number };
export type Surroundings = {
  location: LatLon & { label: string | null; estimated: boolean };
  fireStation: Place | null;
  hydrant: Place | null;
  water: (Place & { kind: string }) | null;
  /** true when any of the places above are Hera's demo estimate rather than live OSM data */
  estimated: boolean;
  source: string;
};

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LatLon, b: LatLon) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Initial compass bearing from a to b, 0 = north, clockwise. */
export function bearingDeg(a: LatLon, b: LatLon) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

export async function geocode(queries: string[]): Promise<(LatLon & { label: string }) | null> {
  for (const q of queries) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ca&q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const hits = (await res.json()) as {
        lat: string;
        lon: string;
        display_name: string;
      }[];
      if (hits[0])
        return {
          lat: Number(hits[0].lat),
          lon: Number(hits[0].lon),
          label: hits[0].display_name,
        };
    } catch {
      // try the next, broader query
    }
  }
  return null;
}

type OsmElement = {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: LatLon;
  geometry?: (LatLon | null)[];
  members?: { geometry?: (LatLon | null)[] }[];
  tags?: Record<string, string>;
};

/** Every coordinate an element has (nodes, centres, way/relation geometry). */
function pointsOf(el: OsmElement): LatLon[] {
  const pts: LatLon[] = [];
  if (el.lat != null && el.lon != null) pts.push({ lat: el.lat, lon: el.lon });
  if (el.center) pts.push(el.center);
  for (const p of el.geometry ?? []) if (p) pts.push(p);
  for (const m of el.members ?? []) for (const p of m.geometry ?? []) if (p) pts.push(p);
  return pts;
}

function nearest(home: LatLon, els: OsmElement[]): { el: OsmElement; at: LatLon; d: number } | null {
  let best: { el: OsmElement; at: LatLon; d: number } | null = null;
  for (const el of els) {
    for (const p of pointsOf(el)) {
      const d = haversineM(home, p);
      if (!best || d < best.d) best = { el, at: p, d };
    }
  }
  return best;
}

const toPlace = (home: LatLon, hit: { el: OsmElement; at: LatLon; d: number } | null): Place | null =>
  hit
    ? {
        name: hit.el.tags?.name ?? null,
        distanceM: Math.round(hit.d),
        bearing: bearingDeg(home, hit.at),
      }
    : null;

/** Parse an Overpass response into the three nearest things Hera cares about. Exported for tests. */
export function nearestPlaces(home: LatLon, elements: OsmElement[]) {
  const fire = elements.filter((e) => e.tags?.amenity === "fire_station");
  const hydrants = elements.filter((e) => e.tags?.emergency === "fire_hydrant");
  const water = elements.filter((e) => e.tags?.waterway || e.tags?.natural === "water");
  const w = nearest(home, water);
  const kind = w ? (w.el.tags?.waterway ?? w.el.tags?.water ?? "water") : "";
  return {
    fireStation: toPlace(home, nearest(home, fire)),
    hydrant: toPlace(home, nearest(home, hydrants)),
    water: w ? { ...toPlace(home, w)!, kind } : null,
  };
}

async function overpass(home: LatLon) {
  const { lat, lon } = home;
  const box = `${lat - 0.025},${lon - 0.035},${lat + 0.025},${lon + 0.035}`;
  const query = `[out:json][timeout:9];
(
  node(around:8000,${lat},${lon})[amenity=fire_station];
  way(around:8000,${lat},${lon})[amenity=fire_station];
  node(around:1000,${lat},${lon})[emergency=fire_hydrant];
)->.a;
.a out center tags;
(
  way(around:2000,${lat},${lon})[waterway~"^(river|stream)$"];
  way(around:2000,${lat},${lon})[natural=water];
  relation(around:2000,${lat},${lon})[natural=water];
)->.w;
.w out tags geom(${box});`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ data: query }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = (await res.json()) as { elements: OsmElement[] };
  return nearestPlaces(home, json.elements ?? []);
}

/** A river-adjacent Ottawa home (Old Ottawa South, by the Rideau) — the demo stand-in. */
const DEMO_HOME: LatLon = { lat: 45.3934, lon: -75.6826 };

function demoPlaces() {
  return {
    fireStation: {
      name: null,
      distanceM: 1900,
      bearing: 318,
    },
    hydrant: { name: null, distanceM: 85, bearing: 118 },
    water: {
      name: null,
      distanceM: 260,
      bearing: 82,
      kind: "river",
    },
  };
}

export async function surroundings(address: { street?: string; city?: string; province?: string; postalCode?: string }): Promise<Surroundings> {
  const full = [address.street, address.city, address.province, address.postalCode, "Canada"].filter(Boolean).join(", ");
  const broad = [address.city, address.province, "Canada"].filter(Boolean).join(", ");
  const geo = await geocode([full, ...(address.postalCode ? [`${address.postalCode}, Canada`] : []), broad]);
  const home = geo ?? DEMO_HOME;

  let places: ReturnType<typeof nearestPlaces> | null = null;
  try {
    places = await overpass(home);
  } catch {
    places = null;
  }
  const live = places !== null && (places.fireStation || places.hydrant || places.water);
  const final = live ? places! : demoPlaces();
  return {
    location: {
      lat: home.lat,
      lon: home.lon,
      label: geo?.label ?? null,
      estimated: !geo,
    },
    ...final,
    estimated: !live || !geo,
    source: live && geo ? "OpenStreetMap" : geo ? "OpenStreetMap address · nearby places estimated" : "Demo estimate",
  };
}
