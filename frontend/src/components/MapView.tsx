import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  Popup,
  Source,
  type MapRef,
} from "react-map-gl/maplibre";
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

export default function MapView({ days, accommodation }: Props) {
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

  const home: { lat: number; lon: number; name: string | null } | null =
    accommodation && accommodation.lat != null && accommodation.lon != null
      ? { lat: accommodation.lat, lon: accommodation.lon, name: accommodation.name }
      : null;

  // MapLibre uses [lon, lat] order — unlike Leaflet.
  const points: [number, number][] = markers.map((m) => [m.place.lon, m.place.lat]);
  if (home) points.push([home.lon, home.lat]);

  const bounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (points.length === 0) return null;
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
    return [
      [minLon, minLat],
      [maxLon, maxLat],
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  const mapRef = useRef<MapRef | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    const isSingle =
      bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1];
    if (isSingle) {
      map.easeTo({
        center: bounds[0],
        zoom: 13,
        duration: 600,
      });
    } else {
      map.fitBounds(bounds, {
        padding: 60,
        duration: 600,
      });
    }
  }, [bounds]);

  // One GeoJSON FeatureCollection with one LineString per visible day.
  // Using a single Source/Layer keeps the layer count low regardless of
  // how many days the trip spans.
  const routesGeoJson = useMemo(
    () => ({
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
    }),
    [visibleDays],
  );

  // Which marker's popup is open (null = none). Keyed by place id.
  const [openPopupId, setOpenPopupId] = useState<string | null>(null);

  return (
    <Map
      ref={mapRef}
      mapStyle={DEFAULT_STYLE_URL}
      initialViewState={{
        longitude: 37.62,
        latitude: 55.75,
        zoom: 4,
      }}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
      onClick={() => setOpenPopupId(null)}
    >
      {routesGeoJson.features.length > 0 && (
        <Source id="tb-routes" type="geojson" data={routesGeoJson}>
          <Layer
            id="tb-routes-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": ["get", "color"],
              "line-width": 4,
              "line-opacity": 0.7,
              "line-dasharray": [1.8, 1.8],
            }}
          />
        </Source>
      )}

      {markers.map((m) => {
        const active = openPopupId === m.place.id;
        return (
          <Marker
            key={m.place.id}
            longitude={m.place.lon}
            latitude={m.place.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setOpenPopupId(active ? null : m.place.id);
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: m.color,
                color: "white",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 12,
                fontWeight: 700,
                border: "3px solid white",
                boxShadow: "0 3px 10px rgba(0,0,0,.28)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              {m.globalIndex}
            </div>
          </Marker>
        );
      })}

      {markers
        .filter((m) => openPopupId === m.place.id)
        .map((m) => (
          <Popup
            key={`popup-${m.place.id}`}
            longitude={m.place.lon}
            latitude={m.place.lat}
            anchor="bottom"
            offset={16}
            closeButton={false}
            onClose={() => setOpenPopupId(null)}
          >
            <div className="text-sm">
              <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
                День {m.day.day_number}
                {m.day.title ? ` · ${m.day.title}` : ""}
              </div>
              <div className="font-display text-base text-ink-900 mt-0.5">
                {m.place.name}
              </div>
              {m.place.description && (
                <div className="text-ink-500 mt-1.5 text-xs leading-relaxed max-w-[240px]">
                  {m.place.description}
                </div>
              )}
              {m.place.duration_minutes ? (
                <div className="text-xs text-brand-600 mt-2 font-medium">
                  ≈ {m.place.duration_minutes} мин
                </div>
              ) : null}
            </div>
          </Popup>
        ))}

      {home && (
        <Marker
          longitude={home.lon}
          latitude={home.lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setOpenPopupId(openPopupId === "__home__" ? null : "__home__");
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: "#0b1220",
              color: "white",
              border: "3px solid white",
              boxShadow: "0 6px 18px rgba(0,0,0,.35)",
              cursor: "pointer",
              userSelect: "none",
            }}
            aria-label="Место проживания"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2V9.5z" />
            </svg>
          </div>
        </Marker>
      )}

      {home && openPopupId === "__home__" && (
        <Popup
          longitude={home.lon}
          latitude={home.lat}
          anchor="bottom"
          offset={20}
          closeButton={false}
          onClose={() => setOpenPopupId(null)}
        >
          <div className="text-sm">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
              Место проживания
            </div>
            <div className="font-display text-base text-ink-900 mt-0.5">
              {home.name || "Отель"}
            </div>
          </div>
        </Popup>
      )}
    </Map>
  );
}
