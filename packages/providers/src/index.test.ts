import { describe, it, expect } from "vitest";
import { toWireMessages } from "./index.js";
import type { ChatMessage } from "@llmwebchat/shared";

const mk = (over: Partial<ChatMessage>): ChatMessage => ({
  id: "x",
  role: "user",
  content: "",
  createdAt: 0,
  ...over,
});

describe("toWireMessages", () => {
  it("passes through plain user/assistant text", () => {
    const out = toWireMessages([
      mk({ role: "user", content: "hi" }),
      mk({ role: "assistant", content: "hello" }),
    ]);
    expect(out).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("emits tool_calls on an assistant message", () => {
    const out = toWireMessages([
      mk({
        role: "assistant",
        content: "",
        toolCalls: [{ id: "c1", name: "search", arguments: "{}" }],
      }),
    ]);
    expect(out[0]).toMatchObject({ role: "assistant" });
    expect((out[0] as any).tool_calls[0].function.name).toBe("search");
  });

  it("reconstructs role:tool result messages after a tool-calling assistant turn", () => {
    const out = toWireMessages([
      mk({
        role: "assistant",
        content: "doing it",
        toolCalls: [{ id: "c1", name: "write_file", arguments: "{}" }],
        toolResults: [{ toolCallId: "c1", name: "write_file", content: "ok" }],
      }),
      mk({ role: "user", content: "thanks" }),
    ]);
    // [assistant(tool_calls), tool(result), user]
    expect(out).toHaveLength(3);
    expect(out[1]).toEqual({ role: "tool", tool_call_id: "c1", content: "ok" });
    expect(out[2]).toEqual({ role: "user", content: "thanks" });
  });

  it("converts image attachments to image_url parts", () => {
    const out = toWireMessages([
      mk({
        role: "user",
        content: "what is this",
        attachments: [{ id: "a", type: "image/png", name: "f.png", url: "data:image/png;base64,xxx" }],
      }),
    ]);
    const content = (out[0] as any).content;
    expect(content[0]).toMatchObject({ type: "text", text: "what is this" });
    expect(content[1]).toMatchObject({ type: "image_url" });
  });
});
