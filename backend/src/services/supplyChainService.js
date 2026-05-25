import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';
import { getCachedOrCompute, generateCacheKey, CACHE_TTL } from '../utils/cacheHelper.js';
import dayjs from 'dayjs';

/**
 * Supply Chain Service
 * Provides real data for the Priority Action page from rb_po_olap table.
 */

/**
 * Build WHERE clause fragments from filter parameters
 */
function buildPOWhereClause(filters = {}) {
    const conditions = ['po_number IS NOT NULL'];

    if (filters.platform && filters.platform !== 'All') {
        const platforms = filters.platform.split(',').map(p => `'${p.trim().toLowerCase()}'`).join(',');
        conditions.push(`lower(platform) IN (${platforms})`);
    }
    if (filters.brand && filters.brand !== 'All') {
        const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
        conditions.push(`lower(brand) IN (${brands})`);
    }
    if (filters.category && filters.category !== 'All') {
        const categories = filters.category.split(',').map(c => `'${c.trim().toLowerCase()}'`).join(',');
        conditions.push(`lower(category) IN (${categories})`);
    }
    if (filters.city && filters.city !== 'All') {
        const cities = filters.city.split(',').map(c => `'${c.trim().toLowerCase()}'`).join(',');
        conditions.push(`lower(city) IN (${cities})`);
    }
    if (filters.status && filters.status !== 'All') {
        const statuses = filters.status.split(',').map(s => `'${s.trim().toLowerCase()}'`).join(',');
        conditions.push(`lower(po_status) IN (${statuses})`);
    }
    if (filters.search) {
        const searchTerm = filters.search.trim().toLowerCase();
        conditions.push(`(lower(po_number) LIKE '%${searchTerm}%' OR lower(facility_name) LIKE '%${searchTerm}%' OR lower(sku_name) LIKE '%${searchTerm}%')`);
    }
    // Date range filter on po_raised_date column
    // Frontend sends dates as raw JS Date strings (e.g. "Thu, 30 Apr 2026 18:30:00 GMT")
    // ClickHouse needs YYYY-MM-DD format
    if (filters.startDate) {
        const d = new Date(filters.startDate);
        if (!isNaN(d.getTime())) {
            const formatted = d.toISOString().split('T')[0]; // "2026-04-30"
            conditions.push(`toDate(po_raised_date) >= toDate('${formatted}')`);
        }
    }
    if (filters.endDate) {
        const d = new Date(filters.endDate);
        if (!isNaN(d.getTime())) {
            const formatted = d.toISOString().split('T')[0];
            conditions.push(`toDate(po_raised_date) <= toDate('${formatted}')`);
        }
    }

    return conditions.join(' AND ');
}

/**
 * Compute Priority level from aggregated PO metrics
 * Priority is determined by urgency signals:
 *  - High: DIH < 3 OR fillRate < 50% OR expiry within 3 days
 *  - Medium: DIH < 7 OR fillRate < 80% OR expiry within 7 days
 *  - Low: Everything else
 */
function computePriority(avgDoi, fillRate, expiryDate) {
    const now = new Date();
    let daysToExpiry = 999;
    if (expiryDate) {
        const expiry = new Date(expiryDate);
        daysToExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    }

    const doiVal = avgDoi === null || avgDoi === undefined ? 999 : avgDoi;
    const frVal = fillRate === null || fillRate === undefined ? 100 : fillRate;

    if (doiVal < 3 || frVal < 50 || daysToExpiry < 3) return 'High';
    if (doiVal < 7 || frVal < 80 || daysToExpiry < 7) return 'Medium';
    return 'Low';
}

/**
 * Compute PSL (Potential Sales Loss at MRP)
 * Formula: Expected 7-Day Sales at MRP × (1 − OSA) × Stock-Out Risk Factor
 */
function computePSL(expected7DaySales, totalNenoOsa, totalDenoOsa, avgDoi, leadTime) {
    // OSA = neno_osa / deno_osa
    const osa = totalDenoOsa > 0 ? totalNenoOsa / totalDenoOsa : 0;

    const doiVal = avgDoi === null || avgDoi === undefined ? 0 : avgDoi;
    const ltVal = leadTime === null || leadTime === undefined ? 0 : leadTime;

    // Stock-Out Risk Factor: if DIH << LT, risk approaches 1
    // If DIH >= LT, no risk (factor = 0)
    const stockOutRisk = ltVal > 0
        ? Math.max(0, Math.min(1, 1 - (doiVal / ltVal)))
        : 0;

    const psl = expected7DaySales * (1 - Math.min(1, osa)) * stockOutRisk;
    return Math.max(0, psl);
}

/**
 * Title-case a string
 */
function titleCase(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format a date string to "DD Mon YYYY"
 */
function formatDate(dateStr) {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
        return dateStr;
    }
}

const supplyChainService = {

    /**
     * Get Prioritize PO Data — main table data
     * Aggregates rb_po_olap rows by po_number, computes PSL, Priority, Fill Rate
     * 
     * @param {Object} filters — platform, brand, category, city, status, search
     * @returns {Object} { data: [...], totalCount, summary }
     */
    async getPrioritizePOData(filters = {}) {
        console.log('[SupplyChain] getPrioritizePOData called with filters:', filters);
        const cacheKey = generateCacheKey('supply_chain_prioritize_po_v1', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const whereClause = buildPOWhereClause(filters);

                // Default filter: exclude terminal PO statuses unless user explicitly filters by status
                let statusFilter = '';
                if (!filters.status || filters.status === 'All') {
                    statusFilter = `AND lower(po_status) NOT IN ('completed', 'fulfilled', 'expired', 'cancelled', 'rejected', 'cancelled post creation')`;
                }

                const query = `
                    SELECT
                        po_number,
                        any(platform) as platform_val,
                        any(facility_name) as facility_name_val,
                        any(city) as city_val,
                        any(distributor_name) as distributor_name_val,
                        any(po_raised_date) as po_raised_date_val,
                        any(po_appointment_date) as po_appointment_date_val,
                        any(po_expiry_date) as po_expiry_date_val,
                        any(po_status) as po_status_val,
                        any(brand) as brand_val,
                        any(category) as category_val,

                        -- Order Value: sum of total_po_value across SKUs in this PO
                        SUM(total_po_value) as order_value,

                        -- Fill Rate: computed from raw units
                        SUM(units_ordered) as total_units_ordered,
                        SUM(units_delivered) as total_fulfilled_qty,

                        -- AVG DOI (Days of Inventory on Hand)
                        avg(DIH) as avg_doi,

                        -- Lead Time (max across SKUs in PO)
                        max(delivery_time) as lead_time,

                        -- Consumption Per Day (avg DRR)
                        avg(DRR) as consumption_per_day,

                        -- PSL Components
                        SUM(ifNull(DRR, 0) * 7 * ifNull(cost_per_unit, 0)) as expected_7day_sales,
                        SUM(ifNull(neno_osa, 0)) as total_neno_osa,
                        SUM(ifNull(deno_osa, 0)) as total_deno_osa,

                        -- Remaining value
                        SUM(remaining_po_value) as remaining_value,

                        -- SKU count
                        count() as sku_count

                    FROM rb_po_olap
                    WHERE ${whereClause}
                    ${statusFilter}
                    GROUP BY po_number, lower(facility_name)
                    ORDER BY po_number
                `;

                console.log('[SupplyChain] Executing Prioritize PO query...');
                const rows = await queryClickHouse(query);
                console.log(`[SupplyChain] Got ${rows.length} PO rows from ClickHouse`);

                // Post-process: compute PSL, Priority, format fields
                const data = rows.map(row => {
                    const orderValue = row.order_value === null ? null : parseFloat(row.order_value);
                    const totalOrdered = row.total_units_ordered === null ? null : parseFloat(row.total_units_ordered);
                    const totalFulfilled = row.total_fulfilled_qty === null ? null : parseFloat(row.total_fulfilled_qty);
                    const fillRate = (totalOrdered !== null && totalOrdered > 0 && totalFulfilled !== null) ? (totalFulfilled / totalOrdered) * 100 : null;
                    const avgDoi = row.avg_doi === null ? null : parseFloat(row.avg_doi);
                    const leadTime = row.lead_time === null ? null : parseInt(row.lead_time);
                    const cpd = row.consumption_per_day === null ? null : parseFloat(row.consumption_per_day);
                    const expected7DaySales = parseFloat(row.expected_7day_sales) || 0;
                    const totalNenoOsa = parseFloat(row.total_neno_osa) || 0;
                    const totalDenoOsa = parseFloat(row.total_deno_osa) || 0;

                    const psl = computePSL(expected7DaySales, totalNenoOsa, totalDenoOsa, avgDoi, leadTime);
                    const priority = computePriority(avgDoi, fillRate, row.po_expiry_date_val);

                    return {
                        poNumber: row.po_number,
                        priority,
                        projectedSalesAtRisk: Math.round(psl),
                        platformWarehouse: `${titleCase(row.platform_val || '')} - ${titleCase(row.facility_name_val || '')}`,
                        platform: row.platform_val,
                        facilityName: row.facility_name_val,
                        city: titleCase(row.city_val || ''),
                        status: titleCase(row.po_status_val || ''),
                        rawStatus: row.po_status_val,
                        orderValue: orderValue !== null ? Math.round(orderValue) : null,
                        raisedOn: formatDate(row.po_raised_date_val),
                        apptDate: formatDate(row.po_appointment_date_val),
                        expiry: formatDate(row.po_expiry_date_val),
                        rawExpiryDate: row.po_expiry_date_val,
                        avgDoi: avgDoi !== null ? Math.round(avgDoi) : null,
                        lt: leadTime,
                        fillRate: fillRate !== null ? parseFloat(fillRate.toFixed(1)) : null,
                        consumptionPerDay: cpd !== null ? Math.round(cpd) : null,
                        skuCount: parseInt(row.sku_count) || 0,
                        brand: titleCase(row.brand_val || ''),
                        category: titleCase(row.category_val || ''),
                        distributor: titleCase(row.distributor_name_val || '')
                    };
                });

                // Sort: High priority first, then by PSL descending
                const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
                data.sort((a, b) => {
                    const pDiff = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
                    if (pDiff !== 0) return pDiff;
                    return b.projectedSalesAtRisk - a.projectedSalesAtRisk;
                });

                // Summary metrics
                const totalSalesAtRisk = data.reduce((sum, d) => sum + d.projectedSalesAtRisk, 0);
                const avgFillRate = data.length > 0
                    ? data.reduce((sum, d) => sum + d.fillRate, 0) / data.length
                    : 0;
                const highPriorityCount = data.filter(d => d.priority === 'High').length;
                const mediumPriorityCount = data.filter(d => d.priority === 'Medium').length;

                return {
                    data,
                    totalCount: data.length,
                    summary: {
                        totalPOs: data.length,
                        totalSalesAtRisk: Math.round(totalSalesAtRisk),
                        avgFillRate: parseFloat(avgFillRate.toFixed(1)),
                        highPriority: highPriorityCount,
                        mediumPriority: mediumPriorityCount,
                        lowPriority: data.length - highPriorityCount - mediumPriorityCount
                    }
                };

            } catch (error) {
                console.error('[SupplyChain] Error fetching Prioritize PO data:', error);
                throw error;
            }
        }, CACHE_TTL.SHORT);
    },

    /**
     * Get PO Detail Data — SKU-level rows for a specific PO (for the "Know More" modal)
     * 
     * @param {string} poNumber — PO number to drill down into
     * @returns {Object} { poInfo, skus: [...] }
     */
    async getPODetailData(poNumber, facilityName, filters = {}) {
        console.log(`[SupplyChain] getPODetailData called for PO: ${poNumber}, facility: ${facilityName}, filters:`, filters);

        if (!poNumber) {
            throw new Error('poNumber is required');
        }

        const cacheKey = generateCacheKey('supply_chain_po_detail_v2', { poNumber, facilityName, ...filters });

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                // Build the active filters WHERE clause
                const whereClause = buildPOWhereClause(filters);

                // Default filter: exclude terminal PO statuses unless user explicitly filters by status
                let statusFilter = '';
                if (!filters.status || filters.status === 'All') {
                    statusFilter = `AND lower(po_status) NOT IN ('completed', 'fulfilled', 'expired', 'cancelled', 'rejected', 'cancelled post creation')`;
                }

                const query = `
                    SELECT
                        po_number,
                        platform,
                        facility_name,
                        city,
                        distributor_name,
                        po_raised_date,
                        po_appointment_date,
                        po_expiry_date,
                        po_status,
                        sku_name,
                        brand,
                        category,
                        item_id,
                        web_pid,
                        cost_per_unit,
                        units_ordered,
                        units_remaining,
                        units_delivered,
                        total_po_value,
                        remaining_po_value,
                        fullfilled_quantity,
                        fullfilled_po_value,
                        front_inventory,
                        toFloat64OrNull(back_inventory) as back_inventory,
                        DIH,
                        DRR,
                        qty_sold,
                        fill_rate as fill_rate_str,
                        delivery_time,
                        image_url,
                        neno_osa,
                        deno_osa,
                        listing_percent
                    FROM rb_po_olap
                    WHERE lower(po_number) = lower('${poNumber}')
                    ${facilityName && facilityName !== 'null' && facilityName !== 'undefined' ? `AND lower(facility_name) = lower('${facilityName}')` : ''}
                    AND ${whereClause}
                    ${statusFilter}
                    ORDER BY sku_name
                `;

                const rows = await queryClickHouse(query);

                if (rows.length === 0) {
                    return { poInfo: null, skus: [] };
                }

                // Extract PO-level info from first row
                const first = rows[0];
                const poInfo = {
                    poNumber: first.po_number,
                    platform: titleCase(first.platform || ''),
                    facilityName: titleCase(first.facility_name || ''),
                    platformWarehouse: `${titleCase(first.platform || '')} - ${titleCase(first.facility_name || '')}`,
                    city: titleCase(first.city || ''),
                    distributor: titleCase(first.distributor_name || ''),
                    raisedOn: formatDate(first.po_raised_date),
                    apptDate: formatDate(first.po_appointment_date),
                    expiry: formatDate(first.po_expiry_date),
                    status: titleCase(first.po_status || ''),
                    brand: titleCase(first.brand || ''),
                    category: titleCase(first.category || '')
                };

                // Map each SKU row
                const skus = rows.map(row => {
                    const unitsOrdered = row.units_ordered === null ? null : parseFloat(row.units_ordered);
                    const unitsDelivered = row.units_delivered === null ? null : parseFloat(row.units_delivered);
                    const fillRate = (unitsOrdered !== null && unitsOrdered > 0 && unitsDelivered !== null) ? (unitsDelivered / unitsOrdered) * 100 : null;

                    return {
                        skuName: row.sku_name,
                        brand: titleCase(row.brand || ''),
                        category: titleCase(row.category || ''),
                        itemId: row.item_id,
                        webPid: row.web_pid,
                        costPerUnit: row.cost_per_unit === null ? null : parseFloat(row.cost_per_unit),
                        unitsOrdered: unitsOrdered !== null ? Math.round(unitsOrdered) : null,
                        unitsRemaining: row.units_remaining === null ? null : Math.round(parseFloat(row.units_remaining)),
                        unitsDelivered: unitsDelivered !== null ? Math.round(unitsDelivered) : null,
                        totalValue: row.total_po_value === null ? null : Math.round(parseFloat(row.total_po_value)),
                        remainingValue: row.remaining_po_value === null ? null : Math.round(parseFloat(row.remaining_po_value)),
                        fulfilledQty: row.fullfilled_quantity === null ? null : Math.round(parseFloat(row.fullfilled_quantity)),
                        fulfilledValue: row.fullfilled_po_value === null ? null : Math.round(parseFloat(row.fullfilled_po_value)),
                        fillRate: fillRate !== null ? parseFloat(fillRate.toFixed(1)) : null,
                        fillRateStr: row.fill_rate_str,
                        frontInventory: row.front_inventory === null ? null : Math.round(parseFloat(row.front_inventory)),
                        backInventory: row.back_inventory === null ? null : Math.round(parseFloat(row.back_inventory)),
                        doi: row.DIH === null ? null : parseFloat(row.DIH),
                        drr: row.DRR === null ? null : parseFloat(row.DRR),
                        qtySold: row.qty_sold === null ? null : parseFloat(row.qty_sold),
                        deliveryTime: row.delivery_time === null ? null : parseInt(row.delivery_time),
                        imageUrl: row.image_url || null,
                        osa: (row.deno_osa !== null && parseFloat(row.deno_osa) > 0 && row.neno_osa !== null)
                            ? parseFloat((parseFloat(row.neno_osa) / parseFloat(row.deno_osa) * 100).toFixed(1))
                            : null,
                        listingPercent: row.listing_percent === null ? null : parseFloat(row.listing_percent)
                    };
                });

                return { poInfo, skus };

            } catch (error) {
                console.error(`[SupplyChain] Error fetching PO detail for ${poNumber}:`, error);
                throw error;
            }
        }, CACHE_TTL.SHORT);
    },

    /**
     * Get PO Filter Options — distinct values for filter dropdowns
     * 
     * @returns {Object} { platforms, brands, categories, cities, statuses }
     */
    async getPOFilterOptions() {
        console.log('[SupplyChain] getPOFilterOptions called');
        const cacheKey = generateCacheKey('supply_chain_po_filters_v1', {});

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const [platforms, brands, categories, cities, statuses] = await Promise.all([
                    queryClickHouse(`SELECT DISTINCT platform FROM rb_po_olap WHERE platform IS NOT NULL AND platform != '' ORDER BY platform`),
                    queryClickHouse(`SELECT DISTINCT brand FROM rb_po_olap WHERE brand IS NOT NULL AND brand != '' ORDER BY brand`),
                    queryClickHouse(`SELECT DISTINCT category FROM rb_po_olap WHERE category IS NOT NULL AND category != '' ORDER BY category`),
                    queryClickHouse(`SELECT DISTINCT city FROM rb_po_olap WHERE city IS NOT NULL AND city != '' ORDER BY city`),
                    queryClickHouse(`SELECT DISTINCT po_status FROM rb_po_olap WHERE po_status IS NOT NULL AND po_status != '' ORDER BY po_status`)
                ]);

                return {
                    platforms: platforms.map(r => titleCase(r.platform)),
                    brands: brands.map(r => titleCase(r.brand)),
                    categories: categories.map(r => titleCase(r.category)),
                    cities: cities.map(r => titleCase(r.city)),
                    statuses: statuses.map(r => titleCase(r.po_status))
                };

            } catch (error) {
                console.error('[SupplyChain] Error fetching PO filter options:', error);
                throw error;
            }
        }, CACHE_TTL.STATIC);
    },

    /**
     * Get SKU trend data (time-series KPIs)
     * Uses rb_pdp_olap table, joined by Web_Pid
     * 
     * KPIs: OSA, Offtake, DRR (rolling 30-day), Price, Promo %, DOI
     * 
     * @param {string} webPid — Web_Pid identifier for the SKU
     * @param {string} timeStep — 'daily', 'weekly', or 'monthly'
     * @returns {Object} { dates: [...], kpis: { osa, offtake, drr, price, promo, doi } }
     */
    async getSKUTrendData(webPid, timeStep = 'daily') {
        console.log(`[SupplyChain] getSKUTrendData called for webPid: ${webPid}, timeStep: ${timeStep}`);

        if (!webPid) {
            throw new Error('webPid is required');
        }

        const cacheKey = generateCacheKey('supply_chain_sku_trend_v3', { webPid, timeStep });

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const query = `
                    SELECT
                        p.DATE as date,
                        p.offtake as offtake,
                        p.offtake_qty as offtake_qty,
                        p.avg_price as avg_price,
                        p.avg_discount as avg_discount,
                        p.total_inventory as total_inventory,
                        o.total_neno_osa as total_neno_osa,
                        o.total_deno_osa as total_deno_osa
                    FROM (
                        SELECT
                            DATE,
                            sumIf(ifNull(Sales, 0), Comp_flag = 0) as offtake,
                            sumIf(ifNull(Qty_Sold, 0), Comp_flag = 0) as offtake_qty,
                            avg(ifNull(Selling_Price, 0)) as avg_price,
                            avg(ifNull(Discount, 0)) as avg_discount,
                            sum(ifNull(Inventory, 0)) as total_inventory
                        FROM rb_pdp_olap
                        WHERE Web_Pid = '${webPid}'
                        GROUP BY DATE
                    ) p
                    LEFT JOIN (
                        SELECT
                            po_raised_date,
                            sum(ifNull(neno_osa, 0)) as total_neno_osa,
                            sum(ifNull(deno_osa, 0)) as total_deno_osa
                        FROM rb_po_olap
                        WHERE web_pid = '${webPid}'
                        GROUP BY po_raised_date
                    ) o ON toDate(p.DATE) = toDate(o.po_raised_date)
                    ORDER BY p.DATE ASC
                `;

                const rows = await queryClickHouse(query);
                console.log(`[SupplyChain] Got ${rows.length} trend data points for webPid: ${webPid}`);

                if (rows.length === 0) {
                    return { dates: [], kpis: { osa: [], offtake: [], drr: [], price: [], promo: [], doi: [] } };
                }

                // Compute daily values first
                const offtakeValues = rows.map(r => parseFloat(r.offtake) || 0);
                const qtySoldValues = rows.map(r => parseFloat(r.offtake_qty) || 0);
                const dailyPoints = rows.map((row, idx) => {
                    const nenoOsa = row.total_neno_osa === null ? null : parseFloat(row.total_neno_osa);
                    const denoOsa = row.total_deno_osa === null ? null : parseFloat(row.total_deno_osa);
                    const osaVal = (denoOsa !== null && denoOsa > 0 && nenoOsa !== null) ? (nenoOsa / denoOsa * 100) : null;
                    const dailyOfftake = parseFloat(row.offtake) || 0;

                    // DRR: rolling 30-day average of offtake (sales in rupees)
                    const windowStart = Math.max(0, idx - 29);
                    const offtakeSlice = offtakeValues.slice(windowStart, idx + 1);
                    const rollingSum = offtakeSlice.reduce((a, b) => a + b, 0);
                    const rollingDrr = rollingSum / 30;

                    // DRR Qty: rolling 30-day average of qty_sold in units (for DOI)
                    const qtySlice = qtySoldValues.slice(windowStart, idx + 1);
                    const rollingSumQty = qtySlice.reduce((a, b) => a + b, 0);
                    const rollingDrrQty = rollingSumQty / 30;

                    const priceVal = row.avg_price === null ? null : parseFloat(row.avg_price);
                    const discountVal = row.avg_discount === null ? null : parseFloat(row.avg_discount);
                    const inv = row.total_inventory === null ? null : parseFloat(row.total_inventory);
                    const doiVal = (rollingDrrQty > 0 && inv !== null) ? (inv / rollingDrrQty) : null;

                    return {
                        date: row.date,
                        nenoOsa,
                        denoOsa,
                        osaVal,
                        offtakeVal: dailyOfftake,
                        drrVal: rollingDrr,
                        priceVal,
                        discountVal,
                        inventoryVal: inv,
                        doiVal
                    };
                });

                // Group by timeStep
                const buckets = {};
                dailyPoints.forEach(p => {
                    let key;
                    if (timeStep === 'weekly') {
                        const d = dayjs(p.date);
                        const day = d.day();
                        const diff = d.subtract(day === 0 ? 6 : day - 1, 'day');
                        key = diff.format('YYYY-MM-DD');
                    } else if (timeStep === 'monthly') {
                        key = dayjs(p.date).startOf('month').format('YYYY-MM-DD');
                    } else {
                        key = p.date;
                    }

                    if (!buckets[key]) {
                        buckets[key] = [];
                    }
                    buckets[key].push(p);
                });

                const sortedKeys = Object.keys(buckets).sort();
                const dates = [];
                const osa = [];
                const offtake = [];
                const drr = [];
                const price = [];
                const promo = [];
                const doi = [];

                sortedKeys.forEach(key => {
                    const pts = buckets[key];
                    dates.push(key);

                    // OSA: mathematically aggregate numerators and denominators
                    let sumNeno = 0;
                    let sumDeno = 0;
                    let hasOsa = false;
                    pts.forEach(p => {
                        if (p.nenoOsa !== null && p.denoOsa !== null) {
                            sumNeno += p.nenoOsa;
                            sumDeno += p.denoOsa;
                            hasOsa = true;
                        }
                    });
                    osa.push(hasOsa && sumDeno > 0 ? parseFloat((sumNeno / sumDeno * 100).toFixed(1)) : null);

                    // Offtake: total sum over the period
                    const sumOfftake = pts.reduce((sum, p) => sum + (p.offtakeVal || 0), 0);
                    offtake.push(Math.round(sumOfftake));

                    // DRR: average of daily DRR values in this period
                    const avgDrr = pts.reduce((sum, p) => sum + (p.drrVal || 0), 0) / pts.length;
                    drr.push(parseFloat(avgDrr.toFixed(1)));

                    // Price: average of daily prices in this period
                    const validPrices = pts.map(p => p.priceVal).filter(v => v !== null);
                    const avgPrice = validPrices.length > 0 ? (validPrices.reduce((sum, v) => sum + v, 0) / validPrices.length) : null;
                    price.push(avgPrice !== null ? parseFloat(avgPrice.toFixed(1)) : null);

                    // Promo %: average of daily discounts in this period
                    const validPromos = pts.map(p => p.discountVal).filter(v => v !== null);
                    const avgPromo = validPromos.length > 0 ? (validPromos.reduce((sum, v) => sum + v, 0) / validPromos.length) : null;
                    promo.push(avgPromo !== null ? parseFloat(avgPromo.toFixed(1)) : null);

                    // DOI: average of daily DOI values in this period
                    const validDois = pts.map(p => p.doiVal).filter(v => v !== null);
                    const avgDoi = validDois.length > 0 ? (validDois.reduce((sum, v) => sum + v, 0) / validDois.length) : null;
                    doi.push(avgDoi !== null ? parseFloat(avgDoi.toFixed(1)) : null);
                });

                return { dates, kpis: { osa, offtake, drr, price, promo, doi } };

            } catch (error) {
                console.error(`[SupplyChain] Error fetching SKU trend data for ${webPid}:`, error);
                throw error;
            }
        }, CACHE_TTL.SHORT);
    }
};

export default supplyChainService;
