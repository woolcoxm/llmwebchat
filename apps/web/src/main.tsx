import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { loadAccent } from "./lib/theme.js";
import "./index.css";

loadAccent();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
