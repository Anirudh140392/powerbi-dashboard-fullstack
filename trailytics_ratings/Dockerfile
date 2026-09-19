# Use a slim image carrying both Python 3.11 and NodeJS 20
FROM nikolaik/python-nodejs:python3.11-nodejs20-slim

# Install native dependencies if any C extensions need compiling
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python Installations (Cached Layer)
# We specifically install the CPU version of PyTorch to keep the image size small
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir transformers pandas psycopg2-binary python-dotenv google-generativeai

# Guarantee python3 is on the system PATH for Node child_process.spawn
# pip works, so discover Python from pip's shebang and create standard symlinks
RUN echo "=== Diagnosing Python location ===" && \
    ls -la /usr/local/bin/py* 2>/dev/null || true && \
    ls -la /usr/bin/py* 2>/dev/null || true && \
    which pip && head -1 $(which pip) && \
    find / -name "python3.11" -type f 2>/dev/null | head -5 && \
    PYBIN=$(find / -name "python3.11" -type f 2>/dev/null | head -1) && \
    echo "Python binary at: $PYBIN" && \
    ln -sf "$PYBIN" /usr/local/bin/python3 && \
    ln -sf "$PYBIN" /usr/local/bin/python && \
    python3 --version

# Node Dependencies (Cached Layer)
COPY package*.json ./
RUN npm ci

# Copy full application codebase
COPY . .

# Build the React/Vite Frontend
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Prune development dependencies to keep final image tidy (Optional, but good practice)
RUN npm prune --omit=dev

# Railway sets the PORT environment variable dynamically.
# Our Express server checks for process.env.PORT or process.env.API_PORT.
ENV API_PORT=3000
EXPOSE 3000

# Force Python to unbuffer stdout/stderr unconditionally for real-time node streaming
ENV PYTHONUNBUFFERED=1

# Prevent PyTorch/OpenMP from deadlocking on 1-vCPU Docker hosts by spawning too many threads
ENV OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    VECLIB_MAXIMUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1

CMD ["node", "server/api.cjs"]
