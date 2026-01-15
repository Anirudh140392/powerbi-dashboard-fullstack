# Frontend Dockerfile - Serve Pre-built Static Files
FROM nginx:alpine

# Copy pre-built files to nginx
COPY dist /usr/share/nginx/html

# Copy custom nginx config for SPA routing
RUN echo 'server { \
    listen 9000; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 9000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
