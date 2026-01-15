import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "@emotion/react": path.resolve(__dirname, "./node_modules/@emotion/react"),
      "@emotion/styled": path.resolve(__dirname, "./node_modules/@emotion/styled"),
    },
  },
  server: {
    port: 9000,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://13.200.212.219',
        changeOrigin: true,
        secure: false, // In case of self-signed certs, though this is http
      },

    },
  },
});
