
import { queryClickHouse } from '../config/clickhouse.js';

import fs from 'fs';

export const getContentAnalysisStats = async (filters) => {
    try {
        const { platform, brand, location, startDate, endDate } = filters;
        fs.writeFileSync('debug_svc_filters.txt', JSON.stringify(filters, null, 2));

        let query = `
            SELECT 
                product_id,
                brand_name as brand,
                title,
                title_char_count as titleCount,
                bullet_points_count,
                description_char_count as descriptionCount,
                thumbnail_image_count as imageCount,
                thumbnail_video_count,
                url,
                title_length_score as titleScore,
                prod_desc_score as descriptionScore,
                thumbnail_media_score as imageScore,
                aplus_image_score,
                aplus_description_score,
                product_platform_total as overallScore
            FROM tb_content_score_data
            WHERE 1=1
        `;

        // Date Range Filter (using extraction_timestamp)
        if (startDate && endDate) {
            query += ` AND toDate(extraction_timestamp) BETWEEN '${startDate}' AND '${endDate}'`;
        }

        // Add filters
        if (brand && brand !== 'All') {
            query += ` AND lower(brand_name) = lower('${brand}')`;
        }

        // Platform filter - approximating by URL since no platform column exists
        // Normalize platform input (handle string, array, or array-style key)
        const rawPlatform = filters.platform || filters['platform[]'];
        let platforms = [];
        if (Array.isArray(rawPlatform)) {
            platforms = rawPlatform;
        } else if (typeof rawPlatform === 'string') {
            platforms = rawPlatform.split(',');
        }
        // Clean up
        platforms = platforms.map(p => p.trim().toLowerCase()).filter(p => p !== 'all' && p !== '');

        // Platform filter
        if (platforms.length > 0) {
            const orConditions = [];

            platforms.forEach(p => {
                if (p === 'amazon') {
                    orConditions.push("url LIKE '%amazon%'");
                } else if (p === 'blinkit') {
                    orConditions.push("url LIKE '%blinkit%'");
                } else if (p === 'zepto') {
                    orConditions.push("url LIKE '%zepto%'");
                } else if (p === 'instamart') {
                    orConditions.push("url LIKE '%swiggy%'");
                } else {
                    orConditions.push(`url LIKE '%${p}%'`);
                }
            });

            if (orConditions.length > 0) {
                query += ` AND (${orConditions.join(' OR ')})`;
            }
        }

        // Format/Category filter - We don't have this column, so we might skip it or use a placeholder
        // If format is passed, we can't really filter effectively without a column. 
        // For now, we ignore it to avoid returning zero results, or we check if user insists.
        // Given the user instructions, I'll ignore 'format' for WHERE clause but return all data.

        query += ` LIMIT 5000`; // Increased limit to fetch more brands

        fs.writeFileSync('debug_svc_query.txt', query);

        const result = await queryClickHouse(query);

        fs.writeFileSync('debug_svc_result_count.txt', `Count: ${result.length}`);

        // Transform result to match frontend expectations
        const mappedResult = result.map(row => {
            // Derive platform from URL if needed
            let derivedPlatform = 'Unknown';
            if (row.url && row.url.includes('amazon')) derivedPlatform = 'Amazon';
            else if (row.url && row.url.includes('blinkit')) derivedPlatform = 'Blinkit';
            else if (row.url && row.url.includes('zepto')) derivedPlatform = 'Zepto';
            else if (row.url && row.url.includes('swiggy')) derivedPlatform = 'Instamart';

            return {
                platform: derivedPlatform, // Frontend expects: Blinkit, Zepto, Instamart
                format: 'N/A', // Column not available
                brand: row.brand,
                title: row.title,
                url: row.url,
                descriptionCount: row.descriptionCount || 0,
                imageCount: row.imageCount || 0,
                ratingCount: 0, // Not in table
                ratingValue: 0, // Not in table
                titleCount: row.titleCount || 0,
                descriptionScore: row.descriptionScore || 0,
                imageScore: row.imageScore || 0,
                ratingScore: 0, // Not in table
                reviewScore: 0, // Not in table
                titleScore: row.titleScore || 0,
                overallScore: row.overallScore || 0
            };
        });

        return mappedResult;

    } catch (error) {
        console.error("Error in getContentAnalysisStats:", error);
        throw error;
    }
};
