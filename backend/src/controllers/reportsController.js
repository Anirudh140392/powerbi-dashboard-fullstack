import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';
import { getTableColumns, resolveColumn } from '../utils/schemaHelper.js';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

/**
 * Check if a table exists in the current ClickHouse database
 */
const checkTableExists = async (tableName) => {
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${tableName}`);
        const exists = result && result[0] && result[0].result === 1;
        console.log(`[checkTableExists] ${tableName} -> raw: ${JSON.stringify(result?.[0])} -> exists: ${exists}`);
        return exists;
    } catch (error) {
        console.warn(`[Reports] Table existence check failed for ${tableName}:`, error.message);
        return false;
    }
};

/**
 * Get filter options for Scheduled Reports
 */
export const getReportFilterOptions = async (req, res) => {
    try {
        const { platform, brand, city, format } = req.query;
        const cacheKey = generateCacheKey('report_filter_options_ch_v2', req.query);

        // Dynamically determine the Category column to avoid hardcoding "Product_type"
        const pdpCols = await getTableColumns('rb_pdp_olap');
        let catCol = 'Product_type';
        if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');
        else if (pdpCols.has('category')) catCol = pdpCols.get('category');
        else if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category'); // For specific casing fallback if mapped

        const data = await getCachedOrCompute(cacheKey, async () => {
            const buildWhere = (excludeField) => {
                const conditions = [];

                const addInClause = (column, value) => {
                    if (!value || value === 'All' || value.startsWith('All ') || value === 'All Platforms' || value.trim() === '') return;
                    const items = value.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');
                    conditions.push(`lower(${column}) IN (${items})`);
                };

                if (excludeField !== 'Platform') addInClause('Platform', platform);
                if (excludeField !== 'Brand') addInClause('Brand', brand);
                if (excludeField !== 'Location') addInClause('Location', city);
                if (excludeField !== catCol) addInClause(catCol, format);

                return conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';
            };

            let platformQuery = `SELECT DISTINCT Platform FROM rb_pdp_olap WHERE Platform != '' AND Platform IS NOT NULL ${buildWhere('Platform')} ORDER BY Platform`;

            let brandQuery = `SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand != '' AND Brand IS NOT NULL AND toString(Comp_flag) = '0' ${buildWhere('Brand')} ORDER BY Brand`;

            let locationQuery = `SELECT DISTINCT Location FROM rb_pdp_olap WHERE Location != '' AND Location IS NOT NULL ${buildWhere('Location')} ORDER BY Location`;

            let formatQuery = `SELECT DISTINCT ${catCol} as CatLabel FROM rb_pdp_olap WHERE ${catCol} != '' AND ${catCol} IS NOT NULL ${buildWhere(catCol)} ORDER BY CatLabel`;

            let skuQuery = `SELECT DISTINCT Product FROM rb_pdp_olap WHERE Product != '' AND Product IS NOT NULL ${buildWhere('Product')} ORDER BY Product`;

            let monthsQuery = `SELECT DISTINCT formatDateTime(DATE, '%Y-%m') as Month FROM rb_pdp_olap WHERE DATE IS NOT NULL ORDER BY Month DESC`;

            const [platforms, brands, locations, formats, skus, months] = await Promise.all([
                queryClickHouse(platformQuery),
                queryClickHouse(brandQuery),
                queryClickHouse(locationQuery),
                queryClickHouse(formatQuery),
                queryClickHouse(skuQuery),
                queryClickHouse(monthsQuery)
            ]);

            const capitalize = (str) => {
                if (!str) return str;
                return str.toString().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            };

            // Safely get the first value of the object regardless of what casing ClickHouse assigned the key
            const getColVal = (row) => row ? Object.values(row)[0] : null;

            // Deduplicate options if case variations exist (e.g. 'amazon', 'Amazon')
            const uniqueMap = (arr) => [...new Set(arr.map(getColVal).filter(Boolean).map(capitalize))];

            return {
                platforms: uniqueMap(platforms),
                brands: uniqueMap(brands),
                cities: uniqueMap(locations),
                formats: uniqueMap(formats),
                skus: uniqueMap(skus),
                months: months.map(getColVal).filter(Boolean)
            };
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (error) {
        console.error('[getReportFilterOptions] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get builder-specific options for the Report Builder wizard.
 * Returns all dynamic select/toggle options needed by the wizard steps.
 */
export const getReportBuilderOptions = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('report_builder_options_v1', {});
        const pdpCols = await getTableColumns('rb_pdp_olap');

        // Resolve the category column dynamically
        let catCol = 'Product_type';
        if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');
        else if (pdpCols.has('category')) catCol = pdpCols.get('category');

        const col = (name) => resolveColumn(pdpCols, name, '0');
        const hasRegion = pdpCols.has('region');
        const hasSubCategory = pdpCols.has('sub_category') || pdpCols.has('subcategory');
        const subCatCol = pdpCols.has('sub_category') ? pdpCols.get('sub_category')
            : pdpCols.has('subcategory') ? pdpCols.get('subcategory')
                : null;

        const data = await getCachedOrCompute(cacheKey, async () => {
            const queries = {
                platforms: `SELECT DISTINCT Platform FROM rb_pdp_olap WHERE Platform != '' AND Platform IS NOT NULL ORDER BY Platform`,
                categories: `SELECT DISTINCT ${catCol} as val FROM rb_pdp_olap WHERE ${catCol} != '' AND ${catCol} IS NOT NULL ORDER BY val`,
                brandsOwn: `SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand != '' AND Brand IS NOT NULL AND toString(Comp_flag) = '0' ORDER BY Brand`,
                brandsAll: `SELECT DISTINCT Brand FROM rb_pdp_olap WHERE Brand != '' AND Brand IS NOT NULL ORDER BY Brand`,
                skuOwn: `SELECT DISTINCT Product FROM rb_pdp_olap WHERE Product != '' AND Product IS NOT NULL AND toString(Comp_flag) = '0' ORDER BY Product`,
                skuAll: `SELECT DISTINCT Product FROM rb_pdp_olap WHERE Product != '' AND Product IS NOT NULL ORDER BY Product`,
                cities: `SELECT DISTINCT Location FROM rb_pdp_olap WHERE Location != '' AND Location IS NOT NULL ORDER BY Location`,
            };

            if (hasSubCategory && subCatCol) {
                queries.subCategories = `SELECT DISTINCT ${subCatCol} as val FROM rb_pdp_olap WHERE ${subCatCol} != '' AND ${subCatCol} IS NOT NULL ORDER BY val`;
            }
            if (hasRegion) {
                queries.regions = `SELECT DISTINCT ${pdpCols.get('region')} as val FROM rb_pdp_olap WHERE ${pdpCols.get('region')} != '' AND ${pdpCols.get('region')} IS NOT NULL ORDER BY val`;
            }

            const keys = Object.keys(queries);
            const results = await Promise.all(keys.map(k => queryClickHouse(queries[k])));

            const out = {};
            keys.forEach((k, i) => {
                const rows = results[i] || [];
                if (k === 'platforms') out.platforms = rows.map(r => r.Platform).filter(Boolean);
                else if (k === 'categories') out.categories = rows.map(r => r.val).filter(Boolean);
                else if (k === 'subCategories') out.subCategories = rows.map(r => r.val).filter(Boolean);
                else if (k === 'brandsOwn') out.brandsOwn = rows.map(r => r.Brand).filter(Boolean);
                else if (k === 'brandsAll') out.brandsAll = rows.map(r => r.Brand).filter(Boolean);
                else if (k === 'skuOwn') out.skuOwn = rows.map(r => r.Product).filter(Boolean);
                else if (k === 'skuAll') out.skuAll = rows.map(r => r.Product).filter(Boolean);
                else if (k === 'cities') out.cities = rows.map(r => r.Location).filter(Boolean);
                else if (k === 'regions') out.regions = rows.map(r => r.val).filter(Boolean);
            });

            // Provide defaults so frontend never gets undefined
            if (!out.subCategories) out.subCategories = [];
            if (!out.regions) out.regions = [];

            try {
                const hasDarkstoreTable = await checkTableExists('rb_pdp_week');
                if (hasDarkstoreTable) {
                    const dates = await queryClickHouse('SELECT MIN(toDate(created_on)) as minDate, MAX(toDate(created_on)) as maxDate FROM rb_pdp_week');
                    if (dates && dates[0] && dates[0].minDate) {
                        out.darkstoreDateRange = {
                            minDate: dayjs(dates[0].minDate).format('YYYY-MM-DD'),
                            maxDate: dayjs(dates[0].maxDate).format('YYYY-MM-DD'),
                        };
                    }
                }
            } catch (err) {
                console.error('[getReportBuilderOptions] Error checking darkstoreDateRange:', err);
            }

            return out;
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (error) {
        console.error('[getReportBuilderOptions] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Download Report as Excel
 */
export const downloadReport = async (req, res) => {
    try {
        const { platform, brand, city, format, timePeriod, reportType, startDate: qStart, endDate: qEnd } = req.query;

        // Discover actual column names for rb_pdp_olap (handles case-sensitivity differences)
        const pdpCols = await getTableColumns('rb_pdp_olap');
        // Provide '0' as fallback so queries don't crash if optional columns (like DIH, Ad_Sales) are missing
        const col = (name) => resolveColumn(pdpCols, name, '0');

        const resellerCol = pdpCols.has('reseller_name') ? pdpCols.get('reseller_name')
            : pdpCols.has('reseller') ? pdpCols.get('reseller')
            : null;
        const resellerParam = req.query.resellerName || req.query.reseller;

        // Dynamically determine Category column
        let catCol = 'Product_type';
        if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');
        else if (pdpCols.has('category')) catCol = pdpCols.get('category');
        else if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');

        // 1. Determine Date Range from timePeriod
        let startDate, endDate;
        const now = dayjs();

        if (timePeriod === "Custom Range" && qStart && qEnd) {
            startDate = qStart;
            endDate = qEnd;
        } else if (timePeriod === "Last 7 Days") {
            startDate = now.subtract(7, 'day').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        } else if (timePeriod === "Last 30 Days") {
            startDate = now.subtract(30, 'day').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        } else if (timePeriod === "Last 90 Days") {
            startDate = now.subtract(90, 'day').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        } else if (timePeriod === "Last 6 Months") {
            startDate = now.subtract(6, 'month').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        } else if (timePeriod === "Last Year") {
            startDate = now.subtract(1, 'year').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        } else if (/^\d{4}-\d{2}$/.test(timePeriod)) {
            // Specific month format YYYY-MM
            startDate = dayjs(timePeriod).startOf('month').format('YYYY-MM-DD');
            endDate = dayjs(timePeriod).endOf('month').format('YYYY-MM-DD');
        } else {
            // Default to last 30 days
            startDate = now.subtract(30, 'day').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        }

        const buildInClause = (column, value) => {
            if (!value || value === 'All' || value.startsWith('All ') || value.trim() === '') return null;
            const items = value.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');
            return `lower(${column}) IN (${items})`;
        };

        const dataMode = req.query.dataMode || 'aggregated';

        // ── DARKSTORE DATA EXPORT (rb_pdp_week) for DRL ──
        if (dataMode === 'darkstore' || reportType === 'Darkstore Data') {
            const currentDb = getCurrentDbName() || 'drl';
            const weekTable = (currentDb === 'drl' || currentDb === 'prestige') ? `${currentDb}.rb_pdp_week` : 'drl.rb_pdp_week';

            const darkstoreConds = [];
            const pCond = buildInClause('platform_name', platform);
            if (pCond) darkstoreConds.push(pCond);
            const bCond = buildInClause('brand_name', brand);
            if (bCond) darkstoreConds.push(bCond);
            const lCond = buildInClause('location_name', city);
            if (lCond) darkstoreConds.push(lCond);
            const cCond = buildInClause('brand_category_name', format);
            if (cCond) darkstoreConds.push(cCond);

            darkstoreConds.push(`toDate(created_on) BETWEEN '${startDate}' AND '${endDate}'`);

            const darkstoreWhere = darkstoreConds.length > 0 ? `WHERE ${darkstoreConds.join(' AND ')}` : '';

            const darkstoreQuery = `
                SELECT 
                    toString(created_on) as created_on,
                    platform_name as platform,
                    brand_name as brand,
                    brand_category_name as category,
                    location_name as location,
                    pincode,
                    pincode_area,
                    web_pid,
                    sku_name as sku,
                    pdp_page_url,
                    osa,
                    osa_remark
                FROM ${weekTable}
                ${darkstoreWhere}
                ORDER BY created_on DESC
            `;

            console.log(`[downloadReport] Executing Darkstore query on ${weekTable}:`, darkstoreQuery);
            const rawData = await queryClickHouse(darkstoreQuery);
            console.log(`[downloadReport] Fetched ${rawData?.length || 0} Darkstore rows`);

            if (!rawData || rawData.length === 0) {
                return res.status(204).send();
            }

            const worksheet = XLSX.utils.json_to_sheet(rawData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Darkstore_Data");

            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Darkstore_Data_${dayjs().format('YYYYMMDD')}.xlsx`);
            return res.send(buffer);
        }

        let query = '';
        const conditions = [];

        const platformCond = buildInClause(col('Platform'), platform);
        if (platformCond) conditions.push(platformCond);

        const brandCond = buildInClause(col('Brand'), brand);
        if (brandCond) conditions.push(brandCond);

        const cityCond = buildInClause(col('Location'), city);
        if (cityCond) conditions.push(cityCond);

        const formatCond = buildInClause(catCol, format);
        if (formatCond) conditions.push(formatCond);

        if (resellerCol && resellerParam) {
            const resellerCond = buildInClause(resellerCol, resellerParam);
            if (resellerCond) conditions.push(resellerCond);
        }

        conditions.push(`toDate(${col('DATE')}) BETWEEN '${startDate}' AND '${endDate}'`);

        // Handle Granularity constraints
        const granularitySku = req.query.granularitySku || '';
        if (granularitySku.includes('(Own)') && !granularitySku.includes('Comp')) {
            // Filter to proprietary explicitly
            conditions.push(`toString(Comp_flag) = '0'`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Standard reseller fragments for rb_pdp_olap queries
        const resellerSelect = resellerCol ? `, ${resellerCol} as Reseller_Name` : '';
        const resellerSelectT = resellerCol ? `, t.${resellerCol} as Reseller_Name` : '';
        const resellerGroup = resellerCol ? `, ${resellerCol}` : '';
        const resellerGroupT = resellerCol ? `, t.${resellerCol}` : '';

        // Check which optional tables exist for conditional JOINs
        const [hasKwOlap, hasLocationDarkstore] = await Promise.all([
            checkTableExists('rb_kw_olap'),
            checkTableExists('rb_location_darkstore'),
        ]);

        if (reportType === "Availability Analysis") {
            // Build optional CTEs/JOINs based on table existence
            const sosCte = hasKwOlap ? `
                WITH sos_stats AS (
                    SELECT 
                        toDate(DATE) as DATE, platform_name as Platform, brand as Brand, keyword_category as Category,
                        count() as brand_kw_count
                    FROM rb_kw_olap
                    WHERE toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'
                    GROUP BY DATE, Platform, Brand, Category
                ),
                total_kw_stats AS (
                    SELECT 
                        toDate(DATE) as DATE, platform_name as Platform, keyword_category as Category,
                        count() as total_kw_count
                    FROM rb_kw_olap
                    WHERE toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'
                    GROUP BY DATE, Platform, Category
                )` : '';

            const sosJoin = hasKwOlap ? `
                LEFT JOIN sos_stats s ON toDate(t.DATE) = s.DATE AND t.Platform = s.Platform AND t.Brand = s.Brand AND t.${catCol} = s.Category
                LEFT JOIN total_kw_stats tot ON toDate(t.DATE) = tot.DATE AND t.Platform = tot.Platform AND t.${catCol} = tot.Category` : '';

            const metroJoin = hasLocationDarkstore ? `
                LEFT JOIN (
                    SELECT DISTINCT LOWER(location) as location, 1 as is_metro
                    FROM rb_location_darkstore
                    WHERE tier = 'Tier 1'
                ) m ON LOWER(t.Location) = m.location` : '';

            const sosCol = hasKwOlap ? `round(any(s.brand_kw_count) / nullIf(any(tot.total_kw_count), 0) * 100, 2) as SOS_Percentage,` : '';
            const metroCol = hasLocationDarkstore ? `round(SUM(if(m.is_metro = 1, toFloat64(t.${col('neno_osa')}), 0)) / nullIf(SUM(if(m.is_metro = 1, toFloat64(t.${col('deno_osa')}), 0)), 0) * 100, 2) as Metro_City_Stock_Availability` : `0 as Metro_City_Stock_Availability`;

            const hasWebPidInAvail = (req.query.granularitySku || '').includes('SKU');
            const webPidSelectInAvail = hasWebPidInAvail ? `, t.${col('Web_Pid')} as Web_Pid` : '';
            const webPidGroupInAvail = hasWebPidInAvail ? `, t.${col('Web_Pid')}` : '';

            query = `
                ${sosCte}
                SELECT 
                    t.${col('DATE')} as DATE, t.${col('Platform')} as Platform, t.${col('Brand')} as Brand, t.${col('Location')} as City, t.${col(catCol)} as Format, t.${col('Product')} as Product${resellerSelectT}${webPidSelectInAvail},
                    round(SUM(toFloat64(t.${col('neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100, 2) as OSA_Percentage,
                    round(SUM(toFloat64(t.${col('buy_box_neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100, 2) as Buy_Box_Percentage,
                    round(100 - (SUM(toFloat64(t.${col('neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100), 2) as Stock_Out_Percentage,
                    round(avg(toFloat64(t.${col('DIH')})), 2) as DOI,
                    round(SUM(toFloat64(t.${col('buy_box_neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100, 2) as Fillrate_Percentage,
                    ${sosCol}
                    round(SUM(toFloat64(t.${col('Inventory')})) / nullIf(SUM(toFloat64(t.${col('MSL')})), 0) * 100, 2) as PSL,
                    COUNT(DISTINCT t.${col('Web_Pid')}) as Assortment,
                    ${metroCol}
                FROM rb_pdp_olap t
                ${sosJoin}
                ${metroJoin}
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (match) => match === 'Category' ? col(catCol) : 't.' + col(match))}
                GROUP BY t.DATE, t.Platform, t.Brand, t.Location, t.${catCol}, t.Product${resellerGroupT}${webPidGroupInAvail}
                ORDER BY t.DATE DESC
            `;
        } else if (reportType === "Visibility Analysis") {
            query = `
                SELECT 
                    toDate(t.DATE) as DATE, t.platform_name as Platform, t.brand as Brand, t.keyword_category as Keyword_Category, t.keyword_type as Keyword_Type,
                    round(sumIf(toFloat64OrZero(toString(t.overall)), toString(t.flag) = '1' OR t.flag = 1) * 100.0 / nullIf(sumIf(toFloat64OrZero(toString(t.overall)), 1=1), 0), 2) as Overall_SOS_Percentage,
                    round(sumIf(toFloat64OrZero(toString(t.spons)), toString(t.flag) = '1' OR t.flag = 1) * 100.0 / nullIf(sumIf(toFloat64OrZero(toString(t.spons)), 1=1), 0), 2) as Sponsored_SOS_Percentage,
                    round(sumIf(toFloat64OrZero(toString(t.organic)), toString(t.flag) = '1' OR t.flag = 1) * 100.0 / nullIf(sumIf(toFloat64OrZero(toString(t.organic)), 1=1), 0), 2) as Organic_SOS_Percentage,
                    round(avgIf(toInt64OrZero(toString(t.POSITION)), toInt32(t.spons) = 1), 2) as Ad_POS,
                    round(avgIf(toInt64OrZero(toString(t.POSITION)), toInt32(t.spons) != 1), 2) as Org_Pos
                FROM rb_kw_olap t
                WHERE toDate(t.DATE) BETWEEN '${startDate}' AND '${endDate}'
                ${buildInClause('t.platform_name', platform) ? `AND ${buildInClause('t.platform_name', platform)}` : ''}
                ${buildInClause('t.brand', brand) ? `AND ${buildInClause('t.brand', brand)}` : ''}
                GROUP BY DATE, Platform, Brand, t.keyword_category, t.keyword_type
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Market Share") {
            // Use rb_brand_ms if it exists, otherwise fall back to rb_ms_olap
            const hasBrandMs = await checkTableExists('rb_brand_ms');
            const msTable = hasBrandMs ? 'rb_brand_ms' : 'rb_ms_olap';
            const msDateCol = hasBrandMs ? 'created_on' : 'created_on';
            const msBrandCol = hasBrandMs ? 'brand' : 'group_brand';

            // Filter for only 12 specific cities as requested
            const allowedCities = ['Ahmedabad', 'Mumbai', 'Pune', 'Hyderabad', 'Bengaluru', 'Chennai', 'Kolkata', 'Lucknow', 'Delhi', 'Gurgaon', 'Faridabad', 'Chandigarh'];
            const cityFilter = `AND location IN ('${allowedCities.join("','")}')`;

            query = `
                SELECT 
                    toDate(${msDateCol}) as DATE, ${msBrandCol} as Brand, category as Category, location as City,
                    SUM(sales) as Sales_Value,
                    ROUND(SUM(sales) / nullIf(SUM(SUM(sales)) OVER (PARTITION BY DATE, category, location), 0) * 100, 2) as Market_Share_Percentage
                FROM ${msTable}
                WHERE toDate(${msDateCol}) BETWEEN '${startDate}' AND '${endDate}'
                ${buildInClause(msBrandCol, brand) ? `AND ${buildInClause(msBrandCol, brand)}` : ''}
                ${buildInClause('location', city) ? `AND ${buildInClause('location', city)}` : ''}
                ${cityFilter}
                GROUP BY DATE, ${msBrandCol}, category, location
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Sales Data") {
            // To calculate historical comparisons, we fetch a wider range (up to 13 months back)
            const widerStartDate = dayjs(startDate).subtract(13, 'month').format('YYYY-MM-DD');
            query = `
                WITH daily_agg AS (
                    SELECT 
                        toDate(DATE) as DATE, Platform, Brand, Location as City, ${catCol} as Format, Product${resellerSelect},
                        SUM(toFloat64(Sales)) as daily_sales,
                        SUM(assumeNotNull(Qty_Sold)) as daily_orders
                    FROM rb_pdp_olap
                    WHERE toDate(DATE) BETWEEN '${widerStartDate}' AND '${endDate}'
                    ${buildInClause('Platform', platform) ? `AND ${buildInClause('Platform', platform)}` : ''}
                    ${buildInClause('Brand', brand) ? `AND ${buildInClause('Brand', brand)}` : ''}
                    ${buildInClause('Location', city) ? `AND ${buildInClause('Location', city)}` : ''}
                    ${buildInClause(catCol, format) ? `AND ${buildInClause(catCol, format)}` : ''}
                    ${resellerCol && resellerParam && buildInClause(resellerCol, resellerParam) ? `AND ${buildInClause(resellerCol, resellerParam)}` : ''}
                    GROUP BY DATE, Platform, Brand, City, Format, Product${resellerGroup}
                ),
                running_metrics AS (
                    SELECT 
                        *,
                        SUM(daily_sales) OVER (PARTITION BY Platform, Brand, City, Format, Product${resellerGroup}, toStartOfMonth(DATE) ORDER BY DATE) as MTD_Sales,
                        SUM(daily_sales) OVER (PARTITION BY Platform, Brand, City, Format, Product${resellerGroup}, toStartOfYear(DATE) ORDER BY DATE) as YTD_Sales
                    FROM daily_agg
                )
                SELECT 
                    t.DATE as DATE, t.Platform as Platform, t.Brand as Brand, t.City as City, t.Format as Format, t.Product as Product${resellerSelectT},
                    round(t.daily_sales, 2) as Overall_Sales,
                    t.daily_orders as Orders,
                    round(t.daily_sales / nullIf(t.daily_orders, 0), 2) as ASP,
                    round(t.MTD_Sales, 2) as MTD_Sales,
                    round(pm.MTD_Sales, 2) as PREV_MONTH_MTD,
                    round(t.YTD_Sales, 2) as YTD_Sales,
                    round(ly.daily_sales, 2) as LAST_YEAR_SALES,
                    
                    round(t.MTD_Sales / nullIf(toDayOfMonth(t.DATE), 0), 2) as Current_DRR,
                    -- Projected Sales: DRR * Total days in month
                    round(Current_DRR * toDayOfMonth(date_add(month, 1, toStartOfMonth(t.DATE)) - 1), 2) as Projected_Sales,
                    
                    round(t.daily_sales / nullIf(SUM(t.daily_sales) OVER (PARTITION BY t.DATE, t.Platform, t.City), 0) * 100, 2) as Revenue_Share
                FROM running_metrics t
                LEFT JOIN daily_agg ly ON 
                    t.Platform = ly.Platform AND t.Brand = ly.Brand AND t.City = ly.City AND t.Format = ly.Format AND t.Product = ly.Product${resellerCol ? ` AND t.${resellerCol} = ly.${resellerCol}` : ''}
                    AND t.DATE = date_add(year, 1, ly.DATE)
                LEFT JOIN running_metrics pm ON 
                    t.Platform = pm.Platform AND t.Brand = pm.Brand AND t.City = pm.City AND t.Format = pm.Format AND t.Product = pm.Product${resellerCol ? ` AND t.${resellerCol} = pm.${resellerCol}` : ''}
                    AND t.DATE = date_add(month, 1, pm.DATE)
                WHERE t.DATE BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY t.DATE DESC
            `;
        } else if (reportType === "Master Dump") {
            const [hasKwOlap, hasLocationDarkstore, hasBrandMs] = await Promise.all([
                checkTableExists('rb_kw_olap'),
                checkTableExists('rb_location_darkstore'),
                checkTableExists('rb_brand_ms')
            ]);
            const msTable = hasBrandMs ? 'rb_brand_ms' : 'rb_ms_olap';
            const msDateCol = hasBrandMs ? 'created_on' : 'created_on';
            const msBrandCol = hasBrandMs ? 'brand' : 'group_brand';

            // 1. Time Granularity handling
            let timeAgg = `toDate(t.DATE)`;
            let cteTimeAgg = `toDate(DATE)`;
            let cteMsDateAgg = `toDate(${msDateCol})`;
            const granTime = req.query.granularityTime || "Daily";
            if (granTime === "Weekly") { 
                timeAgg = `toStartOfWeek(toDate(t.DATE))`; 
                cteTimeAgg = `toStartOfWeek(toDate(DATE))`; 
                cteMsDateAgg = `toStartOfWeek(toDate(${msDateCol}))`;
            }
            if (granTime === "Monthly") { 
                timeAgg = `toStartOfMonth(toDate(t.DATE))`; 
                cteTimeAgg = `toStartOfMonth(toDate(DATE))`; 
                cteMsDateAgg = `toStartOfMonth(toDate(${msDateCol}))`;
            }

            // 2. Geography / Location Granularity handling
            let reqDimensions = req.query.dimensions ? req.query.dimensions.split(',') : ['Platform', 'Brand', 'City', 'Category', 'Product'];
            if (req.query.granularityGeo === "Pan India") {
                reqDimensions = reqDimensions.filter(d => d !== 'City');
            }

            const granSku = req.query.granularitySku || '';
            const isOwnOnly = granSku.includes('(Own)') && !granSku.includes('Comp');

            const [msCols, kwCols] = await Promise.all([
                getTableColumns(msTable).catch(() => new Map()),
                getTableColumns('rb_kw_olap').catch(() => new Map()),
            ]);

            let kwFlagCond = "";
            if (isOwnOnly) {
                if (kwCols.has('flag')) kwFlagCond = " AND toString(flag) = '1'";
                else if (kwCols.has('comp_flag')) kwFlagCond = " AND comp_flag = 0";
                else if (kwCols.has('Comp_flag')) kwFlagCond = " AND Comp_flag = 0";
            }

            let msFlagCond = "";
            if (isOwnOnly) {
                if (msCols.has('flag')) msFlagCond = " AND toString(flag) = '1'";
                else if (msCols.has('comp_flag')) msFlagCond = " AND comp_flag = 0";
                else if (msCols.has('Comp_flag')) msFlagCond = " AND Comp_flag = 0";
            }

            let hasPlatform = true; // Platform is ALWAYS included in exported report!
            let hasBrand = reqDimensions.includes('Brand');
            let hasCity = reqDimensions.includes('City');
            let hasFormat = reqDimensions.includes('Category') || reqDimensions.includes('Format');
            let hasProduct = reqDimensions.includes('Product');

            // Force override dimensions based on explicit SKU constraints
            if (granSku.includes('SKU')) {
                hasProduct = true;
                hasBrand = true;
            } else if (granSku.includes('Brand')) {
                hasBrand = true;
            } else if (granSku.includes('Category')) {
                hasFormat = true;
            }

            const dimSelects = [];
            const dimGroups = [];
            if (hasPlatform) { dimSelects.push(`t.${col('Platform')} as Platform`); dimGroups.push(`Platform`); }
            if (hasBrand) { dimSelects.push(`t.${col('Brand')} as Brand`); dimGroups.push(`Brand`); }
            if (hasCity) { dimSelects.push(`t.${col('Location')} as City`); dimGroups.push(`City`); }
            if (hasFormat) { dimSelects.push(`t.${catCol} as Format`); dimGroups.push(`Format`); }
            if (hasProduct) { dimSelects.push(`t.${col('Product')} as Product`); dimGroups.push(`Product`); }
            if (granSku.includes('SKU')) { dimSelects.push(`t.${col('Web_Pid')} as Web_Pid`); dimGroups.push(`Web_Pid`); }
            if (resellerCol) { dimSelects.push(`t.${resellerCol} as Reseller_Name`); dimGroups.push(`Reseller_Name`); }

            const dimGroupStr = dimGroups.length > 0 ? ', ' + dimGroups.join(', ') : '';

            // Handle CTE mappings tightly aligned to base query
            let sosGroupCols = ['DATE'];
            let sosSelectCols = [`${cteTimeAgg} as DATE`];
            let sosJoinOn = [`${timeAgg} = s.DATE`];

            let totGroupCols = ['DATE'];
            let totSelectCols = [`${cteTimeAgg} as DATE`];
            let totJoinOn = [`${timeAgg} = tot.DATE`];

            if (hasPlatform) {
                sosGroupCols.push('Platform'); sosSelectCols.push('platform_name as Platform'); sosJoinOn.push('t.Platform = s.Platform');
                totGroupCols.push('Platform'); totSelectCols.push('platform_name as Platform'); totJoinOn.push('t.Platform = tot.Platform');
            }
            if (hasBrand) {
                sosGroupCols.push('Brand'); sosSelectCols.push('brand as Brand'); sosJoinOn.push('t.Brand = s.Brand');
            }
            if (hasFormat) {
                sosGroupCols.push('Category'); sosSelectCols.push('keyword_category as Category'); sosJoinOn.push(`t.${catCol} = s.Category`);
                totGroupCols.push('Category'); totSelectCols.push('keyword_category as Category'); totJoinOn.push(`t.${catCol} = tot.Category`);
            }

            const sosCte = hasKwOlap ? `
                WITH sos_stats AS (
                    SELECT 
                        ${sosSelectCols.join(', ')},
                        round(sumIf(toFloat64OrZero(toString(overall)), toString(flag) = '1' OR flag = 1) * 100.0 / nullIf(sumIf(toFloat64OrZero(toString(overall)), 1=1), 0), 2) as overall_sos_pct,
                        round(sumIf(toFloat64OrZero(toString(spons)), toString(flag) = '1' OR flag = 1) * 100.0 / nullIf(sumIf(toFloat64OrZero(toString(spons)), 1=1), 0), 2) as spons_sos_pct,
                        round(sumIf(toFloat64OrZero(toString(organic)), toString(flag) = '1' OR flag = 1) * 100.0 / nullIf(sumIf(toFloat64OrZero(toString(organic)), 1=1), 0), 2) as org_sos_pct,
                        avgIf(toInt64OrZero(toString(POSITION)), toInt32(spons) = 1) as ad_pos,
                        avgIf(toInt64OrZero(toString(POSITION)), toInt32(spons) != 1) as org_pos
                    FROM rb_kw_olap
                    WHERE toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'
                    GROUP BY ${sosGroupCols.join(', ')}
                ),` : 'WITH ';

            const pricingCte = '';
            const pricingJoin = '';

            const msSelectLoc = hasCity ? ", location as Location" : "";
            const msGroupLoc = hasCity ? ", Location" : "";
            const msJoinLoc = hasCity ? " AND t.Location = ms.Location" : "";
            const cmsJoinLoc = hasCity ? " AND t.Location = cms.Location" : "";

            const msCte = `
                ms_stats AS (
                    SELECT 
                        ${cteMsDateAgg} as DATE, ${msBrandCol} as Brand, category as Category${msSelectLoc},
                        SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as brand_sales
                    FROM ${msTable}
                    WHERE toDate(${msDateCol}) BETWEEN '${startDate}' AND '${endDate}'${msFlagCond}
                      AND sales IS NOT NULL
                    GROUP BY DATE, Brand, Category${msGroupLoc}
                ),
                cat_ms_stats AS (
                    SELECT 
                        ${cteMsDateAgg} as DATE, category as Category${msSelectLoc},
                        SUM(ifNull(toFloat64OrZero(toString(sales)), 0)) as cat_sales
                    FROM ${msTable}
                    WHERE toDate(${msDateCol}) BETWEEN '${startDate}' AND '${endDate}'${msFlagCond}
                      AND sales IS NOT NULL
                    GROUP BY DATE, Category${msGroupLoc}
                ),`;

            const catSizeSelectLoc = hasCity ? ", Location" : "";
            const catSizeGroupLoc = hasCity ? ", Location" : "";
            const catSizeJoinLoc = hasCity ? " AND t.Location = cs.Location" : "";

            const catSizeCte = `
                cat_size_stats AS (
                    SELECT 
                        ${cteTimeAgg} as DATE, Platform${catSizeSelectLoc},
                        SUM(toFloat64(Sales)) as Cat_Size
                    FROM rb_pdp_olap
                    WHERE toDate(DATE) BETWEEN '${startDate}' AND '${endDate}'
                    GROUP BY DATE, Platform${catSizeGroupLoc}
                )`;

            const metroJoin = hasLocationDarkstore ? `
                LEFT JOIN (
                    SELECT DISTINCT LOWER(location) as location, 1 as is_metro
                    FROM rb_location_darkstore
                    WHERE tier = 'Tier 1'
                ) m ON LOWER(t.Location) = m.location` : '';

            const sosJoin = hasKwOlap ? `
                LEFT JOIN sos_stats s ON ${sosJoinOn.join(' AND ')}` : '';



            const msJoin = `
                LEFT JOIN ms_stats ms ON ${timeAgg} = ms.DATE AND t.Brand = ms.Brand AND t.${catCol} = ms.Category${msJoinLoc}
                LEFT JOIN cat_ms_stats cms ON ${timeAgg} = cms.DATE AND t.${catCol} = cms.Category${cmsJoinLoc}`;

            const catSizeJoin = `
                LEFT JOIN cat_size_stats cs ON ${timeAgg} = cs.DATE AND t.Platform = cs.Platform${catSizeJoinLoc}`;

            const sosCol = hasKwOlap ? `
                    any(s.overall_sos_pct) as SOS_Percentage,
                    any(s.overall_sos_pct) as Overall_SOS_Percentage,
                    any(s.spons_sos_pct) as Sponsored_SOS_Percentage,
                    any(s.org_sos_pct) as Organic_SOS_Percentage,
                    round(any(s.ad_pos), 2) as Ad_POS,
                    round(any(s.org_pos), 2) as Org_Pos,
            ` : '';

            const metroCol = hasLocationDarkstore ? `round(SUM(if(m.is_metro = 1, toFloat64(t.${col('neno_osa')}), 0)) / nullIf(SUM(if(m.is_metro = 1, toFloat64(t.${col('deno_osa')}), 0)), 0) * 100, 2) as Metro_City_Stock_Availability,` : `0 as Metro_City_Stock_Availability,`;

            // If sosCte is empty, we must ensure the CTE starts properly with WITH
            const fullCte = (hasKwOlap ? sosCte : 'WITH ') + pricingCte + msCte + catSizeCte;

            query = `
                ${fullCte}
                SELECT 
                    ${timeAgg} as DATE${dimSelects.length > 0 ? ', ' + dimSelects.join(', ') : ''},
                    -- Sales / Basics
                    SUM(toFloat64(t.${col('Sales')})) as Offtake,
                    SUM(assumeNotNull(t.${col('Qty_Sold')})) as Units_Sold,
                    SUM(assumeNotNull(t.${col('Qty_Sold')})) as Orders,
                    round(SUM(toFloat64(t.${col('Sales')})) / nullIf(SUM(assumeNotNull(t.${col('Qty_Sold')})), 0), 2) as ASP,

                    -- Availability
                    round(SUM(toFloat64(t.${col('neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100, 2) as Stock_Availability,
                    round(avg(toFloat64(t.${col('DIH')})), 2) as DOI,
                    round(avg(ifNull(toFloat64OrZero(toString(t.${col('listing_percent')})), 0)), 2) as Listing_Percentage,

                    -- PM
                    SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Impressions')})), 0)) as Impressions,
                    SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Clicks')})), 0)) as Clicks,
                    round(SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Spend')})), 0)), 2) as Spend,
                    round(SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Sales')})), 0)), 2) as Inorganic_Sales,
                    round(if(SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Spend')})), 0)) > 0, SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Sales')})), 0)) / SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Spend')})), 0)), 0), 2) as ROAS,
                    round(if(SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Clicks')})), 0)) > 0, (SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Quantity_sold')})), 0)) / SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Clicks')})), 0))) * 100, 0), 2) as Conversion_Rate,
                    round(if(SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Impressions')})), 0)) > 0, (SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Spend')})), 0)) / SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Impressions')})), 0))) * 1000, 0), 2) as CPM,
                    round(if(SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Clicks')})), 0)) > 0, SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Spend')})), 0)) / SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Clicks')})), 0)), 0), 2) as CPC,
                    round(if(SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Quantity_sold')})), 0)) > 0, SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Sales')})), 0)) / SUM(ifNull(toFloat64OrZero(toString(t.${col('Ad_Quantity_sold')})), 0)), 0), 2) as AOV,

                    -- Inventory
                    SUM(toFloat64(t.${col('Inventory')})) as Current_Inventory,
                    SUM(toFloat64(t.${col('MSL')})) as Target_Inventory,

                    -- Pricing
                    round(avg(toFloat64(t.${col('Selling_Price')})), 2) as Selling_Price,
                    round(avg(toFloat64(t.${col('Selling_Price')})), 2) as ECP,
                    round(avg(toFloat64(t.${col('MRP')})), 2) as MRP,
                    round(avg((toFloat64(t.${col('MRP')}) - toFloat64(t.${col('Selling_Price')})) / nullIf(toFloat64(t.${col('MRP')}), 0) * 100), 2) as Discount_Percentage,
                    
                    ${sosCol}
                    
                    round((SUM(toFloat64(t.${col('Ad_Spend')})) / nullIf(SUM(toFloat64(t.${col('Sales')})), 0)) * 100, 2) as BMI_Sales_Ratio,
                    round(avg(toFloat64(t.${col('Discount')})), 2) as Promo_Percentage,

                    -- Additional Availability KPIs
                    round(SUM(toFloat64(t.${col('neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100, 2) as OSA_Percentage,
                    round(SUM(toFloat64(t.${col('buy_box_neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100, 2) as Buy_Box_Percentage,
                    round(100 - (SUM(toFloat64(t.${col('neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100), 2) as Stock_Out_Percentage,
                    
                    round(SUM(toFloat64(t.${col('Inventory')})) / nullIf(SUM(toFloat64(t.${col('MSL')})), 0) * 100, 2) as PSL,
                    COUNT(DISTINCT t.${col('Web_Pid')}) as Assortment,
                    ${metroCol}

                    -- New Pricing, Sales, Category KPIs
                    any(ms.brand_sales) as Sales_Value,
                    round(any(ms.brand_sales) / nullIf(any(cms.cat_sales), 0) * 100, 2) as Market_Share_Percentage,
                    any(cs.Cat_Size) as Cat_Size
                    
                FROM rb_pdp_olap t
                ${metroJoin}
                ${sosJoin}
                ${pricingJoin}
                ${msJoin}
                ${catSizeJoin}
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (match) => match === 'Category' ? 't.' + catCol : 't.' + match)}
                GROUP BY DATE${dimGroupStr}
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Pricing Analysis") {
            query = `
                SELECT 
                    toDate(t.${col('DATE')}) as DATE, t.${col('Platform')} as Platform, t.${col('Brand')} as Brand, t.${col('Location')} as City, t.${catCol} as Format, t.${col('Product')} as Product${resellerSelectT},
                    round(avg(toFloat64(t.${col('Selling_Price')})), 2) as Selling_Price,
                    round(avg(toFloat64(t.${col('MRP')})), 2) as MRP,
                    round(avg((toFloat64(t.${col('MRP')}) - toFloat64(t.${col('Selling_Price')})) / nullIf(toFloat64(t.${col('MRP')}), 0) * 100), 2) as Discount_Percentage
                FROM rb_pdp_olap t
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (m) => m === 'Category' ? catCol : 't.' + col(m))}
                GROUP BY DATE, Platform, Brand, City, Format, Product${resellerGroupT}
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Performance Marketing") {
            const hasPmOlap = await checkTableExists('rb_pm_olap');
            const pmTable = hasPmOlap ? 'rb_pm_olap' : 'rb_pdp_olap';
            const pmCols = await getTableColumns(pmTable).catch(() => new Map());
            const pmResellerCol = pmCols.has('reseller_name') ? pmCols.get('reseller_name')
                : pmCols.has('reseller') ? pmCols.get('reseller')
                : null;
            const pmResellerSelect = pmResellerCol ? `, ${pmResellerCol} as Reseller_Name` : '';
            const pmResellerGroup = pmResellerCol ? `, ${pmResellerCol}` : '';
            const pmResellerSelectBase = pmResellerCol ? `, Reseller_Name` : '';
            
            const spendCol = hasPmOlap ? 'ad_spend' : 'Ad_Spend';
            const salesCol = hasPmOlap ? 'Ad_sales' : 'Ad_Sales';
            const impCol = hasPmOlap ? 'impressions' : 'Ad_Impressions';
            const clicksCol = hasPmOlap ? 'ad_click' : 'Ad_Clicks';
            const qtyCol = hasPmOlap ? 'Ad_Quantity_sold' : 'Ad_Quantity_sold';

            query = `
                WITH base_metrics AS (
                    SELECT 
                        ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col('Brand')} as Brand, ${col('Location')} as City, ${col(catCol)} as Format, ${col('Product')} as Product${pmResellerSelect},
                        SUM(ifNull(toFloat64OrZero(toString(${spendCol})), 0)) as total_spend,
                        SUM(ifNull(toFloat64OrZero(toString(${salesCol})), 0)) as total_inorganic_sales,
                        SUM(ifNull(toFloat64OrZero(toString(${impCol})), 0)) as total_impressions,
                        SUM(ifNull(toFloat64OrZero(toString(${clicksCol})), 0)) as total_clicks,
                        SUM(ifNull(toFloat64OrZero(toString(${qtyCol})), 0)) as total_orders
                    FROM ${pmTable}
                    ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (match) => match === 'Category' ? col(catCol) : col(match))}
                    GROUP BY DATE, Platform, Brand, Location, ${catCol}, Product${pmResellerGroup}
                )
                SELECT 
                    DATE, Platform, Brand, City, Format, Product${pmResellerSelectBase},
                    round(total_spend, 2) as Spend,
                    round(total_inorganic_sales, 2) as Inorganic_Sales,
                    total_impressions as Impressions,
                    total_clicks as Clicks,
                    total_orders as Orders,
                    round(if(total_clicks > 0, (total_orders / total_clicks) * 100, 0), 2) as Conversion_Rate,
                    round(if(total_spend > 0, total_inorganic_sales / total_spend, 0), 2) as ROAS,
                    round(if(total_clicks > 0, total_spend / total_clicks, 0), 2) as CPC,
                    round(if(total_impressions > 0, (total_spend / total_impressions) * 1000, 0), 2) as CPM,
                    round(if(total_orders > 0, total_inorganic_sales / total_orders, 0), 2) as AOV
                FROM base_metrics
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Content Analysis") {
            // Use tb_content_score_data without hardcoded DB prefix — resolves to user's current DB
            const hasContentTable = await checkTableExists('tb_content_score_data');
            if (!hasContentTable) {
                return res.status(404).json({ error: 'Content Analysis is not available for this database. The table tb_content_score_data does not exist.' });
            }
            query = `
                SELECT 
                    toDate(extraction_timestamp) as DATE, brand_name as Brand, title as Product, url as URL,
                    product_platform_total as Overall_Content_Score,
                    title_length_score as Title_Score,
                    thumbnail_media_score as Image_Score,
                    prod_desc_score as Description_Score,
                    title_char_count as Title_Length,
                    description_char_count as Word_Count
                FROM tb_content_score_data
                WHERE toDate(${col('extraction_timestamp')}) BETWEEN '${startDate}' AND '${endDate}'
                ${buildInClause(col('brand_name'), brand) ? `AND ${buildInClause(col('brand_name'), brand)}` : ''}
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Inventory Analysis") {
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col('Brand')} as Brand, ${col('Location')} as City, ${col(catCol)} as Format, ${col('Product')} as Product${resellerSelect},
                    SUM(toFloat64(${col('Inventory')})) as Current_Inventory,
                    SUM(toFloat64(${col('MSL')})) as Target_Inventory,
                    round(SUM(toFloat64(${col('Inventory')})) / nullIf(SUM(toFloat64(${col('MSL')})), 0) * 100, 2) as Inventory_Health_Percentage,
                    round(avg(toFloat64(${col('DIH')})), 2) as Days_Inventory_on_Hand
                FROM rb_pdp_olap
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (match) => match === 'Category' ? col(catCol) : col(match))}
                GROUP BY DATE, Platform, Brand, City, Format, Product${resellerGroup}
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Category RCA") {
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col(catCol)} as Format, ${col('Location')} as City,
                    SUM(toFloat64(${col('Sales')})) as Offtake_Sales,
                    SUM(assumeNotNull(${col('Qty_Sold')})) as Units,
                    round(SUM(toFloat64(${col('Sales')})) / nullIf(SUM(SUM(toFloat64(${col('Sales')}))) OVER (PARTITION BY ${col('DATE')}, ${col('Platform')}, ${col('Location')}), 0) * 100, 2) as Category_Share,
                    SUM(SUM(toFloat64(${col('Sales')}))) OVER (PARTITION BY ${col('DATE')}, ${col('Platform')}, ${col('Location')}) as Cat_Size
                FROM rb_pdp_olap
                ${whereClause.replace(/\bCategory\b/g, catCol)}
                GROUP BY DATE, Platform, ${catCol}, Location
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Portfolio Analysis") {
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col('Brand')} as Brand, ${col('Location')} as City, ${col(catCol)} as Format, ${col('Product')} as Product${resellerSelect},
                    round(SUM(toFloat64(${col('Sales')})) / nullIf(SUM(assumeNotNull(${col('Qty_Sold')})), 0), 2) as ASP,
                    round((1 - (SUM(toFloat64(${col('Sales')})) / nullIf(SUM(toFloat64(${col('MRP')}) * assumeNotNull(${col('Qty_Sold')})), 0))) * 100, 2) as Discount_Percentage,
                    SUM(assumeNotNull(${col('Qty_Sold')})) as Volume,
                    SUM(if(toFloat64(${col('Discount')}) > 0, assumeNotNull(${col('Qty_Sold')}), 0)) as Promo_Volume,
                    round(Promo_Volume / nullIf(Volume, 0) * 100, 2) as Promo_Volume_Percentage
                FROM rb_pdp_olap
                ${whereClause.replace(/\bCategory\b/g, catCol)}
                GROUP BY DATE, Platform, Brand, Location, ${catCol}, Product${resellerGroup}
                ORDER BY DATE DESC
            `;
        } else if (reportType === "Business Overview") {
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col('Brand')} as Brand, ${col('Location')} as City, ${col(catCol)} as Format, ${col('Product')} as Product${resellerSelect},
                    -- Core Metrics
                    SUM(toFloat64(${col('Sales')})) as Offtake,
                    SUM(assumeNotNull(${col('Qty_Sold')})) as Units_Sold,
                    round(SUM(toFloat64(${col('neno_osa')})) / nullIf(SUM(toFloat64(${col('deno_osa')})), 0) * 100, 2) as Stock_Availability,
                    round(avg(toFloat64(${col('DIH')})), 2) as DOI,
                    round(avg(ifNull(toFloat64OrZero(toString(${col('listing_percent')})), 0)), 2) as listing_percentage,
                    
                    -- Performance Marketing Metrics
                    SUM(toFloat64(${col('Ad_Sales')})) as Inorganic_Sales,
                    SUM(toFloat64(${col('Ad_Spend')})) as Spend,
                    round(SUM(toFloat64(${col('Ad_Sales')})) / nullIf(SUM(toFloat64(${col('Ad_Spend')})), 0), 2) as ROAS,
                    round((SUM(toFloat64(${col('Ad_Quantity_sold')})) / nullIf(SUM(toFloat64(${col('Ad_Clicks')})), 0)) * 100, 2) as Conversion,
                    round((SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Ad_Impressions')})), 0)) * 1000, 2) as CPM,
                    round(SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Ad_Clicks')})), 0), 2) as CPC,
                    
                    -- Ad Spend over Sales
                    round((SUM(toFloat64(${col('Ad_Spend')})) / nullIf(SUM(toFloat64(${col('Sales')})), 0)) * 100, 2) as BMI_Sales_Ratio,
                    
                    -- Promo Metrics
                    round(avg(toFloat64(${col('Discount')})), 2) as Promo_Percentage
                FROM rb_pdp_olap
                ${whereClause.replace(/\b(Platform|Brand|Location|Category|DATE)\b/g, (match) => match === 'Category' ? col(catCol) : col(match))}
                GROUP BY DATE, Platform, Brand, Location, ${catCol}, Product${resellerGroup}
                ORDER BY DATE DESC
            `;
        } else {
            // Default generic query for other report types (Category RCA, Portfolio, Play it You)
            query = `
                SELECT 
                    ${col('DATE')} as DATE, ${col('Platform')} as Platform, ${col('Brand')} as Brand, ${col('Location')} as City, ${col(catCol)} as Format, ${col('Product')} as Product${resellerSelect},
                    SUM(toFloat64(${col('Sales')})) as Sales,
                    SUM(assumeNotNull(${col('Qty_Sold')})) as Qty,
                    round(SUM(toFloat64(${col('neno_osa')})) / nullIf(SUM(toFloat64(${col('deno_osa')})), 0) * 100, 2) as OSA,
                    round(avg(toFloat64(${col('DIH')})), 2) as DOI
                FROM rb_pdp_olap
                ${whereClause.replace(/\bCategory\b/g, catCol)}
                GROUP BY DATE, Platform, Brand, Location, ${catCol}, Product${resellerGroup}
                ORDER BY DATE DESC
            `;
        }

        // 3. Execute Query
        console.log(`[downloadReport] Executing query for ${reportType}:`, query);
        const rawData = await queryClickHouse(query);
        console.log(`[downloadReport] Fetched ${rawData?.length || 0} rows`);

        if (!rawData || rawData.length === 0) {
            // Return 204 No Content so browser doesn't log a 404 network error in console
            return res.status(204).send();
        }

        // 4. Filter columns by requested tags if Master Dump is used
        let finalData = rawData;
        if (reportType === "Master Dump" && req.query.metrics) {
            const requestedTags = req.query.metrics.split(',');

            // Map tag names to exact backend column aliases
            const TAG_MAP = {
                // Sales / Basics
                "Offtake": "Offtake",
                "Units Sold": "Units_Sold",
                "Quantity Sold": "Units_Sold",
                "Orders": "Orders",
                "ASP": "ASP",

                // Availability
                "Stock Availability": "Stock_Availability",
                "OSA %": "OSA_Percentage",
                "Buy Box %": "Buy_Box_Percentage",
                "Stock Out %": "Stock_Out_Percentage",
                "DOI": "DOI",
                "Listing %": "Listing_Percentage",
                "PSL": "PSL",
                "Assortment": "Assortment",
                "Metro City Stock Availability": "Metro_City_Stock_Availability",

                // Performance Marketing
                "Impressions": "Impressions",
                "Clicks": "Clicks",
                "Spend": "Spend",
                "Inorganic Sales": "Inorganic_Sales",
                "ROAS": "ROAS",
                "Conversion Rate": "Conversion_Rate",
                "CPM": "CPM",
                "CPC": "CPC",
                "AOV": "AOV",
                "BMI Sales Ratio": "BMI_Sales_Ratio",

                // Inventory
                "Current Inventory": "Current_Inventory",
                "Target Inventory": "Target_Inventory",

                // Pricing
                "Selling Price": "Selling_Price",
                "ECP": "Selling_Price",
                "MRP": "MRP",
                "Discount %": "Discount_Percentage",
                "RPI": "RPI",

                // Visibility / SOS
                "SOS %": "SOS_Percentage",
                "Overall SOS %": "Overall_SOS_Percentage",
                "Sponsored SOS %": "Sponsored_SOS_Percentage",
                "Organic SOS %": "Organic_SOS_Percentage",
                "Ad Position": "Ad_POS",
                "Org Position": "Org_Pos",

                // Promo
                "Promo %": "Promo_Percentage",

                // Market Share & Category
                "Sales Value": "Sales_Value",
                "Market Share %": "Market_Share_Percentage",
                "Category Size": "Cat_Size"
            };

            // Map requested tags to their clean UI names inside Excel!
            finalData = rawData.map(row => {
                const newRow = { DATE: row.DATE };
                if (row.Platform !== undefined) newRow.Platform = row.Platform;
                if (row.Brand !== undefined) newRow.Brand = row.Brand;
                if (row.City !== undefined) newRow.City = row.City;
                if (row.Format !== undefined) newRow.Format = row.Format;
                if (row.Product !== undefined) newRow.Product = row.Product;
                if (row.Web_Pid !== undefined) newRow["Web Pid"] = row.Web_Pid;
                if (row.Reseller_Name !== undefined) newRow["Reseller Name"] = row.Reseller_Name;
                else if (row.reseller_name !== undefined) newRow["Reseller Name"] = row.reseller_name;

                requestedTags.forEach(tag => {
                    const alias = TAG_MAP[tag];
                    if (alias && row[alias] !== undefined) {
                        newRow[tag] = row[alias];  // Use the human-readable tag as Excel header
                    }
                });
                return newRow;
            });
        }

        // 5. Generate Excel using xlsx
        const worksheet = XLSX.utils.json_to_sheet(finalData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report Data");

        // Set column widths
        const maxWidths = {};
        finalData.forEach(row => {
            Object.keys(row).forEach(key => {
                const val = String(row[key] || '');
                maxWidths[key] = Math.max(maxWidths[key] || key.length, val.length);
            });
        });
        worksheet["!cols"] = Object.keys(maxWidths).map(key => ({ wch: Math.min(maxWidths[key] + 2, 50) }));

        // 5. Send file Buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const fileName = `${reportType.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('[downloadReport] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get available report types based on which tables exist in the current DB
 */
export const getAvailableReportTypes = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('available_report_types', {});

        const data = await getCachedOrCompute(cacheKey, async () => {
            // Define report types and their candidate tables (at least one table must exist)
            const pdpCandidateTables = ['rb_pdp_olap', 'rb_pdp', 'rb_pdp_week', 'rca_sku_dim', 'rb_sales_olap'];
            const reportTableMap = [
                { type: 'Business Overview', tables: pdpCandidateTables },
                { type: 'Availability Analysis', tables: pdpCandidateTables },
                { type: 'Visibility Analysis', tables: ['rb_kw_olap'] },
                { type: 'Sales Data', tables: pdpCandidateTables },
                { type: 'Pricing Analysis', tables: pdpCandidateTables },
                { type: 'Performance Marketing', tables: pdpCandidateTables },
                { type: 'Inventory Analysis', tables: pdpCandidateTables },
                { type: 'Market Share', tables: ['rb_brand_ms', 'rb_ms_olap'] },  // either works
                { type: 'Content Analysis', tables: ['tb_content_score_data'] },
                { type: 'Category RCA', tables: pdpCandidateTables },
                { type: 'Portfolio Analysis', tables: pdpCandidateTables },
            ];

            const results = [];
            for (const entry of reportTableMap) {
                // If any candidate table exists for the report type, include it
                const checks = await Promise.all(entry.tables.map(t => checkTableExists(t)));
                if (checks.some(Boolean)) {
                    results.push(entry.type);
                }
            }
            return results;
        }, CACHE_TTL.METRICS);

        console.log('[getAvailableReportTypes] Returning:', JSON.stringify(data));
        res.json({ reportTypes: data });
    } catch (error) {
        console.error('[getAvailableReportTypes] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get filter options for Download PDP Report page
 */
export const getPdpReportFilters = async (req, res) => {
    try {
        const hasTable = await checkTableExists('rb_pdp');
        if (!hasTable) {
            return res.status(400).json({ error: 'Table rb_pdp does not exist for this database.' });
        }

        const { platform, location, brand, brandCategory, pincode, sku, webPid, date, startDate, endDate } = req.query;
        const cacheKey = generateCacheKey('pdp_report_filters_v4', req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const buildWhere = (excludeField) => {
                const conditions = [];

                const addStringInClause = (column, value, targetField) => {
                    if (excludeField === targetField) return;
                    if (!value || value === 'All' || value.startsWith('All ') || value.trim() === '') return;
                    const items = value.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');
                    conditions.push(`lower(${column}) IN (${items})`);
                };

                const addNumericInClause = (column, value, targetField) => {
                    if (excludeField === targetField) return;
                    if (!value || value === 'All' || value.startsWith('All ') || value.trim() === '') return;
                    const items = value.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v)).join(', ');
                    if (items) {
                        conditions.push(`${column} IN (${items})`);
                    }
                };

                const addDateInClause = (column, value, targetField) => {
                    if (excludeField === targetField) return;

                    if (startDate && endDate) {
                        conditions.push(`toDate(${column}) >= '${startDate}' AND toDate(${column}) <= '${endDate}'`);
                        return;
                    }

                    if (!value || value === 'All' || value.startsWith('All ') || value.trim() === '') return;
                    const items = value.split(',').map(d => `'${d.trim()}'`).join(', ');
                    conditions.push(`toDate(${column}) IN (${items})`);
                };

                addStringInClause('platform_name', platform, 'platform');
                addStringInClause('location_name', location, 'location');
                addNumericInClause('pincode', pincode, 'pincode');
                addStringInClause('brand_name', brand, 'brand');
                addStringInClause('brand_category_name', brandCategory, 'brandCategory');
                addStringInClause('sku_name', sku, 'sku');
                addStringInClause('web_pid', webPid, 'webPid');
                addDateInClause('pdp_crawl_date', date, 'date');

                return conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';
            };

            const platformQuery = `SELECT DISTINCT platform_name FROM rb_pdp WHERE platform_name != '' AND platform_name IS NOT NULL ${buildWhere('platform')} ORDER BY platform_name`;
            const locationQuery = `SELECT DISTINCT location_name FROM rb_pdp WHERE location_name != '' AND location_name IS NOT NULL ${buildWhere('location')} ORDER BY location_name`;
            const pincodeQuery = `SELECT DISTINCT pincode FROM rb_pdp WHERE pincode IS NOT NULL ${buildWhere('pincode')} ORDER BY pincode`;
            const brandQuery = `SELECT DISTINCT brand_name FROM rb_pdp WHERE brand_name != '' AND brand_name IS NOT NULL ${buildWhere('brand')} ORDER BY brand_name`;
            const categoryQuery = `SELECT DISTINCT brand_category_name FROM rb_pdp WHERE brand_category_name != '' AND brand_category_name IS NOT NULL ${buildWhere('brandCategory')} ORDER BY brand_category_name`;
            const skuQuery = `SELECT DISTINCT sku_name FROM rb_pdp WHERE sku_name != '' AND sku_name IS NOT NULL ${buildWhere('sku')} ORDER BY sku_name LIMIT 1000000`;
            const webPidQuery = `SELECT DISTINCT web_pid FROM rb_pdp WHERE web_pid != '' AND web_pid IS NOT NULL ${buildWhere('webPid')} ORDER BY web_pid LIMIT 1000000`;
            const dateQuery = `SELECT DISTINCT toDate(pdp_crawl_date) as DateStr FROM rb_pdp WHERE pdp_crawl_date IS NOT NULL ${buildWhere('date')} ORDER BY DateStr DESC`;
            const platformMaxDatesQuery = `SELECT platform_name, formatDateTime(max(pdp_crawl_date), '%Y-%m-%d') as maxDate FROM rb_pdp WHERE platform_name != '' AND platform_name IS NOT NULL GROUP BY platform_name`;

            const [platforms, locations, pincodes, brands, categories, skus, webPids, dates, platformMaxDates] = await Promise.all([
                queryClickHouse(platformQuery),
                queryClickHouse(locationQuery),
                queryClickHouse(pincodeQuery),
                queryClickHouse(brandQuery),
                queryClickHouse(categoryQuery),
                queryClickHouse(skuQuery),
                queryClickHouse(webPidQuery),
                queryClickHouse(dateQuery),
                queryClickHouse(platformMaxDatesQuery)
            ]);

            const getColVal = (row) => row ? Object.values(row)[0] : null;
            const uniqueMap = (arr) => [...new Set(arr.map(getColVal).filter(v => v !== null && v !== ''))];
            const formatDate = (dateStr) => {
                if (!dateStr) return '';
                return dayjs(dateStr).format('YYYY-MM-DD');
            };

            const maxDatesMap = {};
            if (platformMaxDates && platformMaxDates.length > 0) {
                platformMaxDates.forEach(row => {
                    if (row.platform_name && row.maxDate) {
                        maxDatesMap[row.platform_name] = row.maxDate;
                    }
                });
            }

            return {
                platforms: uniqueMap(platforms),
                locations: uniqueMap(locations),
                pincodes: uniqueMap(pincodes),
                brands: uniqueMap(brands),
                categories: uniqueMap(categories),
                skus: uniqueMap(skus),
                webPids: uniqueMap(webPids),
                dates: [...new Set(dates.map(getColVal).filter(Boolean).map(formatDate))],
                platformMaxDates: maxDatesMap
            };
        }, CACHE_TTL.METRICS);

        res.json(data);
    } catch (error) {
        console.error('[getPdpReportFilters] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Download PDP Report Excel
 */
export const downloadPdpReport = async (req, res) => {
    try {
        const hasTable = await checkTableExists('rb_pdp');
        if (!hasTable) {
            return res.status(400).json({ error: 'Table rb_pdp does not exist for this database.' });
        }

        const skuPlatCols = await getTableColumns('rb_sku_platform').catch(() => new Map());
        const hasPortfolio = skuPlatCols.has('portfolio');

        const pdpRawCols = await getTableColumns('rb_pdp').catch(() => new Map());
        const pdpResellerCol = pdpRawCols.has('reseller_name') ? pdpRawCols.get('reseller_name')
            : pdpRawCols.has('reseller') ? pdpRawCols.get('reseller')
            : null;

        const { platforms, locations, pincodes, brands, categories, skus, webPids, dates, startDate, endDate } = req.query;

        const conditions = [];

        const addFilter = (column, value) => {
            if (!value || value === 'All' || value.startsWith('All ') || value.trim() === '') return;
            const items = value.split(',').map(v => `'${v.trim().replace(/'/g, "''")}'`).join(', ');
            conditions.push(`${column} IN (${items})`);
        };

        addFilter('pdp.platform_name', platforms);
        addFilter('pdp.location_name', locations);

        if (pincodes && pincodes !== 'All' && pincodes.trim() !== '') {
            const items = pincodes.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v)).join(', ');
            if (items) {
                conditions.push(`pdp.pincode IN (${items})`);
            }
        }

        addFilter('pdp.brand_name', brands);
        addFilter('pdp.brand_category_name', categories);
        addFilter('pdp.sku_name', skus);
        addFilter('pdp.web_pid', webPids);

        if (startDate && endDate) {
            conditions.push(`toDate(pdp.pdp_crawl_date) >= '${startDate}' AND toDate(pdp.pdp_crawl_date) <= '${endDate}'`);
        } else if (dates && dates !== 'All' && dates.trim() !== '') {
            const formattedDates = dates.split(',').map(d => `'${d.trim()}'`).join(', ');
            conditions.push(`toDate(pdp.pdp_crawl_date) IN (${formattedDates})`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        let selectPortfolio = "'' AS portfolio";
        let joinClause = "";
        if (hasPortfolio) {
            selectPortfolio = "sp.portfolio AS portfolio";
            joinClause = "LEFT JOIN rb_sku_platform AS sp ON (pdp.web_pid = sp.web_pid)";
        }

        let selectReseller = pdpResellerCol ? `pdp.${pdpResellerCol} AS reseller_name` : "'' AS reseller_name";

        const query = `
            SELECT 
                pdp.platform_name AS platform_name,
                pdp.location_name AS location_name,
                pdp.pincode AS pincode,
                ${selectPortfolio},
                pdp.brand_name AS brand_name,
                pdp.brand_category_name AS brand_category_name,
                pdp.sku_name AS sku_name,
                pdp.web_pid AS web_pid,
                ${selectReseller},
                pdp.osa_remark AS osa_remark,
                pdp.price_rp AS price_rp,
                pdp.price_sp AS price_sp,
                pdp.price_variation AS price_variation,
                formatDateTime(pdp.pdp_crawl_date, '%Y-%m-%d') AS date,
                pdp.year AS year
            FROM rb_pdp AS pdp
            ${joinClause}
            ${whereClause}
            ORDER BY pdp.pdp_crawl_date DESC
        `;

        const rawData = await queryClickHouse(query);

        const finalData = rawData.map(row => ({
            "Platform Name": row.platform_name || '',
            "Location": row.location_name || '',
            "Pincode": row.pincode || '',
            "Portfolio": row.portfolio || '',
            "Brand Name": row.brand_name || '',
            "Brand Category": row.brand_category_name || '',
            "SKU Name": row.sku_name || '',
            "Web Pid": row.web_pid || '',
            "Reseller Name": row.reseller_name || '',
            "OSA Remark": row.osa_remark || '',
            "Price RP": row.price_rp !== null && row.price_rp !== undefined ? Number(row.price_rp) : '',
            "Price SP": row.price_sp !== null && row.price_sp !== undefined ? Number(row.price_sp) : '',
            "Price Variation": row.price_variation !== null && row.price_variation !== undefined ? Number(row.price_variation) : '',
            "Date": row.date || '',
            "Year": row.year !== null && row.year !== undefined ? Number(row.year) : ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(finalData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "PDP Report");

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const fileName = `PDP_Report_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('[downloadPdpReport] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Preview PDP Report data (paginated JSON)
 * Returns the same data as downloadPdpReport but as JSON with pagination
 */
export const previewPdpReport = async (req, res) => {
    try {
        const hasTable = await checkTableExists('rb_pdp');
        if (!hasTable) {
            return res.status(400).json({ error: 'Table rb_pdp does not exist for this database.' });
        }

        const skuPlatCols = await getTableColumns('rb_sku_platform').catch(() => new Map());
        const hasPortfolio = skuPlatCols.has('portfolio');

        const { platforms, locations, pincodes, brands, categories, skus, webPids, dates, startDate, endDate } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
        const offset = (page - 1) * limit;

        const conditions = [];

        const addFilter = (column, value) => {
            if (!value || value === 'All' || value.startsWith('All ') || value.trim() === '') return;
            const items = value.split(',').map(v => `'${v.trim().replace(/'/g, "''")}'`).join(', ');
            conditions.push(`${column} IN (${items})`);
        };

        addFilter('pdp.platform_name', platforms);
        addFilter('pdp.location_name', locations);

        if (pincodes && pincodes !== 'All' && pincodes.trim() !== '') {
            const items = pincodes.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v)).join(', ');
            if (items) {
                conditions.push(`pdp.pincode IN (${items})`);
            }
        }

        addFilter('pdp.brand_name', brands);
        addFilter('pdp.brand_category_name', categories);
        addFilter('pdp.sku_name', skus);
        addFilter('pdp.web_pid', webPids);

        if (startDate && endDate) {
            conditions.push(`toDate(pdp.pdp_crawl_date) >= '${startDate}' AND toDate(pdp.pdp_crawl_date) <= '${endDate}'`);
        } else if (dates && dates !== 'All' && dates.trim() !== '') {
            const formattedDates = dates.split(',').map(d => `'${d.trim()}'`).join(', ');
            conditions.push(`toDate(pdp.pdp_crawl_date) IN (${formattedDates})`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count query (without join to be faster, use same conditions but on pdp alias)
        const countQuery = `SELECT count() as total FROM rb_pdp AS pdp ${whereClause}`;
        const countResult = await queryClickHouse(countQuery);
        const totalCount = countResult && countResult[0] ? parseInt(countResult[0].total, 10) : 0;

        const pdpRawCols = await getTableColumns('rb_pdp').catch(() => new Map());
        const pdpResellerCol = pdpRawCols.has('reseller_name') ? pdpRawCols.get('reseller_name')
            : pdpRawCols.has('reseller') ? pdpRawCols.get('reseller')
            : null;

        let selectPortfolio = "'' AS portfolio";
        let joinClause = "";
        if (hasPortfolio) {
            selectPortfolio = "sp.portfolio AS portfolio";
            joinClause = "LEFT JOIN rb_sku_platform AS sp ON (pdp.web_pid = sp.web_pid)";
        }

        let selectReseller = pdpResellerCol ? `pdp.${pdpResellerCol} AS reseller_name` : "'' AS reseller_name";

        const query = `
            SELECT 
                pdp.platform_name AS platform_name,
                pdp.location_name AS location_name,
                pdp.pincode AS pincode,
                ${selectPortfolio},
                pdp.brand_name AS brand_name,
                pdp.brand_category_name AS brand_category_name,
                pdp.sku_name AS sku_name,
                pdp.web_pid AS web_pid,
                ${selectReseller},
                pdp.osa_remark AS osa_remark,
                pdp.price_rp AS price_rp,
                pdp.price_sp AS price_sp,
                pdp.price_variation AS price_variation,
                formatDateTime(pdp.pdp_crawl_date, '%Y-%m-%d') AS date,
                pdp.year AS year
            FROM rb_pdp AS pdp
            ${joinClause}
            ${whereClause}
            ORDER BY pdp.pdp_crawl_date DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const rawData = await queryClickHouse(query);

        const rows = rawData.map(row => ({
            "Platform Name": row.platform_name || '',
            "Location": row.location_name || '',
            "Pincode": row.pincode || '',
            "Portfolio": row.portfolio || '',
            "Brand Name": row.brand_name || '',
            "Brand Category": row.brand_category_name || '',
            "SKU Name": row.sku_name || '',
            "Web Pid": row.web_pid || '',
            "Reseller Name": row.reseller_name || '',
            "OSA Remark": row.osa_remark || '',
            "Price RP": row.price_rp !== null && row.price_rp !== undefined ? Number(row.price_rp) : '',
            "Price SP": row.price_sp !== null && row.price_sp !== undefined ? Number(row.price_sp) : '',
            "Price Variation": row.price_variation !== null && row.price_variation !== undefined ? Number(row.price_variation) : '',
            "Date": row.date || '',
            "Year": row.year !== null && row.year !== undefined ? Number(row.year) : ''
        }));

        res.json({
            rows,
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (error) {
        console.error('[previewPdpReport] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
