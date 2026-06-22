/**
 * MySQL -> PostgreSQL Review Sync
 *
 * Source: rb_crawl_review_info  (raw crawl dump — NO indexes, review_info_id is
 *         all zeros, so neither OFFSET nor keyset pagination is viable)
 * Target: ratings.reviews
 *
 * Strategy:
 * - single streaming full-table scan of the source (bounded memory, no O(n^2)
 *   OFFSET re-scans, MySQL connection stays actively reading so it can't idle-drop)
 * - accumulate rows into chunks; per chunk: dedupe in-memory, then batched
 *   multi-row UPSERT/INSERT to Postgres (one round-trip per ~500 rows, not per row)
 * - cross-chunk dedupe: ON CONFLICT for review-id rows, an in-memory key Set for
 *   blank-id rows (same model the original per-batch version relied on)
 *
 * Rules:
 * - review_external_id is canonical when present
 * - blank review ids dedupe by platform + web_pid + reviewer + review_date + rating + normalized text/title
 * - invalid legacy review dates are nulled out and excluded from time-window analytics later
 * - within a chunk, latest incoming row wins based on created_time, then richer text
 */
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
require('dotenv').config();

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

const pgPool = new Pool({
    host: requireEnv('DB_HOST'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    max: 5,
});

const COMPANY_ID = requireEnv('COMPANY_ID');
const MYSQL_CONFIG = {
    host: requireEnv('PRESTIGE_MYSQL_HOST'),
    port: parseInt(requireEnv('PRESTIGE_MYSQL_PORT'), 10),
    user: requireEnv('PRESTIGE_MYSQL_USER'),
    password: requireEnv('PRESTIGE_MYSQL_PASSWORD'),
    database: requireEnv('PRESTIGE_MYSQL_DATABASE'),
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
};

const CHUNK_SIZE = 4000;   // stream rows accumulated before a processing pass
const PG_BATCH = 1000;     // rows per multi-row INSERT statement (bigger = fewer round-trips; 1000 * 13 cols = 13k params, well under PG's 65535 limit)
const PF_MAP = { 1: 'amazon', 5: 'flipkart', 2: 'blinkit', 3: 'zepto', 4: 'instamart' };

function cleanString(value) {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).trim();
    if (!cleaned || cleaned === '0' || cleaned === '\\N' || cleaned === '\\\\N') return null;
    return cleaned;
}

// Mirror of sync_mysql_master.cjs canonicalizeCategory — keeps category writes
// in ratings.reviews consistent with masters.products. Without this, the same
// product can produce 'others' on one platform and 'Others' on another.
function canonicalizeCategory(value) {
    const cleaned = cleanString(value);
    if (!cleaned) return null;
    const normalized = cleaned.replace(/\s+/g, ' ');
    const lower = normalized.toLowerCase();
    const CANONICAL = { 'others': 'Others', 'other': 'Others', 'misc': 'Others', 'miscellaneous': 'Others' };
    if (CANONICAL[lower]) return CANONICAL[lower];
    return normalized.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(' ');
}

function normalizeReviewId(value) {
    const cleaned = cleanString(value);
    return cleaned ? cleaned.toLowerCase() : null;
}

function normalizeText(value) {
    return (cleanString(value) || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const min = new Date('2005-01-01T00:00:00Z');
    const max = new Date();
    max.setDate(max.getDate() + 1);
    if (date < min || date > max) return null;

    return date.toISOString().slice(0, 10);
}

function normalizeTimestamp(value) {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function buildBlankReviewKey({ platform, webPid, reviewerName, reviewDate, rating, title, text }) {
    return [
        platform || '',
        webPid || '',
        normalizeText(reviewerName),
        reviewDate || '',
        rating ?? '',
        normalizeText(title),
        normalizeText(text),
    ].join('|');
}

function textRichnessScore(title, text) {
    return normalizeText(title).length + (normalizeText(text).length * 2);
}

function pickPreferred(existing, incoming) {
    if (!existing) return incoming;

    const existingTs = normalizeTimestamp(existing.createdTime);
    const incomingTs = normalizeTimestamp(incoming.createdTime);
    if (incomingTs !== existingTs) {
        return incomingTs > existingTs ? incoming : existing;
    }

    const existingRichness = textRichnessScore(existing.reviewTitle, existing.reviewText);
    const incomingRichness = textRichnessScore(incoming.reviewTitle, incoming.reviewText);
    if (incomingRichness !== existingRichness) {
        return incomingRichness > existingRichness ? incoming : existing;
    }

    if (!!incoming.hasMasterLink !== !!existing.hasMasterLink) {
        return incoming.hasMasterLink ? incoming : existing;
    }

    return existing;
}

// 14-column UPSERT for review-id rows. ON CONFLICT handles cross-chunk dedupe.
// category_source = 'sync' marks the value as coming from the MySQL crawl;
// the ON CONFLICT branch preserves user edits (category_source = 'user').
const ID_COLS = 14;
function buildIdUpsert(candidates) {
    const valuesSql = candidates
        .map((_, i) => {
            const b = i * ID_COLS;
            return `(${Array.from({ length: ID_COLS }, (_, j) => `$${b + j + 1}`).join(',')})`;
        })
        .join(',');
    const params = [];
    for (const c of candidates) {
        params.push(
            COMPANY_ID, c.webPid, c.productName, c.brand, c.platform,
            c.category, c.isCompetitor, c.reviewId, c.reviewerName, c.rating,
            c.reviewTitle, c.reviewText, c.reviewDate, 'sync'
        );
    }
    const sql = `
        INSERT INTO ratings.reviews (
            company_id, web_pid, product_name, brand, platform,
            category, is_competitor, review_external_id,
            reviewer_name, rating, review_title, review_text, review_date,
            category_source
        ) VALUES ${valuesSql}
        ON CONFLICT (company_id, platform, review_external_id) DO UPDATE
        SET
            web_pid = EXCLUDED.web_pid,
            product_name = EXCLUDED.product_name,
            brand = COALESCE(EXCLUDED.brand, ratings.reviews.brand),
            -- Master is authoritative for category. If the master moved a SKU
            -- from "Induction Cooktop" to "Cookware" (real bug we hit: Kadais
            -- with "Induction Compatible" in the name landed under Induction),
            -- the next sync overwrites the stale review.category — UNLESS the
            -- user explicitly edited it (category_source='user').
            category = CASE
                WHEN ratings.reviews.category_source = 'user' THEN ratings.reviews.category
                WHEN EXCLUDED.category IS NOT NULL THEN EXCLUDED.category
                ELSE ratings.reviews.category
            END,
            category_source = CASE
                WHEN ratings.reviews.category_source = 'user' THEN 'user'
                WHEN EXCLUDED.category IS NOT NULL THEN 'sync'
                ELSE ratings.reviews.category_source
            END,
            is_competitor = EXCLUDED.is_competitor,
            reviewer_name = COALESCE(EXCLUDED.reviewer_name, ratings.reviews.reviewer_name),
            rating = COALESCE(EXCLUDED.rating, ratings.reviews.rating),
            review_title = CASE
                WHEN LENGTH(COALESCE(EXCLUDED.review_title, '')) >= LENGTH(COALESCE(ratings.reviews.review_title, ''))
                    THEN EXCLUDED.review_title ELSE ratings.reviews.review_title END,
            review_text = CASE
                WHEN LENGTH(COALESCE(EXCLUDED.review_text, '')) >= LENGTH(COALESCE(ratings.reviews.review_text, ''))
                    THEN EXCLUDED.review_text ELSE ratings.reviews.review_text END,
            review_date = COALESCE(EXCLUDED.review_date, ratings.reviews.review_date),
            updated_at = NOW()
    `;
    return { sql, params };
}

// 13-column plain INSERT for blank-id rows (dedupe handled by the key Set).
const BLANK_COLS = 13;
function buildBlankInsert(candidates) {
    const valuesSql = candidates
        .map((_, i) => {
            const b = i * BLANK_COLS;
            return `(${Array.from({ length: BLANK_COLS }, (_, j) => `$${b + j + 1}`).join(',')})`;
        })
        .join(',');
    const params = [];
    for (const c of candidates) {
        params.push(
            COMPANY_ID, c.webPid, c.productName, c.brand, c.platform,
            c.category, c.isCompetitor, c.reviewerName, c.rating,
            c.reviewTitle, c.reviewText, c.reviewDate, 'sync'
        );
    }
    const sql = `
        INSERT INTO ratings.reviews (
            company_id, web_pid, product_name, brand, platform,
            category, is_competitor, reviewer_name, rating, review_title, review_text, review_date,
            category_source
        ) VALUES ${valuesSql}
    `;
    return { sql, params };
}

async function main() {
    console.log('=== MySQL -> PostgreSQL REVIEW Sync ===\n');

    const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    console.log('Connected to MySQL');

    const { rows: pgProducts } = await pgPool.query(`
        SELECT product_external_id, product_name, brand_name, platform, category, is_competitor
        FROM masters.products
        WHERE company_id = $1
    `, [COMPANY_ID]);

    const productLookup = new Map();
    const simpleLookup = new Map();
    for (const product of pgProducts) {
        productLookup.set(`${product.product_external_id}|${product.platform}`, product);
        if (!simpleLookup.has(product.product_external_id)) {
            simpleLookup.set(product.product_external_id, product);
        }
    }
    console.log(`Loaded ${pgProducts.length} product references`);

    const { rows: existingIdRows } = await pgPool.query(`
        SELECT review_external_id
        FROM ratings.reviews
        WHERE company_id = $1 AND review_external_id IS NOT NULL
    `, [COMPANY_ID]);
    const existingIds = new Set(existingIdRows.map(row => String(row.review_external_id).toLowerCase()));

    const { rows: existingBlankRows } = await pgPool.query(`
        SELECT platform, web_pid, reviewer_name, review_date, rating, review_title, review_text
        FROM ratings.reviews
        WHERE company_id = $1 AND review_external_id IS NULL
    `, [COMPANY_ID]);
    const existingBlankKeys = new Set(
        existingBlankRows.map(row => buildBlankReviewKey({
            platform: row.platform,
            webPid: row.web_pid,
            reviewerName: row.reviewer_name,
            reviewDate: row.review_date ? new Date(row.review_date).toISOString().slice(0, 10) : null,
            rating: row.rating,
            title: row.review_title,
            text: row.review_text,
        }))
    );
    console.log(`Existing: ${existingIds.size} id-reviews, ${existingBlankKeys.size} blank-reviews`);

    let totalRows = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalUpdatedIds = 0;

    function toCandidate(row) {
        const webPid = cleanString(row.web_pid);
        if (!webPid) return null;

        const platform = PF_MAP[row.pf_id] || 'amazon';
        const product = productLookup.get(`${webPid}|${platform}`) || simpleLookup.get(webPid);

        const reviewId = normalizeReviewId(row.web_review_ID);
        const reviewDate = normalizeDate(row.review_time);
        const createdTime = row.created_time || row.review_time || null;
        const reviewTitle = cleanString(row.content_1);
        const reviewText = cleanString(row.content_2) || cleanString(row.content_3);
        // The crawl source uses star_rating = 0 as a sentinel for "couldn't parse
        // a rating from the page". Treat 0 (and any out-of-range value) as NULL —
        // 0 is not a real rating and pollutes every AVG/distribution calculation.
        const ratingRaw = row.star_rating === null || row.star_rating === undefined ? null : Number(row.star_rating);
        const rating = (ratingRaw != null && Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5)
            ? ratingRaw
            : null;
        const reviewerName = cleanString(row.reviewed_by);

        if (!reviewTitle && !reviewText) return null;
        if (!reviewDate && !createdTime) return null;

        return {
            webPid,
            platform,
            reviewId,
            reviewDate,
            createdTime,
            reviewTitle,
            reviewText,
            rating,
            reviewerName,
            productName: product?.product_name || webPid,
            brand: product?.brand_name || null,
            category: canonicalizeCategory(product?.category),
            isCompetitor: !!product?.is_competitor,
            hasMasterLink: !!product,
        };
    }

    async function processChunk(rows) {
        // Within-chunk dedupe (also prevents a duplicate conflict key inside one
        // multi-row ON CONFLICT statement, which Postgres rejects).
        const deduped = new Map();
        for (const row of rows) {
            const candidate = toCandidate(row);
            if (!candidate) continue;
            const dedupeKey = candidate.reviewId || buildBlankReviewKey({
                platform: candidate.platform,
                webPid: candidate.webPid,
                reviewerName: candidate.reviewerName,
                reviewDate: candidate.reviewDate,
                rating: candidate.rating,
                title: candidate.reviewTitle,
                text: candidate.reviewText,
            });
            deduped.set(dedupeKey, pickPreferred(deduped.get(dedupeKey), candidate));
        }

        const idCands = [];
        const blankCands = [];
        for (const c of deduped.values()) {
            if (c.reviewId) {
                if (existingIds.has(c.reviewId)) totalUpdatedIds++;
                else totalInserted++;
                existingIds.add(c.reviewId);
                idCands.push(c);
            } else {
                const blankKey = buildBlankReviewKey({
                    platform: c.platform,
                    webPid: c.webPid,
                    reviewerName: c.reviewerName,
                    reviewDate: c.reviewDate,
                    rating: c.rating,
                    title: c.reviewTitle,
                    text: c.reviewText,
                });
                if (existingBlankKeys.has(blankKey)) {
                    totalSkipped++;
                    continue;
                }
                existingBlankKeys.add(blankKey);
                blankCands.push(c);
                totalInserted++;
            }
        }

        for (let i = 0; i < idCands.length; i += PG_BATCH) {
            const { sql, params } = buildIdUpsert(idCands.slice(i, i + PG_BATCH));
            await pgPool.query(sql, params);
        }
        for (let i = 0; i < blankCands.length; i += PG_BATCH) {
            const { sql, params } = buildBlankInsert(blankCands.slice(i, i + PG_BATCH));
            await pgPool.query(sql, params);
        }
    }

    // Single streaming full-table scan — the only efficient read for this
    // index-less table. mysql2/promise exposes the core connection for streaming.
    const stream = mysqlConn.connection
        .query(`
            SELECT web_pid, pf_id, star_rating, content_1, content_2, content_3,
                   review_time, web_review_ID, reviewed_by, review_type, helpful_count, created_time
            FROM rb_crawl_review_info
        `)
        .stream();

    let chunk = [];
    for await (const row of stream) {
        chunk.push(row);
        totalRows++;
        if (chunk.length >= CHUNK_SIZE) {
            await processChunk(chunk);
            chunk = [];
            console.log(`Processed ${totalRows} source rows...`);
        }
    }
    if (chunk.length) {
        await processChunk(chunk);
        console.log(`Processed ${totalRows} source rows...`);
    }

    console.log('\nReview sync complete');
    console.log(`Source rows scanned: ${totalRows}`);
    console.log(`Inserted/updated candidate rows: ${totalInserted + totalUpdatedIds}`);
    console.log(`Updated existing review-id rows: ${totalUpdatedIds}`);
    console.log(`Skipped duplicate blank-id rows: ${totalSkipped}`);

    await mysqlConn.end();
    await pgPool.end();
}

main().catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
});
