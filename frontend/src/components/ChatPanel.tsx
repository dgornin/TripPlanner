import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles } from "lucide-react";
import VoiceButton from "./VoiceButton";
import { streamPostSse } from "../lib/sse";
import { track } from "../lib/analytics";
import type { Trip } from "../api/trips";

// Module-level set of trip ids for which we've already fired the autoStart
// prompt. Module scope survives React StrictMode's double-mount, so the
// second effect run is a no-op.
const AUTO_STARTED = new Set<string>();

type LogItem =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "tool"; name: string };

interface Props {
  tripId: string;
  onState: (trip: Trip) => void;
  /** If provided (and the trip is empty), ChatPanel fires this prompt once
   *  on mount to kick off the agent automatically. */
  autoStart?: string | null;
}

export default function ChatPanel({ tripId, onState, autoStart }: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogItem[]>([]);
  const streamBufRef = useRef("");
  const autoStartedRef = useRef(false);

  const send = async (msg: string) => {
    const clean = msg.trim();
    if (!clean || busy) return;
    track("message_sent", { trip_id: tripId });
    setLog((l) => [
      ...l,
      { role: "user", text: clean },
      { role: "assistant", text: "" },
    ]);
    streamBufRef.current = "";
    setBusy(true);
    try {
      for await (const ev of streamPostSse(`/api/trips/${tripId}/messages`, {
        text: clean,
      })) {
        if (ev.event === "token") {
          streamBufRef.current += (ev.data?.text as string) ?? "";
          setLog((l) => {
            const copy = [...l];
            // Update last assistant bubble
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].role === "assistant") {
                copy[i] = { role: "assistant", text: streamBufRef.current };
                break;
              }
            }
            return copy;
          });
        } else if (ev.event === "tool_call") {
          setLog((l) => [
            ...l,
            { role: "tool", name: ev.data?.name ?? "tool" },
            { role: "assistant", text: "" },
          ]);
          streamBufRef.current = "";
        } else if (ev.event === "state") {
          if (ev.data?.trip) onState(ev.data.trip as Trip);
        } else if (ev.event === "error") {
          const errText = (ev.data?.error as string) ?? "Неизвестная ошибка.";
          setLog((l) => {
            const copy = [...l];
            // Replace the last assistant bubble with the error
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].role === "assistant") {
                copy[i] = { role: "assistant", text: `⚠️ ${errText}` };
                return copy;
              }
            }
            return [...copy, { role: "assistant", text: `⚠️ ${errText}` }];
          });
        }
      }
    } catch (err) {
      setLog((l) => [
        ...l,
        {
          role: "assistant",
          text: "⚠️ Произошла ошибка соединения. Попробуйте ещё раз.",
        },
      ]);
    } finally {
      setBusy(false);
      // Belt-and-braces: always force a fresh trip fetch when the stream ends,
      // in case any state events were dropped or merged while React was
      // batching updates.
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
    }
  };

  // Kick off the agent automatically on an empty trip (after initial creation).
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!autoStart) return;
    if (AUTO_STARTED.has(tripId)) return;
    AUTO_STARTED.add(tripId);
    autoStartedRef.current = true;
    send(autoStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, tripId]);

  return (
    <div className="rounded-3xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-glass">
      {log.length > 0 && (
        <div className="max-h-64 overflow-y-auto px-5 pt-5 pb-1 space-y-2 tb-scroll">
          {log.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="text-right">
                <span className="inline-block max-w-[80%] bg-ink-900 text-white text-sm rounded-2xl rounded-br-sm px-3 py-2 text-left">
                  {m.text}
                </span>
              </div>
            ) : m.role === "tool" ? (
              <div
                key={i}
                className="text-[11px] uppercase tracking-wider text-brand-600 font-semibold flex items-center gap-1.5"
              >
                <Sparkles size={12} /> {toolLabel(m.name)}
              </div>
            ) : m.text ? (
              <div key={i} className="text-sm text-ink-900 leading-relaxed">
                {m.text}
              </div>
            ) : (
              <div key={i} className="text-xs text-ink-500 italic">
                {busy ? "пишет..." : ""}
              </div>
            ),
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = text;
          setText("");
          send(v);
        }}
        className="p-3 flex items-center gap-2"
      >
        <VoiceButton
          onTranscript={(t) => {
            setText(t);
            send(t);
          }}
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Скажите, куда и зачем — я соберу маршрут"
          disabled={busy}
          className="flex-1 h-10 px-4 rounded-full border border-ink-200 bg-white outline-none focus:border-ink-900 focus:ring-2 focus:ring-brand-500/30 transition text-sm"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-brand-500 text-white shadow-pop hover:bg-brand-600 transition disabled:opacity-50"
          aria-label="Отправить"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

function toolLabel(name: string): string {
  const map: Record<string, string> = {
    kb_search: "ищу факты в базе",
    search_place: "ищу место на карте",
    add_place: "добавляю точку",
    remove_place: "убираю точку",
    update_place: "правлю точку",
    set_trip_summary: "пишу описание поездки",
    set_day_title: "называю день",
  };
  return map[name] ?? name;
}
