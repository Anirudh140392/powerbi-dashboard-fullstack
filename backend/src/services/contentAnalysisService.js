
import { queryClickHouse } from '../config/clickhouse.js';

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
            query += ` AND lower(Channel) = lower('${channel}')`;
        }

        // Category filter
        if (category && category !== 'All') {
            const cats = Array.isArray(category) ? category : category.split(',');
            const catConditions = cats.filter(c => c !== 'All').map(c => `lower(Category) = lower('${c.trim()}')`);
            if (catConditions.length > 0) {
                query += ` AND (${catConditions.join(' OR ')})`;
            }
        }

        // Brand filter
        if (brand && brand !== 'All') {
            const brands = Array.isArray(brand) ? brand : brand.split(',');
            const brandConditions = brands.filter(b => b !== 'All').map(b => `'${b.trim()}'`);
            if (brandConditions.length > 0) {
                query += ` AND web_pid IN (SELECT Web_Pid FROM rb_pdp_olap WHERE Brand IN (${brandConditions.join(',')}))`;
            }
        }

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
             query += ` AND lower(Channel) = lower('${channel}')`;
        }
        // Category filter
        if (category && category !== 'All') {
            const cats = Array.isArray(category) ? category : category.split(',');
            const catConditions = cats.filter(c => c !== 'All').map(c => `lower(Category) = lower('${c.trim()}')`);
            if (catConditions.length > 0) {
                 query += ` AND (${catConditions.join(' OR ')})`;
            }
        }

        // Brand filter
        if (brand && brand !== 'All') {
            const brands = Array.isArray(brand) ? brand : brand.split(',');
            const brandConditions = brands.filter(b => b !== 'All').map(b => `'${b.trim()}'`);
            if (brandConditions.length > 0) {
                query += ` AND web_pid IN (SELECT Web_Pid FROM rb_pdp_olap WHERE Brand IN (${brandConditions.join(',')}))`;
            }
        }

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
            query += ` AND lower(Channel) = lower('${channel}')`;
        }

        // Category filter
        if (category && category !== 'All') {
            const cats = Array.isArray(category) ? category : category.split(',');
            const catConditions = cats.filter(c => c !== 'All').map(c => `lower(Category) = lower('${c.trim()}')`);
            if (catConditions.length > 0) {
                query += ` AND (${catConditions.join(' OR ')})`;
            }
        }

        // Brand filter
        const brand = filters.brand;
        if (brand && brand !== 'All') {
            const brands = Array.isArray(brand) ? brand : brand.split(',');
            const brandConditions = brands.filter(b => b !== 'All').map(b => `'${b.trim()}'`);
            if (brandConditions.length > 0) {
                query += ` AND web_pid IN (SELECT Web_Pid FROM rb_pdp_olap WHERE Brand IN (${brandConditions.join(',')}))`;
            }
        }

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

export const getContentAnalysisPlatforms = async () => {
    try {
        const query = `SELECT DISTINCT Platform FROM rb_product_verify WHERE Platform != '\\\\N' AND Platform != '' ORDER BY Platform`;
        const result = await queryClickHouse(query);
        return result.map(row => row.Platform);
    } catch (error) {
        console.error("Error in getContentAnalysisPlatforms:", error);
        throw error;
    }
};

export const getContentAnalysisCategories = async (platform) => {
    try {
        let query = `SELECT DISTINCT Category FROM rb_product_verify WHERE Category != '\\\\N' AND Category != ''`;
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
        return result.map(row => row.Category);
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
             query += ` AND Brand = '${brand}'`;
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
            query += ` AND lower(Channel) = lower('${channel}')`;
        }

        if (category && category !== 'All') {
            const cats = Array.isArray(category) ? category : category.split(',');
            const catConditions = cats.filter(c => c !== 'All').map(c => `lower(Category) = lower('${c.trim()}')`);
            if (catConditions.length > 0) {
                query += ` AND (${catConditions.join(' OR ')})`;
            }
        }

        // Brand filter
        const brand = filters.brand;
        if (brand && brand !== 'All') {
            const brands = Array.isArray(brand) ? brand : brand.split(',');
            const brandConditions = brands.filter(b => b !== 'All').map(b => `'${b.trim()}'`);
            if (brandConditions.length > 0) {
                query += ` AND web_pid IN (SELECT Web_Pid FROM rb_pdp_olap WHERE Brand IN (${brandConditions.join(',')}))`;
            }
        }

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
