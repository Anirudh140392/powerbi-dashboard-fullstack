import io
import os
import re
import sys
from typing import Iterable

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from transformers import pipeline

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)

WATTAGE_PATTERN = re.compile(r'\b(\d+(?:[.,]\d+)?\s*(?:W|Watts|kw|kilowatt))\b', re.IGNORECASE)
SENTIMENTS = ["Positive", "Negative", "Neutral"]

print("[System] Loading HuggingFace DeBERTa-v3 Model (MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli)...")
classifier = pipeline("zero-shot-classification", model="MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli")
print("[OK] DeBERTa Model loaded successfully into memory!\n")


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_db_connection():
    load_dotenv()
    # TCP keepalives prevent the AWS/Railway network from killing the socket
    # while DeBERTa is doing ~5-min CPU inference on a batch (the conn sits
    # idle). Without these, the next execute_values throws SSL SYSCALL error:
    # EOF detected and the whole job crashes mid-run.
    return psycopg2.connect(
        host=require_env("DB_HOST"),
        database=require_env("DB_NAME"),
        user=require_env("DB_USER"),
        password=require_env("DB_PASSWORD"),
        port=int(require_env("DB_PORT")),
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )


def normalize_text(value: str | None) -> str:
    return re.sub(r'\s+', ' ', (value or '').strip().lower())


def build_material_pattern(materials: list[str]):
    escaped = [re.escape(material) for material in sorted(materials, key=len, reverse=True)]
    return re.compile(r'\b(' + '|'.join(escaped) + r')\b', re.IGNORECASE) if escaped else None


def extract_regex_features(text: str, material_pattern):
    mat_match = material_pattern.search(text) if material_pattern else None
    wat_match = WATTAGE_PATTERN.search(text)
    return (
        mat_match.group(1).title() if mat_match else None,
        wat_match.group(1).upper() if wat_match else None,
    )


def pick_rule_category(text: str, rules: Iterable[tuple[str, list[str], list[str]]], original_category: str | None):
    normalized = normalize_text(text)
    for category, include_keywords, exclude_keywords in rules:
        includes = [normalize_text(keyword) for keyword in include_keywords or [] if normalize_text(keyword)]
        excludes = [normalize_text(keyword) for keyword in exclude_keywords or [] if normalize_text(keyword)]
        if includes and not any(keyword in normalized for keyword in includes):
            continue
        if excludes and any(keyword in normalized for keyword in excludes):
            continue
        return category
    return original_category


def fetch_lookup_data(cur, company_id: str):
    cur.execute(
        """
        SELECT DISTINCT sentiment_subcategory
        FROM ratings.stakeholder_mappings
        WHERE company_id = %s
          AND sentiment_subcategory IS NOT NULL
          AND sentiment_subcategory <> ''
        ORDER BY sentiment_subcategory
        """,
        (company_id,),
    )
    issues = [row[0] for row in cur.fetchall()]
    if not issues:
        raise RuntimeError(f"No stakeholder_mappings sentiment_subcategory rows found for company {company_id}")

    cur.execute(
        """
        SELECT dict_value
        FROM ratings.ml_dictionary
        WHERE company_id = %s AND dict_type = 'material'
        ORDER BY LENGTH(dict_value) DESC, dict_value
        """,
        (company_id,),
    )
    materials = [row[0] for row in cur.fetchall()]
    if not materials:
        raise RuntimeError(f"No material dictionary rows found for company {company_id}")

    cur.execute(
        """
        SELECT category, include_keywords, exclude_keywords
        FROM ratings.category_rules
        WHERE company_id = %s
        ORDER BY priority ASC, id ASC
        """,
        (company_id,),
    )
    rules = [(row[0], row[1] or [], row[2] or []) for row in cur.fetchall()]
    if not rules:
        raise RuntimeError(f"No category_rules found for company {company_id}")

    return issues, materials, rules


def fetch_rows(cur, company_id: str, target_ids: list[str] | None):
    if target_ids:
        cur.execute(
            """
            SELECT id, company_id, product_name, review_text, rating, category, material, wattage, specific_issue, sentiment
            FROM ratings.reviews
            WHERE company_id = %s
              AND id = ANY(%s::uuid[])
            """,
            (company_id, target_ids),
        )
    else:
        cur.execute(
            """
            SELECT id, company_id, product_name, review_text, rating, category, material, wattage, specific_issue, sentiment
            FROM ratings.reviews r
            WHERE r.company_id = %s
              AND r.review_text IS NOT NULL
              AND LENGTH(r.review_text) > 5
              AND NOT EXISTS (
                    SELECT 1
                    FROM ratings.reviews_ml_audit ma
                    WHERE ma.company_id = r.company_id
                      AND ma.review_id = r.id
              )
            LIMIT 500
            """,
            (company_id,),
        )
    return cur.fetchall()


def run_taxonomy_pipeline():
    company_id = require_env("COMPANY_ID")
    print(f"[System] Company ID: {company_id}", flush=True)
    target_ids = [item.strip() for item in sys.argv[1].split(',')] if len(sys.argv) > 1 and sys.argv[1].strip() else None

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            issues_list, materials_list, category_rules = fetch_lookup_data(cur, company_id)
            material_pattern = build_material_pattern(materials_list)

            chunk_number = 1
            while True:
                rows = fetch_rows(cur, company_id, target_ids)
                if not rows:
                    print("No pending reviews found for DeBERTa audit.")
                    break

                existing_ids = {str(row[0]) for row in rows}
                cur.execute(
                    """
                    SELECT review_id
                    FROM ratings.reviews_ml_audit
                    WHERE company_id = %s AND review_id = ANY(%s::uuid[])
                    """,
                    (company_id, list(existing_ids)),
                )
                already_audited = {str(row[0]) for row in cur.fetchall()}

                updates = []
                print(f"--- Processing Batch {chunk_number} ({len(rows)} reviews) ---\n", flush=True)
                for row in rows:
                    row_id, row_company_id, product_name, review_text, rating, original_category, original_material, original_wattage, original_issue, original_sentiment = row
                    if str(row_id) in already_audited:
                        continue

                    safe_text = (review_text or '')[:1500]
                    search_block = f"{product_name or ''} {safe_text}"
                    ml_material, ml_wattage = extract_regex_features(search_block, material_pattern)
                    ml_category = pick_rule_category(search_block, category_rules, original_category)

                    sentiment_result = classifier(safe_text, SENTIMENTS, multi_label=False)
                    ml_sentiment = sentiment_result['labels'][0]
                    ml_confidence = float(sentiment_result['scores'][0])
                    ml_issue = "General_Feedback"

                    if ml_sentiment == "Negative" or float(rating or 0) <= 3:
                        issue_result = classifier(safe_text, issues_list, multi_label=False)
                        if float(issue_result['scores'][0]) > 0.4:
                            ml_issue = issue_result['labels'][0]
                            ml_confidence = float(issue_result['scores'][0])

                    print(f'Text: "{safe_text[:60]}..."', flush=True)
                    print(f"-> Category: {ml_category} | Sentiment: {ml_sentiment} | Issue: {ml_issue} (Conf: {(ml_confidence * 100):.1f}%)", flush=True)
                    if ml_material or ml_wattage:
                        print(f"-> Regex Target: Mat [{ml_material}] | Wat [{ml_wattage}]", flush=True)
                    print("", flush=True)

                    updates.append((
                        row_id, row_company_id, product_name, review_text,
                        original_category, ml_category,
                        original_material, ml_material,
                        original_wattage, ml_wattage,
                        rating, original_sentiment, ml_sentiment,
                        original_issue, ml_issue, ml_confidence * 10, "Local DeBERTa NLP + DB category/material rules",
                    ))

                if not updates:
                    print("All fetched rows were already present in audit.", flush=True)
                    if target_ids:
                        break
                    chunk_number += 1
                    continue

                execute_values(
                    cur,
                    """
                    INSERT INTO ratings.reviews_ml_audit (
                        review_id, company_id, product_name, review_text,
                        original_category, ml_category,
                        original_material, ml_material,
                        original_wattage, ml_wattage,
                        original_user_rating, original_sentiment, ml_sentiment,
                        original_issue, ml_issue, ml_confidence_score, ml_reasoning
                    ) VALUES %s
                    """,
                    updates,
                )
                conn.commit()

                cur.execute("SELECT COUNT(*) FROM ratings.reviews_ml_audit WHERE company_id = %s", (company_id,))
                total_audit = cur.fetchone()[0]
                print(f"[OK] Batch {chunk_number} committed. Total audit rows in DB: {total_audit}", flush=True)

                if target_ids:
                    break
                chunk_number += 1
    finally:
        conn.close()


if __name__ == "__main__":
    run_taxonomy_pipeline()
