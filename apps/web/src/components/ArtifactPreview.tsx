import { useEffect, useState } from "react";
import type { Artifact } from "../lib/artifacts.js";

/** Render HTML in a sandboxed iframe (no same-origin → can't touch parent/cookies). */
function HtmlPreview({ code }: { code: string }) {
  return (
    <iframe
      title="html-preview"
      sandbox="allow-scripts allow-modals"
      srcDoc={code}
      className="w-full h-full bg-white border-0"
    />
  );
}

/** Render raw SVG safely (namespaced). */
function SvgPreview({ code }: { code: string }) {
  return (
    <div className="w-full h-full overflow-auto grid place-items-center bg-[#0d1117] p-4">
      <div
        className="max-w-full"
        // SVG is XML; inline render. CSP-lite: we trust model output in this panel.
        dangerouslySetInnerHTML={{ __html: code }}
      />
    </div>
  );
}

/** Render Mermaid via lazy dynamic import. */
function MermaidPreview({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark" });
        const { svg: out } = await mermaid.render(`mmd-${Math.random().toString(36).slice(2, 8)}`, code);
        if (alive) setSvg(out);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code]);
  if (err) return <pre className="p-4 text-red-400 text-sm">{err}</pre>;
  if (!svg) return <div className="p-4 text-[var(--color-muted)] text-sm">Rendering diagram…</div>;
  return <div className="p-4 overflow-auto grid place-items-center" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  let body: React.ReactNode;
  switch (artifact.language) {
    case "html":
      body = <HtmlPreview code={artifact.code} />;
      break;
    case "svg":
      body = <SvgPreview code={artifact.code} />;
      break;
    case "mermaid":
      body = <MermaidPreview code={artifact.code} />;
      break;
    default:
      body = (
        <pre className="p-4 text-sm overflow-auto h-full bg-[#0d1117]">
          <code>{artifact.code}</code>
        </pre>
      );
  }
  return <div className="flex-1 min-h-0 overflow-hidden bg-[var(--color-bg)]">{body}</div>;
}
