/**
 * Extract renderable "artifacts" (fenced code blocks) from a markdown message.
 * Artifacts are opened in the side panel for live preview / execution.
 */
export interface Artifact {
  id: string;
  language: string;
  /** Bare code content */
  code: string;
  /** Suggested filename */
  filename: string;
  /** Whether this language can be live-previewed */
  previewable: boolean;
}

const PREVIEWABLE = new Set(["html", "svg", "mermaid"]);
const RUNNABLE = new Set(["python", "py"]);

const FENCE = /```([\w+-]+)?\n([\s\S]*?)```/g;

export function extractArtifacts(content: string): Artifact[] {
  const out: Artifact[] = [];
  let m: RegExpExecArray | null;
  FENCE.lastIndex = 0;
  while ((m = FENCE.exec(content)) !== null) {
    const lang = (m[1] ?? "text").toLowerCase();
    const code = m[2].replace(/\n$/, "");
    out.push({
      id: `${out.length}-${lang}`,
      language: lang,
      code,
      filename: filenameFor(lang, out.length),
      previewable: PREVIEWABLE.has(lang),
    });
  }
  return out;
}

export function isRunnable(lang: string): boolean {
  return RUNNABLE.has(lang.toLowerCase());
}

function filenameFor(lang: string, i: number): string {
  const ext: Record<string, string> = {
    html: "html",
    svg: "svg",
    mermaid: "mmd",
    python: "py",
    py: "py",
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    jsx: "jsx",
    tsx: "tsx",
    json: "json",
    css: "css",
    bash: "sh",
    sh: "sh",
  };
  return `artifact-${i + 1}.${ext[lang] ?? "txt"}`;
}
