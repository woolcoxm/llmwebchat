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

/** Render a ```chart JSON spec via Recharts (lazy-loaded). */
function ChartPreview({ code }: { code: string }) {
  const [node, setNode] = useState<React.ReactNode>(<div className="p-4 text-sm text-[var(--color-muted)]">Rendering chart…</div>);
  useEffect(() => {
    let alive = true;
    (async () => {
      let spec: any;
      try {
        spec = JSON.parse(code);
      } catch {
        if (alive) setNode(<pre className="p-4 text-red-400 text-sm">Invalid chart JSON</pre>);
        return;
      }
      const type = spec.type ?? "bar";
      const data = Array.isArray(spec.data) ? spec.data : [];
      const xKey = spec.xKey ?? "name";
      const yKey = spec.yKey ?? "value";
      const R = await import("recharts");
      const props = {
        data,
        width: spec.width ?? 480,
        height: spec.height ?? 280,
        margin: { top: 12, right: 16, bottom: 12, left: 8 },
      };
      const axis = (
        <>
          <R.XAxis dataKey={xKey} tick={{ fill: "#8b8b94", fontSize: 11 }} />
          <R.YAxis tick={{ fill: "#8b8b94", fontSize: 11 }} />
          <R.Tooltip contentStyle={{ background: "#1b1b20", border: "1px solid #27272a", borderRadius: 8 }} />
          <R.Legend wrapperStyle={{ fontSize: 11 }} />
        </>
      );
      let chart: React.ReactNode;
      if (type === "pie") {
        chart = (
          <R.PieChart width={props.width} height={props.height}>
            <R.Pie data={data} dataKey={yKey} nameKey={xKey} outerRadius={90} label>
              {data.map((_: any, i: number) => (
                <R.Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </R.Pie>
            <R.Tooltip contentStyle={{ background: "#1b1b20", border: "1px solid #27272a", borderRadius: 8 }} />
            <R.Legend wrapperStyle={{ fontSize: 11 }} />
          </R.PieChart>
        );
      } else {
        const Comp = type === "line" ? R.LineChart : type === "area" ? R.AreaChart : R.BarChart;
        const Series =
          type === "line"
            ? (p: any) => <R.Line type="monotone" dataKey={yKey} stroke="#6366f1" strokeWidth={2} dot={false} {...p} />
            : type === "area"
              ? (p: any) => <R.Area type="monotone" dataKey={yKey} stroke="#6366f1" fill="#6366f140" {...p} />
              : (p: any) => <R.Bar dataKey={yKey} radius={[4, 4, 0, 0]} {...p}> {data.map((_: any, i: number) => <R.Cell key={i} fill={PALETTE[i % PALETTE.length]} />)} </R.Bar>;
        chart = (
          // @ts-ignore recharts spreads
          <Comp {...props}>
            {axis}
            <Series />
          </Comp>
        );
      }
      if (alive) setNode(<div className="p-4 grid place-items-center overflow-auto">{chart}</div>);
    })();
    return () => {
      alive = false;
    };
  }, [code]);
  return <div className="w-full h-full overflow-auto bg-[#0d1117]">{node}</div>;
}

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4", "#8b5cf6", "#ec4899"];

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
    case "chart":
      body = <ChartPreview code={artifact.code} />;
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
