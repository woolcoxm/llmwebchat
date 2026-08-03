/**
 * Client for the LLMWebChat proxy. Talks to /api/* (proxied to :8787 in dev).
 */
import type { ChatEvent, ChatRequest, ModelInfo, Settings } from "@llmwebchat/shared";

export async function getSettings(): Promise<Settings> {
  const res = await fetch("/api/settings");
  return res.json();
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return res.json();
}

export async function listModels(providerId: string): Promise<ModelInfo[]> {
  const res = await fetch(`/api/models?provider=${encodeURIComponent(providerId)}`);
  const json = await res.json();
  return (json.models ?? []) as ModelInfo[];
}

export interface KbItem {
  id: string;
  source: string;
  text: string;
  createdAt: number;
}
export async function listKb(): Promise<KbItem[]> {
  const r = await fetch("/api/kb");
  return (await r.json()).items ?? [];
}
export async function ingestKb(text: string, source?: string) {
  const r = await fetch("/api/kb/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source }),
  });
  return r.json();
}
export async function deleteKbItem(id: string) {
  await fetch(`/api/kb/${id}`, { method: "DELETE" });
}
export async function postApproval(id: string, decision: "approve" | "reject") {
  await fetch("/api/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, decision }),
  });
}

/** Stream a prompt through the pi agent backend (same ChatEvent wire format). */
export function streamAgent(
  req: { sessionId: string; message: string; images?: Array<{ data: string; mimeType: string }> },
  onEvent: (ev: ChatEvent) => void,
  onError: (err: Error) => void,
  onDone: () => void,
): AbortController {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        try {
          const ev = JSON.parse(text) as ChatEvent;
          if (ev?.type === "error") onEvent(ev);
          else onError(new Error(`Agent HTTP ${res.status}`));
        } catch {
          onError(new Error(`Agent HTTP ${res.status}: ${text.slice(0, 200)}`));
        }
        onDone();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            onEvent(JSON.parse(line) as ChatEvent);
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") onError(err as Error);
    } finally {
      onDone();
    }
  })();
  return controller;
}

/**
 * Stream a chat completion. Calls onEvent for each NDJSON ChatEvent.
 * Returns an AbortController so the UI can cancel.
 */
export function streamChat(
  req: ChatRequest,
  onEvent: (ev: ChatEvent) => void,
  onError: (err: Error) => void,
  onDone: () => void,
): AbortController {
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        onError(new Error(`Chat failed (${res.status}): ${text.slice(0, 200)}`));
        onDone();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            onEvent(JSON.parse(line) as ChatEvent);
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") onError(err as Error);
    } finally {
      onDone();
    }
  })();
  return controller;
}
