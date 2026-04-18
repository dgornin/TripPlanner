import { Link } from "react-router-dom";

export function Logo({
  compact = false,
  to = "/",
  tone = "light",
}: {
  compact?: boolean;
  to?: string;
  tone?: "light" | "dark";
}) {
  const txt = tone === "dark" ? "text-white" : "text-ink-900";
  return (
    <Link
      to={to}
      aria-label="Travel Buddy RU — главная"
      className={`inline-flex items-center gap-2.5 font-display group ${txt}`}
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center">
        <span className="absolute inset-0 rounded-[14px] bg-brand-500 rotate-6 group-hover:rotate-12 transition-transform duration-300" />
        <span className="absolute inset-[4px] rounded-[10px] bg-white" />
        <span className="absolute inset-[10px] rounded-full bg-brand-500" />
      </span>
      {!compact && (
        <span className="font-semibold tracking-tight text-[17px]">
          Travel&nbsp;Buddy{" "}
          <span className={tone === "dark" ? "text-brand-300" : "text-brand-500"}>
            RU
          </span>
        </span>
      )}
    </Link>
  );
}
