# ─────────────────────────────────────────────────────────────
# DS Tester Backend (FastAPI + Selenium)
#
# Fully isolated service on its own container/port (8002). If this
# container is unhealthy or down, the rest of the application is
# unaffected (Nginx proxies /ds-tester/* here with a runtime resolver).
# ─────────────────────────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive

# Chromium + driver are required for the live Selenium UI verification step.
# Selenium Manager is pointed at them through SE_CHROMEDRIVER / CHROME_BIN.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        chromium-driver \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first for better layer caching
COPY requirements.txt /app/ds_tester/requirements.txt
RUN pip install --no-cache-dir -r /app/ds_tester/requirements.txt

# Copy the DS Tester package (uvicorn imports ds_tester.backend.routes:app)
COPY . /app/ds_tester/

# Modules optionally read /app/backend/.env; in Docker, secrets are injected
# through docker compose env_file, so this directory only needs to exist.
RUN mkdir -p /app/backend

ENV CHROME_BIN=/usr/bin/chromium \
    SE_CHROMEDRIVER=/usr/bin/chromedriver

EXPOSE 8002

CMD ["uvicorn", "ds_tester.backend.routes:app", "--host", "0.0.0.0", "--port", "8002"]
