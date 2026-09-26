import { queryClickHouse, streamClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import { generateCacheKey, getCachedOrCompute, CACHE_TTL } from '../utils/cacheHelper.js';
import { getTableColumns, resolveColumn } from '../utils/schemaHelper.js';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

const UPPERCASE_WEB_PID_TARGETS = [
    'amazon',
    'flipkart',
    'flipkart minutes',
    'fk minutes',
    'flipkart_minutes',
    'fk_minutes',
    'amazon now',
    'amazon_now',
    'amz now',
    'amz_now',
    'instamart',
    'swiggy instamart',
    'swiggy_instamart'
];

function shouldUppercaseWebPid(platformStr) {
    if (!platformStr) return false;
    const lower = String(platformStr).trim().toLowerCase();
    return UPPERCASE_WEB_PID_TARGETS.some(target => lower.includes(target) || target.includes(lower));
}

function processWebPidUppercase(row) {
    if (!row) return row;
    const platformVal = row.Platform || row.platform || row["Platform Name"] || row.platform_name || '';
    if (shouldUppercaseWebPid(platformVal)) {
        const keys = ['Web_Pid', 'Web Pid', 'web_pid', 'Web_pid'];
        for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null) {
                row[key] = String(row[key]).toUpperCase();
            }
        }
    }
    return row;
}

/**
 * Check if a table exists in the current ClickHouse database
 */
const checkTableExists = async (tableName) => {
    try {
        const result = await queryClickHouse(`EXISTS TABLE ${tableName}`);
        const exists = Boolean(result && result[0] && (result[0].result == 1 || Object.values(result[0])[0] == 1));
        console.log(`[checkTableExists] ${tableName} -> raw: ${JSON.stringify(result?.[0])} -> exists: ${exists}`);
        return exists;
    } catch (error) {
        console.warn(`[Reports] Table existence check failed for ${tableName}:`, error.message);
        return false;
    }
};

/**
 * Helper to resolve the main full PDP raw data table, prioritizing full tables over week/summary tables.
 */
async function resolvePdpTable() {
    const currentDb = getCurrentDbName() || 'emami';

    // 1. Check full rb_pdp tables first
    if (await checkTableExists(`${currentDb}.rb_pdp`)) return `${currentDb}.rb_pdp`;
    if (await checkTableExists('rb_pdp')) return 'rb_pdp';
    if (await checkTableExists('emami.rb_pdp')) return 'emami.rb_pdp';

    // 2. Check full olap tables
    if (await checkTableExists(`${currentDb}.rb_pdp_olap`)) return `${currentDb}.rb_pdp_olap`;
    if (await checkTableExists('rb_pdp_olap')) return 'rb_pdp_olap';

    // 3. Weekly tables only if no full raw tables exist
    if (await checkTableExists(`${currentDb}.rb_pdp_week`)) return `${currentDb}.rb_pdp_week`;
    if (await checkTableExists('rb_pdp_week')) return 'rb_pdp_week';

    return 'emami.rb_pdp';
}

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
        else if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');

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

            const getColVal = (row) => row ? Object.values(row)[0] : null;
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
 */
export const getReportBuilderOptions = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('report_builder_options_v1', {});
        const pdpCols = await getTableColumns('rb_pdp_olap');

        let catCol = 'Product_type';
        if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');
        else if (pdpCols.has('category')) catCol = pdpCols.get('category');

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

            if (!out.subCategories) out.subCategories = [];
            if (!out.regions) out.regions = [];

            try {
                const hasLocalDarkstore = await checkTableExists('rb_pdp_week');
                const darkstoreTable = hasLocalDarkstore ? 'rb_pdp_week' : 'drl.rb_pdp_week';
                const dates = await queryClickHouse(`SELECT MIN(toDate(created_on)) as minDate, MAX(toDate(created_on)) as maxDate FROM ${darkstoreTable}`).catch(() => null);
                if (dates && dates[0] && dates[0].minDate) {
                    out.darkstoreDateRange = {
                        minDate: dayjs(dates[0].minDate).format('YYYY-MM-DD'),
                        maxDate: dayjs(dates[0].maxDate).format('YYYY-MM-DD'),
                    };
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
 * Download Report as Excel or CSV (Darkstore / Aggregated)
 */
export const downloadReport = async (req, res) => {
    try {
        const { platform, brand, city, format, timePeriod, reportType, startDate: qStart, endDate: qEnd } = req.query;

        const pdpCols = await getTableColumns('rb_pdp_olap');
        const col = (name) => resolveColumn(pdpCols, name, '0');

        const resellerCol = pdpCols.has('reseller_name') ? pdpCols.get('reseller_name')
            : pdpCols.has('reseller') ? pdpCols.get('reseller')
            : null;
        const resellerParam = req.query.resellerName || req.query.reseller;

        let catCol = 'Product_type';
        if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');
        else if (pdpCols.has('category')) catCol = pdpCols.get('category');
        else if (pdpCols.has('sub_category')) catCol = pdpCols.get('sub_category');

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
            startDate = dayjs(timePeriod).startOf('month').format('YYYY-MM-DD');
            endDate = dayjs(timePeriod).endOf('month').format('YYYY-MM-DD');
        } else {
            startDate = now.subtract(30, 'day').format('YYYY-MM-DD');
            endDate = now.format('YYYY-MM-DD');
        }

        const buildInClause = (column, value) => {
            if (!value || value === 'All' || value.startsWith('All ') || value.trim() === '') return null;
            const items = value.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');
            return `lower(${column}) IN (${items})`;
        };

        const dataMode = req.query.dataMode || 'aggregated';

        // ── DARKSTORE DATA EXPORT (rb_pdp_week) — Streaming CSV ──
        if (dataMode === 'darkstore' || reportType === 'Darkstore Data') {
            const currentDb = getCurrentDbName() || 'drl';
            const hasLocalWeekTable = await checkTableExists('rb_pdp_week');
            const weekTable = hasLocalWeekTable ? `${currentDb}.rb_pdp_week` : 'drl.rb_pdp_week';
            const hasLocationDarkstoreTable = await checkTableExists('rb_location_darkstore');

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

            const stateMapCTE = hasLocationDarkstoreTable
                ? `,
                state_map AS
                (
                    SELECT DISTINCT
                        toString(pincode) AS pincode,
                        location_state
                    FROM rb_location_darkstore
                    WHERE pincode IS NOT NULL AND toString(pincode) != '' AND toString(pincode) != '0'
                )`
                : '';
            const stateJoin = hasLocationDarkstoreTable
                ? `LEFT JOIN state_map sm
                    ON toString(b.pincode) = sm.pincode`
                : '';
            const stateCol = hasLocationDarkstoreTable
                ? `sm.location_state AS State,`
                : `'' AS State,`;

            const darkstoreQuery = `
                WITH base AS
                (
                    SELECT
                        toDate(created_on) AS created_date,
                        platform_name,
                        brand_name,
                        brand_category_name,
                        location_name,
                        pincode,
                        pincode_area,
                        web_pid,
                        sku_name,
                        pdp_page_url,
                        osa,
                        osa_remark,
                        location_id
                    FROM ${weekTable}
                    ${darkstoreWhere}
                ),
                platform_count AS
                (
                    SELECT
                        created_date,
                        platform_name,
                        COUNT(DISTINCT location_id) AS total_platform_darkstores
                    FROM base
                    GROUP BY
                        created_date,
                        platform_name
                ),
                city_count AS
                (
                    SELECT
                        created_date,
                        platform_name,
                        location_name,
                        COUNT(DISTINCT location_id) AS total_darkstore_cities
                    FROM base
                    GROUP BY
                        created_date,
                        platform_name,
                        location_name
                ),
                sku_city_listing AS
                (
                    SELECT
                        created_date,
                        platform_name,
                        web_pid,
                        location_name,
                        COUNT(DISTINCT
                            CASE
                                WHEN lower(osa_remark) IN ('instock', 'oos')
                                THEN location_id
                            END
                        ) AS listed_darkstore_cities
                    FROM base
                    GROUP BY
                        created_date,
                        platform_name,
                        web_pid,
                        location_name
                )${stateMapCTE}
                SELECT
                    toString(b.created_date) AS DATE,
                    b.platform_name AS platform,
                    b.brand_name AS brand,
                    b.brand_category_name AS category,
                    b.location_name AS location,
                    ${stateCol}
                    b.pincode AS Pincode,
                    b.pincode_area,
                    b.web_pid,
                    b.sku_name AS sku,
                    b.pdp_page_url AS pdp_page,
                    b.osa,
                    b.osa_remark,
                    b.location_id,
                    pc.total_platform_darkstores AS \`Total Dark store on platform\`,
                    cc.total_darkstore_cities AS \`Total City Dark Store\`,
                    scl.listed_darkstore_cities AS \`Listed City Dark Store\`,
                    ROUND(
                        scl.listed_darkstore_cities * 100.0
                        / NULLIF(cc.total_darkstore_cities, 0),
                        2
                    ) AS \`City Listing %\`
                FROM base b
                LEFT JOIN platform_count pc
                    ON b.created_date = pc.created_date
                    AND b.platform_name = pc.platform_name
                LEFT JOIN city_count cc
                    ON b.created_date = cc.created_date
                    AND b.platform_name = cc.platform_name
                    AND b.location_name = cc.location_name
                LEFT JOIN sku_city_listing scl
                    ON b.created_date = scl.created_date
                    AND b.platform_name = scl.platform_name
                    AND b.web_pid = scl.web_pid
                    AND b.location_name = scl.location_name
                ${stateJoin}
                ORDER BY b.created_date DESC
            `;

            console.log(`[downloadReport Microservice] Streaming Darkstore CSV from ${weekTable}`);

            const csvEscape = (val) => {
                if (val === null || val === undefined) return '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=Darkstore_Data_${dayjs().format('YYYYMMDD')}.csv`);
            res.setHeader('Transfer-Encoding', 'chunked');

            const stream = await streamClickHouse(darkstoreQuery);

            let headerWritten = false;
            let rowCount = 0;

            stream.on('data', (rows) => {
                const rowArray = Array.isArray(rows) ? rows : [rows];
                for (const rowObj of rowArray) {
                    const row = (typeof rowObj.json === 'function') ? rowObj.json()
                        : (Buffer.isBuffer(rowObj)) ? JSON.parse(rowObj.toString())
                        : (typeof rowObj === 'string') ? JSON.parse(rowObj)
                        : rowObj;

                    processWebPidUppercase(row);

                    if (!headerWritten) {
                        const headers = Object.keys(row);
                        res.write(headers.map(csvEscape).join(',') + '\n');
                        headerWritten = true;
                    }

                    const values = Object.values(row);
                    const canWrite = res.write(values.map(csvEscape).join(',') + '\n');
                    rowCount++;

                    if (!canWrite) {
                        stream.pause();
                        res.once('drain', () => stream.resume());
                        break;
                    }
                }
            });


            stream.on('end', () => {
                console.log(`[downloadReport Microservice] Streamed ${rowCount} Darkstore CSV rows`);
                res.end();
            });

            stream.on('error', (err) => {
                console.error('[downloadReport Microservice] Darkstore stream error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Stream failed' });
                } else {
                    res.end();
                }
            });

            return;
        }

        // ── AGGREGATED & STANDARD EXPORT ──
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

        const granularitySku = req.query.granularitySku || '';
        if (granularitySku.includes('(Own)') && !granularitySku.includes('Comp')) {
            conditions.push(`toString(Comp_flag) = '0'`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const resellerSelect = resellerCol ? `, ${resellerCol} as Reseller_Name` : '';
        const resellerSelectT = resellerCol ? `, t.${resellerCol} as Reseller_Name` : '';
        const resellerGroup = resellerCol ? `, ${resellerCol}` : '';
        const resellerGroupT = resellerCol ? `, t.${resellerCol}` : '';

        const [hasKwOlap, hasLocationDarkstore] = await Promise.all([
            checkTableExists('rb_kw_olap'),
            checkTableExists('rb_location_darkstore'),
        ]);

        if (reportType === "Availability Analysis") {
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
                    SELECT DISTINCT location, is_metro FROM rb_location_darkstore WHERE location IS NOT NULL AND location != ''
                ) m ON lower(t.Location) = lower(m.location)` : '';

            const metroCol = hasLocationDarkstore ? `round(SUM(if(m.is_metro = 1, toFloat64(t.${col('neno_osa')}), 0)) / nullIf(SUM(if(m.is_metro = 1, toFloat64(t.${col('deno_osa')}), 0)), 0) * 100, 2) as Metro_City_Stock_Availability` : `0 as Metro_City_Stock_Availability`;

            query = `
                ${sosCte}
                SELECT 
                    toString(toDate(t.DATE)) as DATE_VAL,
                    t.Platform,
                    t.Brand,
                    t.Location as City,
                    t.${catCol} as Format,
                    t.Product${resellerSelectT},
                    t.Web_Pid,
                    round(SUM(toFloat64(t.${col('neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100, 2) as Stock_Availability,
                    round(SUM(toFloat64(t.${col('neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0) * 100, 2) as OSA_Percentage,
                    round(SUM(toFloat64(t.${col('neno_buy_box')})) / nullIf(SUM(toFloat64(t.${col('deno_buy_box')})), 0) * 100, 2) as Buy_Box_Percentage,
                    round((1 - (SUM(toFloat64(t.${col('neno_osa')})) / nullIf(SUM(toFloat64(t.${col('deno_osa')})), 0))) * 100, 2) as Stock_Out_Percentage,
                    round(SUM(toFloat64(t.${col('deno_listing')}) - toFloat64(t.${col('neno_listing')})) / nullIf(SUM(toFloat64(t.${col('deno_listing')})), 0) * 100, 2) as DOI,
                    round(SUM(toFloat64(t.${col('neno_listing')})) / nullIf(SUM(toFloat64(t.${col('deno_listing')})), 0) * 100, 2) as Listing_Percentage,
                    round(SUM(toFloat64(t.${col('neno_psl')})) / nullIf(SUM(toFloat64(t.${col('deno_psl')})), 0) * 100, 2) as PSL,
                    SUM(toFloat64(t.${col('Assortment')})) as Assortment,
                    ${metroCol},
                    ${hasKwOlap ? 'round(SUM(s.brand_kw_count) / nullIf(SUM(tot.total_kw_count), 0) * 100, 2)' : '0'} as SOS_Percentage
                FROM rb_pdp_olap t
                ${sosJoin}
                ${metroJoin}
                ${whereClause}
                GROUP BY toDate(t.DATE), t.Platform, t.Brand, t.Location, t.${catCol}, t.Product${resellerGroupT}, t.Web_Pid
                ORDER BY toDate(t.DATE) DESC
            `;
        } else {
            query = `
                SELECT 
                    toString(toDate(DATE)) as DATE_VAL,
                    Platform,
                    Brand,
                    Location as City,
                    ${catCol} as Format,
                    Product${resellerSelect},
                    Web_Pid,
                    SUM(toFloat64(${col('Offtake')})) as Offtake,
                    SUM(toFloat64(${col('Units_Sold')})) as Units_Sold,
                    SUM(toFloat64(${col('Orders')})) as Orders,
                    round(SUM(toFloat64(${col('Offtake')})) / nullIf(SUM(toFloat64(${col('Units_Sold')})), 0), 2) as ASP,
                    round(SUM(toFloat64(${col('neno_osa')})) / nullIf(SUM(toFloat64(${col('deno_osa')})), 0) * 100, 2) as Stock_Availability,
                    round(SUM(toFloat64(${col('neno_osa')})) / nullIf(SUM(toFloat64(${col('deno_osa')})), 0) * 100, 2) as OSA_Percentage,
                    round(SUM(toFloat64(${col('neno_buy_box')})) / nullIf(SUM(toFloat64(${col('deno_buy_box')})), 0) * 100, 2) as Buy_Box_Percentage,
                    round((1 - (SUM(toFloat64(${col('neno_osa')})) / nullIf(SUM(toFloat64(${col('deno_osa')})), 0))) * 100, 2) as Stock_Out_Percentage,
                    round(SUM(toFloat64(${col('neno_listing')})) / nullIf(SUM(toFloat64(${col('deno_listing')})), 0) * 100, 2) as Listing_Percentage,
                    round(SUM(toFloat64(${col('neno_psl')})) / nullIf(SUM(toFloat64(${col('deno_psl')})), 0) * 100, 2) as PSL,
                    SUM(toFloat64(${col('Assortment')})) as Assortment,
                    SUM(toFloat64(${col('Impressions')})) as Impressions,
                    SUM(toFloat64(${col('Clicks')})) as Clicks,
                    SUM(toFloat64(${col('Spend')})) as Spend,
                    SUM(toFloat64(${col('Inorganic_Sales')})) as Inorganic_Sales,
                    round(SUM(toFloat64(${col('Inorganic_Sales')})) / nullIf(SUM(toFloat64(${col('Spend')})), 0), 2) as ROAS,
                    round(SUM(toFloat64(${col('Orders')})) / nullIf(SUM(toFloat64(${col('Clicks')})), 0) * 100, 2) as Conversion_Rate,
                    round(SUM(toFloat64(${col('Spend')})) / nullIf(SUM(toFloat64(${col('Impressions')})), 0) * 1000, 2) as CPM,
                    round(SUM(toFloat64(${col('Spend')})) / nullIf(SUM(toFloat64(${col('Clicks')})), 0), 2) as CPC,
                    round(SUM(toFloat64(${col('Offtake')})) / nullIf(SUM(toFloat64(${col('Orders')})), 0), 2) as AOV,
                    round(SUM(toFloat64(${col('Spend')})) / nullIf(SUM(toFloat64(${col('Offtake')})), 0) * 100, 2) as BMI_Sales_Ratio,
                    round(AVG(toFloat64(${col('Selling_Price')})), 2) as Selling_Price,
                    round(AVG(toFloat64(${col('MRP')})), 2) as MRP,
                    round(AVG(toFloat64(${col('Discount_Percentage')})), 2) as Discount_Percentage,
                    round(AVG(toFloat64(${col('RPI')})), 2) as RPI,
                    SUM(toFloat64(${col('Current_Inventory')})) as Current_Inventory,
                    SUM(toFloat64(${col('Target_Inventory')})) as Target_Inventory
                FROM rb_pdp_olap
                ${whereClause}
                GROUP BY toDate(DATE), Platform, Brand, Location, ${catCol}, Product${resellerGroup}, Web_Pid
                ORDER BY toDate(DATE) DESC
            `;
        }

        console.log(`[downloadReport Microservice] Executing query for ${reportType}:`, query);
        const rawData = await queryClickHouse(query);
        console.log(`[downloadReport Microservice] Fetched ${rawData?.length || 0} rows`);

        if (!rawData || rawData.length === 0) {
            return res.status(204).send();
        }

        rawData.forEach(row => {
            if (row.DATE_VAL !== undefined) {
                row.DATE = row.DATE_VAL;
                delete row.DATE_VAL;
            }
        });


        let finalData = rawData;
        if (reportType === "Master Dump" && req.query.metrics) {
            const requestedTags = req.query.metrics.split(',');
            const TAG_MAP = {
                "Offtake": "Offtake",
                "Units Sold": "Units_Sold",
                "Quantity Sold": "Units_Sold",
                "Orders": "Orders",
                "ASP": "ASP",
                "Stock Availability": "Stock_Availability",
                "OSA %": "OSA_Percentage",
                "Buy Box %": "Buy_Box_Percentage",
                "Stock Out %": "Stock_Out_Percentage",
                "DOI": "DOI",
                "Listing %": "Listing_Percentage",
                "PSL": "PSL",
                "Assortment": "Assortment",
                "Metro City Stock Availability": "Metro_City_Stock_Availability",
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
                "Current Inventory": "Current_Inventory",
                "Target Inventory": "Target_Inventory",
                "Selling Price": "Selling_Price",
                "ECP": "Selling_Price",
                "MRP": "MRP",
                "Discount %": "Discount_Percentage",
                "RPI": "RPI",
                "SOS %": "SOS_Percentage",
                "Overall SOS %": "Overall_SOS_Percentage",
                "Sponsored SOS %": "Sponsored_SOS_Percentage",
                "Organic SOS %": "Organic_SOS_Percentage",
                "Ad Position": "Ad_POS",
                "Org Position": "Org_Pos",
                "Promo %": "Promo_Percentage",
                "Sales Value": "Sales_Value",
                "Market Share %": "Market_Share_Percentage",
                "Category Size": "Cat_Size"
            };

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
                        newRow[tag] = row[alias];
                    }
                });
                return newRow;
            });
        }

        finalData = finalData.map(row => processWebPidUppercase({ ...row }));

        const totalDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
        const isMoreThan31Days = totalDays > 31;

        if (isMoreThan31Days || req.query.format === 'csv') {
            if (!finalData || finalData.length === 0) {
                return res.status(204).send();
            }

            const headers = Object.keys(finalData[0] || {});
            const csvRows = [headers.join(',')];

            for (const row of finalData) {
                const values = headers.map(header => {
                    const val = row[header];
                    if (val === null || val === undefined) return '""';
                    const str = String(val).replace(/"/g, '""');
                    return `"${str}"`;
                });
                csvRows.push(values.join(','));
            }

            const csvString = csvRows.join('\n');
            const fileName = `${reportType.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            return res.send(csvString);
        }

        const fileName = `${reportType.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: false,
            useSharedStrings: false
        });

        const worksheet = workbook.addWorksheet("Report Data");

        if (finalData && finalData.length > 0) {
            const headers = Object.keys(finalData[0]);
            worksheet.addRow(headers).commit();

            for (const row of finalData) {
                const values = headers.map(h => (row[h] !== undefined && row[h] !== null) ? row[h] : '');
                worksheet.addRow(values).commit();
            }
        }

        await workbook.commit();

    } catch (error) {
        console.error('[downloadReport Microservice] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Get available report types based on database tables
 */
export const getAvailableReportTypes = async (req, res) => {
    try {
        const cacheKey = generateCacheKey('available_report_types', {});

        const data = await getCachedOrCompute(cacheKey, async () => {
            const pdpCandidateTables = ['rb_pdp_olap', 'rb_pdp', 'rb_pdp_week', 'rca_sku_dim', 'rb_sales_olap'];
            const reportTableMap = [
                { type: 'Business Overview', tables: pdpCandidateTables },
                { type: 'Availability Analysis', tables: pdpCandidateTables },
                { type: 'Visibility Analysis', tables: ['rb_kw_olap'] },
                { type: 'Sales Data', tables: pdpCandidateTables },
                { type: 'Pricing Analysis', tables: pdpCandidateTables },
                { type: 'Performance Marketing', tables: pdpCandidateTables },
                { type: 'Inventory Analysis', tables: pdpCandidateTables },
                { type: 'Market Share', tables: ['rb_brand_ms_week', 'rb_brand_ms_month', 'rb_category_ms_week'] },
                { type: 'Category RCA', tables: ['rca_sku_dim'] },
                { type: 'Portfolio Analysis', tables: pdpCandidateTables },
                { type: 'Darkstore Data', tables: ['rb_pdp_week'] },
            ];

            const checkPromises = reportTableMap.map(async (item) => {
                for (const table of item.tables) {
                    const exists = await checkTableExists(table);
                    if (exists) return item.type;
                }
                return null;
            });

            const results = await Promise.all(checkPromises);
            return { reportTypes: results.filter(Boolean) };
        }, CACHE_TTL.VERY_STATIC);

        res.json(data);
    } catch (error) {
        console.error('[getAvailableReportTypes] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getPdpReportFilters = async (req, res) => {
    try {
        const pdpTable = await resolvePdpTable();
        if (!pdpTable) {
            return res.status(400).json({ error: 'No PDP data table exists for this database.' });
        }

        const pdpCols = await getTableColumns(pdpTable).catch(() => new Map());
        const dateCol = pdpCols.has('created_on') ? 'created_on' : 'pdp_crawl_date';
        const { platform, location, pincode, brand, brandCategory, sku, webPid, date } = req.query;

        const cacheKey = generateCacheKey(`pdp_report_filters_ch_${pdpTable}`, req.query);

        const data = await getCachedOrCompute(cacheKey, async () => {
            const buildWhere = (excludeField) => {
                const conditions = [];

                const addStringInClause = (column, value, fieldName) => {
                    if (excludeField === fieldName || !value || value === 'All' || value.startsWith('All ') || value.trim() === '') return;
                    const items = value.split(',').map(v => `'${v.trim().replace(/'/g, "''")}'`).join(', ');
                    conditions.push(`${column} IN (${items})`);
                };

                const addNumberInClause = (column, value, fieldName) => {
                    if (excludeField === fieldName || !value || value === 'All' || value.startsWith('All ') || value.trim() === '') return;
                    const items = value.split(',').map(v => parseInt(v.trim(), 10)).filter(v => !isNaN(v)).join(', ');
                    if (items) conditions.push(`${column} IN (${items})`);
                };

                const addDateInClause = (column, value, fieldName) => {
                    if (excludeField === fieldName || !value || value === 'All' || value.startsWith('All ') || value.trim() === '') return;
                    const items = value.split(',').map(v => `'${v.trim()}'`).join(', ');
                    conditions.push(`toDate(${column}) IN (${items})`);
                };

                addStringInClause('platform_name', platform, 'platform');
                addStringInClause('location_name', location, 'location');
                addNumberInClause('pincode', pincode, 'pincode');
                addStringInClause('brand_name', brand, 'brand');
                addStringInClause('brand_category_name', brandCategory, 'brandCategory');
                addStringInClause('sku_name', sku, 'sku');
                addStringInClause('web_pid', webPid, 'webPid');
                addDateInClause(dateCol, date, 'date');

                return conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';
            };

            const platformQuery = `SELECT DISTINCT platform_name FROM ${pdpTable} WHERE platform_name != '' AND platform_name IS NOT NULL ${buildWhere('platform')} ORDER BY platform_name`;
            const locationQuery = `SELECT DISTINCT location_name FROM ${pdpTable} WHERE location_name != '' AND location_name IS NOT NULL ${buildWhere('location')} ORDER BY location_name`;
            const pincodeQuery = `SELECT DISTINCT pincode FROM ${pdpTable} WHERE pincode IS NOT NULL ${buildWhere('pincode')} ORDER BY pincode`;
            const brandQuery = `SELECT DISTINCT brand_name FROM ${pdpTable} WHERE brand_name != '' AND brand_name IS NOT NULL ${buildWhere('brand')} ORDER BY brand_name`;
            const categoryQuery = `SELECT DISTINCT brand_category_name FROM ${pdpTable} WHERE brand_category_name != '' AND brand_category_name IS NOT NULL ${buildWhere('brandCategory')} ORDER BY brand_category_name`;
            const skuQuery = `SELECT DISTINCT sku_name FROM ${pdpTable} WHERE sku_name != '' AND sku_name IS NOT NULL ${buildWhere('sku')} ORDER BY sku_name LIMIT 1000000`;
            const webPidQuery = `SELECT DISTINCT web_pid FROM ${pdpTable} WHERE web_pid != '' AND web_pid IS NOT NULL ${buildWhere('webPid')} ORDER BY web_pid LIMIT 1000000`;
            const dateQuery = `SELECT DISTINCT toDate(${dateCol}) as DateStr FROM ${pdpTable} WHERE ${dateCol} IS NOT NULL ${buildWhere('date')} ORDER BY DateStr DESC`;
            const platformMaxDatesQuery = `SELECT platform_name, formatDateTime(max(${dateCol}), '%Y-%m-%d') as maxDate FROM ${pdpTable} WHERE platform_name != '' AND platform_name IS NOT NULL GROUP BY platform_name`;

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
            const formatDate = (dateStr) => dateStr ? dayjs(dateStr).format('YYYY-MM-DD') : '';

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

export const downloadPdpReport = async (req, res) => {
    try {
        const pdpTable = await resolvePdpTable();
        if (!pdpTable) {
            return res.status(400).json({ error: 'No PDP data table exists for this database.' });
        }

        const skuPlatCols = await getTableColumns('rb_sku_platform').catch(() => new Map());
        const hasPortfolio = skuPlatCols.has('portfolio');

        const pdpRawCols = await getTableColumns(pdpTable).catch(() => new Map());
        const pdpResellerCol = pdpRawCols.has('reseller_name') ? pdpRawCols.get('reseller_name')
            : pdpRawCols.has('reseller') ? pdpRawCols.get('reseller')
            : null;
        const dateCol = pdpRawCols.has('created_on') ? 'created_on' : 'pdp_crawl_date';

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
            if (items) conditions.push(`pdp.pincode IN (${items})`);
        }

        addFilter('pdp.brand_name', brands);
        addFilter('pdp.brand_category_name', categories);
        addFilter('pdp.sku_name', skus);
        addFilter('pdp.web_pid', webPids);

        if (startDate && endDate) {
            conditions.push(`toDate(pdp.${dateCol}) >= '${startDate}' AND toDate(pdp.${dateCol}) <= '${endDate}'`);
        } else if (dates && dates !== 'All' && dates.trim() !== '') {
            const formattedDates = dates.split(',').map(d => `'${d.trim()}'`).join(', ');
            conditions.push(`toDate(pdp.${dateCol}) IN (${formattedDates})`);
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
                formatDateTime(pdp.${dateCol}, '%Y-%m-%d') AS date,
                pdp.year AS year
            FROM ${pdpTable} AS pdp
            ${joinClause}
            ${whereClause}
            ORDER BY pdp.${dateCol} DESC
        `;

        const rawData = await queryClickHouse(query);

        const finalData = rawData.map(row => {
            const platformVal = row.platform_name || '';
            let webPidVal = row.web_pid || '';
            if (shouldUppercaseWebPid(platformVal) && webPidVal) {
                webPidVal = String(webPidVal).toUpperCase();
            }
            return {
                "Platform Name": row.platform_name || '',
                "Location": row.location_name || '',
                "Pincode": row.pincode || '',
                "Portfolio": row.portfolio || '',
                "Brand Name": row.brand_name || '',
                "Brand Category": row.brand_category_name || '',
                "SKU Name": row.sku_name || '',
                "Web Pid": webPidVal,
                "Reseller Name": row.reseller_name || '',
                "OSA Remark": row.osa_remark || '',
                "Price RP": row.price_rp !== null && row.price_rp !== undefined ? Number(row.price_rp) : '',
                "Price SP": row.price_sp !== null && row.price_sp !== undefined ? Number(row.price_sp) : '',
                "Price Variation": row.price_variation !== null && row.price_variation !== undefined ? Number(row.price_variation) : '',
                "Date": row.date || '',
                "Year": row.year !== null && row.year !== undefined ? Number(row.year) : ''
            };
        });

        const fileName = `PDP_Report_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: false,
            useSharedStrings: false
        });

        const worksheet = workbook.addWorksheet("PDP Report");

        if (finalData && finalData.length > 0) {
            const headers = Object.keys(finalData[0]);
            worksheet.addRow(headers).commit();

            for (const row of finalData) {
                const values = headers.map(h => (row[h] !== undefined && row[h] !== null) ? row[h] : '');
                worksheet.addRow(values).commit();
            }
        }

        await workbook.commit();
    } catch (error) {
        console.error('[downloadPdpReport] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const previewPdpReport = async (req, res) => {
    try {
        const pdpTable = await resolvePdpTable();
        if (!pdpTable) {
            return res.status(400).json({ error: 'No PDP data table exists for this database.' });
        }

        const pdpRawCols = await getTableColumns(pdpTable).catch(() => new Map());
        const pdpResellerCol = pdpRawCols.has('reseller_name') ? pdpRawCols.get('reseller_name')
            : pdpRawCols.has('reseller') ? pdpRawCols.get('reseller')
            : null;
        const dateCol = pdpRawCols.has('created_on') ? 'created_on' : 'pdp_crawl_date';

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
            if (items) conditions.push(`pdp.pincode IN (${items})`);
        }

        addFilter('pdp.brand_name', brands);
        addFilter('pdp.brand_category_name', categories);
        addFilter('pdp.sku_name', skus);
        addFilter('pdp.web_pid', webPids);

        if (startDate && endDate) {
            conditions.push(`toDate(pdp.${dateCol}) >= '${startDate}' AND toDate(pdp.${dateCol}) <= '${endDate}'`);
        } else if (dates && dates !== 'All' && dates.trim() !== '') {
            const formattedDates = dates.split(',').map(d => `'${d.trim()}'`).join(', ');
            conditions.push(`toDate(pdp.${dateCol}) IN (${formattedDates})`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `SELECT count() as total FROM ${pdpTable} AS pdp ${whereClause}`;
        const countResult = await queryClickHouse(countQuery);
        const totalCount = countResult && countResult[0] ? parseInt(countResult[0].total, 10) : 0;

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
                formatDateTime(pdp.${dateCol}, '%Y-%m-%d') AS date,
                pdp.year AS year
            FROM ${pdpTable} AS pdp
            ${joinClause}
            ${whereClause}
            ORDER BY pdp.${dateCol} DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const rawData = await queryClickHouse(query);

        const rows = rawData.map(row => {
            const platformVal = row.platform_name || '';
            let webPidVal = row.web_pid || '';
            if (shouldUppercaseWebPid(platformVal) && webPidVal) {
                webPidVal = String(webPidVal).toUpperCase();
            }
            return {
                "Platform Name": row.platform_name || '',
                "Location": row.location_name || '',
                "Pincode": row.pincode || '',
                "Portfolio": row.portfolio || '',
                "Brand Name": row.brand_name || '',
                "Brand Category": row.brand_category_name || '',
                "SKU Name": row.sku_name || '',
                "Web Pid": webPidVal,
                "Reseller Name": row.reseller_name || '',
                "OSA Remark": row.osa_remark || '',
                "Price RP": row.price_rp !== null && row.price_rp !== undefined ? Number(row.price_rp) : '',
                "Price SP": row.price_sp !== null && row.price_sp !== undefined ? Number(row.price_sp) : '',
                "Price Variation": row.price_variation !== null && row.price_variation !== undefined ? Number(row.price_variation) : '',
                "Date": row.date || '',
                "Year": row.year !== null && row.year !== undefined ? Number(row.year) : ''
            };
        });

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

async function fetchAndProcessPromoViolationData(reqQuery) {
    const pdpTable = await resolvePdpTable();
    const kamTable = (await checkTableExists('emami_kam_master')) ? 'emami_kam_master' : 'emami.emami_kam_master';
    const pdpCols = await getTableColumns(pdpTable).catch(() => new Map());
    const dateCol = pdpCols.has('created_on') ? 'created_on' : 'pdp_crawl_date';
    const { kam, asm, platform, sku, startDate, endDate } = reqQuery;

    const conditions = ['p.price_rp > 0', 'p.price_sp > 0'];

    if (kam && kam !== 'All' && !kam.startsWith('All ')) {
        const items = kam.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');
        conditions.push(`lower(trim(k.kam)) IN (${items})`);
    }
    if (asm && asm !== 'All' && !asm.startsWith('All ')) {
        const items = asm.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');
        conditions.push(`lower(trim(k.asm)) IN (${items})`);
    }
    if (platform && platform !== 'All' && !platform.startsWith('All ')) {
        const items = platform.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');
        conditions.push(`lower(trim(p.platform_name)) IN (${items})`);
    }
    if (sku && sku !== 'All' && !sku.startsWith('All ')) {
        const items = sku.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');
        conditions.push(`lower(trim(p.sku_name)) IN (${items})`);
    }
    if (startDate && endDate) {
        conditions.push(`toDate(p.${dateCol}) >= '${startDate}' AND toDate(p.${dateCol}) <= '${endDate}'`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const query = `
        SELECT 
            k.kam AS kam,
            k.asm AS asm,
            lower(trim(p.platform_name)) AS platform_name,
            p.sku_name AS sku_name,
            lower(trim(p.location_name)) AS location_name,
            toString(p.pincode) AS pincode,
            p.price_rp AS price_rp,
            p.price_sp AS price_sp,
            p.guardrail AS guardrail
        FROM ${pdpTable} AS p
        INNER JOIN ${kamTable} AS k
            ON lower(trim(p.platform_name)) = lower(trim(k.platform_name))
            AND lower(trim(p.location_name)) = lower(trim(k.location_name))
        ${whereClause}
    `;

    const rawRows = await queryClickHouse(query);

    const parseGuardrail = (val) => {
        if (!val || val === 'na' || val === '\\n') return 0;
        const num = parseFloat(val);
        if (isNaN(num)) return 0;
        return num <= 1 ? num * 100 : num;
    };

    const groups = new Map();
    const allLocationsSet = new Set();

    for (const row of rawRows) {
        const plat = row.platform_name || '';
        const skuName = row.sku_name || '';
        const loc = row.location_name || '';
        if (loc) allLocationsSet.add(loc);

        const key = `${plat}|||${skuName}`;
        if (!groups.has(key)) {
            groups.set(key, {
                platform_name: plat,
                sku_name: skuName,
                locationsMap: new Map(),
                rpList: [],
                spList: [],
                guardrailList: [],
            });
        }

        const item = groups.get(key);
        if (loc) {
            if (!item.locationsMap.has(loc)) {
                item.locationsMap.set(loc, new Set());
            }
            if (row.pincode && row.pincode !== '0' && row.pincode !== 'na') {
                item.locationsMap.get(loc).add(row.pincode);
            }
        }

        if (row.price_rp > 0) item.rpList.push(Number(row.price_rp));
        if (row.price_sp > 0) item.spList.push(Number(row.price_sp));
        const gVal = parseGuardrail(row.guardrail);
        if (gVal > 0) item.guardrailList.push(gVal);
    }

    const locationsList = Array.from(allLocationsSet).sort();

    const finalTableRows = [];
    for (const item of groups.values()) {
        const avgMRP = item.rpList.length ? (item.rpList.reduce((a, b) => a + b, 0) / item.rpList.length) : 0;
        const avgSP = item.spList.length ? (item.spList.reduce((a, b) => a + b, 0) / item.spList.length) : 0;

        let totalDiscount = 0;
        let countDisc = 0;
        for (let i = 0; i < Math.min(item.rpList.length, item.spList.length); i++) {
            const rp = item.rpList[i];
            const sp = item.spList[i];
            if (rp > 0) {
                totalDiscount += ((rp - sp) / rp) * 100;
                countDisc++;
            }
        }
        const discountOperated = countDisc > 0 ? (totalDiscount / countDisc) : (avgMRP > 0 ? ((avgMRP - avgSP) / avgMRP * 100) : 0);
        const guardrail = item.guardrailList.length ? (item.guardrailList.reduce((a, b) => a + b, 0) / item.guardrailList.length) : 10;
        const isBreached = discountOperated > guardrail;

        const pincodeCounts = {};
        const pincodeStrings = {};

        for (const loc of locationsList) {
            if (item.locationsMap.has(loc)) {
                const pSet = item.locationsMap.get(loc);
                pincodeCounts[loc] = pSet.size || (pSet.size === 0 ? 1 : 0);
                pincodeStrings[loc] = Array.from(pSet).join(', ');
            } else {
                pincodeCounts[loc] = '';
                pincodeStrings[loc] = '';
            }
        }

        finalTableRows.push({
            platform_name: item.platform_name,
            sku_name: item.sku_name,
            pincodeCounts,
            pincodeStrings,
            mrp: Math.round(avgMRP * 100) / 100,
            sp: Math.round(avgSP * 100) / 100,
            guardrail: Math.round(guardrail * 100) / 100,
            discountOperated: Math.round(discountOperated * 100) / 100,
            isBreached
        });
    }

    const breachedRows = finalTableRows.filter(r => r.isBreached);
    return { locationsList, breachedRows, allRows: finalTableRows };
}

export const getPromoViolationDateRange = async () => {
    try {
        const pdpTable = await resolvePdpTable();
        const pdpCols = await getTableColumns(pdpTable).catch(() => new Map());
        const dateCol = pdpCols.has('created_on') ? 'created_on' : 'pdp_crawl_date';

        const query = `
            SELECT 
                formatDateTime(MIN(${dateCol}), '%Y-%m-%d') AS minDate, 
                formatDateTime(MAX(${dateCol}), '%Y-%m-%d') AS maxDate 
            FROM ${pdpTable} 
            WHERE ${dateCol} IS NOT NULL
        `;

        const res = await queryClickHouse(query).catch(() => []);
        const minDate = res?.[0]?.minDate || null;
        const maxDate = res?.[0]?.maxDate || null;

        return { minDate, maxDate };
    } catch (err) {
        console.error('[getPromoViolationDateRange] Error:', err);
        return { minDate: null, maxDate: null };
    }
};

export const getPromoViolationFilterOptions = async (req, res) => {
    try {
        const pdpTable = await resolvePdpTable();
        const kamTable = (await checkTableExists('emami_kam_master')) ? 'emami_kam_master' : 'emami.emami_kam_master';
        const pdpCols = await getTableColumns(pdpTable).catch(() => new Map());
        const dateCol = pdpCols.has('created_on') ? 'created_on' : 'pdp_crawl_date';
        const { kam, asm, platform, sku, startDate, endDate } = req.query;

        const buildWhere = (excludeField) => {
            const conds = ['p.price_rp > 0', 'p.price_sp > 0'];

            const addIn = (field, col, val) => {
                if (excludeField === field || !val || val === 'All' || val.startsWith('All ') || val.trim() === '') return;
                const items = val.split(',').map(v => `'${v.trim().replace(/'/g, "''").toLowerCase()}'`).join(', ');
                conds.push(`lower(trim(${col})) IN (${items})`);
            };

            addIn('kam', 'k.kam', kam);
            addIn('asm', 'k.asm', asm);
            addIn('platform', 'p.platform_name', platform);
            addIn('sku', 'p.sku_name', sku);

            if (startDate && endDate) {
                conds.push(`toDate(p.${dateCol}) >= '${startDate}' AND toDate(p.${dateCol}) <= '${endDate}'`);
            }

            return conds.length > 0 ? 'WHERE ' + conds.join(' AND ') : '';
        };

        const kamQuery = `SELECT DISTINCT k.kam AS kam FROM ${pdpTable} AS p INNER JOIN ${kamTable} AS k ON lower(trim(p.platform_name)) = lower(trim(k.platform_name)) AND lower(trim(p.location_name)) = lower(trim(k.location_name)) ${buildWhere('kam')} AND k.kam != '' AND k.kam IS NOT NULL ORDER BY kam`;
        const asmQuery = `SELECT DISTINCT k.asm AS asm FROM ${pdpTable} AS p INNER JOIN ${kamTable} AS k ON lower(trim(p.platform_name)) = lower(trim(k.platform_name)) AND lower(trim(p.location_name)) = lower(trim(k.location_name)) ${buildWhere('asm')} AND k.asm != '' AND k.asm IS NOT NULL ORDER BY asm`;
        const platformQuery = `SELECT DISTINCT p.platform_name AS platform_name FROM ${pdpTable} AS p INNER JOIN ${kamTable} AS k ON lower(trim(p.platform_name)) = lower(trim(k.platform_name)) AND lower(trim(p.location_name)) = lower(trim(k.location_name)) ${buildWhere('platform')} AND p.platform_name != '' AND p.platform_name IS NOT NULL ORDER BY platform_name`;
        const skuQuery = `SELECT DISTINCT p.sku_name AS sku_name FROM ${pdpTable} AS p INNER JOIN ${kamTable} AS k ON lower(trim(p.platform_name)) = lower(trim(k.platform_name)) AND lower(trim(p.location_name)) = lower(trim(k.location_name)) ${buildWhere('sku')} AND p.sku_name != '' AND p.sku_name IS NOT NULL ORDER BY sku_name`;

        const [kamsRes, asmsRes, platformsRes, skusRes, dateRange] = await Promise.all([
            queryClickHouse(kamQuery).catch(() => []),
            queryClickHouse(asmQuery).catch(() => []),
            queryClickHouse(platformQuery).catch(() => []),
            queryClickHouse(skuQuery).catch(() => []),
            getPromoViolationDateRange(),
        ]);

        const kams = kamsRes.map(r => r.kam).filter(Boolean);
        const asms = asmsRes.map(r => r.asm).filter(Boolean);
        const platforms = platformsRes.map(r => r.platform_name).filter(Boolean);
        const skus = skusRes.map(r => r.sku_name).filter(Boolean);

        const minDate = dateRange.minDate || null;
        const maxDate = dateRange.maxDate || null;

        res.json({ kams, asms, platforms, skus, minDate, maxDate });
    } catch (error) {
        console.error('[getPromoViolationFilterOptions] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const previewPromoViolationReport = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
        const offset = (page - 1) * limit;

        const { locationsList, breachedRows } = await fetchAndProcessPromoViolationData(req.query);

        const totalCount = breachedRows.length;
        const paginatedRows = breachedRows.slice(offset, offset + limit);
        const kamSelected = req.query.kam ? req.query.kam.split(',')[0] : 'All KAMs';

        res.json({
            locationsList,
            rows: paginatedRows,
            totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit),
            kamName: kamSelected
        });
    } catch (error) {
        console.error('[previewPromoViolationReport] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const downloadPromoViolationReport = async (req, res) => {
    try {
        const { locationsList, breachedRows } = await fetchAndProcessPromoViolationData(req.query);
        const kamSelected = req.query.kam ? req.query.kam.split(',')[0] : 'All KAMs';

        const headerRow1 = [
            `Price Violation @ ${kamSelected}`,
            "",
            "Crawler Data",
            "",
            "Guardrail",
            "Discount Operated"
        ];

        const headerRow2 = [
            "platform_name",
            "Sku- Final",
            "MRP",
            "SP",
            "Guardrail",
            "Discount Operated"
        ];

        for (const loc of locationsList) {
            const cityLabel = loc.charAt(0).toUpperCase() + loc.slice(1);
            headerRow1.push(cityLabel, "");
            headerRow2.push("Count of PIN Code", "Pincodes");
        }

        const dataRows = breachedRows.map(row => {
            const rowVals = [
                row.platform_name,
                row.sku_name,
                row.mrp,
                row.sp,
                `${row.guardrail}%`,
                `${row.discountOperated}%`
            ];
            for (const loc of locationsList) {
                rowVals.push(
                    row.pincodeCounts[loc] !== '' ? row.pincodeCounts[loc] : '',
                    row.pincodeStrings[loc] || ''
                );
            }
            return rowVals;
        });

        const sheetData = [headerRow1, headerRow2, ...dataRows];
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

        const merges = [];
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });
        merges.push({ s: { r: 0, c: 2 }, e: { r: 0, c: 3 } });

        let colIdx = 6;
        for (let i = 0; i < locationsList.length; i++) {
            merges.push({ s: { r: 0, c: colIdx }, e: { r: 0, c: colIdx + 1 } });
            colIdx += 2;
        }

        worksheet['!merges'] = merges;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Promo Violation Report");

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const fileName = `Promo_Violation_Report_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('[downloadPromoViolationReport] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
