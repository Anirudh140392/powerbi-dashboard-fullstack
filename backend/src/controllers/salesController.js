import RbPdpOlap from '../models/RbPdpOlap.js';
import { Op, Sequelize } from 'sequelize';
import dayjs from 'dayjs';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';

/**
 * Helper to handle multi-select filters (comma-separated strings)
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
 * Sales Overview - KPI Cards
 */
export const getSalesOverview = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('sales_overview', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { platform, brand, location, region, startDate, endDate, compareStartDate, compareEndDate } = req.query;

            // Base filters
            const baseWhere = { Comp_flag: 0 };
            handleMultiSelect(platform, 'Platform', baseWhere);
            handleMultiSelect(brand, 'Brand', baseWhere);
            handleMultiSelect(location, 'Location', baseWhere);

            // Region filter requires checking the mapping table via EXISTS
            if (region && region !== 'All') {
                const regionClause = region === 'Unknown'
                    ? 'NOT EXISTS'
                    : `EXISTS (SELECT 1 FROM rb_location_darkstore WHERE location_sales = \`rb_pdp_olap\`.\`Location\` AND region = '${region.replace(/'/g, "''")}')`;

                baseWhere[Op.and] = [Sequelize.literal(regionClause)];
            }

            const currentEnd = endDate ? dayjs(endDate) : dayjs();
            const daysInInterval = startDate && endDate ? dayjs(endDate).diff(dayjs(startDate), 'day') + 1 : 1;

            // 1. Overall Sales in selected range
            const overallWhere = { ...baseWhere };
            if (startDate && endDate) {
                overallWhere.DATE = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }
            const overallRes = await RbPdpOlap.findOne({
                attributes: [[Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('Sales')), 0), 'total']],
                where: overallWhere,
                raw: true
            });
            const overallSales = parseFloat(overallRes?.total || 0);

            // 2. Comparison Period Sales
            let comparisonSales = 0;
            if (compareStartDate && compareEndDate) {
                const compWhere = { ...baseWhere, DATE: { [Op.between]: [new Date(compareStartDate), new Date(compareEndDate)] } };
                const compRes = await RbPdpOlap.findOne({
                    attributes: [[Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('Sales')), 0), 'total']],
                    where: compWhere,
                    raw: true
                });
                comparisonSales = parseFloat(compRes?.total || 0);
            }

            // 3. MTD Sales (Month of the endDate)
            const mtdStart = currentEnd.startOf('month').toDate();
            const mtdWhere = { ...baseWhere, DATE: { [Op.between]: [mtdStart, currentEnd.toDate()] } };
            const mtdRes = await RbPdpOlap.findOne({
                attributes: [[Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('Sales')), 0), 'total']],
                where: mtdWhere,
                raw: true
            });
            const mtdSales = parseFloat(mtdRes?.total || 0);

            // 4. Calculations
            const drr = daysInInterval > 0 ? overallSales / daysInInterval : 0;
            const mtdDaysElapsed = currentEnd.date() || 1;
            const projectedSales = (mtdSales / mtdDaysElapsed) * currentEnd.daysInMonth();

            // 5. Daily Trend for Sparklines
            const trendRes = await RbPdpOlap.findAll({
                attributes: [
                    [Sequelize.fn('DATE', Sequelize.col('DATE')), 'date'],
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'value']
                ],
                where: overallWhere,
                group: [Sequelize.fn('DATE', Sequelize.col('DATE'))],
                order: [[Sequelize.fn('DATE', Sequelize.col('DATE')), 'ASC']],
                raw: true
            });

            // 6. MTD Trend for Sparklines
            const mtdTrendRes = await RbPdpOlap.findAll({
                attributes: [
                    [Sequelize.fn('DATE', Sequelize.col('DATE')), 'date'],
                    [Sequelize.fn('SUM', Sequelize.col('Sales')), 'value']
                ],
                where: mtdWhere,
                group: [Sequelize.fn('DATE', Sequelize.col('DATE'))],
                order: [[Sequelize.fn('DATE', Sequelize.col('DATE')), 'ASC']],
                raw: true
            });

            // Map and format trends
            const trend = trendRes.map(t => ({
                date: dayjs(t.date).format('DD MMM'),
                value: parseFloat(t.value || 0)
            }));

            const mtdTrend = mtdTrendRes.map(t => ({
                date: dayjs(t.date).format('DD MMM'),
                value: parseFloat(t.value || 0)
            }));

            // Calculate change percentages
            const mtdPrevStart = currentEnd.subtract(1, 'month').startOf('month').toDate();
            const mtdPrevEnd = currentEnd.subtract(1, 'month').toDate(); // same day last month
            const mtdPrevWhere = { ...baseWhere, DATE: { [Op.between]: [mtdPrevStart, mtdPrevEnd] } };
            const mtdPrevRes = await RbPdpOlap.findOne({
                attributes: [[Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('Sales')), 0), 'total']],
                where: mtdPrevWhere,
                raw: true
            });
            const mtdPrevSales = parseFloat(mtdPrevRes?.total || 0);

            return {
                overallSales,
                comparisonSales,
                changePercentage: comparisonSales > 0 ? ((overallSales - comparisonSales) / comparisonSales) * 100 : null,
                mtdSales,
                mtdChangePercentage: mtdPrevSales > 0 ? ((mtdSales - mtdPrevSales) / mtdPrevSales) * 100 : null,
                drr,
                projectedSales,
                trend,
                mtdTrend
            };
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (error) {
        console.error('[getSalesOverview] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Sales Drilldown - Hierarchical Table
 * Platform -> Region -> City -> Category
 */
export const getSalesDrilldown = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('sales_drilldown', req.query);

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

            const RbLocationDarkstore = (await import('../models/RbLocationDarkstore.js')).default;

            // Base Filters
            const where = { Comp_flag: 0 };
            handleMultiSelect(brand, 'Brand', where);
            handleMultiSelect(platform, 'Platform', where);

            // Contextual filters from drilldown
            handleMultiSelect(location, 'Location', where);
            // Region filter is handled by JS mapping for consistency on drilldown from Platform -> Region

            let groupByField = 'Location'; // Default for Region and City level
            if (level === 'platform' || !level) groupByField = 'Platform';
            else if (level === 'category') groupByField = 'Category';

            const attributes = [
                [groupByField, 'groupKey'],
                [Sequelize.literal(`COALESCE(SUM(CASE WHEN \`DATE\` BETWEEN '${mtdS}' AND '${mtdE}' THEN \`Sales\` ELSE 0 END), 0)`), 'mtd'],
                [Sequelize.literal(`COALESCE(SUM(CASE WHEN \`DATE\` BETWEEN '${prevMtdS}' AND '${prevMtdE}' THEN \`Sales\` ELSE 0 END), 0)`), 'prevMtd'],
                [Sequelize.literal(`COALESCE(SUM(CASE WHEN \`DATE\` >= '${ytdS}' THEN \`Sales\` ELSE 0 END), 0)`), 'ytd'],
                [Sequelize.literal(`COALESCE(SUM(CASE WHEN \`DATE\` BETWEEN '${lastYearS}' AND '${lastYearE}' THEN \`Sales\` ELSE 0 END), 0)`), 'lastYear'],
            ];

            // Fetch aggregated data
            const results = await RbPdpOlap.findAll({
                attributes,
                where,
                group: [groupByField],
                raw: true
            });

            // Load Mapping table for Region association
            const mappingRows = await RbLocationDarkstore.findAll({ attributes: ['location_sales', 'region'], raw: true });
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
                // Aggregate cities into regions
                const regMap = {};
                results.forEach(r => {
                    const k = (r.groupKey || '').toLowerCase().trim();
                    const reg = locMap[k] || 'Unknown';
                    if (!regMap[reg]) regMap[reg] = { name: reg, mtd: 0, prevMtd: 0, ytd: 0, lastYear: 0 };
                    regMap[reg].mtd += parseFloat(r.mtd);
                    regMap[reg].prevMtd += parseFloat(r.prevMtd);
                    regMap[reg].ytd += parseFloat(r.ytd);
                    regMap[reg].lastYear += parseFloat(r.lastYear);
                });
                intermediateData = Object.values(regMap);
            } else if (level === 'city') {
                // Filter cities by the selected region
                results.forEach(r => {
                    const k = (r.groupKey || '').toLowerCase().trim();
                    const reg = locMap[k] || 'Unknown';
                    if (!region || region === 'All' || reg === region) {
                        intermediateData.push({
                            name: r.groupKey,
                            mtd: parseFloat(r.mtd),
                            prevMtd: parseFloat(r.prevMtd),
                            ytd: parseFloat(r.ytd),
                            lastYear: parseFloat(r.lastYear)
                        });
                    }
                });
            } else {
                // Platform or Category level
                intermediateData = results.map(r => ({
                    name: r.groupKey || 'Unknown',
                    mtd: parseFloat(r.mtd),
                    prevMtd: parseFloat(r.prevMtd),
                    ytd: parseFloat(r.ytd),
                    lastYear: parseFloat(r.lastYear)
                }));
            }

            // Final formatting with business logic
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
 * Category Sales Matrix
 */
export const getCategorySalesMatrix = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('sales_category_matrix', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { platform, brand, location, region, startDate, endDate } = req.query;

            const end = endDate ? dayjs(endDate) : dayjs();
            const mtdS = end.startOf('month').format('YYYY-MM-DD');
            const mtdE = end.format('YYYY-MM-DD');

            // Comparison periods
            const prevMtdS = end.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
            const prevMtdE = end.subtract(1, 'month').format('YYYY-MM-DD');
            const prevMonthFullE = end.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');

            const ytdS = end.startOf('year').format('YYYY-MM-DD');
            const lastYearS = end.subtract(1, 'year').startOf('year').format('YYYY-MM-DD');
            const lastYearE = end.subtract(1, 'year').format('YYYY-MM-DD');
            const lastYearFullS = end.subtract(1, 'year').startOf('year').format('YYYY-MM-DD');
            const lastYearFullE = end.subtract(1, 'year').endOf('year').format('YYYY-MM-DD');

            // Base filters
            const where = { Comp_flag: 0 };
            handleMultiSelect(platform, 'Platform', where);
            handleMultiSelect(brand, 'Brand', where);
            handleMultiSelect(location, 'Location', where);

            // Region filter (using the same logic as getSalesOverview)
            if (region && region !== 'All') {
                const regionClause = region === 'Unknown'
                    ? 'NOT EXISTS'
                    : `EXISTS (SELECT 1 FROM rb_location_darkstore WHERE location_sales = \`rb_pdp_olap\`.\`Location\` AND region = '${region.replace(/'/g, "''")}')`;
                where[Op.and] = [Sequelize.literal(regionClause)];
            }

            const attributes = [
                ['Category', 'category'],
                [Sequelize.literal(`COALESCE(SUM(CASE WHEN \`DATE\` BETWEEN '${mtdS}' AND '${mtdE}' THEN \`Sales\` ELSE 0 END), 0)`), 'mtd'],
                [Sequelize.literal(`COALESCE(SUM(CASE WHEN \`DATE\` BETWEEN '${prevMtdS}' AND '${prevMtdE}' THEN \`Sales\` ELSE 0 END), 0)`), 'prevMtd'],
                [Sequelize.literal(`COALESCE(SUM(CASE WHEN \`DATE\` BETWEEN '${prevMtdS}' AND '${prevMonthFullE}' THEN \`Sales\` ELSE 0 END), 0)`), 'prevMonthFull'],
                [Sequelize.literal(`COALESCE(SUM(CASE WHEN \`DATE\` BETWEEN '${ytdS}' AND '${mtdE}' THEN \`Sales\` ELSE 0 END), 0)`), 'ytd'],
                [Sequelize.literal(`COALESCE(SUM(CASE WHEN \`DATE\` BETWEEN '${lastYearS}' AND '${lastYearE}' THEN \`Sales\` ELSE 0 END), 0)`), 'lastYearMtd'],
                [Sequelize.literal(`COALESCE(SUM(CASE WHEN \`DATE\` BETWEEN '${lastYearFullS}' AND '${lastYearFullE}' THEN \`Sales\` ELSE 0 END), 0)`), 'lastYearFull'],
            ];

            const results = await RbPdpOlap.findAll({
                attributes,
                where,
                group: ['Category'],
                raw: true
            });

            // Fetch daily trend data for all categories in the MTD range
            const trendResults = await RbPdpOlap.findAll({
                attributes: [
                    'Category',
                    [Sequelize.fn('DATE', Sequelize.col('DATE')), 'date'],
                    [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('Sales')), 0), 'dailySales']
                ],
                where: {
                    ...where,
                    DATE: { [Op.between]: [new Date(mtdS), new Date(mtdE)] }
                },
                group: ['Category', Sequelize.fn('DATE', Sequelize.col('DATE'))],
                order: [[Sequelize.fn('DATE', Sequelize.col('DATE')), 'ASC']],
                raw: true
            });

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
 * Sales Trends - for Detailed Chart Drawer
 */
export const getSalesTrends = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('sales_trends', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { platform, brand, location, region, startDate, endDate, category } = req.query;

            const baseWhere = { Comp_flag: 0 };
            handleMultiSelect(platform, 'Platform', baseWhere);
            handleMultiSelect(brand, 'Brand', baseWhere);
            handleMultiSelect(location, 'Location', baseWhere);
            if (category && category !== 'All') baseWhere.Category = category;

            if (region && region !== 'All') {
                const regionClause = region === 'Unknown'
                    ? 'NOT EXISTS'
                    : `EXISTS (SELECT 1 FROM rb_location_darkstore WHERE location_sales = \`rb_pdp_olap\`.\`Location\` AND region = '${region.replace(/'/g, "''")}')`;
                baseWhere[Op.and] = [Sequelize.literal(regionClause)];
            }

            const start = startDate ? dayjs(startDate) : dayjs().startOf('month');
            const end = endDate ? dayjs(endDate) : dayjs();

            const dailyData = await RbPdpOlap.findAll({
                attributes: [
                    'DATE',
                    [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('Sales')), 0), 'sales']
                ],
                where: {
                    ...baseWhere,
                    DATE: { [Op.between]: [start.toDate(), end.toDate()] }
                },
                group: ['DATE'],
                order: [['DATE', 'ASC']],
                raw: true
            });

            let cumulative = 0;
            const daysInMonth = end.daysInMonth();

            return dailyData.map((d, index) => {
                const dateObj = dayjs(d.DATE);
                const sales = parseFloat(d.sales || 0);
                cumulative += sales;
                const dayOfMonth = dateObj.date();

                return {
                    date: dateObj.format('DD MMM\'YY'),
                    overall_sales: parseFloat((sales / 10000000).toFixed(2)),
                    mtd_sales: parseFloat((cumulative / 10000000).toFixed(2)),
                    current_drr: parseFloat(((cumulative / dayOfMonth) / 10000000).toFixed(2)),
                    projected_sales: parseFloat((((cumulative / dayOfMonth) * daysInMonth) / 10000000).toFixed(2)),
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
        const cacheKey = generateCacheKey('sales_filter_options', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const { platform, brand, location } = req.query;

            // Optional filters for cross-filtering
            const baseWhere = { Comp_flag: 0 };
            handleMultiSelect(platform, 'Platform', baseWhere);
            handleMultiSelect(brand, 'Brand', baseWhere);
            handleMultiSelect(location, 'Location', baseWhere);

            const [platforms, brands, categories, locations] = await Promise.all([
                RbPdpOlap.findAll({ attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Platform')), 'Platform']], raw: true }),
                RbPdpOlap.findAll({ attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Brand')), 'Brand']], raw: true }),
                RbPdpOlap.findAll({
                    attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Category')), 'Category']],
                    where: baseWhere,
                    raw: true
                }),
                RbPdpOlap.findAll({ attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Location')), 'Location']], raw: true }),
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
