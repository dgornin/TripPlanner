import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { publicTrip } from "../api/trips";
import MapView from "../components/MapView";
import Itinerary from "../components/Itinerary";
import { DaySelector } from "../components/DaySelector";
import { useUi } from "../store/uiStore";
import { Logo } from "../components/ui/Logo";

export default function PublicTripPage() {
  const { id } = useParams<{ id: string }>();
  const { data: trip, isLoading, error } = useQuery({
    queryKey: ["public-trip", id],
    queryFn: () => publicTrip(id!),
    enabled: Boolean(id),
  });
  const selected = useUi((s) => s.selectedDay);
  const setSelected = useUi((s) => s.setSelectedDay);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500">
        Загрузка маршрута...
      </div>
    );
  }
  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-700 flex-col gap-2">
        <div className="font-display text-2xl">Поездка не найдена</div>
        <div className="text-sm text-ink-500">
          Возможно, владелец закрыл доступ.
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] relative bg-ink-100 overflow-hidden">
      <header className="absolute inset-x-0 top-0 z-30 bg-white/80 backdrop-blur border-b border-ink-200">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <Logo compact />
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-ink-500 font-semibold">
              Публичный маршрут
            </div>
            <div className="font-display text-base text-ink-900">
              {trip.destination}
            </div>
          </div>
          <span className="text-[11px] text-ink-500">только для просмотра</span>
        </div>
      </header>

      <div className="absolute inset-0 pt-[56px]">
        <div className="absolute inset-0">
          <MapView days={trip.days} />
        </div>
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20">
          <DaySelector
            days={trip.days}
            selectedDay={selected}
            onChange={setSelected}
          />
        </div>
        <aside className="absolute top-24 left-6 bottom-6 w-[360px] z-20 hidden md:block">
          <div className="h-full rounded-3xl bg-white/85 backdrop-blur-xl shadow-glass border border-white/60 overflow-hidden flex flex-col">
            <div className="px-5 pt-5 pb-3 border-b border-ink-200/60">
              <div className="text-[10px] uppercase tracking-[0.25em] text-ink-500 font-semibold">
                План поездки
              </div>
              <div className="font-display text-xl text-ink-900 mt-0.5">
                {trip.destination}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto tb-scroll p-5">
              <Itinerary trip={trip} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
