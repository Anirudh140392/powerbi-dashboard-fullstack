# Stage 1: Build stage
FROM node:20-alpine AS build-stage

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Production stage
FROM nginx:alpine

# Copy built static files from build-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Create nginx config with API proxy to backend
RUN echo 'server { \
    listen 9500; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    location /api/ { \
    proxy_pass http://backend:5000/api/; \
    proxy_http_version 1.1; \
    proxy_set_header Host $host; \
    proxy_set_header X-Real-IP $remote_addr; \
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
    proxy_connect_timeout 300; \
    proxy_send_timeout 300; \
    proxy_read_timeout 300; \
    } \
    \
    location / { \
    try_files $uri $uri/ /index.html; \
    } \
    }' > /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 9500

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
