import { queryClickHouse } from '../config/clickhouse.js';
import dayjs from 'dayjs';

const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';

const parseMultiSelectFilter = (value) => {
    if (!value || value === 'All') return null;
    if (Array.isArray(value)) {
        const filtered = value.filter(v => v && v !== 'All');
        return filtered.length > 0 ? filtered : null;
    }
    if (typeof value === 'string' && value.includes(',')) {
        const filtered = value.split(',').map(v => v.trim()).filter(v => v && v !== 'All');
        return filtered.length > 0 ? filtered : null;
    }
    return [value];
};

const buildInClause = (column, values) => {
    if (!values || values.length === 0) return null;
    const escaped = values.map(v => `'${escapeStr(v)}'`).join(',');
    return `${column} IN (${escaped})`;
};

const getTrendsFilterOptions = async ({ filterType, platform, brand }) => {
    try {
        let query = '';
        let result = [];

        switch (filterType) {
            case 'platforms':
                query = `SELECT DISTINCT Platform AS option FROM rb_pdp_olap WHERE Platform IS NOT NULL AND Platform != '' ORDER BY Platform`;
                break;
            case 'categories':
                query = `SELECT DISTINCT Category AS option FROM rb_pdp_olap WHERE Category IS NOT NULL AND Category != '' ORDER BY Category`;
                break;
            case 'cities':
                query = `SELECT DISTINCT Location AS option FROM rb_pdp_olap WHERE Location IS NOT NULL AND Location != '' ORDER BY Location`;
                break;
            case 'brands':
                // Only showing our brands for the filter typically
                query = `SELECT DISTINCT brand_name AS option FROM rca_sku_dim WHERE toString(comp_flag) = '0' AND brand_name IS NOT NULL AND brand_name != '' ORDER BY brand_name`;
                break;
            case 'skus': {
                let where = "WHERE Product IS NOT NULL AND Product != ''";
                if (platform && platform !== 'All') {
                    const plats = Array.isArray(platform) ? platform : platform.split(',');
                    where += ` AND ${buildInClause('Platform', plats)}`;
                }
                if (brand && brand !== 'All') {
                    const brs = Array.isArray(brand) ? brand : brand.split(',');
                    where += ` AND ${buildInClause('Brand', brs)}`;
                }
                query = `SELECT DISTINCT Product AS option FROM rb_pdp_olap ${where} ORDER BY Product LIMIT 500`;
                break;
            }
            default:
                return { success: false, options: [] };
        }

        const data = await queryClickHouse(query);
        const options = ['All', ...data.map(d => d.option).filter(Boolean)];
        return { success: true, options };
    } catch (error) {
        console.error('[getTrendsFilterOptions] Error:', error);
        return { success: false, options: ['All'] };
    }
};

const getKpiTrends = async (filters) => {
    console.log('[getPricingKpiTrends] Computing KPI trends data with filters:', filters);

    try {
        const { brand, location, platform, category, period, timeStep, startDate: customStart, endDate: customEnd, channel, skuName, skuCode } = filters;

        // 1. Determine Date Range
        let endDate = dayjs();
        let startDate = endDate.clone();

        if (period === 'Custom' && customStart && customEnd) {
            startDate = dayjs(customStart);
            endDate = dayjs(customEnd);
        } else {
            switch (period) {
                case '1M': startDate = startDate.subtract(1, 'month'); break;
                case '3M': startDate = startDate.subtract(3, 'month'); break;
                case '6M': startDate = startDate.subtract(6, 'month'); break;
                case '1Y': startDate = startDate.subtract(1, 'year'); break;
                default: startDate = startDate.subtract(1, 'month'); // Default 1M
            }
        }

        console.log(`[getPricingKpiTrends] Date range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);

        // 2. Determine Grouping for ClickHouse
        let groupFormat;  // For formatDateTime
        let groupExpression;

        if (timeStep === 'Monthly') {
            groupFormat = '%Y-%m-01';
            groupExpression = `formatDateTime(toDate(DATE), '${groupFormat}')`;
        } else if (timeStep === 'Weekly') {
            groupFormat = 'WEEK';
            groupExpression = `toYearWeek(toDate(DATE), 1)`;
        } else { // Daily
            // format matches the frontend expectation e.g "DD MMM'YY" 
            // but we can just output YYYY-MM-DD and let frontend parse or we can format directly
            groupFormat = '%Y-%m-%d';
            groupExpression = `formatDateTime(toDate(DATE), '${groupFormat}')`;
        }

        // 3. Build WHERE conditions for rb_pdp_olap
        const conditions = [`toDate(DATE) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`];

        const catArr = parseMultiSelectFilter(category);
        if (catArr) conditions.push(buildInClause('Category', catArr));

        const brandArr = parseMultiSelectFilter(brand);
        if (brandArr) conditions.push(buildInClause('Brand', brandArr));

        const locArr = parseMultiSelectFilter(location);
        if (locArr) conditions.push(buildInClause('Location', locArr));

        const platArr = parseMultiSelectFilter(platform);
        if (platArr) conditions.push(buildInClause('Platform', platArr));

        const skuArrArr = parseMultiSelectFilter(skuName);
        if (skuArrArr && skuArrArr.length > 0) {
            const skuConds = skuArrArr.map(s => `Product LIKE '%${escapeStr(s)}%'`).join(' OR ');
            conditions.push(`(${skuConds})`);
        }

        const skuCodeArrArr = parseMultiSelectFilter(skuCode);
        if (skuCodeArrArr && skuCodeArrArr.length > 0) {
            const skuCodeConds = skuCodeArrArr.map(s => `toString(Web_Pid) LIKE '%${escapeStr(s)}%'`).join(' OR ');
            conditions.push(`(${skuCodeConds})`);
        }

        const kpiConds = conditions.join(' AND ');

        // 4. Run main pricing query grouped by time
        const mainQuery = `
            SELECT
                ${groupExpression} AS date_group,
                MAX(toDate(DATE)) AS ref_date,
                AVG(
                    CASE WHEN toFloat64OrNull(MRP) > 0 AND toFloat64OrNull(Selling_Price) > 0
                    THEN ((toFloat64(MRP) - toFloat64(Selling_Price)) / toFloat64(MRP)) * 100
                    ELSE NULL END
                ) AS discount,
                AVG(
                    CASE WHEN toFloat64OrNull(Selling_Price) > 0
                    THEN toFloat64(Selling_Price) ELSE NULL END
                ) AS asp,
                AVG(
                    CASE WHEN toFloat64OrNull(MRP) > 0
                    THEN toFloat64(MRP) ELSE NULL END
                ) AS mrp,
                AVG(
                    CASE WHEN toString(Comp_flag) = '0' AND toFloat64OrNull(Selling_Price) > 0
                    THEN toFloat64(Selling_Price) ELSE NULL END
                ) AS own_brand_sp,
                AVG(
                    CASE WHEN toString(Comp_flag) = '1' AND toFloat64OrNull(Selling_Price) > 0
                    THEN toFloat64(Selling_Price) ELSE NULL END
                ) AS competitor_sp,
                countIf(toString(Comp_flag) = '1' AND toFloat64OrNull(Selling_Price) > 0) AS competitor_count
            FROM rb_pdp_olap
            WHERE ${kpiConds}
            GROUP BY ${groupExpression}
            ORDER BY date_group ASC
        `;

        // 5. Gram query to calculate Price Per Unit
        // p-prefixed conditions for JOIN query
        const extraWhereP = conditions.length > 0
            ? `AND ${conditions.map(c => c.replace(/^(Category|Location|Platform|Brand|Product)/, 'p.$1')).join(' AND ')}`
            : '';

        const gramExpression = timeStep === 'Weekly'
            ? `toYearWeek(toDate(p.DATE), 1)`
            : `formatDateTime(toDate(p.DATE), '${groupFormat}')`;

        const gramQuery = `
            SELECT
                ${gramExpression} AS date_group,
                SUM(CASE WHEN toFloat64OrNull(p.Selling_Price) > 0 AND toFloat64OrNull(s.gram) > 0
                    THEN toFloat64(p.Selling_Price) ELSE 0 END) AS sum_sp_with_gram,
                SUM(CASE WHEN toFloat64OrNull(s.gram) > 0 AND toFloat64OrNull(p.Selling_Price) > 0
                    THEN toFloat64(s.gram) ELSE 0 END) AS sum_gram
            FROM rb_pdp_olap p
            LEFT JOIN rb_sku_platform s ON p.Web_Pid = s.web_pid
            WHERE 1=1 ${extraWhereP}
            GROUP BY ${gramExpression}
            ORDER BY date_group ASC
        `;

        const [mainResults, gramResults] = await Promise.all([
            queryClickHouse(mainQuery),
            queryClickHouse(gramQuery)
        ]);

        // Merge results
        const gramMap = {};
        (gramResults || []).forEach(r => { gramMap[r.date_group] = r; });

        const timeSeries = [];

        (mainResults || []).forEach(row => {
            const dateStr = row.date_group;
            // format date for frontend (e.g. 06 Sep'25)
            let formattedDate;
            if (timeStep === 'Daily' || timeStep === 'Monthly') {
                formattedDate = dayjs(dateStr).format("DD MMM'YY");
            } else if (timeStep === 'Weekly') {
                // toYearWeek() returns an integer (e.g. 202508) — NOT a string!
                // Use ref_date (the MAX date in the week bucket) for a readable label
                if (row.ref_date) {
                    formattedDate = dayjs(row.ref_date).format("DD MMM'YY");
                } else {
                    // Fallback: parse the YYYYWW integer manually
                    const weekStr = String(dateStr);
                    formattedDate = 'W' + weekStr.substring(4);
                }
            } else {
                formattedDate = String(dateStr);
            }

            const gramRow = gramMap[dateStr] || {};

            // Calculate PPU
            let ppu = parseFloat(row.asp) || 0;
            const sumGram = parseFloat(gramRow.sum_gram);
            const sumSpWithGram = parseFloat(gramRow.sum_sp_with_gram);
            if (!isNaN(sumGram) && sumGram > 0 && !isNaN(sumSpWithGram)) {
                ppu = sumSpWithGram / sumGram;
            }

            // Calculate RPI
            let rpi = 0;
            const compCount = parseInt(row.competitor_count) || 0;
            const ownSp = parseFloat(row.own_brand_sp);
            const compSp = parseFloat(row.competitor_sp);
            const avgSp = parseFloat(row.asp);
            const avgMrp = parseFloat(row.mrp);

            if (compCount > 0 && !isNaN(ownSp) && !isNaN(compSp) && compSp > 0) {
                rpi = ownSp / compSp;
            } else if (!isNaN(avgSp) && !isNaN(avgMrp) && avgMrp > 0) {
                rpi = avgSp / avgMrp;
            }

            timeSeries.push({
                date: formattedDate,
                rawDate: dateStr,
                Discount: parseFloat(row.discount) || 0,
                PricePerUnit: ppu,
                ASP: parseFloat(row.asp) || 0,
                RPI: rpi
            });
        });

        return {
            success: true,
            timeSeries
        };

    } catch (error) {
        console.error('[getPricingKpiTrends] Error:', error);
        return { success: false, error: error.message, timeSeries: [] };
    }
};

export default {
    getKpiTrends,
    getTrendsFilterOptions
};
