/**
 * In-browser Python execution via Pyodide (WebAssembly). Lazy-loaded once from
 * the CDN on first use. Output (stdout/stderr) is captured and returned.
 *
 * Security: Pyodide runs in WASM with no filesystem or network by default —
 * it cannot touch the user's machine, only the in-memory sandbox. Safe to run
 * untrusted code here.
 */

const PYODIDE_VERSION = "0.26.4";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise: Promise<unknown> | null = null;

declare global {
  interface Window {
    loadPyodide?: (cfg: { indexURL: string }) => Promise<unknown>;
  }
}

async function loadPyodide(): Promise<any> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      if (!window.loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = INDEX_URL + "pyodide.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Pyodide script"));
          document.head.appendChild(s);
        });
      }
      const py = await window.loadPyodide!({ indexURL: INDEX_URL });
      // redirect stdout/stderr into JS callbacks
      (py as any).setStdout({ batched: (s: string) => outBuffer += s + "\n" });
      (py as any).setStderr({ batched: (s: string) => outBuffer += s + "\n" });
      return py;
    })();
  }
  return pyodidePromise;
}

let outBuffer = "";

export interface RunResult {
  ok: boolean;
  output: string;
  durationMs: number;
}

/** Run Python code. Subsequent calls reuse the same interpreter (stateful). */
export async function runPython(code: string): Promise<RunResult> {
  const start = performance.now();
  outBuffer = "";
  try {
    const py = await loadPyodide();
    await (py as any).runPythonAsync(code);
    return { ok: true, output: outBuffer.trim() || "(no output)", durationMs: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      ok: false,
      output: (outBuffer.trim() + "\n" + String((err as Error).message)).trim(),
      durationMs: Math.round(performance.now() - start),
    };
  }
}

export async function isPyodideReady(): Promise<boolean> {
  try {
    await loadPyodide();
    return true;
  } catch {
    return false;
  }
}
