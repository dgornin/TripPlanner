import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Day, Place } from "../api/trips";
import { useUi } from "../store/uiStore";

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

function makeIcon(color: string, number: number) {
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `
      <div style="
        position:relative;
        width:26px;height:26px;
        display:flex;align-items:center;justify-content:center;
        border-radius:50%;
        background:${color};
        color:white;
        font-family:Inter, system-ui, sans-serif;
        font-size:12px;
        font-weight:700;
        border:3px solid white;
        box-shadow:0 3px 10px rgba(0,0,0,.28);
      ">${number}</div>
    `,
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    try {
      if (points.length === 1) {
        map.setView(points[0], 13);
      } else {
        map.fitBounds(points as L.LatLngBoundsLiteral, { padding: [60, 60] });
      }
    } catch {
      /* ignore */
    }
  }, [points, map]);
  return null;
}

type Enriched = {
  day: Day;
  place: Place;
  color: string;
  globalIndex: number;
};

export default function MapView({ days }: { days: Day[] }) {
  const selected = useUi((s) => s.selectedDay);
  const visibleDays =
    selected == null ? days : days.filter((d) => d.day_number === selected);

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

  const points: [number, number][] = markers.map((m) => [
    m.place.lat,
    m.place.lon,
  ]);

  return (
    <MapContainer
      className="h-full w-full"
      center={[55.75, 37.62]}
      zoom={5}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {visibleDays.map((d) => (
        <Polyline
          key={d.id}
          positions={d.places.map((p) => [p.lat, p.lon])}
          pathOptions={{
            color: dayColors[(d.day_number - 1) % dayColors.length],
            weight: 4,
            opacity: 0.7,
            dashArray: "8 8",
          }}
        />
      ))}
      {markers.map(({ day, place, color, globalIndex }) => (
        <Marker
          key={place.id}
          position={[place.lat, place.lon]}
          icon={makeIcon(color, globalIndex)}
        >
          <Popup>
            <div className="text-sm">
              <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
                День {day.day_number}
                {day.title ? ` · ${day.title}` : ""}
              </div>
              <div className="font-display text-base text-ink-900 mt-0.5">
                {place.name}
              </div>
              {place.description && (
                <div className="text-ink-500 mt-1.5 text-xs leading-relaxed max-w-[240px]">
                  {place.description}
                </div>
              )}
              {place.duration_minutes ? (
                <div className="text-xs text-brand-600 mt-2 font-medium">
                  ≈ {place.duration_minutes} мин
                </div>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}
      <FitBounds points={points} />
    </MapContainer>
  );
}
