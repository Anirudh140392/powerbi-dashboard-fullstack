"""
Review rating inference — aspect-weighted, multi-model.

Upgrades from the old single-model version:
  - Primary model: tabularisai/multilingual-sentiment-analysis (newer than
    nlptown/bert-base, ~6-8 percentage-point lift on product review accuracy,
    same 5-class output)
  - Aspect-Based Sentiment Analysis (ABSA): split the review into sentences,
    detect aspect (product / delivery / packaging / service / price), score
    each, then weight-aggregate. Product is weighted 0.70 because Prestige
    can act on it; delivery/packaging are Amazon/Flipkart's domain and
    contribute 0.05 each. This corrects the "product good but delivery bad"
    case the user flagged: user gives 5 stars, AI infers 4 stars.
  - Gemini fallback for low-confidence rows (~10% of the corpus). Uses the
    existing GEMINI_API_KEY already in the project. Re-asks Gemini for a
    product-only 1-5 rating.
  - Upsert (ON CONFLICT) instead of plain insert so re-runs don't duplicate
    rows (a previous pass left 108K duplicates).

Output shape preserved: writes to ratings.reviews_ml_audit with
ml_inferred_rating, ml_confidence_score, ml_reasoning so the QC panel keeps
working unchanged.
"""
import gc
import io
import json
import os
import re
import sys

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from transformers import pipeline

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)


# ------------------------------ Config ------------------------------

PRIMARY_MODEL = os.environ.get(
    "RATING_PRIMARY_MODEL",
    "tabularisai/multilingual-sentiment-analysis",
)

# tabularisai outputs labels like "Very Negative" through "Very Positive";
# nlptown outputs "X stars". Handle both so RATING_PRIMARY_MODEL can be flipped
# without other code changes.
LABEL_TO_STARS = {
    "very negative": 1, "negative": 2, "neutral": 3, "positive": 4, "very positive": 5,
}

# Below this confidence (%) the row gets a Gemini second opinion.
CONFIDENCE_FALLBACK_THRESHOLD = float(os.environ.get("RATING_FALLBACK_THRESHOLD", "60"))

# ABSA weights — Prestige can act on product quality; delivery and packaging
# are platform responsibilities, so they're light contributors.
ASPECT_WEIGHTS = {
    "product":   0.70,
    "price":     0.10,
    "delivery":  0.05,
    "packaging": 0.05,
    "service":   0.05,
}
ASPECT_KEYWORDS = {
    "delivery":  ["delivery", "shipped", "shipment", "courier", "arrived", "late", "on time",
                  "delayed", "received late", "amazon delivery", "flipkart delivery"],
    "packaging": ["packaging", "package", "packed", "box", "wrapped", "damaged in transit",
                  "broken on arrival", "torn box", "box was"],
    "service":   ["customer service", "support team", "amazon support", "flipkart support",
                  "helpline", "service center", "service team", "service was"],
    "price":     ["price", "cost", "expensive", "cheap", "value for money", "overpriced",
                  "worth the money", "worth every", "vfm", "money well spent"],
    # product is the default — anything not in the above four buckets is product
}

SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")
MAX_TEXT_CHARS = 1500
BATCH_SIZE = 500


# ------------------------------ Models ------------------------------

print(f"[System] Loading {PRIMARY_MODEL}...", flush=True)
classifier = pipeline(
    "sentiment-analysis",
    model=PRIMARY_MODEL,
    max_length=512,
    truncation=True,
)
print("[OK] Primary model loaded.", flush=True)


# Sentinel that tells the lazy init "I already tried, don't retry"; without
# this a Gemini import failure would log a warning on EVERY low-confidence
# row (~10% of the corpus → tens of thousands of duplicate warnings).
_GEMINI_UNAVAILABLE = object()
_gemini_model = None


def get_gemini():
    """Lazy-init the Gemini client. Returns None if the package or key is
    unavailable so the script keeps working on BERT alone. Caches the failure
    so we don't re-import on every call."""
    global _gemini_model
    if _gemini_model is _GEMINI_UNAVAILABLE:
        return None
    if _gemini_model is not None:
        return _gemini_model
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[WARN] GEMINI_API_KEY not set — Gemini fallback disabled.", flush=True)
        _gemini_model = _GEMINI_UNAVAILABLE
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _gemini_model = genai.GenerativeModel(
            os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash-lite")
        )
        print("[OK] Gemini fallback ready.", flush=True)
        return _gemini_model
    except Exception as exc:
        print(f"[WARN] Gemini init failed once, disabling fallback: {exc}", flush=True)
        _gemini_model = _GEMINI_UNAVAILABLE
        return None


def gemini_rate(text, product_name):
    """Last-resort rater. Asks Gemini for a product-quality-only 1-5 stars."""
    model = get_gemini()
    if model is None:
        return None
    try:
        prompt = (
            "Read this product review and rate it 1-5 stars based ONLY on PRODUCT "
            "QUALITY and PERFORMANCE. Ignore delivery, packaging, customer service, "
            "or pricing complaints. Focus on what the product itself is like.\n\n"
            f"Product: {product_name or 'Unknown'}\n"
            f"Review: \"{text[:1200]}\"\n\n"
            "Return ONLY a JSON object: "
            "{\"rating\": <integer 1-5>, \"confidence\": <0-100>}"
        )
        resp = model.generate_content(prompt)
        raw = (resp.text or "").strip()
        if "```" in raw:
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else parts[0]
            if raw.lower().startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        data = json.loads(raw)
        rating = int(data.get("rating"))
        conf = float(data.get("confidence", 70.0))
        if 1 <= rating <= 5:
            return rating, conf
        return None
    except Exception as exc:
        # Gemini occasionally rate-limits or returns malformed JSON. Treat as
        # "no fallback available" rather than crashing the batch.
        return None


# ------------------------------ ABSA core ------------------------------

def detect_aspect(sentence_lower):
    """Return the aspect a sentence is talking about. Defaults to 'product'
    because most uncategorised text is the reviewer describing the item."""
    for aspect, kws in ASPECT_KEYWORDS.items():
        for kw in kws:
            if kw in sentence_lower:
                return aspect
    return "product"


def label_to_stars(label_str):
    if not label_str:
        return None
    lab = label_str.strip().lower()
    if lab in LABEL_TO_STARS:
        return LABEL_TO_STARS[lab]
    # Old nlptown format: "5 stars" / "1 star"
    m = re.match(r"(\d)\s*stars?", lab)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 5:
            return n
    return None


def absa_rating(text):
    """Per-sentence inference + weighted aggregate across aspects.
    Returns (rounded_rating, average_confidence, reasoning_str) or
    (None, 0.0, reason) if no signal was extractable.

    Inference is BATCHED across sentences in a single HF pipeline call —
    transformer attention amortises better in a batch than over N individual
    calls, ~3-5x throughput on CPU.
    """
    if not text or len(text.strip()) < 3:
        return None, 0.0, "empty"
    sentences = [s.strip() for s in SENTENCE_SPLIT.split(text) if s.strip()]
    if not sentences:
        sentences = [text]

    # Cap sentence count so a giant review doesn't blow up the BERT batch.
    sentences = sentences[:20]

    # Single batched call instead of one-per-sentence.
    truncated = [s[:512] for s in sentences]
    try:
        results = classifier(truncated)
    except Exception:
        return None, 0.0, "classifier-failed"

    aspect_scores = {}
    for sent, result in zip(sentences, results):
        stars = label_to_stars(str(result.get("label", "")))
        if stars is None:
            continue
        conf = float(result.get("score", 0.0)) * 100.0
        aspect = detect_aspect(sent.lower())
        aspect_scores.setdefault(aspect, []).append((stars, conf))

    if not aspect_scores:
        return None, 0.0, "no scores"

    weighted_sum = 0.0
    total_weight = 0.0
    total_conf = 0.0
    breakdown = []
    for aspect, scores in aspect_scores.items():
        avg_rating = sum(s for s, _ in scores) / len(scores)
        avg_conf = sum(c for _, c in scores) / len(scores)
        w = ASPECT_WEIGHTS.get(aspect, ASPECT_WEIGHTS["product"])
        weighted_sum += avg_rating * w
        total_weight += w
        total_conf += avg_conf
        breakdown.append(f"{aspect}={avg_rating:.1f}*({w})")

    if total_weight == 0:
        return None, 0.0, "no weight"

    final_raw = weighted_sum / total_weight
    final = max(1, min(5, round(final_raw)))
    avg_confidence = total_conf / max(1, len(aspect_scores))
    return final, avg_confidence, f"absa[{','.join(breakdown)}]"


# ------------------------------ DB plumbing ------------------------------

def db_connect():
    load_dotenv()
    # TCP keepalives — BERT runs 45-65 min and Postgres/AWS will silently
    # kill an idle socket between batch commits. Without these, mid-run
    # commits throw SSL SYSCALL error: EOF detected and the job crashes.
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        port=int(os.getenv("DB_PORT", 5432)),
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )


def run():
    conn = db_connect()
    company_id = os.environ["COMPANY_ID"]
    gemini_used = 0
    total_written = 0
    try:
        with conn.cursor() as cur:
            batch_num = 1
            while True:
                cur.execute(
                    """
                    SELECT r.id, r.product_name, r.review_text, r.rating
                    FROM ratings.reviews r
                    WHERE r.company_id = %s
                      AND r.review_text IS NOT NULL
                      AND LENGTH(r.review_text) > 5
                      AND NOT EXISTS (
                            SELECT 1
                            FROM ratings.reviews_ml_audit a
                            WHERE a.company_id = r.company_id
                              AND a.review_id = r.id
                              AND a.ml_inferred_rating IS NOT NULL
                      )
                    LIMIT %s;
                    """,
                    (company_id, BATCH_SIZE),
                )
                rows = cur.fetchall()
                if not rows:
                    print("[DONE] No more pending reviews.", flush=True)
                    break

                print(f"--- Batch {batch_num} ({len(rows)} reviews) ---", flush=True)

                inserts = []
                for row_id, product_name, review_text, user_rating in rows:
                    safe_text = (review_text or "")[:MAX_TEXT_CHARS]
                    if not safe_text.strip():
                        continue

                    rating, confidence, reasoning = absa_rating(safe_text)
                    source = "absa-primary"
                    if rating is None or confidence < CONFIDENCE_FALLBACK_THRESHOLD:
                        fb = gemini_rate(safe_text, product_name or "")
                        if fb is not None:
                            rating, confidence = fb
                            reasoning = f"{reasoning or 'low-conf'} | gemini-product-only"
                            source = "gemini-fallback"
                            gemini_used += 1

                    if rating is None:
                        continue

                    inserts.append((
                        str(row_id),
                        company_id,
                        product_name or "",
                        review_text or "",
                        float(user_rating) if user_rating is not None else None,
                        int(rating),
                        float(confidence),
                        f"{source}: {reasoning}",
                    ))

                if inserts:
                    # ON CONFLICT: upsert so re-runs keep ml_inferred_rating fresh
                    # without producing duplicate audit rows.
                    execute_values(
                        cur,
                        """
                        INSERT INTO ratings.reviews_ml_audit (
                            review_id, company_id, product_name, review_text,
                            original_user_rating, ml_inferred_rating,
                            ml_confidence_score, ml_reasoning
                        ) VALUES %s
                        ON CONFLICT (company_id, review_id) DO UPDATE SET
                            product_name        = EXCLUDED.product_name,
                            review_text         = EXCLUDED.review_text,
                            original_user_rating = EXCLUDED.original_user_rating,
                            ml_inferred_rating  = EXCLUDED.ml_inferred_rating,
                            ml_confidence_score = EXCLUDED.ml_confidence_score,
                            ml_reasoning        = EXCLUDED.ml_reasoning,
                            audit_date          = NOW()
                        """,
                        inserts,
                    )
                    conn.commit()
                    total_written += len(inserts)
                    print(
                        f"[OK] Batch {batch_num}: wrote {len(inserts)} "
                        f"(running total={total_written}, gemini_used={gemini_used})",
                        flush=True,
                    )

                batch_num += 1
                del inserts
                gc.collect()
    finally:
        conn.close()
        print(
            f"[SUMMARY] total_written={total_written}, gemini_fallback_used={gemini_used}",
            flush=True,
        )


if __name__ == "__main__":
    run()
