import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { loadAccent } from "./lib/theme.js";
import "./index.css";

loadAccent();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
