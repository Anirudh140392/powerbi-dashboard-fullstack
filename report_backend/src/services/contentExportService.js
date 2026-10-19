// Content Data export query (Report Builder → "Content Data").
// Mirror of buildContentOlapExportQuery / buildContentExportQuery in backend/src/services/contentAnalysisService.js —
// report_backend is deployed separately, so keep both copies in sync.

const PLATFORMS_SUPPORTING_RATINGS = ['bigbasket', 'flipkart', 'amazon'];

/**
 * Per-row content score expressions (0–1 scale), shared with the Content Data export.
 * Must match the formulas used by the Content Analysis page.
 */
const SI_SCORE_SQL = `multiIf(
    pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
    pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
    0.0
)`;
const DESC_SCORE_SQL = `multiIf(
    pf_id IN (2, 6, 7, 9), description_verification / 1.0,
    (bulletin_verification + description_verification) / 2.0
)`;
const RATING_PLATFORMS_SQL = PLATFORMS_SUPPORTING_RATINGS.map(p => `'${p}'`).join(', ');
const RATING_SCORE_SQL = `IF(lower(Platform) IN (${RATING_PLATFORMS_SQL}), IF(pdp_rating_value >= 4.2, 1.0, 0.0), NULL)`;

/**
 * Fallback Content Data export query from rb_product_verify (Content Score data), used
 * only when the account has no rb_content_olap. One row per SKU per platform per day; when a SKU was verified several times
 * on the same day, the latest snapshot of that day is kept.
 * Rating Score only applies to ratings platforms (bigbasket, flipkart, amazon) and
 * only those platforms include it in the Overall Score.
 * Brand comes from rb_sku_platform (SKU master) when the tenant has it — rb_pdp_olap
 * only covers SKUs with recent PDP crawls — and is joined case-insensitively on web_pid.
 */
export const buildContentExportQuery = ({ platform, brand, category, startDate, endDate, hasSkuPlatform = true }) => {
    const conds = [
        `toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'`,
        `isNotNull(web_pid)`,
        `isNotNull(Platform) AND Platform != '\\\\N' AND Platform != ''`,
    ];

    const platforms = (typeof platform === 'string' ? platform.split(',') : (platform || []))
        .map(p => p.trim().toLowerCase().replace(/'/g, "''"))
        .filter(p => p && p !== 'all' && !p.startsWith('all '));
    if (platforms.length > 0) {
        const values = new Set(platforms);
        if (values.has('instamart')) values.add('swiggy');
        conds.push(`lower(Platform) IN (${[...values].map(p => `'${p}'`).join(', ')})`);
    }

    const cats = (typeof category === 'string' ? category.split(',') : (category || []))
        .map(c => c.trim().toLowerCase().replace(/'/g, "''"))
        .filter(c => c && c !== 'all' && !c.startsWith('all '));
    if (cats.length > 0) {
        conds.push(`lower(Category) IN (${cats.map(c => `'${c}'`).join(', ')})`);
    }

    const brands = (typeof brand === 'string' ? brand.split(',') : (brand || []))
        .map(b => b.trim().toLowerCase().replace(/'/g, "''"))
        .filter(b => b && b !== 'all' && !b.startsWith('all '));
    const brandWhere = brands.length > 0
        ? `WHERE lower(b.sku_brand) IN (${brands.map(b => `'${b}'`).join(', ')})`
        : '';

    const brandMapSql = hasSkuPlatform
        ? `SELECT lower(web_pid) AS pid, any(brand_name) AS sku_brand
            FROM rb_sku_platform
            WHERE isNotNull(brand_name) AND brand_name != '\\N' AND brand_name != ''
            GROUP BY pid`
        : `SELECT lower(Web_Pid) AS pid, any(Brand) AS sku_brand
            FROM rb_pdp_olap
            WHERE Brand != '\\N' AND Brand != ''
            GROUP BY pid`;

    const t = `coalesce(v.verification_title, 0)`;
    const i = `coalesce(v.verification_image, 0)`;
    const si = `coalesce(${SI_SCORE_SQL}, 0)`;
    const d = `coalesce(${DESC_SCORE_SQL}, 0)`;
    const r = `coalesce(${RATING_SCORE_SQL}, 0)`;

    return `
        WITH
        brand_map AS
        (
            ${brandMapSql}
        ),
        daily AS
        (
            SELECT *
            FROM rb_product_verify
            WHERE ${conds.join(' AND ')}
            ORDER BY created_on DESC
            LIMIT 1 BY toDate(created_on), lower(Platform), web_pid
        )
        SELECT
            toDate(v.created_on) AS \`Date\`,
            v.Platform AS \`Platform\`,
            b.sku_brand AS \`Brand\`,
            v.Category AS \`Category\`,
            v.web_pid AS \`Web PID\`,
            v.master_title AS \`Title\`,
            round(v.verification_title * 100, 2) AS \`Title Score\`,
            round(v.verification_image * 100, 2) AS \`Image Score\`,
            round(${SI_SCORE_SQL} * 100, 2) AS \`Secondary Image Score\`,
            round(${DESC_SCORE_SQL} * 100, 2) AS \`Description Score\`,
            v.pdp_rating_value AS \`Rating\`,
            round(${RATING_SCORE_SQL} * 100, 2) AS \`Rating Score\`,
            round(
                IF(lower(v.Platform) IN (${RATING_PLATFORMS_SQL}),
                    (${t} + ${i} + ${si} + ${d} + ${r}) / 5.0,
                    (${t} + ${i} + ${si} + ${d}) / 4.0
                ) * 100, 2
            ) AS \`Overall Score\`,
            v.pdp_page_url AS \`PDP URL\`
        FROM daily v
        LEFT JOIN brand_map b ON lower(v.web_pid) = b.pid
        ${brandWhere}
        ORDER BY \`Date\`, \`Platform\`, \`Web PID\`
    `;
};

/**
 * Total content score as shown on the Content Analysis page (trailytics_content_analysis):
 * sum of the scores that apply to each platform.
 */
const CONTENT_TOTAL_SCORE_SQL = `CASE
    WHEN lower(o.platform) = 'zepto' THEN
        coalesce(o.title_score, 0) + coalesce(o.bullet_score, 0) + coalesce(o.thumbnail_image_score, 0) + coalesce(o.thumbnail_video_score, 0) + coalesce(o.aplus_image_score, 0)
    WHEN lower(o.platform) = 'bigbasket' THEN
        coalesce(o.title_score, 0) + coalesce(o.bullet_score, 0) + coalesce(o.description_score, 0) + coalesce(o.aplus_image_score, 0) + coalesce(o.thumbnail_image_score, 0)
    WHEN lower(o.platform) = 'instamart' THEN
        coalesce(o.title_score, 0) + coalesce(o.description_score, 0) + coalesce(o.thumbnail_image_score, 0) + coalesce(o.thumbnail_video_score, 0)
    ELSE
        coalesce(o.title_score, 0) + coalesce(o.bullet_score, 0) + coalesce(o.description_score, 0) + coalesce(o.aplus_image_score, 0) + coalesce(o.thumbnail_image_score, 0) + coalesce(o.thumbnail_video_score, 0)
END`;

const toSqlList = (value) => (typeof value === 'string' ? value.split(',') : (value || []))
    .map(v => v.trim().toLowerCase().replace(/'/g, "''"))
    .filter(v => v && v !== 'all' && !v.startsWith('all '));

/**
 * Builds the Content Data export query from rb_content_olap — the table behind the
 * Content Analysis page. One row per SKU per platform per crawl day (latest crawl of the day).
 * Brand / Category come from rb_sku_platform, joined case-insensitively on web_pid.
 */
export const buildContentOlapExportQuery = ({ platform, brand, category, startDate, endDate }) => {
    const conds = [`toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'`];
    const platforms = toSqlList(platform);
    if (platforms.length > 0) {
        conds.push(`lower(platform) IN (${platforms.map(p => `'${p}'`).join(', ')})`);
    }

    const skuConds = [];
    const brands = toSqlList(brand);
    if (brands.length > 0) skuConds.push(`lower(s.sku_brand) IN (${brands.map(b => `'${b}'`).join(', ')})`);
    const cats = toSqlList(category);
    if (cats.length > 0) skuConds.push(`lower(s.sku_category) IN (${cats.map(c => `'${c}'`).join(', ')})`);

    return `
        WITH
        sku_map AS
        (
            SELECT
                lower(web_pid) AS pid,
                any(brand_name) AS sku_brand,
                any(brand_category) AS sku_category,
                any(coalesce(sku_name, sku_title)) AS sku_label
            FROM rb_sku_platform
            GROUP BY pid
        ),
        daily AS
        (
            SELECT *
            FROM rb_content_olap
            WHERE ${conds.join(' AND ')}
            ORDER BY created_on DESC
            LIMIT 1 BY toDate(created_on), lower(platform), lower(product_id)
        )
        SELECT
            toDate(o.created_on) AS \`Date\`,
            o.platform AS \`Platform\`,
            s.sku_brand AS \`Brand\`,
            s.sku_category AS \`Category\`,
            o.product_id AS \`Web PID\`,
            coalesce(nullIf(s.sku_label, ''), o.title) AS \`Title\`,
            ${CONTENT_TOTAL_SCORE_SQL} AS \`Total Score\`,
            o.title_score AS \`Title Score\`,
            o.bullet_score AS \`Bullet Point Score\`,
            o.description_score AS \`Description Score\`,
            o.aplus_image_score AS \`A+ Score\`,
            o.thumbnail_image_score AS \`Thumbnail Score\`,
            o.thumbnail_video_score AS \`Video Score\`,
            o.title_char_count AS \`Title Characters\`,
            o.bullet_points_count AS \`Bullet Points\`,
            o.description_char_count AS \`Description Characters\`,
            o.aplus_image_count AS \`A+ Images\`,
            o.thumbnail_image_count AS \`Thumbnail Images\`,
            o.thumbnail_video_count AS \`Videos\`,
            o.url AS \`PDP URL\`
        FROM daily o
        LEFT JOIN sku_map s ON lower(o.product_id) = s.pid
        ${skuConds.length > 0 ? `WHERE ${skuConds.join(' AND ')}` : ''}
        ORDER BY \`Date\`, \`Platform\`, \`Web PID\`
    `;
};
