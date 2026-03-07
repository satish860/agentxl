import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles/globals.css";

/**
 * Initialize the taskpane.
 *
 * If Office.js is available (running inside Excel), wait for it to initialize.
 * If not (running in a browser for testing), render immediately.
 */
function render() {
  const root = document.getElementById("root");
  if (!root) throw new Error("Root element not found");

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// Check if Office.js is available
declare const Office: any;

if (typeof Office !== "undefined" && Office.onReady) {
  Office.onReady(() => {
    render();
  });
} else {
  // Browser testing — no Office.js
  render();
}
