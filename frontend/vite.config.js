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
    // Allow importing .tsx / .ts files from trailytics_ratings without extension
    extensions: ['.mjs', '.js', '.ts', '.tsx', '.jsx', '.json'],
  },
  // Tell esbuild (used by Vite under the hood) to handle TSX in .ts/.tsx files
  // imported from outside the project root (i.e. trailytics_ratings/src)
  esbuild: {
    loader: 'tsx',
    include: [
      /src\/.*\.[jt]sx?$/,
      /trailytics_ratings\/src\/.*\.[jt]sx?$/,
      /trailytics_content_analysis\/frontend\/src\/.*\.[jt]sx?$/,
    ],
    exclude: [],
  },
  // Allow importing from the sibling trailytics_ratings directory
  server: {
    port: 9500,
    host: true,
    fs: {
      // Allow serving files from the workspace root (needed for trailytics_ratings imports)
      allow: ['..'],
    },
    hmr: {
      clientPort: 9500,
    },
    proxy: {
      // ── Specific proxies for ratings backend (port 3001) ──
      // These match the Nginx rules to ensure ratings requests are routed to the ratings backend
      '/api/ratings': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/ml': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/ml-audit': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/automation': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/data-lake': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/notifications': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // ── Main backend API proxy (catch-all for other /api/*) ──
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        timeout: 10 * 60 * 1000,       // 10 minutes for large report downloads
        proxyTimeout: 10 * 60 * 1000,   // 10 minutes proxy timeout
      },
      // Proxy for trailytics_ratings backend API (port 3001)
      // DS frontend calls /ratings-api/... → ratings Express server /api/...
      '/ratings-api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ratings-api/, ''),
      },
      '/socket.io': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
