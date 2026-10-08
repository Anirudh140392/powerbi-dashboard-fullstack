# ─────────────────────────────────────────────────
# Ratings Backend — Production Dockerfile
# Runs the Express API server on port 3001
# ─────────────────────────────────────────────────
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files for dependency caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code and scripts (needed for migrations & sync jobs)
COPY src/ ./src/
COPY scripts/ ./scripts/

# Expose the API port
EXPOSE 3001

# Health check — hit the Express server
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "src/server.js"]
