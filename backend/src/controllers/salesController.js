import RbPdpOlap from '../models/RbPdpOlap.js';
import { Op, Sequelize } from 'sequelize';
import dayjs from 'dayjs';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';
import { queryClickHouse } from '../config/clickhouse.js';

/**
 * Helper to escape ClickHouse strings
 */
const escapeCH = (str) => String(str || '').replace(/'/g, "''");

/**
 * Helper to build ClickHouse multi-select conditions
 */
const buildCHMultiCondition = (value, column, options = {}) => {
    if (!value || value === 'All') return '1=1';

    const values = String(value).split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) return '1=1';

    if (options.isBrand) {
        // Use LIKE for brand matching
        if (values.length === 1) {
            return `positionCaseInsensitive(${column}, '${escapeCH(values[0])}') > 0`;
        }
        return `(${values.map(v => `positionCaseInsensitive(${column}, '${escapeCH(v)}') > 0`).join(' OR ')})`;
    }

    if (values.length === 1) {
        return `${column} = '${escapeCH(values[0])}'`;
    }
    return `${column} IN (${values.map(v => `'${escapeCH(v)}'`).join(',')})`;
};

/**
 * Helper to handle multi-select filters (comma-separated strings) - MySQL version kept for backwards compatibility
 */
const handleMultiSelect = (value, column, baseWhere) => {
    if (!value || value === 'All') return;

    const values = String(value).split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) return;

    if (values.length === 1) {
        if (column === 'Brand') {
            baseWhere[column] = { [Op.like]: `%${values[0]}%` };
        } else {
            baseWhere[column] = values[0];
        }
    } else {
        if (column === 'Brand') {
            baseWhere[column] = { [Op.or]: values.map(v => ({ [Op.like]: `%${v}%` })) };
        } else {
            baseWhere[column] = { [Op.in]: values };
        }
    }
};

/**
 * Sales Overview - KPI Cards (ClickHouse version)
 */
export const getSalesOverview = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('sales_overview_ch', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { platform, brand, location, startDate, endDate, compareStartDate, compareEndDate } = req.query;

            // Build base conditions
            const platformCondition = buildCHMultiCondition(platform, 'Platform');
            const brandCondition = buildCHMultiCondition(brand, 'Brand', { isBrand: true });
            const locationCondition = buildCHMultiCondition(location, 'Location');
            const compFlagCondition = "toString(Comp_flag) = '0'";
            const baseWhere = `${compFlagCondition} AND ${platformCondition} AND ${brandCondition} AND ${locationCondition}`;

            const currentEnd = endDate ? dayjs(endDate) : dayjs();
            const currentStart = startDate ? dayjs(startDate) : currentEnd.subtract(30, 'day');
            const today = dayjs();
            const daysInMonth = currentEnd.daysInMonth();

            // ── Q1: Overall Sales in selected range ───────────────────
            const overallQuery = `
                SELECT 
                    COALESCE(SUM(toFloat64OrZero(Sales)), 0) as total,
                    COUNT(DISTINCT toDate(DATE)) as dataDays
                FROM rb_pdp_olap
                WHERE ${baseWhere}
                  AND toDate(DATE) BETWEEN '${currentStart.format('YYYY-MM-DD')}' AND '${currentEnd.format('YYYY-MM-DD')}'
            `;
            const overallRes = await queryClickHouse(overallQuery);
            const overallSales = parseFloat(overallRes[0]?.total || 0);
            const actualDataDays = parseInt(overallRes[0]?.dataDays || 1);

            // ── Q2: Comparison Period Sales ────────────────────────────
            let comparisonSales = 0;
            let compDataDays = 1;
            if (compareStartDate && compareEndDate) {
                const compQuery = `
                    SELECT 
                        COALESCE(SUM(toFloat64OrZero(Sales)), 0) as total,
                        COUNT(DISTINCT toDate(DATE)) as dataDays
                    FROM rb_pdp_olap
                    WHERE ${baseWhere}
                      AND toDate(DATE) BETWEEN '${dayjs(compareStartDate).format('YYYY-MM-DD')}' AND '${dayjs(compareEndDate).format('YYYY-MM-DD')}'
                `;
                const compRes = await queryClickHouse(compQuery);
                comparisonSales = parseFloat(compRes[0]?.total || 0);
                compDataDays = parseInt(compRes[0]?.dataDays || 1);
            }

            // ── Q3: Previous Full Month Sales (for projected comparison) ──
            const prevMonthStart = currentEnd.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
            const prevMonthEnd = currentEnd.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
            const prevMonthQuery = `
                SELECT COALESCE(SUM(toFloat64OrZero(Sales)), 0) as total
                FROM rb_pdp_olap
                WHERE ${baseWhere}
                  AND toDate(DATE) BETWEEN '${prevMonthStart}' AND '${prevMonthEnd}'
            `;
            const prevMonthRes = await queryClickHouse(prevMonthQuery);
            const prevMonthSales = parseFloat(prevMonthRes[0]?.total || 0);

            // ── Derived KPIs ──────────────────────────────────────────
            // MTD = Sales from 1st of endDate's month to endDate
            const mtdStart = currentEnd.startOf('month').format('YYYY-MM-DD');
            const mtdEnd = currentEnd.format('YYYY-MM-DD');
            const mtdQuery = `
                SELECT COALESCE(SUM(toFloat64OrZero(Sales)), 0) as total
                FROM rb_pdp_olap
                WHERE ${baseWhere}
                  AND toDate(DATE) BETWEEN '${mtdStart}' AND '${mtdEnd}'
            `;
            const mtdRes = await queryClickHouse(mtdQuery);
            const mtdSales = parseFloat(mtdRes[0]?.total || 0);

            // DRR = Overall / actual data days (NOT calendar days)
            const drr = actualDataDays > 0 ? overallSales / actualDataDays : 0;

            // Projected = DRR × days in month (of endDate's month)
            const projectedSales = drr * daysInMonth;

            // ── Change Percentages ────────────────────────────────────
            const changePercentage = comparisonSales > 0
                ? ((overallSales - comparisonSales) / comparisonSales) * 100
                : null;

            const compDrr = compDataDays > 0 ? comparisonSales / compDataDays : 0;
            const mtdChangePercentage = compDrr > 0
                ? ((drr - compDrr) / compDrr) * 100 * (actualDataDays / compDataDays)
                : null;

            const drrChangePercentage = compDrr > 0
                ? ((drr - compDrr) / compDrr) * 100
                : null;

            const projectedChangePercentage = prevMonthSales > 0
                ? ((projectedSales - prevMonthSales) / prevMonthSales) * 100
                : null;

            // ── Required Run Rate & Forecast Accuracy ─────────────────
            const dayOfMonth = currentEnd.date();
            const remainingDays = daysInMonth - dayOfMonth;
            // How much daily sales needed for rest of month to match last month
            const reqRunRate = remainingDays > 0 && prevMonthSales > 0
                ? (prevMonthSales - mtdSales) / remainingDays
                : drr;
            // Gap between current DRR and required run rate
            const reqRunRateGap = drr > 0
                ? ((reqRunRate - drr) / drr) * 100
                : null;
            // Forecast accuracy = projected as % of previous month
            const forecastAccuracy = prevMonthSales > 0
                ? (projectedSales / prevMonthSales) * 100
                : null;

            // ── Q4: Sparkline — Overall Sales trend (bucketed ~15 pts) ─
            const MAX_SPARKLINE_POINTS = 15;
            const clampedEnd = currentEnd.isAfter(today) ? today : currentEnd;
            const totalDays = Math.max(1, clampedEnd.diff(currentStart, 'day') + 1);
            const bucketSize = Math.max(1, Math.ceil(totalDays / MAX_SPARKLINE_POINTS));
            const dateFormat = totalDays > 60 ? 'MMM YY' : 'DD MMM';

            const trendQuery = `
                SELECT 
                    min(toDate(DATE)) as bucket_start,
                    SUM(toFloat64OrZero(Sales)) as value,
                    COUNT(DISTINCT toDate(DATE)) as days_in_bucket
                FROM rb_pdp_olap
                WHERE ${baseWhere}
                  AND toDate(DATE) BETWEEN '${currentStart.format('YYYY-MM-DD')}' AND '${clampedEnd.format('YYYY-MM-DD')}'
                GROUP BY intDiv(dateDiff('day', toDate('${currentStart.format('YYYY-MM-DD')}'), toDate(DATE)), ${bucketSize})
                ORDER BY bucket_start ASC
            `;
            const trendRes = await queryClickHouse(trendQuery);
            const trend = trendRes.map(t => ({
                date: dayjs(t.bucket_start).format(dateFormat),
                value: parseFloat(t.value || 0),
                dataDays: parseInt(t.days_in_bucket || 1)
            }));

            console.log(`[Sparkline] Range: ${totalDays} days | Bucket: ${bucketSize} days/pt | Points: ${trend.length} | DataDays: ${actualDataDays}`);

            // ── Derived Sparklines ─────────────────────────────────────
            // MTD trend: cumulative running total
            const mtdTrend = trend.map((point, idx) => {
                const cumSum = trend.slice(0, idx + 1).reduce((s, p) => s + p.value, 0);
                return { date: point.date, value: Math.round(cumSum) };
            });

            // DRR trend: running average using actual data days per bucket
            const drrTrend = trend.map((point, idx) => {
                const cumSum = trend.slice(0, idx + 1).reduce((s, p) => s + p.value, 0);
                const cumDataDays = trend.slice(0, idx + 1).reduce((s, p) => s + p.dataDays, 0);
                return { date: point.date, value: Math.round(cumSum / Math.max(1, cumDataDays)) };
            });

            // Projected trend: projected month total at each point
            const projectedTrend = trend.map((point, idx) => {
                const cumSum = trend.slice(0, idx + 1).reduce((s, p) => s + p.value, 0);
                const cumDataDays = trend.slice(0, idx + 1).reduce((s, p) => s + p.dataDays, 0);
                const localDrr = cumDataDays > 0 ? cumSum / cumDataDays : 0;
                return { date: point.date, value: Math.round(localDrr * daysInMonth) };
            });

            return {
                overallSales,
                comparisonSales,
                changePercentage,
                mtdSales,
                mtdChangePercentage,
                drr,
                drrChangePercentage,
                projectedSales,
                projectedChangePercentage,
                actualDataDays,
                prevMonthSales,
                reqRunRate,
                reqRunRateGap,
                forecastAccuracy,
                trend,
                mtdTrend,
                drrTrend,
                projectedTrend
            };
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (error) {
        console.error('[getSalesOverview] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Sales Drilldown - Hierarchical Table (ClickHouse version)
 * Platform -> Region -> City -> Category
 */
export const getSalesDrilldown = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('sales_drilldown_ch', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { level, platform, region, location, startDate, endDate, brand } = req.query;

            const end = endDate ? dayjs(endDate) : dayjs();
            const mtdS = end.startOf('month').format('YYYY-MM-DD');
            const mtdE = end.format('YYYY-MM-DD');
            const prevMtdS = end.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
            const prevMtdE = end.subtract(1, 'month').format('YYYY-MM-DD');
            const ytdS = end.startOf('year').format('YYYY-MM-DD');
            const lastYearS = end.subtract(1, 'year').startOf('month').format('YYYY-MM-DD');
            const lastYearE = end.subtract(1, 'year').format('YYYY-MM-DD');

            // Build ClickHouse conditions
            const conditions = ["toString(Comp_flag) = '0'"];
            if (brand && brand !== 'All') {
                conditions.push(buildCHMultiCondition(brand, 'Brand', { isBrand: true }));
            }
            if (platform && platform !== 'All') {
                conditions.push(buildCHMultiCondition(platform, 'Platform'));
            }
            if (location && location !== 'All') {
                conditions.push(buildCHMultiCondition(location, 'Location'));
            }
            const whereClause = conditions.join(' AND ');

            let groupByField = 'Location';
            if (level === 'platform' || !level) groupByField = 'Platform';
            else if (level === 'category') groupByField = 'Category';

            const query = `
                SELECT 
                    ${groupByField} as groupKey,
                    sum(if(toDate(DATE) BETWEEN '${mtdS}' AND '${mtdE}', toFloat64OrZero(Sales), 0)) as mtd,
                    sum(if(toDate(DATE) BETWEEN '${prevMtdS}' AND '${prevMtdE}', toFloat64OrZero(Sales), 0)) as prevMtd,
                    sum(if(toDate(DATE) >= '${ytdS}', toFloat64OrZero(Sales), 0)) as ytd,
                    sum(if(toDate(DATE) BETWEEN '${lastYearS}' AND '${lastYearE}', toFloat64OrZero(Sales), 0)) as lastYear
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY ${groupByField}
            `;

            const results = await queryClickHouse(query);

            // Load location mapping for region association
            const mappingQuery = `SELECT location_sales, region FROM rb_location_darkstore`;
            const mappingRows = await queryClickHouse(mappingQuery);
            const locMap = {};
            mappingRows.forEach(m => {
                if (m.location_sales) {
                    const k = m.location_sales.toLowerCase().trim();
                    if (!locMap[k]) locMap[k] = m.region || 'Unknown';
                }
            });

            const elapsed = end.date() || 1;
            const totalDays = end.daysInMonth();

            let intermediateData = [];

            if (level === 'region') {
                const regMap = {};
                results.forEach(r => {
                    const k = (r.groupKey || '').toLowerCase().trim();
                    const reg = locMap[k] || 'Unknown';
                    if (!regMap[reg]) regMap[reg] = { name: reg, mtd: 0, prevMtd: 0, ytd: 0, lastYear: 0 };
                    regMap[reg].mtd += parseFloat(r.mtd || 0);
                    regMap[reg].prevMtd += parseFloat(r.prevMtd || 0);
                    regMap[reg].ytd += parseFloat(r.ytd || 0);
                    regMap[reg].lastYear += parseFloat(r.lastYear || 0);
                });
                intermediateData = Object.values(regMap);
            } else if (level === 'city') {
                results.forEach(r => {
                    const k = (r.groupKey || '').toLowerCase().trim();
                    const reg = locMap[k] || 'Unknown';
                    if (!region || region === 'All' || reg === region) {
                        intermediateData.push({
                            name: r.groupKey,
                            mtd: parseFloat(r.mtd || 0),
                            prevMtd: parseFloat(r.prevMtd || 0),
                            ytd: parseFloat(r.ytd || 0),
                            lastYear: parseFloat(r.lastYear || 0)
                        });
                    }
                });
            } else {
                intermediateData = results.map(r => ({
                    name: r.groupKey || 'Unknown',
                    mtd: parseFloat(r.mtd || 0),
                    prevMtd: parseFloat(r.prevMtd || 0),
                    ytd: parseFloat(r.ytd || 0),
                    lastYear: parseFloat(r.lastYear || 0)
                }));
            }

            return intermediateData.map(d => {
                const mtdValue = d.mtd || 0;
                const dailyRate = mtdValue / elapsed;
                return {
                    name: d.name,
                    mtdSales: mtdValue,
                    prevMonthMtd: d.prevMtd,
                    currentDrr: dailyRate,
                    projectedSales: dailyRate * totalDays,
                    ytdSales: d.ytd,
                    lastYearSales: d.lastYear
                };
            }).filter(item => item.mtdSales > 0 || item.prevMonthMtd > 0 || item.ytdSales > 0 || item.name !== 'Unknown');
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (error) {
        console.error('[getSalesDrilldown] Error:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};


/**
 * Category Sales Matrix (ClickHouse version)
 */
export const getCategorySalesMatrix = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('sales_category_matrix_ch', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { platform, brand, location, region, startDate, endDate } = req.query;

            const end = endDate ? dayjs(endDate) : dayjs();
            const mtdS = end.startOf('month').format('YYYY-MM-DD');
            const mtdE = end.format('YYYY-MM-DD');

            const prevMtdS = end.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
            const prevMtdE = end.subtract(1, 'month').format('YYYY-MM-DD');
            const prevMonthFullE = end.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');

            const ytdS = end.startOf('year').format('YYYY-MM-DD');
            const lastYearS = end.subtract(1, 'year').startOf('year').format('YYYY-MM-DD');
            const lastYearE = end.subtract(1, 'year').format('YYYY-MM-DD');
            const lastYearFullS = end.subtract(1, 'year').startOf('year').format('YYYY-MM-DD');
            const lastYearFullE = end.subtract(1, 'year').endOf('year').format('YYYY-MM-DD');

            // Build ClickHouse conditions
            const conditions = ["toString(Comp_flag) = '0'"];
            if (platform && platform !== 'All') {
                conditions.push(buildCHMultiCondition(platform, 'Platform'));
            }
            if (brand && brand !== 'All') {
                conditions.push(buildCHMultiCondition(brand, 'Brand', { isBrand: true }));
            }
            if (location && location !== 'All') {
                conditions.push(buildCHMultiCondition(location, 'Location'));
            }

            // Filter by active categories from rca_sku_dim
            const activeCategoriesResult = await queryClickHouse(`SELECT DISTINCT category FROM rca_sku_dim WHERE toString(status) = '1'`);
            const activeCategories = activeCategoriesResult.map(r => r.category).filter(Boolean);

            if (activeCategories.length > 0) {
                conditions.push(`Category IN (${activeCategories.map(c => `'${escapeCH(c)}'`).join(',')})`);
            } else {
                // If no active categories found, fallback to all but prevent error
                conditions.push('1=1');
            }

            const whereClause = conditions.join(' AND ');

            const query = `
                SELECT 
                    Category as category,
                    sum(if(toDate(DATE) BETWEEN '${mtdS}' AND '${mtdE}', toFloat64OrZero(Sales), 0)) as mtd,
                    sum(if(toDate(DATE) BETWEEN '${prevMtdS}' AND '${prevMtdE}', toFloat64OrZero(Sales), 0)) as prevMtd,
                    sum(if(toDate(DATE) BETWEEN '${prevMtdS}' AND '${prevMonthFullE}', toFloat64OrZero(Sales), 0)) as prevMonthFull,
                    sum(if(toDate(DATE) BETWEEN '${ytdS}' AND '${mtdE}', toFloat64OrZero(Sales), 0)) as ytd,
                    sum(if(toDate(DATE) BETWEEN '${lastYearS}' AND '${lastYearE}', toFloat64OrZero(Sales), 0)) as lastYearMtd,
                    sum(if(toDate(DATE) BETWEEN '${lastYearFullS}' AND '${lastYearFullE}', toFloat64OrZero(Sales), 0)) as lastYearFull
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY Category
            `;

            const results = await queryClickHouse(query);

            // Fetch daily trend data
            const trendQuery = `
                SELECT 
                    Category,
                    toDate(DATE) as date,
                    sum(toFloat64OrZero(Sales)) as dailySales
                FROM rb_pdp_olap
                WHERE ${whereClause}
                  AND toDate(DATE) BETWEEN '${mtdS}' AND '${mtdE}'
                GROUP BY Category, toDate(DATE)
                ORDER BY date ASC
            `;

            const trendResults = await queryClickHouse(trendQuery);

            const trendMap = {};
            trendResults.forEach(tr => {
                const cat = tr.Category || 'Other';
                if (!trendMap[cat]) trendMap[cat] = [];
                trendMap[cat].push({ date: tr.date, value: parseFloat(tr.dailySales || 0) });
            });

            const elapsed = end.date() || 1;
            const totalDays = end.daysInMonth();

            const calculateDelta = (curr, prev) => {
                if (!prev || prev === 0) return 0;
                return ((curr - prev) / prev) * 100;
            };

            return results.map(r => {
                const catName = r.category || 'Other';
                const mtd = parseFloat(r.mtd || 0);
                const prevMtd = parseFloat(r.prevMtd || 0);
                const prevMonthFull = parseFloat(r.prevMonthFull || 0);
                const ytd = parseFloat(r.ytd || 0);
                const lastYearMtd = parseFloat(r.lastYearMtd || 0);
                const lastYearFull = parseFloat(r.lastYearFull || 0);

                const drr = mtd / elapsed;
                const prevDrr = prevMtd / (end.subtract(1, 'month').date() || 1);
                const projected = drr * totalDays;

                const trend = trendMap[catName] || [];

                return {
                    category: catName,
                    metrics: {
                        mtd: { value: mtd, delta: calculateDelta(mtd, prevMtd), trend },
                        prevMtd: { value: prevMtd, delta: calculateDelta(prevMtd, lastYearMtd), trend },
                        drr: { value: drr, delta: calculateDelta(drr, prevDrr), trend },
                        ytd: { value: ytd, delta: calculateDelta(ytd, lastYearMtd), trend },
                        lastYear: { value: lastYearFull, delta: calculateDelta(lastYearFull, lastYearMtd), trend: [] },
                        projected: { value: projected, delta: calculateDelta(projected, prevMonthFull), trend }
                    }
                };
            }).filter(r => r.metrics.mtd.value > 0 || r.metrics.prevMtd.value > 0 || r.category !== 'Other');
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (error) {
        console.error('[getCategorySalesMatrix] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


/**
 * Sales Trends - for Detailed Chart Drawer (ClickHouse version)
 */
export const getSalesTrends = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('sales_trends_ch', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { platform, brand, location, region, startDate, endDate, category } = req.query;

            // Build ClickHouse conditions
            const conditions = ["toString(Comp_flag) = '0'"];
            if (platform && platform !== 'All') {
                conditions.push(buildCHMultiCondition(platform, 'Platform'));
            }
            if (brand && brand !== 'All') {
                conditions.push(buildCHMultiCondition(brand, 'Brand', { isBrand: true }));
            }
            if (location && location !== 'All') {
                conditions.push(buildCHMultiCondition(location, 'Location'));
            }
            if (category && category !== 'All') {
                conditions.push(`Category = '${escapeCH(category)}'`);
            }

            const start = startDate ? dayjs(startDate) : dayjs().startOf('month');
            const end = endDate ? dayjs(endDate) : dayjs();
            const startStr = start.format('YYYY-MM-DD');
            const endStr = end.format('YYYY-MM-DD');

            conditions.push(`toDate(DATE) BETWEEN '${startStr}' AND '${endStr}'`);
            const whereClause = conditions.join(' AND ');
            console.log('[getSalesTrends] Where Clause:', whereClause);

            const query = `
                SELECT 
                    toDate(DATE) as date,
                    sum(toFloat64OrZero(Sales)) as sales
                FROM rb_pdp_olap
                WHERE ${whereClause}
                GROUP BY toDate(DATE)
                ORDER BY date ASC
            `;

            const dailyData = await queryClickHouse(query);
            console.log(`[getSalesTrends] Found ${dailyData?.length || 0} rows`);

            let cumulative = 0;
            const daysInMonth = end.daysInMonth();

            return dailyData.map((d, index) => {
                const dateObj = dayjs(d.date);
                const sales = parseFloat(d.sales || 0);
                cumulative += sales;
                const dayOfMonth = dateObj.date();

                // Remove the division by 10^7 (1 Crore) to show raw data
                // The frontend or chart can handle scaling if needed
                return {
                    date: dateObj.format('DD MMM\'YY'),
                    overall_sales: sales,
                    mtd_sales: cumulative,
                    current_drr: cumulative / dayOfMonth,
                    projected_sales: (cumulative / dayOfMonth) * daysInMonth,
                };
            });
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (error) {
        console.error('[getSalesTrends] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const getSalesFilterOptions = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('sales_filter_options_ch', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const [platforms, brands, categories, locations] = await Promise.all([
                queryClickHouse(`SELECT DISTINCT Platform FROM rb_pdp_olap WHERE Platform != '' ORDER BY Platform`),
                queryClickHouse(`SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand != '' AND toString(Comp_flag) = '0' ORDER BY Brand`),
                queryClickHouse(`SELECT DISTINCT Category FROM rb_pdp_olap WHERE Category != '' AND toString(Comp_flag) = '0' ORDER BY Category`),
                queryClickHouse(`SELECT DISTINCT Location FROM rb_pdp_olap WHERE Location != '' ORDER BY Location`),
            ]);

            return {
                platforms: platforms.map(p => p.Platform).filter(Boolean).sort(),
                brands: brands.map(b => b.Brand).filter(Boolean).sort(),
                categories: categories.map(c => c.Category).filter(Boolean).sort(),
                locations: locations.map(l => l.Location).filter(Boolean).sort(),
            };
        }, 86400); // 24 hours for filters

        res.json(data);
    } catch (error) {
        console.error('[getSalesFilterOptions] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

