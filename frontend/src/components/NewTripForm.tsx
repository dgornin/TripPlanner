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
        {/* Stepper, not <input type="number">: iOS Safari's native steppers
            were swallowing taps on the submit button below this field. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Меньше путников"
            onClick={() => setTravelers((v) => Math.max(1, v - 1))}
            className="h-12 w-12 rounded-2xl border border-ink-200 bg-white text-ink-900 text-lg font-medium hover:border-ink-900 transition select-none touch-manipulation disabled:opacity-40"
            disabled={travelers <= 1}
          >
            −
          </button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={travelers}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              if (!raw) {
                setTravelers(1);
                return;
              }
              const n = Math.min(10, Math.max(1, parseInt(raw, 10)));
              setTravelers(n);
            }}
            className="flex-1 h-12 px-4 text-center rounded-2xl border border-ink-200 bg-white text-ink-900 outline-none focus:border-ink-900 focus:ring-2 focus:ring-brand-500/30 transition touch-manipulation"
          />
          <button
            type="button"
            aria-label="Больше путников"
            onClick={() => setTravelers((v) => Math.min(10, v + 1))}
            className="h-12 w-12 rounded-2xl border border-ink-200 bg-white text-ink-900 text-lg font-medium hover:border-ink-900 transition select-none touch-manipulation disabled:opacity-40"
            disabled={travelers >= 10}
          >
            +
          </button>
        </div>
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
