import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // the API server (apps/server) runs on 3001 in development
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});
