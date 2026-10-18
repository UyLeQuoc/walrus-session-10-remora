import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    // Both extensions. It was .tsx only, so a plain .ts test file was collected
    // by nothing and reported as neither passing nor failing.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
