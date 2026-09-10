import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import { getTableColumns, resolveColumn } from '../utils/schemaHelper.js';

/**
 * Check if mop_master table exists in the current database
 */
const checkMopTableExists = async () => {
    try {
        const result = await queryClickHouse(`EXISTS TABLE mop_master`);
        return result && result[0] && result[0].result === 1;
    } catch {
        return false;
    }
};

/**
 * GET /api/mop-analysis/latest-date
 * Returns min and max date (created_on) in mop_master
 */
export const getMopLatestDate = async (req, res) => {
    try {
        const exists = await checkMopTableExists();
        if (!exists) {
            return res.json({ available: false });
        }

        const dateQuery = `
            SELECT 
                formatDateTime(MIN(toDate(created_on)), '%Y-%m-%d') AS min_date,
                formatDateTime(MAX(toDate(created_on)), '%Y-%m-%d') AS max_date
            FROM mop_master
            WHERE created_on IS NOT NULL
        `;

        const result = await queryClickHouse(dateQuery);
        if (result && result.length > 0 && result[0].max_date) {
            const minDate = result[0].min_date;
            const maxDate = result[0].max_date;

            // Calculate default start date (e.g. 7 days prior to maxDate or minDate)
            const maxD = new Date(maxDate);
            const defaultStartD = new Date(maxD);
            defaultStartD.setDate(defaultStartD.getDate() - 7);

            const minD = new Date(minDate);
            const finalStartD = defaultStartD < minD ? minD : defaultStartD;

            const defaultStartDate = finalStartD.toISOString().split('T')[0];

            return res.json({
                available: true,
                minDate: minDate,
                maxDate: maxDate,
                endDate: maxDate,
                startDate: defaultStartDate,
                defaultEndDate: maxDate,
                defaultStartDate: defaultStartDate
            });
        }

        res.json({ available: false });
    } catch (error) {
        console.error('[getMopLatestDate] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * GET /api/mop-analysis/filters
 * Returns filter options: ecom_nmg list, code list
 */

export const getMopFilters = async (req, res) => {
    try {
        const exists = await checkMopTableExists();
        if (!exists) {
            return res.json({ ecomNaming: [], codes: [] });
        }

        const [ecomRows, codeRows] = await Promise.all([
            queryClickHouse(`SELECT DISTINCT ecom_nmg FROM mop_master WHERE ecom_nmg IS NOT NULL AND ecom_nmg != '' ORDER BY ecom_nmg`),
            queryClickHouse(`SELECT DISTINCT code FROM mop_master WHERE code IS NOT NULL AND code != '' ORDER BY code`),
        ]);

        res.json({
            ecomNaming: ecomRows.map(r => r.ecom_nmg).filter(Boolean),
            codes: codeRows.map(r => r.code).filter(Boolean),
        });
    } catch (error) {
        console.error('[getMopFilters] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * GET /api/mop-analysis/data
 * Returns the MOP Analysis grid data.
 *
 * Query params:
 *   - ecomNaming: filter by ecom_nmg
 *   - code:       filter by code
 *   - startDate / endDate: date range
 *   - page / pageSize: pagination
 */
export const getMopData = async (req, res) => {
    try {
        const exists = await checkMopTableExists();
        if (!exists) {
            return res.json({ rows: [], total: 0, platforms: [] });
        }

        const { ecomNaming, code, startDate, endDate, page = 1, pageSize = 50 } = req.query;

        // ─── Build WHERE conditions on mop_master ───
        const mopConds = [];
        if (ecomNaming && ecomNaming !== 'All') {
            mopConds.push(`lower(m.ecom_nmg) = lower('${ecomNaming.replace(/'/g, "''")}')`);
        }
        if (code && code !== 'All') {
            mopConds.push(`lower(m.code) = lower('${code.replace(/'/g, "''")}')`);
        }
        if (startDate) {
            mopConds.push(`toDate(m.created_on) >= '${startDate}'`);
        }
        if (endDate) {
            mopConds.push(`toDate(m.created_on) <= '${endDate}'`);
        }
        const mopWhere = mopConds.length > 0 ? `WHERE ${mopConds.join(' AND ')}` : '';

        // ─── Discover columns in rb_pdp_olap ───
        let spCol = 'Selling_Price';
        let webPidCol = 'Web_Pid';
        let platformCol = 'Platform';
        let dateCol = 'DATE';

        try {
            const olapCols = await getTableColumns('rb_pdp_olap');
            spCol = resolveColumn(olapCols, 'Selling_Price', 'Selling_Price');
            webPidCol = resolveColumn(olapCols, 'Web_Pid', 'Web_Pid');
            platformCol = resolveColumn(olapCols, 'Platform', 'Platform');
            dateCol = resolveColumn(olapCols, 'DATE', 'DATE');
        } catch (e) {
            console.warn('[getMopData] Could not describe rb_pdp_olap, using default column names');
        }

        // ─── Known platform list (matches the image columns) ───
        const knownPlatforms = ['amazon', 'blinkit', 'bigbasket', 'flipkart', 'swiggy', 'zepto'];

        // Build pivot SELECT expressions for each platform's minimum selling price
        const platformSelects = knownPlatforms.map(p => {
            // Handle platform name variants (e.g. "flipkart national" should match "flipkart")
            return `MIN(CASE WHEN lower(o.${platformCol}) LIKE '%${p}%' THEN toFloat64(o.${spCol}) END) AS ${p}_price`;
        }).join(',\n                    ');

        // ─── Main query: join mop_master with rb_pdp_olap ───
        // For each mop_master row (date + web_pid), get MIN selling price per platform from rb_pdp_olap
        const dataQuery = `
            SELECT
                toDate(m.created_on) AS date,
                m.code,
                m.ecom_nmg,
                m.name AS product,
                m.mrp,
                m.t1_mop,
                m.t2_mop,
                m.platform AS mop_platform,
                m.web_pid,
                ${platformSelects}
            FROM mop_master m
            LEFT JOIN rb_pdp_olap o
                ON lower(m.web_pid) = lower(o.${webPidCol})
                AND toDate(m.created_on) = toDate(o.${dateCol})
            ${mopWhere}
            GROUP BY
                toDate(m.created_on),
                m.code,
                m.ecom_nmg,
                m.name,
                m.mrp,
                m.t1_mop,
                m.t2_mop,
                m.platform,
                m.web_pid
            ORDER BY toDate(m.created_on) DESC, m.code ASC
        `;

        // ─── Count query ───
        const countQuery = `
            SELECT count() AS cnt
            FROM (
                SELECT
                    toDate(m.created_on) AS date,
                    m.code,
                    m.web_pid
                FROM mop_master m
                ${mopWhere.replace(/m\./g, 'm.')}
                GROUP BY date, m.code, m.web_pid
            )
        `;

        console.log('[getMopData] Executing query:', dataQuery.replace(/\s+/g, ' ').substring(0, 300));

        const [rawData, countData] = await Promise.all([
            queryClickHouse(dataQuery),
            queryClickHouse(countQuery),
        ]);

        const total = countData?.[0]?.cnt || rawData.length;

        // ─── Paginate in JS (ClickHouse LIMIT with GROUP BY can be unreliable for offsets) ───
        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const paginatedData = rawData.slice(offset, offset + parseInt(pageSize));

        // ─── Format rows for the frontend ───
        const rows = paginatedData.map(row => ({
            date: row.date,
            code: row.code ? String(row.code).toUpperCase() : '',
            ecomNaming: row.ecom_nmg || '',
            product: row.product || '',
            mrp: row.mrp != null ? Number(row.mrp) : null,
            t1Mop: row.t1_mop != null ? Number(row.t1_mop) : null,
            t2Mop: row.t2_mop != null ? Number(row.t2_mop) : null,
            webPid: row.web_pid || '',
            amazonPrice: row.amazon_price != null ? Number(row.amazon_price) : null,
            blinkitPrice: row.blinkit_price != null ? Number(row.blinkit_price) : null,
            bigbasketPrice: row.bigbasket_price != null ? Number(row.bigbasket_price) : null,
            flipkartPrice: row.flipkart_price != null ? Number(row.flipkart_price) : null,
            swiggyPrice: row.swiggy_price != null ? Number(row.swiggy_price) : null,
            zeptoPrice: row.zepto_price != null ? Number(row.zepto_price) : null,
        }));

        res.json({
            rows,
            total: parseInt(total),
            platforms: knownPlatforms,
        });
    } catch (error) {
        console.error('[getMopData] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
