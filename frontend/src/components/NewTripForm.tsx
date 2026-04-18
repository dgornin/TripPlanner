import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Button } from "./ui/Button";
import { createTrip } from "../api/trips";
import { track } from "../lib/analytics";

const INTERESTS: Array<{ id: string; label: string }> = [
  { id: "culture", label: "Культура" },
  { id: "food", label: "Еда" },
  { id: "nature", label: "Природа" },
  { id: "active", label: "Актив" },
  { id: "nightlife", label: "Ночная жизнь" },
  { id: "family", label: "С семьёй" },
];

export default function NewTripForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [travelers, setTravelers] = useState(1);
  const [interests, setInterests] = useState<string[]>(["culture"]);
  const [accommodation, setAccommodation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setInterests((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const trip = await createTrip({
        destination,
        start_date: start || null,
        end_date: end || null,
        travelers,
        interests,
        accommodation: accommodation.trim() || null,
      });
      track("trip_created", { destination });
      qc.invalidateQueries({ queryKey: ["trips"] });
      navigate(`/app/trips/${trip.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не удалось создать поездку.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <div className="text-sm font-medium text-ink-900 mb-1.5">
          Куда едем
        </div>
        <input
          type="text"
          value={destination}
          required
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Например: Казань"
          className="w-full h-12 px-4 rounded-2xl border border-ink-200 bg-white text-ink-900 outline-none focus:border-ink-900 focus:ring-2 focus:ring-brand-500/30 transition"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-ink-900 mb-1.5">С</div>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl border border-ink-200 bg-white text-ink-900 outline-none focus:border-ink-900 focus:ring-2 focus:ring-brand-500/30 transition"
          />
        </div>
        <div>
          <div className="text-sm font-medium text-ink-900 mb-1.5">По</div>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            min={start || undefined}
            className="w-full h-12 px-4 rounded-2xl border border-ink-200 bg-white text-ink-900 outline-none focus:border-ink-900 focus:ring-2 focus:ring-brand-500/30 transition"
          />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-sm font-medium text-ink-900">Путников</span>
          <span className="text-xs text-ink-500">от 1 до 10</span>
        </div>
        <input
          type="number"
          value={travelers}
          min={1}
          max={10}
          onChange={(e) => setTravelers(parseInt(e.target.value || "1", 10))}
          className="w-full h-12 px-4 rounded-2xl border border-ink-200 bg-white text-ink-900 outline-none focus:border-ink-900 focus:ring-2 focus:ring-brand-500/30 transition"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-sm font-medium text-ink-900">
            Где живёте в городе
          </span>
          <span className="text-xs text-ink-500">необязательно</span>
        </div>
        <input
          type="text"
          value={accommodation}
          onChange={(e) => setAccommodation(e.target.value)}
          placeholder="Отель Шаляпин, ул. Баумана 7"
          className="w-full h-12 px-4 rounded-2xl border border-ink-200 bg-white text-ink-900 outline-none focus:border-ink-900 focus:ring-2 focus:ring-brand-500/30 transition"
        />
        <div className="text-xs text-ink-500 mt-1">
          Агент будет строить маршруты от этой точки, чтобы меньше петлять.
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-ink-900 mb-2">Интересы</div>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const active = interests.includes(i.id);
            return (
              <button
                type="button"
                key={i.id}
                onClick={() => toggle(i.id)}
                className={`px-4 h-9 rounded-full text-sm transition border ${
                  active
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white text-ink-900 border-ink-200 hover:border-ink-900"
                }`}
              >
                {i.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="text-sm bg-red-50 border border-red-200 text-red-800 rounded-2xl px-4 py-3">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" loading={loading}>
        Спланировать поездку <ArrowUpRight size={18} />
      </Button>
    </form>
  );
}
