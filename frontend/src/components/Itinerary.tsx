import { Clock, Home } from "lucide-react";
import type { Trip } from "../api/trips";
import { useUi } from "../store/uiStore";

const dayColors = [
  "#f97316",
  "#2563eb",
  "#059669",
  "#dc2626",
  "#7c3aed",
  "#d97706",
  "#db2777",
];

export default function Itinerary({ trip }: { trip: Trip }) {
  const selected = useUi((s) => s.selectedDay);
  const days =
    selected == null
      ? trip.days
      : trip.days.filter((d) => d.day_number === selected);

  return (
    <div className="space-y-5">
      {trip.accommodation && (
        <div className="flex items-start gap-3 rounded-2xl bg-ink-900 text-white p-3.5">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300 shrink-0">
            <Home size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold">
              Место проживания
            </div>
            <div className="text-sm font-medium mt-0.5 break-words">
              {trip.accommodation}
            </div>
            {trip.accommodation_lat == null && (
              <div className="text-[11px] text-white/60 mt-1">
                Координаты не нашлись — агент уточнит адрес по пути.
              </div>
            )}
          </div>
        </div>
      )}
      {trip.summary && (
        <p className="text-sm text-ink-700 leading-relaxed">{trip.summary}</p>
      )}
      {days.map((d) => (
        <section key={d.id}>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: dayColors[(d.day_number - 1) % dayColors.length],
              }}
            />
            <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
              День {d.day_number}
            </div>
            {d.title && (
              <div className="font-display text-ink-900 text-sm">{d.title}</div>
            )}
          </div>
          <ol className="space-y-2.5">
            {d.places.length === 0 && (
              <li className="text-xs text-ink-500 bg-ink-100 rounded-lg px-3 py-3">
                Пока нет точек — попросите агента подобрать места.
              </li>
            )}
            {d.places.map((p, i) => (
              <li
                key={p.id}
                className="rounded-xl bg-white border border-ink-200 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <span className="font-display text-ink-300 text-sm w-6 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900">
                      {p.name}
                    </div>
                    {p.description && (
                      <div className="text-xs text-ink-500 mt-1 leading-snug">
                        {p.description}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-ink-500">
                      {p.duration_minutes ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={10} /> {p.duration_minutes} мин
                        </span>
                      ) : null}
                      {p.category && (
                        <span className="uppercase tracking-wider">
                          {p.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
