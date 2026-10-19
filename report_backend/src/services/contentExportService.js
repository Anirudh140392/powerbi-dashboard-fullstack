// Content Data export query (Report Builder → "Content Data").
// Mirror of buildContentOlapExportQuery in backend/src/services/contentAnalysisService.js —
// report_backend is deployed separately, so keep both copies in sync.

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

// Report Builder platform ids vs rb_content_olap names, compared without spaces / punctuation
// ("1_mg" → "1mg", "amazon now" → "amazonnow"); aliases cover names that differ beyond that
const CONTENT_PLATFORM_ALIASES = { apollo247: 'apollo' };
const contentPlatformKey = (p) => p.toLowerCase().replace(/[^a-z0-9]/g, '');

const toSqlList = (value) => (typeof value === 'string' ? value.split(',') : (value || []))
    .map(v => v.trim().toLowerCase().replace(/\\/g, '\\\\').replace(/'/g, "\\'"))
    .filter(v => v && v !== 'all' && !v.startsWith('all '));

/**
 * Builds the Content Data export query from rb_content_olap — the table behind the
 * Content Analysis page. One row per SKU per platform per crawl day (latest crawl of the day).
 * Brand / Category come from rb_sku_platform, joined case-insensitively on web_pid.
 */
export const buildContentOlapExportQuery = ({ platform, brand, category, startDate, endDate }) => {
    const conds = [`toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'`];
    const platformKeys = new Set();
    toSqlList(platform).forEach(p => {
        const key = contentPlatformKey(p);
        if (!key) return;
        platformKeys.add(key);
        if (CONTENT_PLATFORM_ALIASES[key]) platformKeys.add(CONTENT_PLATFORM_ALIASES[key]);
    });
    if (platformKeys.size > 0) {
        conds.push(`replaceRegexpAll(lower(platform), '[^a-z0-9]', '') IN (${[...platformKeys].map(k => `'${k}'`).join(', ')})`);
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
