"""
Database ML Backfill Script
Reads candidate reviews from Postgres, runs the local ML rules pipeline,
and writes ML outputs into ratings.reviews_ml_audit for QC review.
"""
import os
import sys
import logging

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml_pipeline.category_classifier import classify_review
from ml_pipeline.sentiment_analyzer import analyze_sentiment_local

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

BATCH_SIZE = 2000


def get_pg_conn():
    load_dotenv()
    # TCP keepalives — long backfill runs hold the conn idle between batches
    # and AWS network drops idle sockets. Without these the next commit
    # throws SSL SYSCALL error: EOF detected.
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        port=os.getenv("DB_PORT", "5432"),
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )


def get_company_id():
    return os.environ["COMPANY_ID"]


def main():
    read_conn = get_pg_conn()
    write_conn = get_pg_conn()
    company_id = get_company_id()

    logging.info("Company ID: %s", company_id)

    # Targets reviews missing sentiment in ratings.reviews where no audit row
    # has produced a v8 sentiment yet. The previous NOT EXISTS excluded any
    # review with ANY audit row, which left 108K reviews stranded with
    # BERT-only audit rows (BERT writes rating, not sentiment).
    pending_sql = """
        SELECT count(*)
        FROM ratings.reviews r
        WHERE r.company_id = %s
          AND r.review_text IS NOT NULL
          AND LENGTH(TRIM(r.review_text)) > 5
          AND (r.specific_issue IS NULL OR r.sentiment IS NULL OR r.ml_inferred_rating IS NULL)
          AND NOT EXISTS (
                SELECT 1
                FROM ratings.reviews_ml_audit a
                WHERE a.company_id = r.company_id
                  AND a.review_id  = r.id
                  AND a.ml_sentiment IS NOT NULL
          )
    """

    fetch_sql = """
        SELECT r.id, r.review_text, r.product_name, r.rating, r.sentiment, r.specific_issue
        FROM ratings.reviews r
        WHERE r.company_id = %s
          AND r.review_text IS NOT NULL
          AND LENGTH(TRIM(r.review_text)) > 5
          AND (r.specific_issue IS NULL OR r.sentiment IS NULL OR r.ml_inferred_rating IS NULL)
          AND NOT EXISTS (
                SELECT 1
                FROM ratings.reviews_ml_audit a
                WHERE a.company_id = r.company_id
                  AND a.review_id  = r.id
                  AND a.ml_sentiment IS NOT NULL
          )
    """

    # ON CONFLICT updates an existing audit row when our v8 result fills a
    # gap (sentiment/issue null on the existing row). Reviews can have only
    # one audit row per (company_id, review_id) — earlier BERT-only rows
    # would crash this INSERT otherwise.
    insert_sql = """
        INSERT INTO ratings.reviews_ml_audit (
            review_id,
            company_id,
            product_name,
            review_text,
            original_user_rating,
            original_sentiment,
            original_issue,
            ml_sentiment,
            ml_issue,
            ml_confidence_score,
            ml_reasoning,
            ml_inferred_rating,
            ml_issue_category,
            ml_issue_subcategory
        ) VALUES %s
        ON CONFLICT (company_id, review_id) DO UPDATE SET
            ml_sentiment         = COALESCE(ratings.reviews_ml_audit.ml_sentiment,         EXCLUDED.ml_sentiment),
            ml_issue             = COALESCE(ratings.reviews_ml_audit.ml_issue,             EXCLUDED.ml_issue),
            ml_issue_category    = COALESCE(ratings.reviews_ml_audit.ml_issue_category,    EXCLUDED.ml_issue_category),
            ml_issue_subcategory = COALESCE(ratings.reviews_ml_audit.ml_issue_subcategory, EXCLUDED.ml_issue_subcategory),
            ml_confidence_score  = GREATEST(ratings.reviews_ml_audit.ml_confidence_score,  EXCLUDED.ml_confidence_score),
            ml_reasoning         = EXCLUDED.ml_reasoning,
            audit_date           = NOW()
    """

    with read_conn.cursor() as cur:
        cur.execute(pending_sql, (company_id,))
        total_remaining = cur.fetchone()[0]

    logging.info("Targeting %s reviews requiring ML audit backfill", total_remaining)
    if total_remaining == 0:
        logging.info("Nothing to backfill.")
        return

    processed = 0
    batch = []

    with read_conn.cursor(name="fetch_ml_reviews_cursor") as cur:
        cur.itersize = BATCH_SIZE
        cur.execute(fetch_sql, (company_id,))

        for review_id, text, product_name, rating, original_sentiment, original_issue in cur:
            text = text or ""
            # NULL user rating is genuinely unknown — don't fabricate "3.0", which
            # both biased the rules classifier toward neutral AND wrote a fake
            # original_user_rating into the audit table.
            rating_for_classifier = float(rating) if rating is not None else None
            rating_for_audit = float(rating) if rating is not None else None

            ml_sentiment, _, _ = analyze_sentiment_local(text)
            issue_category, issue_subcategory, confidence, reasoning = classify_review(
                text=text,
                product_name=product_name or "",
                rating=rating_for_classifier if rating_for_classifier is not None else 3.0,
                provider="rules",
            )

            batch.append((
                str(review_id),
                company_id,
                product_name or "",
                text,
                rating_for_audit,
                original_sentiment,
                original_issue,
                ml_sentiment,
                issue_subcategory,
                confidence,
                reasoning,
                None,
                issue_category,
                issue_subcategory,
            ))

            if len(batch) >= BATCH_SIZE:
                with write_conn.cursor() as update_cur:
                    execute_values(update_cur, insert_sql, batch, page_size=500)
                    write_conn.commit()
                processed += len(batch)
                logging.info("Backfilled ML audit rows for %s reviews", processed)
                batch = []

    if batch:
        with write_conn.cursor() as update_cur:
            execute_values(update_cur, insert_sql, batch, page_size=500)
            write_conn.commit()
        processed += len(batch)
        logging.info("Backfilled ML audit rows for %s total reviews", processed)

    read_conn.close()
    write_conn.close()
    logging.info("ML backfill completed successfully.")


if __name__ == "__main__":
    main()
