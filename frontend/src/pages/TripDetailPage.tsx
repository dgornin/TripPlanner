import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTrip, patchTrip, type Trip } from "../api/trips";
import TripPage from "./TripPage";
import MapView from "../components/MapView";
import Itinerary from "../components/Itinerary";
import ChatPanel from "../components/ChatPanel";
import { useUi } from "../store/uiStore";
import { track } from "../lib/analytics";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => getTrip(id!),
    enabled: Boolean(id),
  });

  const selectedDay = useUi((s) => s.selectedDay);
  const setSelectedDay = useUi((s) => s.setSelectedDay);
  const showToast = useUi((s) => s.showToast);
  const [agentBusy, setAgentBusy] = useState(false);
  const handleBusyChange = useCallback((b: boolean) => setAgentBusy(b), []);

  useEffect(() => {
    track("page_view", { path: "/app/trips/:id", trip_id: id });
  }, [id]);

  // Reset to "All days" when switching trips.
  useEffect(() => {
    setSelectedDay(null);
  }, [id, setSelectedDay]);

  // Auto-kick the agent the first time a freshly created trip is opened.
  // useMemo must run on every render (hook ordering), so compute up-front.
  const autoStart = useMemo(
    () => (trip ? buildAutoStart(trip) : null),
    [trip?.id, trip?.days.length, trip?.summary, trip?.accommodation],
  );

  if (isLoading || !trip) {
    return (
      <div className="min-h-[calc(100vh-57px)] flex items-center justify-center text-ink-500">
        Загрузка поездки...
      </div>
    );
  }

  const share = async () => {
    if (!trip) return;
    try {
      const updated = await patchTrip(trip.id, { is_public: true });
      qc.setQueryData(["trip", trip.id], updated);
      const link = `${window.location.origin}/share/trips/${trip.id}`;
      try {
        await navigator.clipboard.writeText(link);
        showToast("Ссылка скопирована в буфер");
      } catch {
        showToast(link);
      }
      track("trip_shared", { trip_id: trip.id });
    } catch {
      showToast("Не удалось поделиться");
    }
  };

  const onState = (next: Trip) => {
    qc.setQueryData(["trip", trip.id], next);
  };

  return (
    <TripPage
      destination={trip.destination}
      days={trip.days}
      selectedDay={selectedDay}
      onSelectDay={setSelectedDay}
      onShare={share}
      agentBusy={agentBusy}
      MapSlot={
        <MapView
          days={trip.days}
          accommodation={{
            name: trip.accommodation,
            lat: trip.accommodation_lat,
            lon: trip.accommodation_lon,
          }}
        />
      }
      ItinerarySlot={<Itinerary trip={trip} agentBusy={agentBusy} />}
      ChatSlot={
        <ChatPanel
          tripId={trip.id}
          onState={onState}
          autoStart={autoStart}
          onBusyChange={handleBusyChange}
        />
      }
    />
  );
}

const INTEREST_LABEL: Record<string, string> = {
  culture: "культура",
  food: "еда",
  nature: "природа",
  active: "активный отдых",
  nightlife: "ночная жизнь",
  family: "с семьёй",
};

function buildAutoStart(trip: Trip): string | null {
  const hasPlaces = trip.days.some((d) => d.places.length > 0);
  if (hasPlaces) return null;
  if (trip.summary) return null; // agent already wrote a summary
  const parts: string[] = [];
  const numDays = trip.days.length;
  if (numDays > 0) {
    parts.push(`Составь план на ${numDays} ${dayNoun(numDays)} в ${trip.destination}.`);
  } else {
    parts.push(`Составь план в ${trip.destination}.`);
  }
  if ((trip.interests || []).length > 0) {
    const labels = trip.interests
      .map((i) => INTEREST_LABEL[i] || i)
      .join(", ");
    parts.push(`Интересы: ${labels}.`);
  }
  if (trip.travelers && trip.travelers > 1) {
    parts.push(`Путников: ${trip.travelers}.`);
  }
  if (trip.accommodation) {
    parts.push(
      `Место проживания: ${trip.accommodation}. Строй дневные маршруты от него.`,
    );
  }
  parts.push(
    "Обязательно добавь минимум 3-4 точки в каждый день через add_place и напиши summary.",
  );
  return parts.join(" ");
}

function dayNoun(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
}
