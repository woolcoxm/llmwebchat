import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { useStore } from "../store.js";

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const lang = /language-(\w+)/.exec(className ?? "")?.[1];
  const code = String(children ?? "");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };
  return (
<div className="relative group">
        <div className="flex items-center justify-between px-3 py-1 text-[11px] text-[var(--color-muted)] border-b border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-t-[10px]">
          <span>{lang ?? "text"}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => useStore.getState().setArtifactOpen(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--color-fg)]"
              title="Open in Artifacts panel"
            >
              ↗ open
            </button>
            <button
              onClick={copy}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--color-fg)]"
            >
              {copied ? "✓ copied" : "copy"}
            </button>
          </div>
        </div>
      <pre className="!mt-0 !rounded-t-none">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code({ className, children, ...props }) {
            const isBlock = className?.includes("language-");
            if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
