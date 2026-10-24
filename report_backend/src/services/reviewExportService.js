// Review Rating Data export query (Report Builder → "Review Rating Data").
// Mirror of buildReviewOlapExportQuery in backend/src/services/reviewExportService.js —
// report_backend is deployed separately, so keep both copies in sync.

/**
 * Review OLAP table behind the Review Rating page (trailytics_ratings).
 * Most accounts use rb_review_olap; Marico databases use rb_reviews_olap.
 */
export const REVIEW_OLAP_TABLES = ['rb_review_olap', 'rb_reviews_olap'];

// Report Builder platform ids vs review table names, compared without spaces / punctuation
const reviewPlatformKey = (p) => p.toLowerCase().replace(/[^a-z0-9]/g, '');

const toSqlList = (value) => (typeof value === 'string' ? value.split(',') : (value || []))
    .map(v => v.trim().toLowerCase().replace(/\\/g, '\\\\').replace(/'/g, "\\'"))
    .filter(v => v && v !== 'all' && !v.startsWith('all '));

/**
 * Builds the Review Rating Data export query — one row per review (own + competitor SKUs).
 * startDate / endDate must already be validated as YYYY-MM-DD.
 */
export const buildReviewOlapExportQuery = ({ table, platform, brand, category, startDate, endDate }) => {
    const conds = [`o.review_date BETWEEN toDate('${startDate}') AND toDate('${endDate}')`];

    const platformKeys = [...new Set(toSqlList(platform).map(reviewPlatformKey).filter(Boolean))];
    if (platformKeys.length > 0) {
        conds.push(`replaceRegexpAll(lower(o.platform), '[^a-z0-9]', '') IN (${platformKeys.map(k => `'${k}'`).join(', ')})`);
    }
    const brands = toSqlList(brand);
    if (brands.length > 0) conds.push(`lower(o.brand) IN (${brands.map(b => `'${b}'`).join(', ')})`);
    const cats = toSqlList(category);
    if (cats.length > 0) conds.push(`lower(o.product_category) IN (${cats.map(c => `'${c}'`).join(', ')})`);

    return `
        SELECT
            o.review_date AS \`Date\`,
            o.platform AS \`Platform\`,
            o.brand AS \`Brand\`,
            o.product_category AS \`Category\`,
            if(o.is_competitor = 1, 'Competitor', 'Own') AS \`Brand Type\`,
            o.web_pid AS \`Web PID\`,
            o.product_name AS \`Product Name\`,
            toString(o.review_id) AS \`Review ID\`,
            o.rating AS \`Review Rating\`,
            o.review_title AS \`Review Title\`,
            o.review_text AS \`Review Text\`,
            o.is_verified_purchase AS \`Verified Purchase\`,
            initcap(o.sentiment) AS \`Sentiment\`,
            o.sentiment_category AS \`Sentiment Category\`,
            o.sentiment_subcategory AS \`Sentiment Subcategory\`,
            o.sentiment_score AS \`Sentiment Score\`,
            o.specific_issue AS \`Specific Issue\`,
            o.pdp_rating AS \`PDP Rating\`,
            o.pdp_rating_count AS \`PDP Rating Count\`,
            o.price_rp AS \`MRP\`,
            o.price_sp AS \`Selling Price\`
        FROM ${table} o
        WHERE ${conds.join(' AND ')}
        ORDER BY \`Date\` DESC, \`Platform\`, \`Web PID\`
    `;
};
