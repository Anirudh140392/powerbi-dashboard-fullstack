# ─────────────────────────────────────────────────────────────
# Frontend Dockerfile (Monorepo-Aware Multi-Stage Build)
#
# Build context MUST be the monorepo root (.) because the main
# frontend imports source files directly from:
#   trailytics_ratings/frontend/src/components/Dashboard.tsx
#   trailytics_ratings/frontend/src/contexts/AuthContext.tsx
#   trailytics_ratings/frontend/src/index.css
# ─────────────────────────────────────────────────────────────

# Stage 1: Build
FROM node:20-alpine AS build-stage

WORKDIR /app

# ── Install main frontend dependencies ──
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# ── Install ratings frontend dependencies ──
# (Vite resolves their TS/TSX at build time, so node_modules must exist)
COPY trailytics_ratings/frontend/package*.json ./trailytics_ratings/frontend/
RUN cd trailytics_ratings/frontend && npm install

# ── Copy source code for both projects ──
COPY frontend/ ./frontend/
COPY trailytics_ratings/frontend/src/ ./trailytics_ratings/frontend/src/
COPY trailytics_ratings/frontend/index.html ./trailytics_ratings/frontend/
COPY trailytics_ratings/frontend/vite.config.ts ./trailytics_ratings/frontend/
COPY trailytics_ratings/frontend/tsconfig*.json ./trailytics_ratings/frontend/
COPY trailytics_ratings/frontend/postcss.config.js ./trailytics_ratings/frontend/
COPY trailytics_ratings/frontend/tailwind.config.js ./trailytics_ratings/frontend/

# ── Build the main frontend (which compiles ratings TSX inline) ──
RUN cd frontend && npm run build

# Stage 2: Production — serve with Nginx
FROM nginx:alpine

# Copy built static files from build stage
COPY --from=build-stage /app/frontend/dist /usr/share/nginx/html

# Copy Nginx configuration (separate file avoids heredoc/BuildKit issues)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 9500

CMD ["nginx", "-g", "daemon off;"]
