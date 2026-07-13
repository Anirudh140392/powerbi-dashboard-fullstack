#!/usr/bin/env bash
# Periodic auto-approve loop for BERT-inferred ratings.
#
# Every CHECK_INTERVAL seconds: pull the latest ml_inferred_rating from the
# audit table into ratings.reviews for rows still missing it. Logs each pass
# with current coverage. Exits when ml_inferred_rating coverage >= TARGET_PCT
# OR the BERT Inference job is no longer RUNNING and we made no progress in
# the last pass (it's done — nothing more to harvest).
set -u
PLINK='C:\Program Files\PuTTY\plink.exe'
KEY='C:\Users\monst\Downloads\Idam_Crawling 2.ppk'
SSH='ubuntu@3.7.138.75'
COMPANY="297e37ea-a5ac-47df-bebd-ac44e52b7979"
PSQL_BASE="PGPASSWORD='PgAdsautoX942026' psql -h localhost -U adsauto -d adsauto"

CHECK_INTERVAL=${CHECK_INTERVAL:-1800}     # 30 min default
TARGET_PCT=${TARGET_PCT:-95}
MAX_PASSES=${MAX_PASSES:-12}                # 12 * 30 min = 6h safety cap

prev_count=0
no_progress_streak=0

for pass in $(seq 1 "$MAX_PASSES"); do
    echo "[$(date +%H:%M:%S)] Pass $pass / $MAX_PASSES"

    # Auto-approve: pull ml_inferred_rating into ratings.reviews where currently NULL.
    SQL="
SET lock_timeout='120s';
WITH best AS (
  SELECT DISTINCT ON (a.review_id)
         a.review_id,
         CASE WHEN a.ml_inferred_rating BETWEEN 1 AND 5 THEN a.ml_inferred_rating END AS r
    FROM ratings.reviews_ml_audit a
   WHERE a.company_id='$COMPANY'
     AND a.ml_inferred_rating IS NOT NULL
   ORDER BY a.review_id, a.audit_date DESC
)
UPDATE ratings.reviews r
   SET ml_inferred_rating = best.r,
       updated_at = NOW()
  FROM best
 WHERE best.review_id = r.id
   AND r.ml_inferred_rating IS NULL
   AND best.r IS NOT NULL;
"
    "$PLINK" -ssh -i "$KEY" -batch "$SSH" "$PSQL_BASE -c \"$SQL\"" 2>&1 | tail -1

    # Stats
    COVERAGE=$("$PLINK" -ssh -i "$KEY" -batch "$SSH" "$PSQL_BASE -tA -c \"SELECT COUNT(*) FILTER (WHERE ml_inferred_rating IS NOT NULL)||'/'||COUNT(*)||'|'||ROUND(100.0*COUNT(*) FILTER (WHERE ml_inferred_rating IS NOT NULL)/COUNT(*),1) FROM ratings.reviews WHERE company_id='$COMPANY';\"" 2>/dev/null | tr -d '[:space:]')
    BERT_STATUS=$("$PLINK" -ssh -i "$KEY" -batch "$SSH" "$PSQL_BASE -tA -c \"SELECT status FROM ratings.ml_jobs_log WHERE job_name='BERT Inference' ORDER BY started_at DESC LIMIT 1;\"" 2>/dev/null | tr -d '[:space:]')
    CURRENT_COUNT=$("$PLINK" -ssh -i "$KEY" -batch "$SSH" "$PSQL_BASE -tA -c \"SELECT COUNT(*) FILTER (WHERE ml_inferred_rating IS NOT NULL) FROM ratings.reviews WHERE company_id='$COMPANY';\"" 2>/dev/null | tr -d '[:space:]')
    PCT=$(echo "$COVERAGE" | cut -d'|' -f2)

    echo "[$(date +%H:%M:%S)] coverage=$COVERAGE pct=$PCT bert=$BERT_STATUS"

    # Exit conditions
    PCT_INT=$(echo "$PCT" | cut -d'.' -f1)
    if [ "$PCT_INT" -ge "$TARGET_PCT" ]; then
        echo "[$(date +%H:%M:%S)] Target $TARGET_PCT% reached. Exiting."
        break
    fi

    if [ "$BERT_STATUS" != "RUNNING" ]; then
        if [ "$CURRENT_COUNT" = "$prev_count" ]; then
            no_progress_streak=$((no_progress_streak + 1))
            if [ "$no_progress_streak" -ge 2 ]; then
                echo "[$(date +%H:%M:%S)] BERT is $BERT_STATUS and no new rows in last 2 passes. Exiting."
                break
            fi
        else
            no_progress_streak=0
        fi
    fi

    prev_count="$CURRENT_COUNT"

    if [ "$pass" -lt "$MAX_PASSES" ]; then
        sleep "$CHECK_INTERVAL"
    fi
done

echo "[$(date +%H:%M:%S)] Watcher done."
