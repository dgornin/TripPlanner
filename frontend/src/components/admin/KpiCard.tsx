import { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: number | string;
  delta?: { value: number; dir: "up" | "down" };
  icon?: LucideIcon;
  accent?: boolean;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
  loading,
}: Props) {
  const bg = accent
    ? "bg-brand-500 text-white border-transparent"
    : "bg-white text-ink-900 border-ink-200";
  return (
    <div
      className={`relative rounded-3xl border p-5 sm:p-6 overflow-hidden transition-shadow hover:shadow-glass ${bg}`}
    >
      {accent && (
        <div
          className="absolute inset-0 bg-noise opacity-20 mix-blend-overlay"
          aria-hidden
        />
      )}
      <div className="relative flex items-start justify-between">
        <div
          className={`text-[10px] uppercase tracking-[0.28em] font-semibold ${
            accent ? "text-white/80" : "text-ink-500"
          }`}
        >
          {label}
        </div>
        {Icon && (
          <Icon
            size={18}
            strokeWidth={1.75}
            className={accent ? "text-white/70" : "text-ink-500"}
          />
        )}
      </div>
      <div className="relative mt-5 flex items-baseline gap-2">
        <span className="font-display text-4xl sm:text-5xl leading-none tabular-nums">
          {loading ? "—" : formatNum(value)}
        </span>
        {delta && !loading && (
          <span
            className={`text-xs font-medium ${
              accent
                ? "text-white/80"
                : delta.dir === "up"
                  ? "text-green-600"
                  : "text-red-600"
            }`}
          >
            {delta.dir === "up" ? "▲" : "▼"} {delta.value}%
          </span>
        )}
      </div>
    </div>
  );
}

function formatNum(v: number | string) {
  if (typeof v === "number") return v.toLocaleString("ru-RU");
  return v;
}
