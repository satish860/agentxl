import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Build modes:
 *
 * - Default (`npm run build:taskpane`):
 *   base = /taskpane/  →  served by localhost:3001/taskpane/
 *
 * - Hosted (`VITE_BASE=/agentxl/taskpane/ npm run build:taskpane`):
 *   base = /agentxl/taskpane/  →  served by GitHub Pages
 *
 * The taskpane JS auto-detects whether it's on localhost or a public host
 * and routes API calls accordingly.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE || "/taskpane/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    // Dev server settings (for standalone UI development)
    port: 3002,
    strictPort: false,
  },
});
