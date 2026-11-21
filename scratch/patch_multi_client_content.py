with open('backend/src/services/contentAnalysisService.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Locate functions in contentAnalysisService.js
# 1. Replace getContentAnalysisStats
# 2. Replace getContentAnalysisOverviewStats
# 3. Replace getContentAnalysisPlatformBreakdown
# 4. Replace getContentAnalysisCategories

overview_start = None
overview_end = None
breakdown_start = None
breakdown_end = None
stats_start = None
stats_end = None

for i, l in enumerate(lines):
    if "export const getContentAnalysisStats = async (filters) => {" in l:
        stats_start = i
    if "export const getContentAnalysisOverviewStats = async (filters, isCompare = false) => {" in l:
        stats_end = i
        overview_start = i
    if "export const getContentAnalysisPlatformBreakdown = async (filters, isCompare = false) => {" in l:
        overview_end = i
        breakdown_start = i
    if "export const getContentAnalysisPlatforms = async (channel) => {" in l:
        breakdown_end = i

print(f"Stats: {stats_start} -> {stats_end}")
print(f"Overview: {overview_start} -> {overview_end}")
print(f"Breakdown: {breakdown_start} -> {breakdown_end}")

new_overview_code = """export const getContentAnalysisOverviewStats = async (filters, isCompare = false) => {
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
             query += ` AND lower(Channel) = lower('${channel.replace(/'/g, "''")}')`;
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

"""

new_breakdown_code = """export const getContentAnalysisPlatformBreakdown = async (filters, isCompare = false) => {
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
                WHERE platform != '\\\\N'
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
            WHERE Platform != '\\\\N'
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

"""

# Reconstruct file
new_lines = lines[:overview_start] + [new_overview_code] + [new_breakdown_code] + lines[breakdown_end:]
with open('backend/src/services/contentAnalysisService.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("SUCCESS: updated contentAnalysisService.js")

