import { Clock, Home, Sparkles } from "lucide-react";
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

interface Props {
  trip: Trip;
  /** True while the agent is mid-generation. Adds a loading banner so the
   *  user can see progress instead of staring at "no places yet". */
  agentBusy?: boolean;
}

export default function Itinerary({ trip, agentBusy }: Props) {
  const selected = useUi((s) => s.selectedDay);
  const days =
    selected == null
      ? trip.days
      : trip.days.filter((d) => d.day_number === selected);
  const totalPlaces = trip.days.reduce((n, d) => n + d.places.length, 0);
  const showGenerationBanner = agentBusy;

  return (
    <div className="space-y-5">
      {showGenerationBanner && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/70 px-3.5 py-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white shrink-0 animate-pulse">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink-900 flex items-center gap-1">
              Агент составляет маршрут
              <span className="inline-flex gap-0.5 ml-1">
                <span className="w-1 h-1 rounded-full bg-ink-900 animate-[pulse_1.2s_ease-in-out_infinite]" />
                <span className="w-1 h-1 rounded-full bg-ink-900 animate-[pulse_1.2s_ease-in-out_.2s_infinite]" />
                <span className="w-1 h-1 rounded-full bg-ink-900 animate-[pulse_1.2s_ease-in-out_.4s_infinite]" />
              </span>
            </div>
            <div className="text-xs text-ink-600 mt-0.5 leading-snug">
              {totalPlaces > 0
                ? `Уже ${totalPlaces} ${placeNoun(totalPlaces)} — добавляю остальные.`
                : "Ищу факты о городе и расставляю точки по дням."}
            </div>
          </div>
        </div>
      )}
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
                {agentBusy
                  ? "Агент ещё подбирает точки для этого дня…"
                  : "Пока нет точек — попросите агента подобрать места."}
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

function placeNoun(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "точка";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100))
    return "точки";
  return "точек";
}
