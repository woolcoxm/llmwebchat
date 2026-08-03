import { lazy, Suspense } from "react";

// Heavy deps (react-markdown + rehype-katex + rehype-highlight) are isolated in
// MarkdownImpl and split into their own chunk, loaded on first render.
const MarkdownImpl = lazy(() => import("./MarkdownImpl.js"));

export function Markdown({ content }: { content: string }) {
  return (
    <Suspense
      fallback={
        <div className="prose-chat text-[var(--color-muted)] text-sm stream-caret">rendering…</div>
      }
    >
      <MarkdownImpl content={content} />
    </Suspense>
  );
}
