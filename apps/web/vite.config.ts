import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  // In dev, /api goes to the local server the way Vercel's rewrite sends it to
  // Railway in production, so the page is same-origin and the session cookie
  // works. Without this every chat request hit Vite and came back 404.
  // WEB_PORT / PORT let several local stacks (and agent worktrees) run side by side.
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      "/api": process.env.REMORA_API_URL ?? `http://localhost:${process.env.PORT ?? 8787}`,
      // ADR-0149: the template badge, served by the API like the production rewrite.
      "/badge": process.env.REMORA_API_URL ?? `http://localhost:${process.env.PORT ?? 8787}`,
    },
  },
});
