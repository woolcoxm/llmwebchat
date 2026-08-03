// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { writeFileSync } from "node:fs";

beforeAll(() => {
  if (!(window as any).speechSynthesis) (window as any).speechSynthesis = { speaking: false, cancel() {}, speak() {} };
  if (!navigator.clipboard) (navigator as any).clipboard = { writeText: async () => {} };
});

describe("App render smoke", () => {
  it("mounts without infinite-update loop", async () => {
    const root = document.getElementById("root") ?? document.body.appendChild(document.createElement("div"));
    const r = createRoot(root);
    const errs: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
      errs.push(a.map((x) => (x && typeof x === "object" ? (x as any).stack ?? JSON.stringify(x) : String(x))).join(" "));
    });
    let loopErr: unknown = null;
    try {
      await act(async () => {
        const { default: App } = await import("../../src/App.js");
        r.render(<App />);
      });
      await act(async () => { await new Promise((res) => setTimeout(res, 600)); });
    } catch (e) {
      loopErr = e;
    }
    spy.mockRestore();
    writeFileSync("/tmp/all-errs.txt", errs.join("\n----\n"));
    if (loopErr) {
      writeFileSync("/tmp/loop-stack.txt", (loopErr as Error).stack ?? String(loopErr));
      console.log("LOOP_STACK:\n" + (loopErr as Error).stack);
    }
    expect(loopErr).toBeNull();
    r.unmount();
  });
}, { timeout: 20_000 });
