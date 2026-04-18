import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, MapPinned, MessagesSquare, Share2 } from "lucide-react";
import { Container } from "../components/ui/Container";
import { Logo } from "../components/ui/Logo";
import { KpiCard } from "../components/admin/KpiCard";
import { StatsChart } from "../components/admin/StatsChart";
import { Funnel } from "../components/admin/Funnel";
import { getFunnel, getStats } from "../api/admin";
import { track } from "../lib/analytics";

export default function AdminPage() {
  useEffect(() => {
    track("page_view", { path: "/app/admin" });
  }, []);

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getStats(14),
  });
  const funnel = useQuery({
    queryKey: ["admin-funnel"],
    queryFn: () => getFunnel(),
  });

  const t = stats.data?.totals ?? { users: 0, trips: 0, messages: 0, shares: 0 };
  const chartKeys = ["signup", "trip_created", "message_sent", "trip_shared"];

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white sticky top-0 z-20">
        <Container className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Logo compact />
            <span className="text-ink-300">·</span>
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-ink-500 font-semibold">
                Панель
              </div>
              <div className="font-display text-lg text-ink-900 leading-none mt-0.5">
                Аналитика
              </div>
            </div>
          </div>
          <div className="text-xs text-ink-500">
            За последние 14 дней · обновлено только что
          </div>
        </Container>
      </header>

      <Container className="py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Пользователей"
            value={t.users}
            icon={Users}
            loading={stats.isLoading}
          />
          <KpiCard
            label="Поездок"
            value={t.trips}
            icon={MapPinned}
            accent
            loading={stats.isLoading}
          />
          <KpiCard
            label="Сообщений"
            value={t.messages}
            icon={MessagesSquare}
            loading={stats.isLoading}
          />
          <KpiCard
            label="Поделились"
            value={t.shares}
            icon={Share2}
            loading={stats.isLoading}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mt-6">
          <section className="lg:col-span-2 bg-white border border-ink-200 rounded-3xl p-6 sm:p-8">
            <SectionTitle
              eyebrow="Активность"
              title="События по дням"
              hint="Сигнал о том, что продукт живёт."
            />
            <div className="mt-6 -mx-2">
              <StatsChart data={stats.data?.by_day ?? []} keys={chartKeys} />
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <section className="bg-ink-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div
                className="absolute inset-0 bg-noise opacity-30 mix-blend-overlay"
                aria-hidden
              />
              <SectionTitle
                eyebrow="Воронка"
                title="От лендинга до шеринга"
                tone="dark"
              />
              <div className="mt-5">
                <Funnel steps={funnel.data?.steps ?? []} />
              </div>
            </section>

            <section className="bg-white border border-ink-200 rounded-3xl p-6 sm:p-8">
              <SectionTitle eyebrow="Топ направлений" title="Куда едут" />
              <ol className="mt-5 space-y-2">
                {(stats.data?.top_destinations ?? []).map((d, i) => (
                  <li
                    key={d.destination}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="font-display text-ink-300 w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-ink-900 font-medium">
                      {d.destination}
                    </span>
                    <span className="text-xs text-ink-500 font-mono">
                      {d.count}
                    </span>
                  </li>
                ))}
                {(stats.data?.top_destinations ?? []).length === 0 && (
                  <li className="text-sm text-ink-500">Пока нет данных.</li>
                )}
              </ol>
            </section>
          </aside>
        </div>
      </Container>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  hint,
  tone = "light",
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  tone?: "light" | "dark";
}) {
  const label = tone === "dark" ? "text-brand-300" : "text-brand-600";
  const h = tone === "dark" ? "text-white" : "text-ink-900";
  const sub = tone === "dark" ? "text-white/60" : "text-ink-500";
  return (
    <div>
      <div
        className={`text-[10px] uppercase tracking-[0.28em] font-semibold mb-2 ${label}`}
      >
        {eyebrow}
      </div>
      <div className={`font-display text-2xl ${h}`}>{title}</div>
      {hint && <div className={`text-sm mt-1 ${sub}`}>{hint}</div>}
    </div>
  );
}
