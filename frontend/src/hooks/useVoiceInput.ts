import { useRef, useState } from "react";
import { createRecognition, supportsSpeech } from "../lib/speech";

export function useVoiceInput(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const ref = useRef<any>(null);

  const start = () => {
    const rec = createRecognition();
    if (!rec) return;
    ref.current = rec;
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript as string | undefined;
      if (t) onText(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    try {
      ref.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  };

  return { supported: supportsSpeech(), listening, start, stop };
}
