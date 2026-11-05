
import { queryClickHouse } from '../config/clickhouse.js';
import { getTableColumns, columnExists, resolveColumn } from '../utils/schemaHelper.js';

import fs from 'fs';

const PLATFORMS_SUPPORTING_RATINGS = ['bigbasket', 'flipkart', 'amazon'];

const calculateOverallScore = (title, image, si, desc, rating, platform) => {
    const scores = [title, image, si, desc];
    
    // Only include rating if rating actually exists for this platform/selection
    if (rating !== null && rating !== undefined && !isNaN(parseFloat(rating))) {
        scores.push(parseFloat(rating));
    }
    
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
};

const detectContentTable = async () => {
    const verifyExists = await queryClickHouse("EXISTS TABLE rb_product_verify");
    if (verifyExists && verifyExists[0]?.result === 1) {
        return "rb_product_verify";
    }
    const olapExists = await queryClickHouse("EXISTS TABLE rb_content_olap");
    if (olapExists && olapExists[0]?.result === 1) {
        return "rb_content_olap";
    }
    return null;
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

export const getContentAnalysisStats = async (filters) => {
    try {
        const { platform, brand, location, startDate, endDate, channel, category } = filters;
        
        const contentTable = await detectContentTable();
        if (!contentTable) {
            return [];
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

        if (contentTable === 'rb_content_olap') {
            let olapQuery = `
                SELECT 
                    product_id,
                    platform,
                    title,
                    title_score * 5.0 AS titleScore,
                    thumbnail_image_score * 5.0 AS imageScore,
                    bullet_score * 5.0 AS siScore,
                    description_score * 5.0 AS descScore,
                    NULL AS ratingScore,
                    total_score AS overallScore
                FROM rb_content_olap
                WHERE 1=1
            `;
            if (startDate && endDate) {
                olapQuery += ` AND toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'`;
            }
            if (platforms.length > 0) {
                const orConditions = platforms.map(p => {
                    if (p === 'instamart') return "lower(platform) = 'swiggy'";
                    return `lower(platform) = '${p}'`;
                });
                olapQuery += ` AND (${orConditions.join(' OR ')})`;
            }
            olapQuery += ` LIMIT 1000`;

            const olapResult = await queryClickHouse(olapQuery);
            return olapResult.map(row => ({
                ...row,
                titleScore: parseFloat(row.titleScore) || 0,
                imageScore: parseFloat(row.imageScore) || 0,
                siScore: parseFloat(row.siScore) || 0,
                descriptionScore: parseFloat(row.descScore) || 0,
                ratingScore: null,
                overallScore: parseFloat(row.overallScore) || 0,
            }));
        }

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
                multiIf(
                    lower(Platform) NOT IN ('bigbasket', 'flipkart', 'amazon'), NULL,
                    pdp_rating_value IS NULL OR pdp_rating_value = 0, NULL,
                    pdp_rating_value >= 4.2, 100.0,
                    0.0
                ) AS ratingScore
            FROM rb_product_verify
            WHERE 1=1
        `;

        // Date Range Filter
        if (startDate && endDate) {
            query += ` AND toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'`;
        }

        if (platforms.length > 0) {
            const orConditions = platforms.map(p => {
                if (p === 'instamart') return "lower(Platform) = 'swiggy'";
                return `lower(Platform) = '${p}'`;
            });
            query += ` AND (${orConditions.join(' OR ')})`;
        }

        // Channel filter
        if (channel && channel !== 'All') {
            const chNorm = channel.toLowerCase().trim();
            const chMatch = chNorm.includes('quick') ? 'quickcomm' : (chNorm.includes('ecom') ? 'ecommerce' : chNorm);
            query += ` AND (lower(Channel) = '${chMatch.replace(/'/g, "''")}' OR lower(Channel) = '${chNorm.replace(/'/g, "''")}')`;
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
            const rScore = row.ratingScore !== null && !isNaN(parseFloat(row.ratingScore)) ? parseFloat(row.ratingScore) : null;
            const overall = calculateOverallScore(
                parseFloat(row.titleScore) || 0,
                parseFloat(row.imageScore) || 0,
                parseFloat(row.siScore) || 0,
                parseFloat(row.descScore) || 0,
                rScore,
                row.platform
            );

            return {
                ...row,
                titleScore: parseFloat(row.titleScore) || 0,
                imageScore: parseFloat(row.imageScore) || 0,
                siScore: parseFloat(row.siScore) || 0,
                descriptionScore: parseFloat(row.descScore) || 0,
                ratingScore: rScore,
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
        const contentTable = await detectContentTable();
        if (!contentTable) {
            console.log("[getContentAnalysisOverviewStats] No content table exists in current database");
            return {
                titleScore: 0, imageScore: 0, siScore: 0, descScore: 0, ratingScore: null, overallScore: 0
            };
        }

        const { platform, brand, location, startDate, endDate, prevStartDate, prevEndDate, channel, category } = filters;
        
        let targetStartDate = isCompare ? prevStartDate : startDate;
        let targetEndDate = isCompare ? prevEndDate : endDate;

        const rawPlatform = filters.platform || filters['platform[]'];
        let platforms = [];
        if (Array.isArray(rawPlatform)) {
            platforms = rawPlatform;
        } else if (typeof rawPlatform === 'string') {
            platforms = rawPlatform.split(',');
        }
        platforms = platforms.map(p => p.trim().toLowerCase()).filter(p => p !== 'all' && p !== '');

        if (contentTable === "rb_content_olap") {
            let olapQuery = `
                SELECT 
                    AVG(title_score) * 5.0 AS titleScore,
                    AVG(thumbnail_image_score) * 5.0 AS imageScore,
                    AVG(bullet_score) * 5.0 AS siScore,
                    AVG(description_score) * 5.0 AS descScore,
                    NULL AS ratingScore,
                    AVG(total_score) AS overallScore
                FROM rb_content_olap
                WHERE 1=1
            `;
            if (targetStartDate && targetEndDate) {
                olapQuery += ` AND toDate(created_on) BETWEEN '${targetStartDate}' AND '${targetEndDate}'`;
            }
            if (platforms.length > 0) {
                const platConds = platforms.map(p => `lower(platform) = '${p}'`);
                olapQuery += ` AND (${platConds.join(' OR ')})`;
            }
            const olapRes = await queryClickHouse(olapQuery);
            if (olapRes && olapRes.length > 0) {
                const r = olapRes[0];
                const title = isNaN(parseFloat(r.titleScore)) ? 0 : parseFloat(r.titleScore);
                const image = isNaN(parseFloat(r.imageScore)) ? 0 : parseFloat(r.imageScore);
                const si = isNaN(parseFloat(r.siScore)) ? 0 : parseFloat(r.siScore);
                const desc = isNaN(parseFloat(r.descScore)) ? 0 : parseFloat(r.descScore);
                const overall = isNaN(parseFloat(r.overallScore)) ? 0 : parseFloat(r.overallScore);
                return {
                    titleScore: title,
                    imageScore: image,
                    siScore: si,
                    descScore: desc,
                    ratingScore: null,
                    overallScore: overall
                };
            }
            return {
                titleScore: 0, imageScore: 0, siScore: 0, descScore: 0, ratingScore: null, overallScore: 0
            };
        }

        // rb_product_verify logic
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

        if (targetStartDate && targetEndDate) {
            query += ` AND toDate(created_on) BETWEEN '${targetStartDate}' AND '${targetEndDate}'`;
        }

        if (platforms.length > 0) {
            const orConditions = platforms.map(p => {
                if (p === 'instamart') return "lower(Platform) = 'swiggy'";
                return `lower(Platform) = '${p}'`;
            });
            query += ` AND (${orConditions.join(' OR ')})`;
        }

        if (channel && channel !== 'All') {
            const chNorm = channel.toLowerCase().trim();
            const chMatch = chNorm.includes('quick') ? 'quickcomm' : (chNorm.includes('ecom') ? 'ecommerce' : chNorm);
            query += ` AND (lower(Channel) = '${chMatch.replace(/'/g, "''")}' OR lower(Channel) = '${chNorm.replace(/'/g, "''")}')`;
        }
        if (category && category !== 'All') {
            const cats = Array.isArray(category) ? category : category.split(',');
            const catConditions = cats.filter(c => c !== 'All').map(c => `lower(Category) = lower('${c.trim().replace(/'/g, "''")}')`);
            if (catConditions.length > 0) {
                 query += ` AND (${catConditions.join(' OR ')})`;
            }
        }

        query += getBrandFilterSnippet(brand);

        const result = await queryClickHouse(query);
        
        if (result && result.length > 0) {
            const r = result[0];
            const title = isNaN(parseFloat(r.titleScore)) ? 0 : parseFloat(r.titleScore);
            const image = isNaN(parseFloat(r.imageScore)) ? 0 : parseFloat(r.imageScore);
            const si = isNaN(parseFloat(r.siScore)) ? 0 : parseFloat(r.siScore);
            const desc = isNaN(parseFloat(r.descScore)) ? 0 : parseFloat(r.descScore);
            const rating = r.ratingScore !== null && !isNaN(parseFloat(r.ratingScore)) ? parseFloat(r.ratingScore) : null;
            
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
            titleScore: 0, imageScore: 0, siScore: 0, descScore: 0, ratingScore: null, overallScore: 0
        };

    } catch (error) {
        console.error("Error in getContentAnalysisOverviewStats:", error);
        return {
            titleScore: 0, imageScore: 0, siScore: 0, descScore: 0, ratingScore: null, overallScore: 0
        };
    }
};

export const getContentAnalysisPlatformBreakdown = async (filters, isCompare = false) => {
    try {
        const contentTable = await detectContentTable();
        if (!contentTable) {
            return {};
        }

        const { startDate, endDate, prevStartDate, prevEndDate, channel, category } = filters;
        
        let targetStartDate = isCompare ? prevStartDate : startDate;
        let targetEndDate = isCompare ? prevEndDate : endDate;

        if (contentTable === "rb_content_olap") {
            let olapQuery = `
                SELECT 
                    platform AS Platform,
                    AVG(title_score) * 5.0 AS titleScore,
                    AVG(thumbnail_image_score) * 5.0 AS imageScore,
                    AVG(bullet_score) * 5.0 AS siScore,
                    AVG(description_score) * 5.0 AS descScore,
                    NULL AS ratingScore,
                    AVG(total_score) AS overallScore
                FROM rb_content_olap
                WHERE platform != '\\N'
            `;
            if (targetStartDate && targetEndDate) {
                olapQuery += ` AND toDate(created_on) BETWEEN '${targetStartDate}' AND '${targetEndDate}'`;
            }
            olapQuery += ` GROUP BY platform ORDER BY platform`;
            const olapResult = await queryClickHouse(olapQuery);
            const platformMap = {};
            if (olapResult && olapResult.length > 0) {
                olapResult.forEach(row => {
                    const plat = row.Platform;
                    const title = isNaN(parseFloat(row.titleScore)) ? 0 : parseFloat(row.titleScore);
                    const image = isNaN(parseFloat(row.imageScore)) ? 0 : parseFloat(row.imageScore);
                    const si = isNaN(parseFloat(row.siScore)) ? 0 : parseFloat(row.siScore);
                    const desc = isNaN(parseFloat(row.descScore)) ? 0 : parseFloat(row.descScore);
                    const overall = isNaN(parseFloat(row.overallScore)) ? 0 : parseFloat(row.overallScore);
                    platformMap[plat] = {
                        titleScore: title,
                        imageScore: image,
                        siScore: si,
                        descScore: desc,
                        ratingScore: null,
                        overallScore: overall
                    };
                });
            }
            return platformMap;
        }

        // rb_product_verify query
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
            WHERE Platform != '\\N'
        `;

        if (targetStartDate && targetEndDate) {
            query += ` AND toDate(created_on) BETWEEN '${targetStartDate}' AND '${targetEndDate}'`;
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

        query += getBrandFilterSnippet(filters.brand);
        query += ` GROUP BY Platform ORDER BY Platform`;

        const result = await queryClickHouse(query);
        const platformMap = {};
        if (result && result.length > 0) {
            result.forEach(row => {
                const plat = row.Platform;
                const title = isNaN(parseFloat(row.titleScore)) ? 0 : parseFloat(row.titleScore);
                const image = isNaN(parseFloat(row.imageScore)) ? 0 : parseFloat(row.imageScore);
                const si = isNaN(parseFloat(row.siScore)) ? 0 : parseFloat(row.siScore);
                const desc = isNaN(parseFloat(row.descScore)) ? 0 : parseFloat(row.descScore);
                const rating = row.ratingScore !== null && !isNaN(parseFloat(row.ratingScore)) ? parseFloat(row.ratingScore) : null;
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
        return {};
    }
};

export const getContentAnalysisPlatforms = async (channel) => {
    try {
        let contentTable = null;
        const olapExists = await queryClickHouse("EXISTS TABLE rb_content_olap");
        if (olapExists && olapExists[0]?.result === 1) {
            contentTable = "rb_content_olap";
        } else {
            const verifyExists = await queryClickHouse("EXISTS TABLE rb_product_verify");
            if (verifyExists && verifyExists[0]?.result === 1) {
                contentTable = "rb_product_verify";
            }
        }

        if (!contentTable) {
            console.log("[getContentAnalysisPlatforms] Neither rb_content_olap nor rb_product_verify exists");
            return [];
        }

        const contentCols = await getTableColumns(contentTable);
        const contentPlatformCol = resolveColumn(contentCols, 'platform', 'Platform');

        // Step 1: Get all distinct platforms from content table
        let query = `SELECT DISTINCT ${contentPlatformCol} AS Platform FROM ${contentTable} WHERE isNotNull(${contentPlatformCol}) AND ${contentPlatformCol} != '\\N' AND ${contentPlatformCol} != ''`;

        // Step 2: If a channel is selected, keep only platforms whose Channel matches
        if (channel && channel !== 'All') {
            const hasChannelInContent = columnExists(contentCols, 'channel');
            if (hasChannelInContent) {
                const contentChannelCol = resolveColumn(contentCols, 'channel', 'Channel');
                query += ` AND lower(${contentChannelCol}) = lower('${channel.trim().replace(/'/g, "''")}')`;
            } else {
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
        }

        query += ` ORDER BY Platform`;

        const result = await queryClickHouse(query);
        const platforms = result.map(row => row.Platform).filter(Boolean).filter(p => !['\\n', '\\N', 'null', 'none', ''].includes(p.toLowerCase().trim()));

        // If channel filter returned 0, return all distinct platforms present in content table
        if (platforms && platforms.length > 0) return platforms;

        const allContentPlatforms = await queryClickHouse(
            `SELECT DISTINCT ${contentPlatformCol} AS Platform FROM ${contentTable} WHERE isNotNull(${contentPlatformCol}) AND ${contentPlatformCol} != '\\N' AND ${contentPlatformCol} != '' ORDER BY Platform`
        );
        return allContentPlatforms.map(row => row.Platform).filter(Boolean).filter(p => !['\\n', '\\N', 'null', 'none', ''].includes(p.toLowerCase().trim()));
    } catch (error) {
        console.error("Error in getContentAnalysisPlatforms:", error);
        return [];
    }
};

export const getContentAnalysisCategories = async (platform) => {
    try {
        const contentTable = await detectContentTable();
        if (contentTable === 'rb_product_verify') {
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
        }

        // Fallback to rb_pdp_olap
        const pdpExists = await queryClickHouse("EXISTS TABLE rb_pdp_olap");
        if (pdpExists && pdpExists[0]?.result === 1) {
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
        }
        return [];
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
        
        const contentTable = await detectContentTable();
        if (!contentTable) {
            return [];
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

        if (contentTable === 'rb_content_olap') {
            let olapTrendQuery = `
                SELECT 
                    toDate(created_on) as date,
                    AVG(title_score * 5.0) AS titleScore,
                    AVG(thumbnail_image_score * 5.0) AS imageScore,
                    AVG(bullet_score * 5.0) AS siScore,
                    AVG(description_score * 5.0) AS descScore,
                    NULL AS ratingScore,
                    AVG(total_score) AS overallScore
                FROM rb_content_olap
                WHERE 1=1
            `;
            if (startDate && endDate) {
                olapTrendQuery += ` AND toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'`;
            }
            if (platforms.length > 0) {
                const orConditions = platforms.map(p => {
                    if (p === 'instamart') return "lower(platform) = 'swiggy'";
                    return `lower(platform) = '${p}'`;
                });
                olapTrendQuery += ` AND (${orConditions.join(' OR ')})`;
            }
            olapTrendQuery += ` GROUP BY date ORDER BY date`;
            const olapTrendResult = await queryClickHouse(olapTrendQuery);
            return olapTrendResult.map(row => {
                const t = parseFloat(row.titleScore) || 0;
                const i = parseFloat(row.imageScore) || 0;
                const s = parseFloat(row.siScore) || 0;
                const d = parseFloat(row.descScore) || 0;
                const overall = parseFloat(row.overallScore) || 0;
                return {
                    date: row.date,
                    overall,
                    title: t,
                    images: i,
                    secondary: s,
                    description: d,
                    rating: null
                };
            });
        }

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
