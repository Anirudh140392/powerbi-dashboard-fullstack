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

    if (avgDoi < 3 || fillRate < 50 || daysToExpiry < 3) return 'High';
    if (avgDoi < 7 || fillRate < 80 || daysToExpiry < 7) return 'Medium';
    return 'Low';
}

/**
 * Compute PSL (Potential Sales Loss at MRP)
 * Formula: Expected 7-Day Sales at MRP × (1 − OSA) × Stock-Out Risk Factor
 */
function computePSL(expected7DaySales, totalNenoOsa, totalDenoOsa, avgDoi, leadTime) {
    // OSA = neno_osa / deno_osa
    const osa = totalDenoOsa > 0 ? totalNenoOsa / totalDenoOsa : 0;

    // Stock-Out Risk Factor: if DIH << LT, risk approaches 1
    // If DIH >= LT, no risk (factor = 0)
    const stockOutRisk = leadTime > 0
        ? Math.max(0, Math.min(1, 1 - (avgDoi / leadTime)))
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
                        SUM(ifNull(total_po_value, 0)) as order_value,

                        -- Fill Rate: computed from raw units
                        SUM(ifNull(units_ordered, 0)) as total_units_ordered,
                        SUM(ifNull(units_delivered, 0)) as total_fulfilled_qty,

                        -- AVG DOI (Days of Inventory on Hand)
                        avg(ifNull(DIH, 0)) as avg_doi,

                        -- Lead Time (max across SKUs in PO)
                        max(ifNull(delivery_time, 0)) as lead_time,

                        -- Consumption Per Day (avg DRR)
                        avg(ifNull(DRR, 0)) as consumption_per_day,

                        -- PSL Components
                        SUM(ifNull(DRR, 0) * 7 * ifNull(cost_per_unit, 0)) as expected_7day_sales,
                        SUM(ifNull(neno_osa, 0)) as total_neno_osa,
                        SUM(ifNull(deno_osa, 0)) as total_deno_osa,

                        -- Remaining value
                        SUM(ifNull(remaining_po_value, 0)) as remaining_value,

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
                    const orderValue = parseFloat(row.order_value) || 0;
                    const totalOrdered = parseFloat(row.total_units_ordered) || 0;
                    const totalFulfilled = parseFloat(row.total_fulfilled_qty) || 0;
                    const fillRate = totalOrdered > 0 ? (totalFulfilled / totalOrdered) * 100 : 0;
                    const avgDoi = parseFloat(row.avg_doi) || 0;
                    const leadTime = parseInt(row.lead_time) || 0;
                    const cpd = parseFloat(row.consumption_per_day) || 0;
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
                        orderValue: Math.round(orderValue),
                        raisedOn: formatDate(row.po_raised_date_val),
                        apptDate: formatDate(row.po_appointment_date_val),
                        expiry: formatDate(row.po_expiry_date_val),
                        rawExpiryDate: row.po_expiry_date_val,
                        avgDoi: parseFloat(avgDoi.toFixed(1)),
                        lt: leadTime,
                        fillRate: parseFloat(fillRate.toFixed(1)),
                        consumptionPerDay: parseFloat(cpd.toFixed(1)),
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
                        ifNull(cost_per_unit, 0) as cost_per_unit,
                        ifNull(units_ordered, 0) as units_ordered,
                        ifNull(units_remaining, 0) as units_remaining,
                        ifNull(units_delivered, 0) as units_delivered,
                        ifNull(total_po_value, 0) as total_po_value,
                        ifNull(remaining_po_value, 0) as remaining_po_value,
                        ifNull(fullfilled_quantity, 0) as fullfilled_quantity,
                        ifNull(fullfilled_po_value, 0) as fullfilled_po_value,
                        ifNull(front_inventory, 0) as front_inventory,
                        toFloat64OrZero(ifNull(back_inventory, '0')) as back_inventory,
                        ifNull(DIH, 0) as DIH,
                        ifNull(DRR, 0) as DRR,
                        ifNull(qty_sold, 0) as qty_sold,
                        fill_rate as fill_rate_str,
                        ifNull(delivery_time, 0) as delivery_time,
                        image_url,
                        ifNull(neno_osa, 0) as neno_osa,
                        ifNull(deno_osa, 0) as deno_osa,
                        ifNull(listing_percent, 0) as listing_percent
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
                    const unitsOrdered = parseFloat(row.units_ordered) || 0;
                    const unitsDelivered = parseFloat(row.units_delivered) || 0;
                    const fillRate = unitsOrdered > 0 ? (unitsDelivered / unitsOrdered) * 100 : 0;

                    return {
                        skuName: row.sku_name,
                        brand: titleCase(row.brand || ''),
                        category: titleCase(row.category || ''),
                        itemId: row.item_id,
                        webPid: row.web_pid,
                        costPerUnit: parseFloat(row.cost_per_unit) || 0,
                        unitsOrdered: Math.round(unitsOrdered),
                        unitsRemaining: Math.round(parseFloat(row.units_remaining) || 0),
                        unitsDelivered: Math.round(parseFloat(row.units_delivered) || 0),
                        totalValue: Math.round(parseFloat(row.total_po_value) || 0),
                        remainingValue: Math.round(parseFloat(row.remaining_po_value) || 0),
                        fulfilledQty: Math.round(parseFloat(row.fullfilled_quantity) || 0),
                        fulfilledValue: Math.round(parseFloat(row.fullfilled_po_value) || 0),
                        fillRate: parseFloat(fillRate.toFixed(1)),
                        fillRateStr: row.fill_rate_str,
                        frontInventory: Math.round(parseFloat(row.front_inventory) || 0),
                        backInventory: Math.round(parseFloat(row.back_inventory) || 0),
                        doi: parseFloat(row.DIH) || 0,
                        drr: parseFloat(row.DRR) || 0,
                        qtySold: parseFloat(row.qty_sold) || 0,
                        deliveryTime: parseInt(row.delivery_time) || 0,
                        imageUrl: row.image_url || null,
                        osa: parseFloat(row.deno_osa) > 0
                            ? parseFloat((parseFloat(row.neno_osa) / parseFloat(row.deno_osa) * 100).toFixed(1))
                            : null,
                        listingPercent: parseFloat(row.listing_percent) || 0
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
                        DATE as date,
                        sum(ifNull(Qty_Sold, 0)) as offtake,
                        avg(ifNull(Selling_Price, 0)) as avg_price,
                        avg(ifNull(Discount, 0)) as avg_discount,
                        sum(ifNull(neno_osa, 0)) as total_neno_osa,
                        sum(ifNull(deno_osa, 0)) as total_deno_osa,
                        sum(ifNull(Inventory, 0)) as total_inventory
                    FROM rb_pdp_olap
                    WHERE Web_Pid = '${webPid}'
                    GROUP BY DATE
                    ORDER BY DATE ASC
                `;

                const rows = await queryClickHouse(query);
                console.log(`[SupplyChain] Got ${rows.length} trend data points for webPid: ${webPid}`);

                if (rows.length === 0) {
                    return { dates: [], kpis: { osa: [], offtake: [], drr: [], price: [], promo: [], doi: [] } };
                }

                // Compute daily values first
                const offtakeValues = rows.map(r => parseFloat(r.offtake) || 0);
                const dailyPoints = rows.map((row, idx) => {
                    const nenoOsa = parseFloat(row.total_neno_osa) || 0;
                    const denoOsa = parseFloat(row.total_deno_osa) || 0;
                    const osaVal = denoOsa > 0 ? (nenoOsa / denoOsa * 100) : null;
                    const dailyOfftake = parseFloat(row.offtake) || 0;

                    // DRR: rolling 30-day average of offtake
                    const windowStart = Math.max(0, idx - 29);
                    const windowSlice = offtakeValues.slice(windowStart, idx + 1);
                    const rollingSum = windowSlice.reduce((a, b) => a + b, 0);
                    const rollingDrr = rollingSum / 30;

                    const priceVal = parseFloat(row.avg_price || 0);
                    const discountVal = parseFloat(row.avg_discount || 0);
                    const inv = parseFloat(row.total_inventory) || 0;
                    const doiVal = rollingDrr > 0 ? (inv / rollingDrr) : null;

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
                    pts.forEach(p => {
                        sumNeno += p.nenoOsa;
                        sumDeno += p.denoOsa;
                    });
                    osa.push(sumDeno > 0 ? parseFloat((sumNeno / sumDeno * 100).toFixed(1)) : null);

                    // Offtake: total sum over the period
                    const sumOfftake = pts.reduce((sum, p) => sum + p.offtakeVal, 0);
                    offtake.push(Math.round(sumOfftake));

                    // DRR: average of daily DRR values in this period
                    const avgDrr = pts.reduce((sum, p) => sum + p.drrVal, 0) / pts.length;
                    drr.push(parseFloat(avgDrr.toFixed(1)));

                    // Price: average of daily prices in this period
                    const avgPrice = pts.reduce((sum, p) => sum + p.priceVal, 0) / pts.length;
                    price.push(parseFloat(avgPrice.toFixed(1)));

                    // Promo %: average of daily discounts in this period
                    const avgPromo = pts.reduce((sum, p) => sum + p.discountVal, 0) / pts.length;
                    promo.push(parseFloat(avgPromo.toFixed(1)));

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
