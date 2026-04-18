interface Props {
  steps: Array<{ step: string; count: number }>;
}

const LABELS: Record<string, string> = {
  page_view: "Лендинг",
  signup: "Регистрация",
  trip_created: "Создана поездка",
  message_sent: "Сообщение агенту",
  trip_shared: "Поделились",
};

export function Funnel({ steps }: Props) {
  const top = Math.max(1, steps[0]?.count ?? 0);
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => {
        const pct = (s.count / top) * 100;
        const prev = i === 0 ? null : steps[i - 1];
        const fromPrev =
          prev && prev.count > 0 ? (s.count / prev.count) * 100 : null;
        return (
          <li key={s.step} className="group">
            <div className="flex items-baseline justify-between text-[11px] uppercase tracking-wider text-white/70 mb-1">
              <span className="font-semibold">
                {String(i + 1).padStart(2, "0")} · {LABELS[s.step] ?? s.step}
              </span>
              <span className="font-mono text-white">
                {s.count.toLocaleString("ru-RU")}
              </span>
            </div>
            <div className="h-9 rounded-xl bg-white/10 overflow-hidden relative">
              <div
                className="h-full flex items-center px-3 text-white text-sm font-medium transition-all duration-700"
                style={{
                  width: `${Math.max(4, pct)}%`,
                  background:
                    "linear-gradient(90deg, #f97316 0%, #fb923c 100%)",
                }}
              >
                {pct >= 16 && `${Math.round(pct)}%`}
              </div>
            </div>
            {fromPrev !== null && (
              <div className="text-[11px] text-white/50 mt-1">
                {fromPrev.toFixed(1)}% от прошлого шага
              </div>
            )}
          </li>
        );
      })}
      {steps.length === 0 && (
        <li className="text-sm text-white/60">Пока нет данных.</li>
      )}
    </ol>
  );
}
