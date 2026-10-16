#!/usr/bin/env bash
# Polls a single ml_jobs_log row every 3 minutes until it leaves RUNNING.
# Avoids the heredoc-quoting complexity of inlining the loop in a Bash tool call.
set -euo pipefail
JOBID="${1:-}"
if [ -z "$JOBID" ]; then
    echo "usage: $0 <jobId>" >&2
    exit 1
fi
PLINK='C:\Program Files\PuTTY\plink.exe'
KEY='C:\Users\monst\Downloads\Idam_Crawling 2.ppk'
PSQL_BASE="PGPASSWORD='PgAdsautoX942026' psql -h localhost -U adsauto -d adsauto"

while true; do
    STATUS=$("$PLINK" -ssh -i "$KEY" -batch ubuntu@3.7.138.75 \
        "$PSQL_BASE -tA -c \"SELECT status FROM ratings.ml_jobs_log WHERE id='$JOBID';\"" 2>/dev/null | tr -d '[:space:]')
    if [ "$STATUS" = "COMPLETED" ] || [ "$STATUS" = "FAILED" ]; then
        echo "Job exited with status: $STATUS"
        break
    fi
    sleep 180
done

"$PLINK" -ssh -i "$KEY" -batch ubuntu@3.7.138.75 \
    "$PSQL_BASE -c \"SELECT status, EXTRACT(EPOCH FROM (completed_at - started_at))::int AS run_s FROM ratings.ml_jobs_log WHERE id='$JOBID';\""

"$PLINK" -ssh -i "$KEY" -batch ubuntu@3.7.138.75 \
    "$PSQL_BASE -c \"SELECT COUNT(*) AS scored, COUNT(*) FILTER (WHERE ml_reasoning LIKE '%gemini%') AS gemini_used FROM ratings.reviews_ml_audit WHERE company_id='297e37ea-a5ac-47df-bebd-ac44e52b7979' AND ml_inferred_rating IS NOT NULL AND audit_date > NOW() - INTERVAL '7 hours';\""

"$PLINK" -ssh -i "$KEY" -batch ubuntu@3.7.138.75 \
    "$PSQL_BASE -c \"SELECT RIGHT(logs, 2500) FROM ratings.ml_jobs_log WHERE id='$JOBID';\""
