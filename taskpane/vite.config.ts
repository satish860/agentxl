import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/taskpane/",
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
