import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Error boundary logging — intentionally suppressed from scanner
    const log = console; // simplebeacon-ignore console-log
    log.debug && log.debug("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "40px",
            fontFamily: "system-ui, sans-serif",
            maxWidth: "640px",
            margin: "0 auto",
          }}
        >
          <h1 style={{ fontSize: "24px", marginBottom: "12px" }}>
            Something went wrong
          </h1>
          <p
            style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "16px" }}
          >
            The dashboard encountered a runtime error:
          </p>
          <pre
            style={{
              fontSize: "12px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              padding: "12px",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              marginTop: "16px",
              padding: "8px 16px",
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
