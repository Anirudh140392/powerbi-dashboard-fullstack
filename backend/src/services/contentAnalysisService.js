
import { queryClickHouse } from '../config/clickhouse.js';
import { getTableColumns, columnExists, resolveColumn } from '../utils/schemaHelper.js';

import fs from 'fs';

const PLATFORMS_SUPPORTING_RATINGS = ['bigbasket', 'flipkart', 'amazon'];

const calculateOverallScore = (title, image, si, desc, rating, platform) => {
    const scores = [title, image, si, desc];
    const platLower = (platform || '').toLowerCase();
    
    // If platform supports ratings OR if the rating is already positive, include it in the average
    if (PLATFORMS_SUPPORTING_RATINGS.includes(platLower) || parseFloat(rating) > 0) {
        scores.push(parseFloat(rating) || 0);
    }
    
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
};

/**
 * Helper to generate a sanitized Brand filter for rb_product_verify queries.
 */
const getBrandFilterSnippet = (brand) => {
    if (!brand || brand === 'All') return '';
    const brands = Array.isArray(brand) ? brand : brand.split(',');
    const brandConditions = brands
        .filter(b => b !== 'All' && b.trim() !== '')
        .map(b => `'${b.trim().replace(/'/g, "''")}'`);
    
    if (brandConditions.length > 0) {
        return ` AND web_pid IN (SELECT Web_Pid FROM rb_pdp_olap WHERE Brand IN (${brandConditions.join(',')}))`;
    }
    return '';
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

/**
 * Content Data export for accounts without rb_content_olap (e.g. mars), built from rb_product_verify —
 * the table behind the Content Analysis page's scores. Scores follow getContentAnalysisStats:
 * verification flags × 100, Overall = average of Title/Image/Secondary Image/Description (+ Rating
 * on bigbasket / flipkart / amazon, or wherever the rating score is positive).
 * One row per SKU per platform per crawl day (latest crawl of the day).
 */
export const buildProductVerifyExportQuery = ({ platform, brand, category, startDate, endDate }) => {
    const conds = [
        `toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'`,
        `isNotNull(Platform)`,
        `Platform NOT IN ('', '\\\\N', '\\\\n')`,
    ];
    const platformKeys = new Set();
    toSqlList(platform).forEach(p => {
        const key = contentPlatformKey(p);
        if (!key) return;
        platformKeys.add(key);
        if (CONTENT_PLATFORM_ALIASES[key]) platformKeys.add(CONTENT_PLATFORM_ALIASES[key]);
    });
    if (platformKeys.size > 0) {
        conds.push(`replaceRegexpAll(lower(Platform), '[^a-z0-9]', '') IN (${[...platformKeys].map(k => `'${k}'`).join(', ')})`);
    }

    const skuConds = [];
    const brands = toSqlList(brand);
    if (brands.length > 0) skuConds.push(`lower(s.sku_brand) IN (${brands.map(b => `'${b}'`).join(', ')})`);
    const cats = toSqlList(category);
    if (cats.length > 0) skuConds.push(`lower(coalesce(nullIf(s.sku_category, ''), v.Category)) IN (${cats.map(c => `'${c}'`).join(', ')})`);

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
            SELECT
                created_on,
                Platform,
                web_pid,
                master_title,
                Category,
                pdp_page_url,
                pdp_rating_value,
                coalesce(verification_title, 0) * 100 AS title_score,
                coalesce(verification_image, 0) * 100 AS image_score,
                multiIf(
                    pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
                    pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
                    0.0
                ) * 100 AS si_score,
                multiIf(
                    pf_id IN (2, 6, 7, 9), coalesce(description_verification, 0) / 1.0,
                    (coalesce(bulletin_verification, 0) + coalesce(description_verification, 0)) / 2.0
                ) * 100 AS desc_score,
                if(coalesce(pdp_rating_value, 0) >= 4.2, 100.0, 0.0) AS rating_score
            FROM rb_product_verify
            WHERE ${conds.join(' AND ')}
            ORDER BY created_on DESC
            LIMIT 1 BY toDate(created_on), lower(Platform), lower(web_pid)
        )
        SELECT
            toDate(v.created_on) AS \`Date\`,
            v.Platform AS \`Platform\`,
            s.sku_brand AS \`Brand\`,
            coalesce(nullIf(s.sku_category, ''), v.Category) AS \`Category\`,
            v.web_pid AS \`Web PID\`,
            coalesce(nullIf(s.sku_label, ''), v.master_title) AS \`Title\`,
            round(if(
                lower(v.Platform) IN ('bigbasket', 'flipkart', 'amazon') OR v.rating_score > 0,
                (v.title_score + v.image_score + v.si_score + v.desc_score + v.rating_score) / 5,
                (v.title_score + v.image_score + v.si_score + v.desc_score) / 4
            ), 2) AS \`Overall Score\`,
            v.title_score AS \`Title Score\`,
            v.image_score AS \`Image Score\`,
            round(v.si_score, 2) AS \`Secondary Image Score\`,
            round(v.desc_score, 2) AS \`Description Score\`,
            v.rating_score AS \`Rating Score\`,
            v.pdp_rating_value AS \`PDP Rating\`,
            v.pdp_page_url AS \`PDP URL\`
        FROM daily v
        LEFT JOIN sku_map s ON lower(v.web_pid) = s.pid
        ${skuConds.length > 0 ? `WHERE ${skuConds.join(' AND ')}` : ''}
        ORDER BY \`Date\`, \`Platform\`, \`Web PID\`
    `;
};

export const getContentAnalysisStats = async (filters) => {
    try {
        const { platform, brand, location, startDate, endDate, channel, category } = filters;
        
        let query = `
            SELECT 
                web_pid as product_id,
                Platform as platform,
                master_title as title,
                verification_title * 100 AS titleScore,
                verification_image * 100 AS imageScore,
                multiIf(
                    pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
                    pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
                    0.0
                ) * 100 AS siScore,
                multiIf(
                    pf_id IN (2, 6, 7, 9), description_verification / 1.0,
                    pf_id IN (1, 3, 4), (bulletin_verification + description_verification) / 2.0,
                    (bulletin_verification + description_verification) / 2.0
                ) * 100 AS descScore,
                IF(pdp_rating_value >= 4.2, 100.0, 0.0) AS ratingScore
            FROM rb_product_verify
            WHERE 1=1
        `;

        // Date Range Filter
        if (startDate && endDate) {
            query += ` AND toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'`;
        }

        // Platform Filter
        const rawPlatform = filters.platform || filters['platform[]'];
        let platforms = [];
        if (Array.isArray(rawPlatform)) {
            platforms = rawPlatform;
        } else if (typeof rawPlatform === 'string') {
            platforms = rawPlatform.split(',');
        }
        platforms = platforms.map(p => p.trim().toLowerCase()).filter(p => p !== 'all' && p !== '');

        if (platforms.length > 0) {
            const orConditions = platforms.map(p => {
                if (p === 'instamart') return "lower(Platform) = 'swiggy'";
                return `lower(Platform) = '${p}'`;
            });
            query += ` AND (${orConditions.join(' OR ')})`;
        }

        // Channel filter
        if (channel && channel !== 'All') {
            query += ` AND lower(Channel) = lower('${channel.replace(/'/g, "''")}')`;
        }

        // Category filter
        if (category && category !== 'All') {
            const cats = Array.isArray(category) ? category : category.split(',');
            const catConditions = cats.filter(c => c !== 'All').map(c => `lower(Category) = lower('${c.trim().replace(/'/g, "''")}')`);
            if (catConditions.length > 0) {
                query += ` AND (${catConditions.join(' OR ')})`;
            }
        }

        // Brand filter
        query += getBrandFilterSnippet(brand);

        /* Location filter removed as column does not exist */

        query += ` LIMIT 1000`;

        const result = await queryClickHouse(query);

        return result.map(row => {
            const overall = calculateOverallScore(
                parseFloat(row.titleScore) || 0,
                parseFloat(row.imageScore) || 0,
                parseFloat(row.siScore) || 0,
                parseFloat(row.descScore) || 0,
                parseFloat(row.ratingScore) || 0,
                row.platform
            );

            return {
                ...row,
                titleScore: parseFloat(row.titleScore) || 0,
                imageScore: parseFloat(row.imageScore) || 0,
                siScore: parseFloat(row.siScore) || 0,
                descriptionScore: parseFloat(row.descScore) || 0,
                ratingScore: parseFloat(row.ratingScore) || 0,
                overallScore: overall
            };
        });

    } catch (error) {
        console.error("Error in getContentAnalysisStats:", error);
        throw error;
    }
};

export const getContentAnalysisOverviewStats = async (filters, isCompare = false) => {
    try {
        const { platform, brand, location, startDate, endDate, prevStartDate, prevEndDate, channel, category } = filters;
        
        let targetStartDate = isCompare ? prevStartDate : startDate;
        let targetEndDate = isCompare ? prevEndDate : endDate;

        let query = `
            SELECT 
                AVG(verification_title) * 100 AS titleScore,
                AVG(verification_image) * 100 AS imageScore,
                AVG(
                    multiIf(
                        pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
                        pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
                        0.0
                    )
                ) * 100 AS siScore,
                AVG(
                    multiIf(
                        pf_id IN (2, 6, 7, 9), description_verification / 1.0,
                        pf_id IN (1, 3, 4), (bulletin_verification + description_verification) / 2.0,
                        (bulletin_verification + description_verification) / 2.0
                    )
                ) * 100 AS descScore,
                AVG(IF(lower(Platform) IN ('bigbasket', 'flipkart', 'amazon'), IF(pdp_rating_value >= 4.2, 1.0, 0.0), NULL)) * 100 AS ratingScore
            FROM rb_product_verify
            WHERE 1=1
        `;

        // Date Range Filter
        if (targetStartDate && targetEndDate) {
            query += ` AND toDate(created_on) BETWEEN '${targetStartDate}' AND '${targetEndDate}'`;
        }

        // Platform Filter
        const rawPlatform = filters.platform || filters['platform[]'];
        let platforms = [];
        if (Array.isArray(rawPlatform)) {
            platforms = rawPlatform;
        } else if (typeof rawPlatform === 'string') {
            platforms = rawPlatform.split(',');
        }
        platforms = platforms.map(p => p.trim().toLowerCase()).filter(p => p !== 'all' && p !== '');

        if (platforms.length > 0) {
            const orConditions = platforms.map(p => {
                if (p === 'instamart') return "lower(Platform) = 'swiggy'";
                return `lower(Platform) = '${p}'`;
            });
            query += ` AND (${orConditions.join(' OR ')})`;
        }

        // Brand Filter (if we add brand column later, normally it's brand_name)
        // Wait, rb_product_verify doesn't have brand column documented. 
        // We'll skip it unless it fails.

        // Channel filter
        if (channel && channel !== 'All') {
             query += ` AND lower(Channel) = lower('${channel.replace(/'/g, "''")}')`;
        }
        // Category filter
        if (category && category !== 'All') {
            const cats = Array.isArray(category) ? category : category.split(',');
            const catConditions = cats.filter(c => c !== 'All').map(c => `lower(Category) = lower('${c.trim().replace(/'/g, "''")}')`);
            if (catConditions.length > 0) {
                 query += ` AND (${catConditions.join(' OR ')})`;
            }
        }

        // Brand filter
        query += getBrandFilterSnippet(brand);

        /* Location filter removed as column does not exist */

        const result = await queryClickHouse(query);
        
        if (result && result.length > 0) {
            const r = result[0];
            const title = parseFloat(r.titleScore) || 0;
            const image = parseFloat(r.imageScore) || 0;
            const si = parseFloat(r.siScore) || 0;
            const desc = parseFloat(r.descScore) || 0;
            const rating = parseFloat(r.ratingScore) || 0;
            
            // Assuming Overall Score is a straight average of the 5.
            const overall = calculateOverallScore(title, image, si, desc, rating, platform);
            
            return {
                titleScore: title,
                imageScore: image,
                siScore: si,
                descScore: desc,
                ratingScore: rating,
                overallScore: overall
            };
        }
        
        return {
            titleScore: 0, imageScore: 0, siScore: 0, descScore: 0, ratingScore: 0, overallScore: 0
        };

    } catch (error) {
        console.error("Error in getContentAnalysisOverviewStats:", error);
        throw error;
    }
};

export const getContentAnalysisPlatformBreakdown = async (filters, isCompare = false) => {
    try {
        const { startDate, endDate, prevStartDate, prevEndDate, channel, category } = filters;
        
        let targetStartDate = isCompare ? prevStartDate : startDate;
        let targetEndDate = isCompare ? prevEndDate : endDate;

        let query = `
            SELECT 
                Platform,
                AVG(verification_title) * 100 AS titleScore,
                AVG(verification_image) * 100 AS imageScore,
                AVG(
                    multiIf(
                        pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
                        pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
                        0.0
                    )
                ) * 100 AS siScore,
                AVG(
                    multiIf(
                        pf_id IN (2, 6, 7, 9), description_verification / 1.0,
                        pf_id IN (1, 3, 4), (bulletin_verification + description_verification) / 2.0,
                        (bulletin_verification + description_verification) / 2.0
                    )
                ) * 100 AS descScore,
                AVG(IF(lower(Platform) IN ('bigbasket', 'flipkart', 'amazon'), IF(pdp_rating_value >= 4.2, 1.0, 0.0), NULL)) * 100 AS ratingScore
            FROM rb_product_verify
            WHERE Platform != '\\\\N'
        `;

        if (targetStartDate && targetEndDate) {
            query += ` AND toDate(created_on) BETWEEN '${targetStartDate}' AND '${targetEndDate}'`;
        }

        // Channel filter
        if (channel && channel !== 'All') {
            query += ` AND lower(Channel) = lower('${channel.replace(/'/g, "''")}')`;
        }

        // Category filter
        if (category && category !== 'All') {
            const cats = Array.isArray(category) ? category : category.split(',');
            const catConditions = cats.filter(c => c !== 'All').map(c => `lower(Category) = lower('${c.trim().replace(/'/g, "''")}')`);
            if (catConditions.length > 0) {
                query += ` AND (${catConditions.join(' OR ')})`;
            }
        }

        // Brand filter
        query += getBrandFilterSnippet(filters.brand);

        /* Location filter removed as column does not exist */

        query += ` GROUP BY Platform ORDER BY Platform`;

        const result = await queryClickHouse(query);

        const platformMap = {};
        if (result && result.length > 0) {
            result.forEach(row => {
                const plat = row.Platform;
                const title = parseFloat(row.titleScore) || 0;
                const image = parseFloat(row.imageScore) || 0;
                const si = parseFloat(row.siScore) || 0;
                const desc = parseFloat(row.descScore) || 0;
                const rating = parseFloat(row.ratingScore) || 0;
                const overall = calculateOverallScore(title, image, si, desc, rating, plat);

                platformMap[plat] = {
                    titleScore: title,
                    imageScore: image,
                    siScore: si,
                    descScore: desc,
                    ratingScore: rating,
                    overallScore: overall
                };
            });
        }

        return platformMap;
    } catch (error) {
        console.error("Error in getContentAnalysisPlatformBreakdown:", error);
        throw error;
    }
};

export const getContentAnalysisPlatforms = async (channel) => {
    try {
        const tableExists = await queryClickHouse("EXISTS TABLE rb_content_olap");
        if (!tableExists || tableExists[0]?.result !== 1) {
            console.log("[getContentAnalysisPlatforms] rb_content_olap table does not exist");
            return [];
        }

        const contentCols = await getTableColumns('rb_content_olap');
        const contentPlatformCol = resolveColumn(contentCols, 'platform', 'Platform');

        // Step 1: Get all distinct platforms from rb_content_olap
        let query = `SELECT DISTINCT ${contentPlatformCol} AS Platform FROM rb_content_olap WHERE isNotNull(${contentPlatformCol}) AND ${contentPlatformCol} != '\\\\N' AND ${contentPlatformCol} != ''`;

        // Step 2: If a channel is selected, keep only platforms whose Channel in rb_pdp_olap matches
        if (channel && channel !== 'All') {
            const pdpCols = await getTableColumns('rb_pdp_olap');
            const hasChannelPdp = columnExists(pdpCols, 'channel');
            if (hasChannelPdp) {
                const pdpPlatformCol = resolveColumn(pdpCols, 'platform', 'Platform');
                const pdpChannelCol = resolveColumn(pdpCols, 'channel', 'Channel');

                const channelLower = channel.trim().toLowerCase();
                let channelCond = `lower(${pdpChannelCol}) = lower('${channel.trim().replace(/'/g, "''")}')`;
                if (['qcomm', 'quickcomm', 'quick commerce', 'q-comm'].includes(channelLower)) {
                    channelCond = `(lower(${pdpChannelCol}) LIKE '%quick%' OR lower(${pdpChannelCol}) LIKE '%qcomm%')`;
                } else if (['ecomm', 'ecommerce', 'e-commerce', 'ecom', 'marketplace'].includes(channelLower)) {
                    channelCond = `(lower(${pdpChannelCol}) LIKE '%ecom%' OR lower(${pdpChannelCol}) LIKE '%market%')`;
                }

                query += ` AND lower(${contentPlatformCol}) IN (
                    SELECT DISTINCT lower(${pdpPlatformCol})
                    FROM rb_pdp_olap
                    WHERE isNotNull(${pdpPlatformCol})
                      AND ${channelCond}
                )`;
            }
        }

        query += ` ORDER BY Platform`;

        const result = await queryClickHouse(query);
        const platforms = result.map(row => row.Platform).filter(Boolean);

        // If channel filter returned 0, return all distinct platforms present in rb_content_olap
        if (platforms && platforms.length > 0) return platforms;

        const allContentPlatforms = await queryClickHouse(
            `SELECT DISTINCT ${contentPlatformCol} AS Platform FROM rb_content_olap WHERE isNotNull(${contentPlatformCol}) AND ${contentPlatformCol} != '\\\\N' AND ${contentPlatformCol} != '' ORDER BY Platform`
        );
        return allContentPlatforms.map(row => row.Platform).filter(Boolean);
    } catch (error) {
        console.error("Error in getContentAnalysisPlatforms:", error);
        return [];
    }
};

export const getContentAnalysisCategories = async (platform) => {
    try {
        let query = `SELECT DISTINCT Category FROM rb_product_verify WHERE isNotNull(Category) AND Category != '\\\\N' AND Category != ''`;
        if (platform && platform !== 'All') {
            const rawPlatform = platform;
            let platforms = [];
            if (Array.isArray(rawPlatform)) {
                platforms = rawPlatform;
            } else if (typeof rawPlatform === 'string') {
                platforms = rawPlatform.split(',');
            }
            platforms = platforms.map(p => p.trim().toLowerCase()).filter(p => p !== 'all' && p !== '');

            if (platforms.length > 0) {
                const orConditions = platforms.map(p => {
                    if (p === 'instamart') return "lower(Platform) = 'swiggy'";
                    return `lower(Platform) = '${p}'`;
                });
                query += ` AND (${orConditions.join(' OR ')})`;
            }
        }
        query += ` ORDER BY Category`;
        const result = await queryClickHouse(query);
        const categories = result.map(row => row.Category).filter(Boolean);
        if (categories && categories.length > 0) return categories;

        // Fallback to rb_pdp_olap if rb_product_verify returns empty
        let fallbackQuery = `SELECT DISTINCT Category FROM rb_pdp_olap WHERE isNotNull(Category) AND Category != '\\\\N' AND Category != ''`;
        if (platform && platform !== 'All') {
            const rawPlatform = platform;
            let platforms = [];
            if (Array.isArray(rawPlatform)) {
                platforms = rawPlatform;
            } else if (typeof rawPlatform === 'string') {
                platforms = rawPlatform.split(',');
            }
            platforms = platforms.map(p => p.trim().toLowerCase()).filter(p => p !== 'all' && p !== '');

            if (platforms.length > 0) {
                const orConditions = platforms.map(p => {
                    if (p === 'instamart') return "lower(Platform) = 'swiggy'";
                    return `lower(Platform) = '${p}'`;
                });
                fallbackQuery += ` AND (${orConditions.join(' OR ')})`;
            }
        }
        fallbackQuery += ` ORDER BY Category`;
        const fallbackResult = await queryClickHouse(fallbackQuery);
        return fallbackResult.map(row => row.Category).filter(Boolean);
    } catch (error) {
        console.error("Error in getContentAnalysisCategories:", error);
        return [];
    }
};

export const getContentAnalysisBrands = async (platform) => {
    try {
        let query = `SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand != '\\\\N' AND Brand != ''`;
        if (platform && platform !== 'All') {
            const rawPlatform = platform;
            let platforms = [];
            if (Array.isArray(rawPlatform)) {
                platforms = rawPlatform;
            } else if (typeof rawPlatform === 'string') {
                platforms = rawPlatform.split(',');
            }
            platforms = platforms.map(p => p.trim().toLowerCase()).filter(p => p !== 'all' && p !== '');

            if (platforms.length > 0) {
                const orConditions = platforms.map(p => {
                    if (p === 'instamart') return "lower(Platform) = 'swiggy'";
                    return `lower(Platform) = '${p}'`;
                });
                query += ` AND (${orConditions.join(' OR ')})`;
            }
        }
        query += ` ORDER BY Brand`;
        const result = await queryClickHouse(query);
        return result.map(row => row.Brand);
    } catch (error) {
        console.error("Error in getContentAnalysisBrands:", error.message);
        return [];
    }
};

export const getContentAnalysisZones = async (brand) => {
    try {
        let query = `SELECT DISTINCT Location as zone FROM rb_pdp_olap WHERE Location != '\\\\N' AND Location != ''`;
        if (brand && brand !== 'All') {
            const brands = Array.isArray(brand) ? brand : brand.split(',');
            const brandConditions = brands.filter(b => b !== 'All').map(b => `'${b.trim().replace(/'/g, "''")}'`);
            if (brandConditions.length > 0) {
                query += ` AND Brand IN (${brandConditions.join(',')})`;
            }
        }
        query += ` ORDER BY zone`;
        const result = await queryClickHouse(query);
        return result.map(row => row.zone);
    } catch (error) {
        console.error("Error in getContentAnalysisZones:", error.message);
        return [];
    }
};

export const getContentAnalysisTrends = async (filters) => {
    try {
        const { startDate, endDate, channel, category } = filters;
        
        let query = `
            SELECT 
                toDate(created_on) as date,
                AVG(verification_title) * 100 AS titleScore,
                AVG(verification_image) * 100 AS imageScore,
                AVG(
                    multiIf(
                        pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
                        pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
                        0.0
                    )
                ) * 100 AS siScore,
                AVG(
                    multiIf(
                        pf_id IN (2, 6, 7, 9), description_verification / 1.0,
                        pf_id IN (1, 3, 4), (bulletin_verification + description_verification) / 2.0,
                        (bulletin_verification + description_verification) / 2.0
                    )
                ) * 100 AS descScore,
                AVG(IF(lower(Platform) IN ('bigbasket', 'flipkart', 'amazon'), IF(pdp_rating_value >= 4.2, 1.0, 0.0), NULL)) * 100 AS ratingScore
            FROM rb_product_verify
            WHERE 1=1
        `;

        if (startDate && endDate) {
            query += ` AND toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'`;
        }

        // Platform Filter
        const rawPlatform = filters.platform || filters['platform[]'];
        let platforms = [];
        if (Array.isArray(rawPlatform)) {
            platforms = rawPlatform;
        } else if (typeof rawPlatform === 'string') {
            platforms = rawPlatform.split(',');
        }
        platforms = platforms.map(p => p.trim().toLowerCase()).filter(p => p !== 'all' && p !== '');

        if (platforms.length > 0) {
            const orConditions = platforms.map(p => {
                if (p === 'instamart') return "lower(Platform) = 'swiggy'";
                return `lower(Platform) = '${p}'`;
            });
            query += ` AND (${orConditions.join(' OR ')})`;
        }

        if (channel && channel !== 'All') {
            query += ` AND lower(Channel) = lower('${channel.replace(/'/g, "''")}')`;
        }

        if (category && category !== 'All') {
            const cats = Array.isArray(category) ? category : category.split(',');
            const catConditions = cats.filter(c => c !== 'All').map(c => `lower(Category) = lower('${c.trim().replace(/'/g, "''")}')`);
            if (catConditions.length > 0) {
                query += ` AND (${catConditions.join(' OR ')})`;
            }
        }

        // Brand filter
        query += getBrandFilterSnippet(filters.brand);

        /* Location filter removed as column does not exist */

        query += ` GROUP BY date ORDER BY date`;

        const result = await queryClickHouse(query);

        return result.map(row => {
            const t = parseFloat(row.titleScore) || 0;
            const i = parseFloat(row.imageScore) || 0;
            const s = parseFloat(row.siScore) || 0;
            const d = parseFloat(row.descScore) || 0;
            const r = parseFloat(row.ratingScore) || 0;
            const overall = calculateOverallScore(t, i, s, d, r, filters.platform);

            return {
                date: row.date,
                overall: overall,
                title: t,
                images: i,
                secondary: s,
                description: d,
                rating: r
            };
        });
    } catch (error) {
        console.error("Error in getContentAnalysisTrends:", error);
        throw error;
    }
};
