import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Share2,
  Map as MapIcon,
  ListChecks,
  MessageSquare,
} from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { Button } from "../components/ui/Button";
import { DaySelector, DayLike } from "../components/DaySelector";

interface Props {
  days: DayLike[];
  selectedDay: number | null;
  onSelectDay: (d: number | null) => void;
  destination: string;
  onShare?: () => void;
  MapSlot: ReactNode;
  ItinerarySlot: ReactNode;
  ChatSlot: ReactNode;
  /** When the parent knows the agent is generating (e.g. auto-start fired on
   *  a fresh trip), we jump the mobile user to the "План" tab so they can
   *  watch the loading state — otherwise they stare at an empty map. */
  agentBusy?: boolean;
}

type MobileTab = "map" | "itinerary" | "chat";

export default function TripPage({
  days,
  selectedDay,
  onSelectDay,
  destination,
  onShare,
  MapSlot,
  ItinerarySlot,
  ChatSlot,
  agentBusy,
}: Props) {
  const [tab, setTab] = useState<MobileTab>("map");
  const userSwitchedRef = useRef(false);

  // First time the agent starts generating, pull the mobile user onto the
  // "План" tab so they see the loading banner. After that, respect any
  // manual tab switches.
  useEffect(() => {
    if (!agentBusy) return;
    if (userSwitchedRef.current) return;
    setTab("itinerary");
  }, [agentBusy]);

  const handleTab = (next: MobileTab) => {
    userSwitchedRef.current = true;
    setTab(next);
  };

  return (
    // Fill the viewport below AppLayout's sticky header (h ≈ 60px) exactly,
    // so the whole trip surface is non-scrolling and the top toolbar + bottom
    // chat composer stay anchored together.
    <div className="h-[calc(100dvh-61px)] relative bg-ink-100 overflow-hidden">
      <header className="absolute inset-x-0 top-0 z-30 bg-white/80 backdrop-blur border-b border-ink-200">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <Link
              to="/app/trips"
              className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900 font-medium"
              aria-label="К списку поездок"
            >
              <ArrowLeft size={16} /> Мои поездки
            </Link>
            <span className="hidden md:inline text-ink-300">·</span>
            <div className="hidden md:block">
              <div className="text-[10px] uppercase tracking-[0.25em] text-ink-500 font-semibold">
                Маршрут
              </div>
              <div className="font-display text-base text-ink-900">
                {destination}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onShare && (
              <Button variant="outline" size="sm" onClick={onShare}>
                <Share2 size={14} />
                <span className="hidden sm:inline">Поделиться</span>
              </Button>
            )}
            <div className="hidden sm:block">
              <Logo compact />
            </div>
          </div>
        </div>
      </header>

      <div className="hidden md:block absolute inset-0 pt-[56px]">
        <div className="absolute inset-0">{MapSlot}</div>

        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <DaySelector
            days={days}
            selectedDay={selectedDay}
            onChange={onSelectDay}
          />
        </div>

        <aside className="absolute top-24 left-6 bottom-36 w-[360px] z-20">
          <div className="h-full rounded-3xl bg-white/85 backdrop-blur-xl shadow-glass border border-white/60 overflow-hidden flex flex-col">
            <div className="px-5 pt-5 pb-3 border-b border-ink-200/60">
              <div className="text-[10px] uppercase tracking-[0.25em] text-ink-500 font-semibold">
                План поездки
              </div>
              <div className="font-display text-xl text-ink-900 mt-0.5">
                {destination}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto tb-scroll p-5">
              {ItinerarySlot}
            </div>
          </div>
        </aside>

        <div className="absolute bottom-6 left-0 right-0 z-30 px-6 pointer-events-none">
          <div className="mx-auto max-w-2xl pointer-events-auto">{ChatSlot}</div>
        </div>
      </div>

      <div className="md:hidden absolute inset-0 pt-[56px] flex flex-col">
        <div className="flex-1 relative min-h-0">
          <div className={tab === "map" ? "absolute inset-0" : "hidden"}>
            {MapSlot}
          </div>
          <div
            className={
              tab === "itinerary"
                ? "absolute inset-0 overflow-y-auto bg-ink-50 p-4"
                : "hidden"
            }
          >
            {ItinerarySlot}
          </div>
          <div
            className={
              tab === "chat"
                ? "absolute inset-0 bg-ink-50 p-4 overflow-y-auto"
                : "hidden"
            }
          >
            {ChatSlot}
          </div>
          {tab === "map" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100vw-24px)]">
              <DaySelector
                days={days}
                selectedDay={selectedDay}
                onChange={onSelectDay}
                compact
              />
            </div>
          )}
        </div>
        <nav className="border-t border-ink-200 bg-white grid grid-cols-3 text-sm">
          <MobileTabButton
            active={tab === "map"}
            onClick={() => handleTab("map")}
            Icon={MapIcon}
            label="Карта"
          />
          <MobileTabButton
            active={tab === "itinerary"}
            onClick={() => handleTab("itinerary")}
            Icon={ListChecks}
            label="План"
            badge={agentBusy}
          />
          <MobileTabButton
            active={tab === "chat"}
            onClick={() => handleTab("chat")}
            Icon={MessageSquare}
            label="Чат"
          />
        </nav>
      </div>
    </div>
  );
}

function MobileTabButton({
  active,
  onClick,
  Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  Icon: any;
  label: string;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-0.5 py-3 transition-colors ${
        active ? "text-brand-600" : "text-ink-500"
      }`}
    >
      <span className="relative">
        <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
        {badge && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
        )}
      </span>
      <span className="text-[11px]">{label}</span>
    </button>
  );
}
