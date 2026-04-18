import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin } from "lucide-react";
import { Container } from "../components/ui/Container";
import NewTripForm from "../components/NewTripForm";
import { listTrips } from "../api/trips";
import { track } from "../lib/analytics";

export default function TripsPage() {
  useEffect(() => {
    track("page_view", { path: "/app/trips" });
  }, []);

  const { data } = useQuery({ queryKey: ["trips"], queryFn: listTrips });

  return (
    <Container className="py-10">
      <div className="max-w-3xl">
        <div className="text-xs uppercase tracking-[0.28em] text-brand-600 font-semibold mb-3">
          Поездки
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-ink-900 leading-[1.02]">
          Куда двигаемся дальше?
        </h1>
      </div>

      <div className="mt-10 grid md:grid-cols-[1fr_2fr] gap-8 items-start">
        <section className="bg-white border border-ink-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="text-[10px] uppercase tracking-[0.28em] text-ink-500 font-semibold mb-2">
            Новая поездка
          </div>
          <h2 className="font-display text-2xl mb-5">Форма в 4 поля</h2>
          <NewTripForm />
        </section>

        <section>
          <div className="text-[10px] uppercase tracking-[0.28em] text-ink-500 font-semibold mb-3">
            Мои маршруты
          </div>
          <ul className="space-y-3">
            {(data ?? []).map((t, i) => (
              <li key={t.id}>
                <Link
                  to={`/app/trips/${t.id}`}
                  className="block bg-white border border-ink-200 rounded-2xl px-5 py-4 hover:border-ink-900 transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
                        <span className="font-mono">
                          №{String(i + 1).padStart(2, "0")}
                        </span>
                        {t.is_public && (
                          <span className="text-brand-600">публичная</span>
                        )}
                      </div>
                      <div className="font-display text-xl text-ink-900 mt-0.5 group-hover:text-brand-600 transition">
                        {t.title || t.destination}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-500 mt-2">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} /> {t.destination}
                        </span>
                        {(t.start_date || t.end_date) && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} /> {t.start_date ?? "?"} —{" "}
                            {t.end_date ?? "?"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-ink-400 font-mono">
                      {new Date(t.created_at).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {(data ?? []).length === 0 && (
              <li className="bg-ink-100 rounded-2xl px-5 py-10 text-center text-sm text-ink-500">
                Пока нет поездок. Создайте первую слева.
              </li>
            )}
          </ul>
        </section>
      </div>
    </Container>
  );
}
