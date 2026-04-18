import { useEffect } from "react";
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

  useEffect(() => {
    track("page_view", { path: "/app/trips/:id", trip_id: id });
  }, [id]);

  // Reset to "All days" when switching trips.
  useEffect(() => {
    setSelectedDay(null);
  }, [id, setSelectedDay]);

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
      ItinerarySlot={<Itinerary trip={trip} />}
      ChatSlot={<ChatPanel tripId={trip.id} onState={onState} />}
    />
  );
}
