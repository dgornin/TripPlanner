import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  type LngLatBoundsLike,
  type LngLatLike,
  type Map as MlMap,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Day, Place } from "../api/trips";
import { useUi } from "../store/uiStore";

// Vector tiles from OpenFreeMap — community-run, no API key, not branded
// "OpenStreetMap" in the UI (data under the hood is still OSM, but the
// render is completely different from the raster Leaflet stack we had).
// Override via env if someone wants a MapTiler / Stadia / self-hosted
// style URL without touching code.
const DEFAULT_STYLE_URL =
  (import.meta.env.VITE_MAP_STYLE_URL as string) ||
  "https://tiles.openfreemap.org/styles/liberty";

const dayColors = [
  "#f97316",
  "#2563eb",
  "#059669",
  "#dc2626",
  "#7c3aed",
  "#d97706",
  "#db2777",
  "#0891b2",
  "#65a30d",
];

type Enriched = {
  day: Day;
  place: Place;
  color: string;
  globalIndex: number;
};

interface Props {
  days: Day[];
  accommodation?: {
    name: string | null;
    lat: number | null;
    lon: number | null;
  } | null;
}

function buildMarkerEl(color: string, number: number): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "width:26px",
    "height:26px",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "border-radius:50%",
    `background:${color}`,
    "color:white",
    "font-family:Inter, system-ui, sans-serif",
    "font-size:12px",
    "font-weight:700",
    "border:3px solid white",
    "box-shadow:0 3px 10px rgba(0,0,0,.28)",
    "cursor:pointer",
    "user-select:none",
  ].join(";");
  el.textContent = String(number);
  return el;
}

function buildHomeEl(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "width:34px",
    "height:34px",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "border-radius:12px",
    "background:#0b1220",
    "color:white",
    "border:3px solid white",
    "box-shadow:0 6px 18px rgba(0,0,0,.35)",
    "cursor:pointer",
  ].join(";");
  el.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2V9.5z"/></svg>';
  el.setAttribute("aria-label", "Место проживания");
  return el;
}

function buildPlacePopupHtml(m: Enriched): string {
  const desc = m.place.description
    ? `<div style="color:#6b7280;margin-top:6px;font-size:12px;line-height:1.5;max-width:240px;">${escapeHtml(m.place.description)}</div>`
    : "";
  const dur = m.place.duration_minutes
    ? `<div style="font-size:12px;color:#f97316;margin-top:8px;font-weight:500;">≈ ${m.place.duration_minutes} мин</div>`
    : "";
  const dayLine = `День ${m.day.day_number}${m.day.title ? " · " + escapeHtml(m.day.title) : ""}`;
  return `
    <div style="font-size:14px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;font-weight:600;">${dayLine}</div>
      <div style="font-family:Unbounded, Inter, system-ui, sans-serif;font-size:16px;color:#0b1220;margin-top:2px;">${escapeHtml(m.place.name)}</div>
      ${desc}
      ${dur}
    </div>`;
}

function buildHomePopupHtml(name: string | null): string {
  return `
    <div style="font-size:14px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;font-weight:600;">Место проживания</div>
      <div style="font-family:Unbounded, Inter, system-ui, sans-serif;font-size:16px;color:#0b1220;margin-top:2px;">${escapeHtml(name || "Отель")}</div>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function MapView({ days, accommodation }: Props) {
  const selected = useUi((s) => s.selectedDay);
  const visibleDays = useMemo(
    () =>
      selected == null ? days : days.filter((d) => d.day_number === selected),
    [days, selected],
  );

  const markers: Enriched[] = useMemo(() => {
    let idx = 0;
    return visibleDays.flatMap((d) =>
      d.places.map((p) => ({
        day: d,
        place: p,
        color: dayColors[(d.day_number - 1) % dayColors.length],
        globalIndex: ++idx,
      })),
    );
  }, [visibleDays]);

  const home: { lat: number; lon: number; name: string | null } | null =
    accommodation && accommodation.lat != null && accommodation.lon != null
      ? {
          lat: accommodation.lat,
          lon: accommodation.lon,
          name: accommodation.name,
        }
      : null;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerObjectsRef = useRef<maplibregl.Marker[]>([]);
  const [styleLoaded, setStyleLoaded] = useState(false);

  // --- Initialise the map once on mount. ---
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE_URL,
      center: [37.62, 55.75],
      zoom: 4,
      attributionControl: { compact: true },
      // `preserveDrawingBuffer` keeps the WebGL buffer around so the first
      // compositor sample isn't a black frame. Cast via `as any` because
      // the option is valid at runtime but not in the v5 TS `MapOptions`.
      ...({ preserveDrawingBuffer: true } as Record<string, unknown>),
    });
    mapRef.current = map;

    map.on("load", () => {
      setStyleLoaded(true);
      // Belt-and-braces: prod sometimes reports a zero-height container
      // during the first layout pass (flex parent). Resize + repaint so
      // the first visible frame is guaranteed.
      map.resize();
      map.triggerRepaint();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setStyleLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Observe container size changes, tell MapLibre to resize. ---
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!el || !map) return;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Render markers. ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    // Nuke previous markers.
    for (const m of markerObjectsRef.current) m.remove();
    markerObjectsRef.current = [];

    for (const m of markers) {
      const el = buildMarkerEl(m.color, m.globalIndex);
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([m.place.lon, m.place.lat])
        .setPopup(
          new maplibregl.Popup({
            offset: 16,
            closeButton: false,
            closeOnClick: true,
          }).setHTML(buildPlacePopupHtml(m)),
        )
        .addTo(map);
      markerObjectsRef.current.push(marker);
    }
    if (home) {
      const el = buildHomeEl();
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([home.lon, home.lat])
        .setPopup(
          new maplibregl.Popup({
            offset: 20,
            closeButton: false,
            closeOnClick: true,
          }).setHTML(buildHomePopupHtml(home.name)),
        )
        .addTo(map);
      markerObjectsRef.current.push(marker);
    }
  }, [markers, home?.lat, home?.lon, home?.name, styleLoaded]);

  // --- Render the per-day route lines as a single GeoJSON source. ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const data = {
      type: "FeatureCollection" as const,
      features: visibleDays
        .filter((d) => d.places.length >= 2)
        .map((d) => ({
          type: "Feature" as const,
          properties: {
            color: dayColors[(d.day_number - 1) % dayColors.length],
          },
          geometry: {
            type: "LineString" as const,
            coordinates: d.places.map((p) => [p.lon, p.lat]),
          },
        })),
    };

    const src = map.getSource("tb-routes") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (src) {
      src.setData(data);
    } else {
      map.addSource("tb-routes", { type: "geojson", data });
      map.addLayer({
        id: "tb-routes-line",
        type: "line",
        source: "tb-routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4,
          "line-opacity": 0.7,
          "line-dasharray": [1.8, 1.8],
        },
      });
    }
  }, [visibleDays, styleLoaded]);

  // --- Fit bounds whenever the point set changes. ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const points: [number, number][] = markers.map((m) => [
      m.place.lon,
      m.place.lat,
    ]);
    if (home) points.push([home.lon, home.lat]);
    if (points.length === 0) return;

    let minLon = points[0][0];
    let maxLon = points[0][0];
    let minLat = points[0][1];
    let maxLat = points[0][1];
    for (const [lon, lat] of points) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const isSingle = minLon === maxLon && minLat === maxLat;
    if (isSingle) {
      map.easeTo({
        center: [minLon, minLat] as LngLatLike,
        zoom: 13,
        duration: 600,
      });
    } else {
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ] as LngLatBoundsLike,
        { padding: 60, duration: 600 },
      );
    }
  }, [markers, home?.lat, home?.lon, styleLoaded]);

  return <div ref={containerRef} className="h-full w-full" />;
}
