import { Mic, MicOff } from "lucide-react";
import { useVoiceInput } from "../hooks/useVoiceInput";

export default function VoiceButton({
  onTranscript,
}: {
  onTranscript: (t: string) => void;
}) {
  const { supported, listening, start, stop } = useVoiceInput(onTranscript);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      aria-pressed={listening}
      aria-label={listening ? "Остановить запись" : "Голосовой ввод"}
      className={`inline-flex items-center justify-center h-10 w-10 rounded-full border transition ${
        listening
          ? "bg-brand-500 text-white border-transparent shadow-pop animate-pulse"
          : "bg-white text-ink-900 border-ink-200 hover:border-ink-900"
      }`}
      title={listening ? "Идёт запись" : "Голосовой ввод"}
    >
      {listening ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  );
}
