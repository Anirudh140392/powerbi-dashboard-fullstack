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

# Nginx configuration with proxies to both backend services
RUN cat > /etc/nginx/conf.d/default.conf << 'NGINX_CONF'
server {
    listen 9500;
    root /usr/share/nginx/html;
    index index.html;

    # ── Ratings backend API paths (must come before generic /api/) ──
    # Nginx longest-prefix match ensures these hit ratings_backend:3001
    location /api/ratings/ {
        proxy_pass http://ratings_backend:3001/api/ratings/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    location /api/ml/ {
        proxy_pass http://ratings_backend:3001/api/ml/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    location /api/ml-audit/ {
        proxy_pass http://ratings_backend:3001/api/ml-audit/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    location /api/automation/ {
        proxy_pass http://ratings_backend:3001/api/automation/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    location /api/data-lake/ {
        proxy_pass http://ratings_backend:3001/api/data-lake/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    location /api/notifications/ {
        proxy_pass http://ratings_backend:3001/api/notifications/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    # ── Main backend API proxy (catch-all for /api/*) ──
    location /api/ {
        proxy_pass http://backend_multiple:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    # Main backend Socket.io proxy
    location /socket.io/ {
        proxy_pass http://backend_multiple:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Ratings backend API proxy (mirrors vite.config.js dev proxy)
    location /ratings-api/ {
        rewrite ^/ratings-api/(.*) /$1 break;
        proxy_pass http://ratings_backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    # SPA fallback — serve index.html for all unmatched routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX_CONF

EXPOSE 9500

CMD ["nginx", "-g", "daemon off;"]
