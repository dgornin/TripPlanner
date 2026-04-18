import { useEffect } from "react";
import { motion, LayoutGroup } from "framer-motion";

export interface DayLike {
  day_number: number;
  title: string | null;
}

interface Props {
  days: DayLike[];
  selectedDay: number | null;
  onChange: (d: number | null) => void;
  compact?: boolean;
}

export function DaySelector({ days, selectedDay, onChange, compact }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        if (days.find((d) => d.day_number === n)) onChange(n);
      } else if (e.key === "0") {
        onChange(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [days, onChange]);

  return (
    <LayoutGroup id="day-selector">
      <div
        role="tablist"
        aria-label="Выбор дня маршрута"
        className={`flex items-center gap-1 p-1.5 rounded-full bg-white/90 backdrop-blur-xl border border-white/60 shadow-glass ${
          compact ? "text-xs" : "text-sm"
        } overflow-x-auto max-w-full tb-scroll`}
      >
        <Chip
          active={selectedDay === null}
          onClick={() => onChange(null)}
          aria-label="Все дни"
        >
          Все
          {!compact && (
            <span className="ml-1.5 text-[10px] opacity-60 font-mono">0</span>
          )}
        </Chip>
        {days.map((d) => (
          <Chip
            key={d.day_number}
            active={selectedDay === d.day_number}
            onClick={() => onChange(d.day_number)}
            aria-label={`День ${d.day_number}`}
          >
            <span className="font-display">День {d.day_number}</span>
            {!compact && d.title && (
              <span className="ml-1.5 max-w-[10rem] truncate opacity-70">
                {d.title}
              </span>
            )}
            {!compact && (
              <span className="ml-1.5 text-[10px] opacity-60 font-mono">
                {d.day_number}
              </span>
            )}
          </Chip>
        ))}
      </div>
    </LayoutGroup>
  );
}

function Chip({
  active,
  onClick,
  children,
  ...rest
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative inline-flex items-center px-3.5 py-2 rounded-full whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        active ? "text-white" : "text-ink-700 hover:text-ink-900"
      }`}
      {...rest}
    >
      {active && (
        <motion.span
          layoutId="day-active-pill"
          className="absolute inset-0 rounded-full bg-ink-900 shadow-sm"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <span className="relative z-10 flex items-center">{children}</span>
    </button>
  );
}
