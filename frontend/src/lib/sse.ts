export type SseEvent = { event: string; data: any };

/**
 * Minimal SSE reader over fetch POST — the browser's native EventSource does
 * not support POST, so we parse the text/event-stream ourselves.
 */
export async function* streamPostSse(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok || !resp.body) {
    throw new Error(`SSE request failed: ${resp.status}`);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const chunk of parts) {
        const lines = chunk.split("\n");
        let ev = "message";
        let dataStr = "";
        for (const ln of lines) {
          if (ln.startsWith("event:")) ev = ln.slice(6).trim();
          else if (ln.startsWith("data:")) dataStr += ln.slice(5).trim();
        }
        if (dataStr) {
          let data: any = dataStr;
          try {
            data = JSON.parse(dataStr);
          } catch {
            /* keep as string */
          }
          yield { event: ev, data };
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}
