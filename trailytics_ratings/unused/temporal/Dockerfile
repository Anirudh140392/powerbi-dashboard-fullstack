# Temporal worker for the Ratings automation pipeline.
#
# Build from the REPO ROOT (the worker runs scripts/ + server/automation/):
#   docker build -f temporal/Dockerfile -t rating-temporal-worker .
#
# Run (needs network access to BOTH the Prestige MySQL DB and the adsauto Postgres):
#   docker run --env-file temporal/.env --name rating-worker rating-temporal-worker
FROM node:20-bookworm

# Python runtime for the ML scripts spawned by activities.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Whole repo — the worker spawns scripts/*.cjs|*.py and requires server/automation/*.
COPY . .

# Root Node deps (pg, mysql2, nodemailer, dotenv, @google/genai, tsx, ...) used by
# the sync scripts, ML scripts, and the shared server/automation modules.
RUN npm install --omit=dev

# Temporal worker deps + TypeScript build (temporal/lib/*.js).
WORKDIR /app/temporal
RUN npm install && npm run build

# Python deps for the ML scripts. --break-system-packages: Debian-managed env.
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Activities resolve the repo's shared CJS modules relative to this root.
ENV AUTOMATION_REPO_ROOT=/app

CMD ["node", "lib/worker.js"]
