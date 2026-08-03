import { Component, type ReactNode } from "react";

/**
 * Top-level error boundary so a render bug in any component degrades gracefully
 * (shows a reload prompt) instead of a blank white screen.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("UI error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full grid place-items-center p-8 text-center">
          <div className="max-w-md">
            <div className="text-4xl mb-3">😵</div>
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <pre className="text-xs text-[var(--color-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 mb-4 overflow-auto text-left whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm mr-2"
            >
              Try again
            </button>
            <button
              onClick={() => location.reload()}
              className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
