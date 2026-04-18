import { api } from "../api/client";

const KEY = "tb_session";

function sessionId(): string {
  let s = localStorage.getItem(KEY);
  if (!s) {
    s =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, s);
  }
  return s;
}

export function track(type: string, props: Record<string, unknown> = {}) {
  try {
    api
      .post("/events", { type, props, session_id: sessionId() })
      .catch(() => {});
  } catch {
    /* never surface */
  }
}
