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
  server: {
    port: 5173,
    proxy: { "/api": process.env.HIPPO_API_URL ?? "http://localhost:8787" },
  },
});
