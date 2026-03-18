import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 9500,
    host: true,
    hmr: {
      clientPort: 9500,
    },
    proxy: {
      '/api': {
        target: 'https://powerbi-dashboard-fullstack-rca-backend.onrender.com',
        changeOrigin: true,
      },
    },
  },
});
