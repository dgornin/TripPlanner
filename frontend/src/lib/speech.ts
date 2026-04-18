// Thin wrapper around the Web Speech API with Russian default.
// Falls back to null if the browser has no SpeechRecognition implementation.

type AnyWindow = Window & {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};

export function supportsSpeech(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as AnyWindow;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createRecognition(lang = "ru-RU") {
  if (typeof window === "undefined") return null;
  const w = window as AnyWindow;
  const Ctor: any =
    (w.SpeechRecognition as any) || (w.webkitSpeechRecognition as any);
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  return rec;
}
