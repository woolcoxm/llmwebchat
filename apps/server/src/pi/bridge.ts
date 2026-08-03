/**
 * pi agent bridge — runs `pi --mode rpc` as a persistent subprocess per agent
 * session and translates pi's JSONL events into LLMWebChat's ChatEvent stream.
 *
 * This gives the chat a REAL agent (pi): read/write/edit/bash tools, skills,
 * extensions, plan mode, the coding system prompt — everything pi can do.
 *
 * One PiSession = one long-lived `pi --mode rpc` process = one agent
 * conversation (context persists across prompts within the session). Idle
 * sessions are reaped to free resources.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { ChatEvent } from "@llmwebchat/shared";

export interface PiSessionOptions {
  /** Directory pi runs in (its tools operate here). Required. */
  cwd: string;
  /** Optional pi binary path (default "pi"). */
  bin?: string;
  /** Optional provider/model override passed to pi. */
  provider?: string;
  model?: string;
  /** Optional extra args. */
  extraArgs?: string[];
}

interface PromptHandle {
  onEvent: (ev: ChatEvent) => void;
  settled: boolean;
}

export class PiSession {
  readonly sessionId: string;
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buf = "";
  private current: PromptHandle | null = null;
  private lastUsed = Date.now();
  status: "starting" | "ready" | "error" | "closed" = "starting";
  lastError?: string;

  constructor(sessionId: string, private opts: PiSessionOptions) {
    this.sessionId = sessionId;
  }

  async start(): Promise<void> {
    const args = ["--mode", "rpc", "--no-session", ...(this.opts.extraArgs ?? [])];
    if (this.opts.provider) args.push("--provider", this.opts.provider);
    if (this.opts.model) args.push("--model", this.opts.model);
    this.proc = spawn(this.opts.bin ?? "pi", args, {
      cwd: this.opts.cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.proc.stdout.setEncoding("utf-8");
    this.proc.stdout.on("data", (d) => this.onStdout(d));
    this.proc.stderr.on("data", (d) => {
      // pi logs diagnostics to stderr; ignore unless debugging
      void d;
    });
    this.proc.on("exit", (code) => {
      this.status = "closed";
      if (this.current && !this.current.settled) {
        this.current.onEvent({ type: "error", message: `pi exited (code ${code})` });
        this.current.settled = true;
      }
    });
    this.proc.on("error", (e) => {
      this.status = "error";
      this.lastError = e.message;
      if (this.current && !this.current.settled) {
        this.current.onEvent({ type: "error", message: `pi failed to start: ${e.message}` });
        this.current.settled = true;
      }
    });
    this.status = "ready";
  }

  private onStdout(chunk: string) {
    this.buf += chunk;
    let nl: number;
    // Strict LF framing (do NOT split on Unicode separators — see pi rpc.md).
    while ((nl = this.buf.indexOf("\n")) !== -1) {
      let line = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.trim()) continue;
      let ev: any;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      this.handleEvent(ev);
    }
  }

  private handleEvent(ev: any) {
    this.lastUsed = Date.now();
    if (!this.current) return;
    const out = normalizePiEvent(ev);
    for (const e of out) this.current.onEvent(e);
    if (ev.type === "agent_settled" || (ev.type === "agent_end" && !ev.willRetry && ev.type)) {
      // agent_settled is the true "fully done" signal; agent_end without retry is a fallback.
      if (ev.type === "agent_settled") this.current.settled = true;
    }
  }

  /** Send a user prompt; stream events via onEvent until the turn settles. */
  async prompt(
    message: string,
    images: Array<{ data: string; mimeType: string }>,
    onEvent: (ev: ChatEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!this.proc) await this.start();
    this.current = { onEvent, settled: false };
    const cmd: any = {
      type: "prompt",
      message,
      ...(images.length ? { images: images.map((i) => ({ type: "image", data: i.data, mimeType: i.mimeType })) } : {}),
    };
    this.write(cmd);
    onEvent({ type: "start", messageId: this.sessionId, model: this.opts.model ?? "pi" });

    const done = () => signal?.removeEventListener("abort", onAbort);
    const onAbort = () => {
      this.write({ type: "abort" });
    };
    signal?.addEventListener("abort", onAbort);

    // Resolve when settled. Poll the handle (simple, robust).
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (this.current?.settled || this.status === "closed" || this.status === "error") {
          done();
          this.current = null;
          resolve();
        } else {
          setTimeout(tick, 30);
        }
      };
      tick();
    });
  }

  private write(obj: unknown) {
    if (!this.proc?.stdin.writable) {
      if (this.current && !this.current.settled) {
        this.current.onEvent({ type: "error", message: "pi process not writable" });
        this.current.settled = true;
      }
      return;
    }
    this.proc.stdin.write(JSON.stringify(obj) + "\n");
  }

  abort() {
    this.write({ type: "abort" });
  }

  async close() {
    this.status = "closed";
    try {
      this.proc?.stdin.end();
    } catch {
      /* noop */
    }
    try {
      this.proc?.kill();
    } catch {
      /* noop */
    }
    this.proc = null;
  }

  get idleMs() {
    return Date.now() - this.lastUsed;
  }
}

/** Translate a pi RPC event into zero or more LLMWebChat ChatEvents. */
function normalizePiEvent(ev: any): ChatEvent[] {
  const out: ChatEvent[] = [];
  if (ev.type === "message_update") {
    const d = ev.assistantMessageEvent;
    if (!d) return out;
    if (d.type === "text_delta" && d.delta) out.push({ type: "delta", content: d.delta });
    else if (d.type === "thinking_delta" && d.delta) out.push({ type: "reasoning", content: d.delta });
    else if (d.type === "toolcall_end" && d.toolCall) {
      out.push({
        type: "tool_call",
        toolCall: { id: d.toolCall.id ?? d.id ?? "tc", name: d.toolCall.name, arguments: d.toolCall.arguments ?? "" },
      });
    } else if (d.type === "error") {
      out.push({ type: "error", message: d.error ?? d.reason ?? "pi message error" });
    }
  } else if (ev.type === "turn_end") {
    // Accurate tool results live here.
    if (Array.isArray(ev.toolResults)) {
      for (const tr of ev.toolResults) {
        out.push({
          type: "tool_result",
          result: {
            toolCallId: tr.toolCallId ?? tr.id ?? "",
            name: tr.toolName ?? tr.name ?? "tool",
            content: typeof tr.content === "string" ? tr.content : JSON.stringify(tr.result ?? tr.output ?? tr),
            isError: tr.isError,
          },
        });
      }
    }
  } else if (ev.type === "agent_settled") {
    out.push({ type: "finish", messageId: "pi", model: "pi", finishReason: "stop" });
  } else if (ev.type === "extension_error") {
    out.push({ type: "error", message: `extension error: ${ev.error}` });
  }
  return out;
}
