# ─────────────────────────────────────────────────
# Content Analysis Backend — Production Dockerfile
# Builds TypeScript source with tsc, runs on port 8000
# ─────────────────────────────────────────────────
FROM node:20-alpine AS build-stage

# Set working directory
WORKDIR /app

# Copy package files for dependency caching
COPY package*.json ./

# Install all dependencies (including devDependencies for tsc build)
RUN npm ci

# Copy source code and TypeScript config
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript to JavaScript
RUN npm run build

# ─── Production stage ───
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy compiled JavaScript from build stage
COPY --from=build-stage /app/dist/ ./dist/

# Expose the API port
EXPOSE 8000

# Health check — hit the Express server
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "dist/index.js"]
