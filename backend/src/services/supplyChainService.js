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
 * Build WHERE clause fragments for Surplus Inventory filtering
 */
function buildSurplusWhereClause(filters = {}) {
    const conditions = ['sku_name IS NOT NULL'];

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
    if (filters.search) {
        const searchTerm = filters.search.trim().toLowerCase();
        conditions.push(`(lower(sku_name) LIKE '%${searchTerm}%' OR lower(facility_name) LIKE '%${searchTerm}%')`);
    }
    if (filters.startDate) {
        const d = new Date(filters.startDate);
        if (!isNaN(d.getTime())) {
            const formatted = d.toISOString().split('T')[0];
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

function buildPOV2WhereClause(filters = {}) {
    const conditions = ['v2.po_number IS NOT NULL'];

    if (filters.platform && filters.platform !== 'All') {
        const platforms = filters.platform.split(',').map(p => `'${p.trim().toLowerCase()}'`).join(',');
        conditions.push(`lower(v2.platform) IN (${platforms})`);
    }

    const resolvedBrandExpr = `coalesce(nullIf(joinGet('mars._j_sap_to_attrs', 'brand', coalesce(nullIf(joinGet('mars._j_article_to_sap', 'sap_sku', lower(v2.platform) || ':' || lower(v2.sku_code)), ''), nullIf(joinGet('mars._j_ean_to_dcom', 'sku', v2.ean), ''), nullIf(v2.sap_sku_code, ''))), ''), nullIf(coalesce(nullIf(v2.brand,''), pdp.brand_pdp), ''), '')`;
    if (filters.brand && filters.brand !== 'All') {
        const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
        conditions.push(`lower(${resolvedBrandExpr}) IN (${brands})`);
    }

    if (filters.category && filters.category !== 'All') {
        const resolvedSapSkuExpr = `coalesce(nullIf(joinGet('mars._j_article_to_sap', 'sap_sku', lower(v2.platform) || ':' || lower(v2.sku_code)), ''), nullIf(joinGet('mars._j_ean_to_dcom', 'sku', v2.ean), ''), nullIf(v2.sap_sku_code, ''))`;
        const resolvedCategoryExpr = `lower(joinGet('mars._j_sap_to_attrs', 'category', ${resolvedSapSkuExpr}))`;
        const categories = filters.category.split(',').map(c => `'${c.trim().toLowerCase()}'`).join(',');
        conditions.push(`${resolvedCategoryExpr} IN (${categories})`);
    }

    const derivedCityExpr = `if(v2.city != '', v2.city, joinGet('mars._j_feeder_city', 'city', lower(v2.platform) || ':' || lower(trim(v2.facility_name))))`;
    if (filters.city && filters.city !== 'All') {
        const cities = filters.city.split(',').map(c => `'${c.trim().toLowerCase()}'`).join(',');
        conditions.push(`lower(${derivedCityExpr}) IN (${cities})`);
    }

    if (filters.status && filters.status !== 'All') {
        const statuses = filters.status.split(',').map(s => `'${s.trim().toLowerCase()}'`).join(',');
        conditions.push(`lower(v2.po_status) IN (${statuses})`);
    } else {
        conditions.push(`lower(v2.po_status) NOT IN ('completed', 'fulfilled', 'expired', 'cancelled', 'rejected', 'cancelled post creation', 'grn_done')`);
    }

    if (filters.search) {
        const searchTerm = filters.search.trim().toLowerCase();
        conditions.push(`(lower(v2.po_number) LIKE '%${searchTerm}%' OR lower(v2.facility_name) LIKE '%${searchTerm}%' OR lower(v2.sku_description) LIKE '%${searchTerm}%')`);
    }

    if (filters.startDate) {
        const d = new Date(filters.startDate);
        if (!isNaN(d.getTime())) {
            const formatted = d.toISOString().split('T')[0];
            conditions.push(`toDate(v2.po_raised_date) >= toDate('${formatted}')`);
        }
    }
    if (filters.endDate) {
        const d = new Date(filters.endDate);
        if (!isNaN(d.getTime())) {
            const formatted = d.toISOString().split('T')[0];
            conditions.push(`toDate(v2.po_raised_date) <= toDate('${formatted}')`);
        }
    }

    const petcareExclusion = `lower(coalesce(nullIf(v2.brand,''), pdp.brand_pdp)) NOT IN ('whiskas','pedigree','sheba','temptations','chappi','catsan')`;
    conditions.push(petcareExclusion);

    return conditions.join(' AND ');
}

const SUPPLY_ACTION_CTES_V2 = (maxDateChain, maxDateSoh) => `
WITH
  pdp AS (
    SELECT
      lower(Platform) AS plat,
      coalesce(nullIf(joinGet('mars._j_city_alias', 'canonical_city', lower(toString(Location))), ''),
               lower(toString(Location))) AS city,
      if(lower(Platform)='zepto', Web_Pid, Item_Id) AS sku_key,
      argMax(Brand, DATE) AS brand_pdp,
      argMax(image_url, DATE) AS image_url,
      if(sum(deno_osa) > 0, 100.0 * sum(neno_osa) / sum(deno_osa), NULL) AS osa_pct,
      sum(neno_osa) AS neno,
      sum(deno_osa) AS deno,
      argMax(PPU, if(PPU > 0, DATE, toDate('1970-01-01'))) AS ppu,
      argMax(toFloat64OrNull(listing_percent), DATE) AS listing_pct,
      count() AS pdp_obs
    FROM mars.rb_pdp_olap
    WHERE DATE >= today() - 7
    GROUP BY plat, city, sku_key
  ),
  chain AS (
    SELECT platform AS plat,
           lower(city)                                              AS key,
           sap_sku_code                                             AS sap_sku,
           drr_ea,
           drr_sustained,
           chain_fe, chain_be, chain_total,
           chain_total / nullIf(drr_sustained, 0)                   AS dih,
           chain_total / nullIf(drr_sustained, 0)                   AS doi,
           qty_sold_l30d, days_with_sales
    FROM mars.po_chain_kpi_daily
    WHERE snapshot_date = '${maxDateChain}'

    UNION ALL

    SELECT f.platform                                               AS plat,
           lower(f.facility_name)                                   AS key,
           c.sap_sku_code                                           AS sap_sku,
           sum(c.drr_ea)                                            AS drr_ea,
           sum(c.drr_sustained)                                     AS drr_sustained,
           sum(c.chain_fe)                                          AS chain_fe,
           sum(c.chain_be)                                          AS chain_be,
           sum(c.chain_total)                                       AS chain_total,
           sum(c.chain_total) / nullIf(sum(c.drr_sustained), 0)     AS dih,
           sum(c.chain_total) / nullIf(sum(c.drr_sustained), 0)     AS doi,
           sum(c.qty_sold_l30d)                                     AS qty_sold_l30d,
           max(c.days_with_sales)                                   AS days_with_sales
    FROM mars.po_feeder_serving_area f
    INNER JOIN mars.po_chain_kpi_daily c
      ON c.platform = f.platform
      AND lower(c.city) = lower(f.served_city)
      AND c.snapshot_date = '${maxDateChain}'
    WHERE f.served_city != ''
    GROUP BY f.platform, lower(f.facility_name), c.sap_sku_code
  ),
  sku_cs AS (
    SELECT sku_code, argMax(case_size, valid_from) AS cs
    FROM mars.po_sku_attributes
    WHERE case_size > 0
    GROUP BY sku_code
  ),
  cfa_soh AS (
    SELECT
      lower(p.cfa_name) AS city_match,
      replaceRegexpOne(soh.material_code, '[.]0+$', '') AS sap_sku,
      if(any(sku_cs.cs) > 0, sum(toFloat64(soh.unrestricted)) * any(sku_cs.cs), NULL) AS eaches,
      sum(toFloat64(soh.unrestricted)) AS soh_cases
    FROM mars.po_stock_on_hand_v2 soh
    INNER JOIN mars.po_v_sap_plant_master_v2 p
      ON p.plant = soh.plant AND p.storage_type = 'CFA'
    LEFT JOIN sku_cs
      ON sku_cs.sku_code = replaceRegexpOne(soh.material_code, '[.]0+$', '')
    WHERE soh.saleable_stock = 'Normal sale' AND soh.unrestricted > 0
      AND soh.snapshot_date = '${maxDateSoh}'
    GROUP BY city_match, sap_sku
  ),
  lt_master AS (
    SELECT lower(platform) AS plat, argMax(lead_time_days, valid_from) AS lt_days
    FROM mars.po_lead_time_master
    WHERE platform NOT LIKE 'test-%'
    GROUP BY plat
  ),
  recon_enr AS (
    SELECT po_number AS r_po, platform_sku_id AS r_sku,
           max(toFloat64(confirmed_qty)) AS r_confirmed,
           max(toFloat64(confirmed_qty)) AS r_picked, -- FALLBACK since picked_qty doesn't exist
           max(toFloat64(billed_qty))    AS r_billed,
           max(toFloat64(received_qty))  AS r_grn,
           max(toFloat64(order_qty))     AS r_order,
           max(toFloat64(cfa_stock))     AS r_cfa_stock,
           any(reject_bucket)            AS r_reject_bucket,
           any(reject_reason)            AS r_reject_reason
    FROM mars.rb_recon_wf
    WHERE po_raised_date >= today() - 90
    GROUP BY po_number, platform_sku_id
  )
`;



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
        console.log('[SupplyChain] getPrioritizePOData called with filters (forcing v2):', filters);
        return await this.getPrioritizePODataV2(filters);
    },

    async getPrioritizePODataV2(filters = {}) {
        console.log('[SupplyChain] getPrioritizePODataV2 called with filters:', filters);
        const cacheKey = generateCacheKey('supply_chain_prioritize_po_v2_res', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const conditions = [];

                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(v2.platform) IN (${platforms})`);
                } else {
                    conditions.push(`lower(v2.platform) IN ('blinkit','instamart','zepto')`);
                }

                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(v2.brand) IN (${brands})`);
                } else {
                    conditions.push(`lower(v2.brand) NOT IN ('whiskas','pedigree','sheba','temptations','chappi','catsan')`);
                }

                if (filters.status && filters.status !== 'All') {
                    const statuses = filters.status.split(',').map(s => `'${s.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(v2.po_status) IN (${statuses})`);
                } else {
                    conditions.push(`lower(v2.po_status) IN ('scheduled','partially scheduled','rescheduled','created','pending_acknowledgement','confirmed')`);
                }

                if (filters.startDate) {
                    const d = new Date(filters.startDate);
                    // Add 5.5 hours for IST so it doesn't fall back to previous day
                    d.setHours(d.getHours() + 5);
                    d.setMinutes(d.getMinutes() + 30);
                    const startStr = d.toISOString().split('T')[0];
                    conditions.push(`toDate(v2.po_raised_date) >= toDate('${startStr}')`);
                } else {
                    conditions.push(`v2.po_raised_date = '2026-05-23'`);
                }

                if (filters.endDate) {
                    const d = new Date(filters.endDate);
                    d.setHours(d.getHours() + 5);
                    d.setMinutes(d.getMinutes() + 30);
                    const endStr = d.toISOString().split('T')[0];
                    conditions.push(`toDate(v2.po_raised_date) <= toDate('${endStr}')`);
                }

                if (filters.city && filters.city !== 'All') {
                    const cities = filters.city.split(',').map(c => `'${c.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(v2.city) IN (${cities})`);
                }

                if (filters.search) {
                    const term = filters.search.trim().toLowerCase();
                    conditions.push(`(lower(v2.po_number) LIKE '%${term}%' OR lower(v2.facility_name) LIKE '%${term}%')`);
                }

                const whereClause = conditions.join(' AND ');

                const query = `
SELECT
  v2.po_number AS po_number,
  any(v2.facility_name) AS wh,
  any(v2.po_status) AS status,
  sum(toFloat64(v2.line_value_with_tax)) / 100000 AS val,
  max(v2.po_raised_date) AS raised,
  max(v2.po_expiry_date) AS exp,
  round(avg(toFloat64(c.chain_total) / nullIf(toFloat64(c.drr_ea), 0)), 1) AS doi,
  any(l.lt) AS lt,
  100.0 * sum(toFloat64(v2.units_received)) / nullIf(sum(toFloat64(v2.units_ordered)), 0) AS fill,
  sum(least(toFloat64(v2.line_value_with_tax), if(c.chain_total IS NULL OR toFloat64(c.drr_ea) <= 0, 0, greatest(0, coalesce(toFloat64(l.lt), 4.0) - toFloat64(c.chain_total) / toFloat64(c.drr_ea)) * toFloat64(c.drr_ea) * coalesce(nullIf(toFloat64(v2.unit_cost_landed), 0), 0)))) / 100000 AS psl,
  if(psl / nullIf(val, 0) >= 0.30 OR (exp - today() <= 2 AND fill < 100), 'CRITICAL', if(psl / nullIf(val, 0) >= 0.10 OR (exp - today() <= 5), 'HIGH', if(psl / nullIf(val, 0) > 0.02 OR fill < 50, 'MEDIUM', 'LOW'))) AS priority,
  if(lower(any(v2.platform)) IN ('zepto','instamart'), NULL, toString(max(v2.appointment_date))) AS apptDate,
  sum(c.drr_ea) AS consumptionPerDay,
  count(distinct v2.sku_code) AS skuCount,
  any(v2.platform) AS platform,
  any(v2.brand) AS brand
FROM mars.rb_po_olap_v2_latest v2
LEFT JOIN (
  SELECT platform plat, city, sap_sku_code s, drr_ea, chain_total FROM mars.po_chain_kpi_daily WHERE snapshot_date = (SELECT max(snapshot_date) FROM mars.po_chain_kpi_daily)
) c ON c.plat = v2.platform AND c.s = v2.sap_sku_code AND c.city = coalesce(nullIf(joinGet('mars._j_city_alias', 'canonical_city', lower(v2.city)), ''), lower(v2.city))
LEFT JOIN (
  SELECT lower(platform) plat, argMax(lead_time_days, valid_from) lt FROM mars.po_lead_time_master WHERE platform NOT LIKE 'test-%' GROUP BY plat
) l ON l.plat = v2.platform
WHERE ${whereClause}
GROUP BY po_number
ORDER BY psl DESC
LIMIT 1000
`;

                const rows = await queryClickHouse(query);
                const poStatusMap = {
                    'grn_done': 'Fulfilled',
                    'completed': 'Fulfilled',
                    'fulfilled': 'Fulfilled',
                    'expired': 'Expired',
                    'rejected': 'Rejected',
                    'cancelled': 'Cancelled',
                    'cancelled post creation': 'Cancelled',
                    'scheduled': 'Scheduled',
                    'partially scheduled': 'Partially Scheduled',
                    'rescheduled': 'Scheduled',
                    'created': 'Created',
                    'pending_acknowledgement': 'Created',
                    'confirmed': 'Confirmed',
                    'unscheduled': 'Unscheduled',
                    'asn_created': 'Scheduled'
                };

                const data = rows.map(row => {
                    const orderVal = row.val ? parseFloat(row.val) * 100000 : 0;
                    const fillPct = row.fill !== null ? parseFloat(row.fill) : 0;
                    const billedVal = orderVal * (fillPct / 100.0);
                    const psl = row.psl ? parseFloat(row.psl) * 100000 : 0;
                    const avgPoDOI = row.doi !== null ? parseFloat(row.doi) : null;
                    const lt = row.lt !== null ? parseInt(row.lt) : 4;

                    return {
                        poNumber: row.po_number,
                        priority: titleCase(row.priority || 'Low'),
                        projectedSalesAtRisk: Math.round(psl),
                        platformWarehouse: `${titleCase(row.platform || '')} - ${titleCase(row.wh || '')}`,
                        platform: row.platform,
                        facilityName: row.wh,
                        status: titleCase(poStatusMap[row.status?.toLowerCase()] || row.status || ''),
                        rawStatus: row.status,
                        orderValue: Math.round(orderVal),
                        billedValue: Math.round(billedVal),
                        raisedOn: formatDate(row.raised),
                        apptDate: formatDate(row.apptDate),
                        expiry: formatDate(row.exp),
                        avgDoi: avgPoDOI !== null ? Math.round(avgPoDOI) : null,
                        lt,
                        fillRate: row.fill !== null ? parseFloat(parseFloat(row.fill).toFixed(1)) : null,
                        confirmFill: row.fill !== null ? parseFloat(parseFloat(row.fill).toFixed(1)) : null,
                        pickFill: row.fill !== null ? parseFloat(parseFloat(row.fill).toFixed(1)) : null,
                        billFill: row.fill !== null ? parseFloat(parseFloat(row.fill).toFixed(1)) : null,
                        grnFill: row.fill !== null ? parseFloat(parseFloat(row.fill).toFixed(1)) : null,
                        consumptionPerDay: row.consumptionPerDay !== null ? Math.round(parseFloat(row.consumptionPerDay)) : null,
                        skuCount: parseInt(row.skuCount) || 0,
                        brand: titleCase(row.brand || ''),
                        version: 'v2'
                    };
                });

                const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
                data.sort((a, b) => {
                    const pDiff = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
                    if (pDiff !== 0) return pDiff;
                    return b.projectedSalesAtRisk - a.projectedSalesAtRisk;
                });

                const totalSalesAtRisk = data.reduce((sum, d) => sum + d.projectedSalesAtRisk, 0);
                const avgFillRate = data.length > 0
                    ? data.reduce((sum, d) => sum + (d.fillRate || 0), 0) / data.length
                    : 0;
                const criticalPriorityCount = data.filter(d => d.priority === 'Critical').length;
                const highPriorityCount = data.filter(d => d.priority === 'High').length;
                const mediumPriorityCount = data.filter(d => d.priority === 'Medium').length;

                return {
                    data,
                    totalCount: data.length,
                    summary: {
                        totalPOs: data.length,
                        totalSalesAtRisk: Math.round(totalSalesAtRisk),
                        avgFillRate: parseFloat(avgFillRate.toFixed(1)),
                        criticalPriority: criticalPriorityCount,
                        highPriority: highPriorityCount,
                        mediumPriority: mediumPriorityCount,
                        lowPriority: data.length - criticalPriorityCount - highPriorityCount - mediumPriorityCount
                    }
                };
            } catch (error) {
                console.error('[SupplyChain] Error in getPrioritizePODataV2:', error);
                throw error;
            }
        }, CACHE_TTL.SHORT);
    },

    async getPODetailDataV2(poNumber, facilityName, filters = {}) {
        console.log(`[SupplyChain] getPODetailDataV2 called for PO: ${poNumber}, facility: ${facilityName}`);
        const cacheKey = generateCacheKey('supply_chain_po_detail_v2_res_key', { poNumber, facilityName, ...filters });

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const chainDateRes = await queryClickHouse("SELECT formatDateTime(max(snapshot_date), '%Y-%m-%d') AS md FROM mars.po_chain_kpi_daily");
                const maxDateChain = chainDateRes[0]?.md || '2026-06-02';

                const sohDateRes = await queryClickHouse("SELECT formatDateTime(max(snapshot_date), '%Y-%m-%d') AS md FROM mars.po_stock_on_hand_v2");
                const maxDateSoh = sohDateRes[0]?.md || '2026-06-02';

                const ctes = SUPPLY_ACTION_CTES_V2(maxDateChain, maxDateSoh);

                const query = `${ctes}
SELECT
  v2.po_number AS poNo,
  v2.platform AS platform,
  v2.facility_name AS warehouse,
  any(v2.po_status) AS dbStatus,
  toString(max(v2.po_raised_date)) AS poDate,
  toString(max(v2.po_expiry_date)) AS expiryDate,
  if(lower(v2.platform) IN ('zepto','instamart'), NULL, toString(max(v2.appointment_date))) AS appointmentDate,
  any(coalesce(nullIf(joinGet('mars._j_sap_to_attrs', 'brand', coalesce(nullIf(joinGet('mars._j_article_to_sap', 'sap_sku', lower(v2.platform) || ':' || lower(v2.sku_code)), ''), nullIf(joinGet('mars._j_ean_to_dcom', 'sku', v2.ean), ''), nullIf(v2.sap_sku_code, ''))), ''), nullIf(coalesce(nullIf(v2.brand,''), pdp.brand_pdp), ''), '')) AS brandWarehouse,
  groupArray(tuple(
    v2.sku_code,
    v2.sku_description,
    coalesce(nullIf(joinGet('mars._j_sap_to_attrs', 'brand', coalesce(nullIf(joinGet('mars._j_article_to_sap', 'sap_sku', lower(v2.platform) || ':' || lower(v2.sku_code)), ''), nullIf(joinGet('mars._j_ean_to_dcom', 'sku', v2.ean), ''), nullIf(v2.sap_sku_code, ''))), ''), nullIf(coalesce(nullIf(v2.brand,''), pdp.brand_pdp), ''), ''),
    v2.units_ordered,
    v2.units_received,
    v2.line_value_with_tax / 100000,
    if(v2.po_status IN ('completed','fulfilled'),
       v2.line_value_with_tax, v2.line_value_with_tax * v2.units_received / nullIf(v2.units_ordered, 0)) / 100000,
    toFloat64(chain.chain_total) / nullIf(toFloat64(chain.drr_sustained), 0),
    pdp.neno,
    pdp.deno,
    coalesce(nullIf(toFloat64(v2.unit_cost_landed), 0), toFloat64(pdp.ppu), 0),
    toString(v2.po_raised_date),
    toString(v2.appointment_date),
    toString(v2.po_expiry_date),
    v2.po_status,
    pdp.image_url,
    chain.drr_sustained,
    100.0 * v2.units_received / nullIf(v2.units_ordered, 0),
    chain.qty_sold_l30d,
    chain.dih,
    chain.chain_fe,
    chain.chain_be,
    chain.chain_total,
    cfa_soh.eaches,
    coalesce(toFloat64(lt_master.lt_days), 4.0),
    chain.drr_ea,
    coalesce(recon_enr.r_confirmed, 0),
    coalesce(recon_enr.r_billed, 0),
    coalesce(recon_enr.r_grn, toFloat64(v2.units_received)),
    coalesce(recon_enr.r_reject_bucket, ''),
    coalesce(recon_enr.r_reject_reason, ''),
    coalesce(recon_enr.r_picked, 0),
    coalesce(recon_enr.r_cfa_stock, 0)
  )) AS items
FROM mars.rb_po_olap_v2_latest v2
LEFT JOIN pdp   ON pdp.plat   = v2.platform AND pdp.sku_key   = v2.sku_code      AND pdp.city   = coalesce(nullIf(joinGet('mars._j_city_alias', 'canonical_city', lower(if(v2.city != '', v2.city, joinGet('mars._j_feeder_city', 'city', lower(v2.platform) || ':' || lower(trim(v2.facility_name)))))), ''), lower(if(v2.city != '', v2.city, joinGet('mars._j_feeder_city', 'city', lower(v2.platform) || ':' || lower(trim(v2.facility_name))))))
LEFT JOIN chain ON chain.plat = v2.platform AND chain.sap_sku = coalesce(nullIf(joinGet('mars._j_article_to_sap', 'sap_sku', lower(v2.platform) || ':' || lower(v2.sku_code)), ''), nullIf(joinGet('mars._j_ean_to_dcom', 'sku', v2.ean), ''), nullIf(v2.sap_sku_code, ''))  AND chain.key = coalesce(nullIf(coalesce(nullIf(joinGet('mars._j_city_alias', 'canonical_city', lower(if(v2.city != '', v2.city, joinGet('mars._j_feeder_city', 'city', lower(v2.platform) || ':' || lower(trim(v2.facility_name)))))), ''), lower(if(v2.city != '', v2.city, joinGet('mars._j_feeder_city', 'city', lower(v2.platform) || ':' || lower(trim(v2.facility_name)))))), ''), lower(v2.facility_name))
LEFT JOIN cfa_soh ON coalesce(nullIf(joinGet('mars._j_feeder_cfa','cfa', lower(trim(v2.facility_name))), ''), nullIf(joinGet('mars._j_facility_to_cfa','cfa_name', lower(v2.facility_name)), ''), nullIf(joinGet('mars._j_city_active_cfa','cfa_name', lower(v2.city)), '')) = cfa_soh.city_match AND coalesce(nullIf(joinGet('mars._j_article_to_sap', 'sap_sku', lower(v2.platform) || ':' || lower(v2.sku_code)), ''), nullIf(joinGet('mars._j_ean_to_dcom', 'sku', v2.ean), ''), nullIf(v2.sap_sku_code, '')) = cfa_soh.sap_sku
LEFT JOIN lt_master ON lt_master.plat = v2.platform
LEFT JOIN recon_enr ON recon_enr.r_po = v2.po_number AND recon_enr.r_sku = v2.sku_code
WHERE lower(v2.po_number) = lower('${poNumber}')
${facilityName && facilityName !== 'null' && facilityName !== 'undefined' ? `AND lower(v2.facility_name) = lower('${facilityName}')` : ''}
GROUP BY v2.po_number, v2.platform, v2.facility_name
`;

                const rows = await queryClickHouse(query);
                if (rows.length === 0) {
                    return { poInfo: null, skus: [] };
                }

                const first = rows[0];
                const poInfo = {
                    poNumber: first.poNo,
                    platform: titleCase(first.platform || ''),
                    facilityName: titleCase(first.warehouse || ''),
                    platformWarehouse: `${titleCase(first.platform || '')} - ${titleCase(first.warehouse || '')}`,
                    city: '',
                    distributor: '',
                    raisedOn: formatDate(first.poDate),
                    apptDate: formatDate(first.appointmentDate),
                    expiry: formatDate(first.expiryDate),
                    status: titleCase(first.dbStatus || ''),
                    brand: titleCase(first.brandWarehouse || ''),
                    category: ''
                };

                const skus = first.items.map(it => {
                    const orderQty = parseFloat(it[3]) || 0;
                    const receivedQty = parseFloat(it[4]) || 0;
                    const fillRate = orderQty > 0 ? (receivedQty / orderQty) * 100 : null;

                    const confirmedQtyR = parseFloat(it[26]) || 0;
                    const billedQtyR = parseFloat(it[27]) || 0;
                    const grnQtyR = parseFloat(it[28]) || 0;
                    const pickedQtyR = parseFloat(it[31]) || 0;

                    const confirmPct = orderQty > 0 ? Math.round(100 * confirmedQtyR / orderQty) : null;
                    const pickPct    = orderQty > 0 ? Math.round(100 * pickedQtyR / orderQty) : null;
                    const billPct    = orderQty > 0 ? Math.round(100 * billedQtyR / orderQty) : null;
                    const grnPct     = orderQty > 0 ? Math.round(100 * grnQtyR / orderQty) : null;

                    const currentDoi = it[7] !== null && it[7] !== '' ? parseFloat(it[7]) : 0;
                    const drrBurst = it[25] !== null && it[25] !== '' ? parseFloat(it[25]) : 0;
                    const skuLt = parseFloat(it[24]) || 4.0;
                    const cost = parseFloat(it[10]) || 0;
                    const gapDays = Math.max(0, skuLt - currentDoi);
                    const pslEaches = gapDays * drrBurst;
                    const rawItemPsl = (pslEaches * cost) / 100000;
                    const itemPsl = Math.min(it[5] !== null ? parseFloat(it[5]) : 0, rawItemPsl);

                    return {
                        skuName: it[1],
                        brand: titleCase(it[2] || ''),
                        category: '',
                        itemId: it[0],
                        webPid: it[0],
                        costPerUnit: cost,
                        unitsOrdered: Math.round(orderQty),
                        unitsRemaining: Math.round(orderQty - receivedQty),
                        unitsDelivered: Math.round(receivedQty),
                        totalValue: Math.round(parseFloat(it[5]) * 100000),
                        remainingValue: Math.round((parseFloat(it[5]) - parseFloat(it[6])) * 100000),
                        fulfilledQty: Math.round(receivedQty),
                        fulfilledValue: Math.round(parseFloat(it[6]) * 100000),
                        fillRate: fillRate !== null ? parseFloat(fillRate.toFixed(1)) : null,
                        fillRateStr: fillRate !== null ? `${fillRate.toFixed(1)}%` : null,
                        frontInventory: it[20] !== null && it[20] !== '' ? Math.round(parseFloat(it[20])) : null,
                        backInventory: it[21] !== null && it[21] !== '' ? Math.round(parseFloat(it[21])) : null,
                        doi: it[7] !== null && it[7] !== '' ? parseFloat(parseFloat(it[7]).toFixed(1)) : null,
                        drr: it[16] !== null && it[16] !== '' ? parseFloat(parseFloat(it[16]).toFixed(1)) : null,
                        qtySold: it[18] !== null && it[18] !== '' ? parseFloat(it[18]) : null,
                        deliveryTime: Math.round(skuLt),
                        imageUrl: it[15] || null,
                        osa: it[9] > 0 ? parseFloat(((parseFloat(it[8]) / parseFloat(it[9])) * 100).toFixed(1)) : null,
                        listingPercent: null,
                        confirmedQty: confirmedQtyR,
                        pickedQty: pickedQtyR,
                        grnQty: grnQtyR,
                        confirmPct,
                        pickPct,
                        billPct,
                        grnPct,
                        rejectBucket: it[29] || '',
                        rejectReason: it[30] || '',
                        psl: Math.round(itemPsl * 100000)
                    };
                });

                return { poInfo, skus };
            } catch (error) {
                console.error(`[SupplyChain] Error in getPODetailDataV2 for ${poNumber}:`, error);
                throw error;
            }
        });
    },

    /**
     * Get PO Detail Data — SKU-level rows for a specific PO (for the "Know More" modal)
     * 
     * @param {string} poNumber — PO number to drill down into
     * @returns {Object} { poInfo, skus: [...] }
     */
    async getPODetailData(poNumber, facilityName, filters = {}) {
        console.log(`[SupplyChain] getPODetailData called for PO: ${poNumber}, facility: ${facilityName}, filters (forcing v2):`, filters);
        if (!poNumber) {
            throw new Error('poNumber is required');
        }
        return await this.getPODetailDataV2(poNumber, facilityName, filters);
    },

    /**
     * Get PO Filter Options — distinct values for filter dropdowns
     * 
     * @returns {Object} { platforms, brands, categories, cities, statuses }
     */
    async getPOFilterOptions() {
        console.log('[SupplyChain] getPOFilterOptions called');
        const cacheKey = generateCacheKey('supply_chain_po_filters_combined_v2', {});

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const [platformsV2, brandsV2, citiesV2, statusesV2, categoriesV2] = await Promise.all([
                    queryClickHouse(`SELECT DISTINCT platform FROM mars.rb_po_olap_v2_latest WHERE platform IS NOT NULL AND platform != ''`),
                    queryClickHouse(`SELECT DISTINCT brand FROM mars.rb_po_olap_v2_latest WHERE brand IS NOT NULL AND brand != ''`),
                    queryClickHouse(`SELECT DISTINCT city FROM mars.rb_po_olap_v2_latest WHERE city IS NOT NULL AND city != ''`),
                    queryClickHouse(`SELECT DISTINCT po_status FROM mars.rb_po_olap_v2_latest WHERE po_status IS NOT NULL AND po_status != ''`),
                    queryClickHouse(`SELECT DISTINCT Category FROM mars.rb_pdp_olap WHERE Category IS NOT NULL AND Category != '' AND DATE >= today() - 30`)
                ]);

                const platforms = Array.from(new Set([
                    ...platformsV2.map(r => titleCase(r.platform))
                ])).sort();

                const brands = Array.from(new Set([
                    ...brandsV2.map(r => titleCase(r.brand))
                ])).sort();

                const categories = Array.from(new Set([
                    ...categoriesV2.map(r => titleCase(r.Category))
                ])).sort();

                const cities = Array.from(new Set([
                    ...citiesV2.map(r => titleCase(r.city))
                ])).sort();

                const statuses = Array.from(new Set([
                    ...statusesV2.map(r => titleCase(r.po_status))
                ])).sort();

                return { platforms, brands, categories, cities, statuses };

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
    },

    /**
     * Get Stock Transfer Data
     * Aggregates rb_po_olap rows by sku_name and facility_name
     * to compute KPIs: City OSA%, DOI(FE/BE), SOH(FE/BE), CPD, PSL Recovery
     *
     * @param {Object} filters — platform, brand, category, city, search, startDate, endDate
     * @returns {Array} Stock transfer items with computed KPIs
     */
    async getStockTransferData(filters = {}) {
        console.log('[SupplyChain] getStockTransferData called with filters (forcing v2):', filters);
        return await this.getStockTransferDataV2(filters);
    },

    async getStockTransferDataV2(filters = {}) {
        console.log('[SupplyChain] getStockTransferDataV2 called with filters:', filters);
        const cacheKey = generateCacheKey('supply_chain_stock_transfer_v2_res_key', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                let brandFilterSql = '';
                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    brandFilterSql = `AND lower(brand) IN (${brands})`;
                } else {
                    brandFilterSql = `AND lower(brand) NOT IN ('whiskas','pedigree','sheba','temptations','chappi','catsan')`;
                }

                let cityFilterSql = '';
                if (filters.city && filters.city !== 'All') {
                    const cities = filters.city.split(',').map(c => `'${c.trim().toLowerCase()}'`).join(',');
                    cityFilterSql = `AND lower(dc.city) IN (${cities})`;
                }

                let days = 30.0;
                let billingDateCondition = `billing_date >= today() - 30`;
                let sohSnapshotDateCondition = `soh.snapshot_date = (SELECT max(snapshot_date) FROM mars.po_stock_on_hand_v2)`;

                if (filters.startDate || filters.endDate) {
                    let start = null;
                    let end = null;

                    if (filters.startDate) {
                        const startStr = new Date(filters.startDate).toISOString().split('T')[0];
                        billingDateCondition = `billing_date >= toDate('${startStr}')`;
                        start = new Date(startStr);
                    } else {
                        start = new Date();
                        start.setDate(start.getDate() - 30);
                    }

                    if (filters.endDate) {
                        const endStr = new Date(filters.endDate).toISOString().split('T')[0];
                        if (filters.startDate) {
                            billingDateCondition += ` AND billing_date <= toDate('${endStr}')`;
                        } else {
                            const startStr = start.toISOString().split('T')[0];
                            billingDateCondition = `billing_date >= toDate('${startStr}') AND billing_date <= toDate('${endStr}')`;
                        }
                        end = new Date(endStr);
                        sohSnapshotDateCondition = `soh.snapshot_date = (SELECT max(snapshot_date) FROM mars.po_stock_on_hand_v2 WHERE snapshot_date <= toDate('${endStr}'))`;
                    } else {
                        end = new Date();
                    }

                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    days = Math.max(1, diffDays);
                }

                const query = `
WITH
  /* City Coordinates Master (from src/lib/india-geo.ts) */
  city_coords AS (
    SELECT 'Mumbai' AS city, 72.877 AS lng, 19.076 AS lat UNION ALL
    SELECT 'Delhi', 77.209, 28.613 UNION ALL
    SELECT 'Bangalore', 77.594, 12.971 UNION ALL
    SELECT 'Kolkata', 88.364, 22.573 UNION ALL
    SELECT 'Chennai', 80.270, 13.083 UNION ALL
    SELECT 'Hyderabad', 78.487, 17.385 UNION ALL
    SELECT 'Pune', 73.856, 18.520 UNION ALL
    SELECT 'Ahmedabad', 72.571, 23.023 UNION ALL
    SELECT 'Jaipur', 75.787, 26.912 UNION ALL
    SELECT 'Lucknow', 80.946, 26.846 UNION ALL
    SELECT 'Chandigarh', 76.779, 30.734 UNION ALL
    SELECT 'Kochi', 76.267, 9.932 UNION ALL
    SELECT 'Indore', 75.858, 22.720 UNION ALL
    SELECT 'Nagpur', 79.088, 21.146 UNION ALL
    SELECT 'Surat', 72.831, 21.170 UNION ALL
    SELECT 'Patna', 85.144, 25.612 UNION ALL
    SELECT 'Bhopal', 77.412, 23.259 UNION ALL
    SELECT 'Coimbatore', 76.956, 11.017 UNION ALL
    SELECT 'Guwahati', 91.731, 26.145 UNION ALL
    SELECT 'Visakhapatnam', 83.218, 17.686 UNION ALL
    SELECT 'Ghaziabad', 77.438, 28.669 UNION ALL
    SELECT 'Noida', 77.391, 28.535 UNION ALL
    SELECT 'Vijayawada', 80.648, 16.506 UNION ALL
    SELECT 'Vadodara', 73.181, 22.307 UNION ALL
    SELECT 'Kanpur', 80.332, 26.450 UNION ALL
    SELECT 'Varanasi', 82.992, 25.318 UNION ALL
    SELECT 'Ludhiana', 75.857, 30.901 UNION ALL
    SELECT 'Agra', 78.008, 27.177 UNION ALL
    SELECT 'Nashik', 73.789, 19.998 UNION ALL
    SELECT 'Ranchi', 85.310, 23.344 UNION ALL
    SELECT 'Bhubaneswar', 85.825, 20.297 UNION ALL
    SELECT 'Dehradun', 78.032, 30.317 UNION ALL
    SELECT 'Raipur', 81.630, 21.250 UNION ALL
    SELECT 'Thiruvananthapuram', 76.936, 8.524 UNION ALL
    SELECT 'Gurugram', 77.027, 28.459 UNION ALL
    SELECT 'Mysore', 76.639, 12.296 UNION ALL
    SELECT 'Mangalore', 74.843, 12.871 UNION ALL
    SELECT 'Rajkot', 70.802, 22.304 UNION ALL
    SELECT 'Madurai', 78.120, 9.925 UNION ALL
    SELECT 'Amritsar', 74.873, 31.634 UNION ALL
    SELECT 'Aurangabad', 75.343, 19.876
  ),
  /* Fuzzy City Matcher mapping CFA names to Coordinates */
  cfa_geo AS (
    SELECT 
      cfa,
      multiIf(
        cfa LIKE '%mumbai%' OR cfa LIKE '%bombay%' OR cfa = 'bom', 'Mumbai',
        cfa LIKE '%delhi%' OR cfa LIKE '%ncr%', 'Delhi',
        cfa LIKE '%bangalore%' OR cfa LIKE '%bengaluru%' OR cfa = 'blr', 'Bangalore',
        cfa LIKE '%kolkata%' OR cfa LIKE '%calcutta%', 'Kolkata',
        cfa LIKE '%chennai%' OR cfa LIKE '%madras%', 'Chennai',
        cfa LIKE '%hyderabad%' OR cfa = 'hyd', 'Hyderabad',
        cfa LIKE '%pune%' OR cfa LIKE '%poona%', 'Pune',
        cfa LIKE '%ahmedabad%', 'Ahmedabad',
        cfa LIKE '%kochi%' OR cfa LIKE '%cochin%', 'Kochi',
        cfa LIKE '%madurai%', 'Madurai',
        cfa LIKE '%vijayawada%' OR cfa = 'vjd', 'Vijayawada',
        cfa LIKE '%jaipur%', 'Jaipur',
        cfa LIKE '%lucknow%', 'Lucknow',
        cfa LIKE '%chandigarh%', 'Chandigarh',
        cfa LIKE '%indore%', 'Indore',
        cfa LIKE '%nagpur%', 'Nagpur',
        cfa LIKE '%surat%', 'Surat',
        cfa LIKE '%patna%', 'Patna',
        cfa LIKE '%bhopal%', 'Bhopal',
        cfa LIKE '%coimbatore%', 'Coimbatore',
        cfa LIKE '%guwahati%', 'Guwahati',
        cfa LIKE '%visakhapatnam%' OR cfa LIKE '%vizag%', 'Visakhapatnam',
        cfa LIKE '%ghaziabad%', 'Ghaziabad',
        cfa LIKE '%noida%', 'Noida',
        cfa LIKE '%vadodara%' OR cfa LIKE '%baroda%', 'Vadodara',
        cfa LIKE '%kanpur%', 'Kanpur',
        cfa LIKE '%varanasi%', 'Varanasi',
        cfa LIKE '%ludhiana%', 'Ludhiana',
        cfa LIKE '%agra%', 'Agra',
        cfa LIKE '%nashik%', 'Nashik',
        cfa LIKE '%ranchi%', 'Ranchi',
        cfa LIKE '%bhubaneswar%', 'Bhubaneswar',
        cfa LIKE '%dehradun%', 'Dehradun',
        cfa LIKE '%raipur%', 'Raipur',
        cfa LIKE '%thiruvananthapuram%' OR cfa LIKE '%trivandrum%', 'Thiruvananthapuram',
        cfa LIKE '%gurugram%' OR cfa LIKE '%gurgaon%', 'Gurugram',
        cfa LIKE '%mysore%' OR cfa LIKE '%mysuru%', 'Mysore',
        cfa LIKE '%mangalore%' OR cfa LIKE '%mangaluru%', 'Mangalore',
        cfa LIKE '%rajkot%', 'Rajkot',
        cfa LIKE '%amritsar%', 'Amritsar',
        cfa LIKE '%aurangabad%', 'Aurangabad',
        ''
      ) AS city
    FROM (
      SELECT DISTINCT lower(cfa_name) AS cfa FROM mars.po_v_primary_billing_latest WHERE cfa_name NOT IN ('', '-')
      UNION DISTINCT
      SELECT DISTINCT lower(p.cfa_name) AS cfa FROM mars.po_stock_on_hand_v2 soh INNER JOIN mars.po_v_sap_plant_master_v2 p ON p.plant = soh.plant WHERE cfa_name NOT IN ('', '-')
    )
  ),
  cfa_coords AS (
    SELECT 
      g.cfa AS cfa,
      g.city AS city,
      c.lat AS lat,
      c.lng AS lng
    FROM cfa_geo g
    INNER JOIN city_coords c ON c.city = g.city
  ),
  /* DRR per CFA per SKU (trailing billing) excluding Petcare */
  drr AS (
    SELECT
      lower(cfa_name) AS cfa,
      replaceRegexpOne(material_code, '[.]0+$', '') AS sap_sku,
      argMax(brand, billing_date) AS brand_drr,
      argMax(parent_sku, billing_date) AS parent_sku_drr,
      argMax(material_description, billing_date) AS sku_name_drr,
      sum(bill_qty_eaches) / ${days.toFixed(1)} AS drr_ea
    FROM mars.po_v_primary_billing_latest
    WHERE ${billingDateCondition} AND bill_qty_eaches > 0 AND cfa_name NOT IN ('', '-')
      ${brandFilterSql}
    GROUP BY cfa, sap_sku
  ),
  /* Current SOH per CFA per SKU (MB52 snapshot matched to end of range) */
  soh AS (
    SELECT
      lower(p.cfa_name) AS cfa,
      replaceRegexpOne(soh.material_code, '[.]0+$', '') AS sap_sku,
      sum(toFloat64(soh.unrestricted)) AS soh_cs
    FROM mars.po_stock_on_hand_v2 soh
    INNER JOIN mars.po_v_sap_plant_master_v2 p ON p.plant = soh.plant
    WHERE soh.saleable_stock = 'Normal sale' AND soh.unrestricted > 0
      AND ${sohSnapshotDateCondition}
    GROUP BY cfa, sap_sku
  ),
  /* Case size and hierarchy configuration */
  attrs AS (
    SELECT sku_code,
      argMax(case_size, valid_from) AS cs,
      argMax(parent_description, valid_from) AS parent_sku
    FROM mars.po_sku_attributes
    WHERE parent_description != '' AND case_size > 0
    GROUP BY sku_code
  ),
  /* Unified state metrics */
  cfa_states AS (
    SELECT
      drr.cfa AS cfa,
      drr.sap_sku AS sap_sku,
      drr.sku_name_drr AS sku_name,
      drr.brand_drr AS brand,
      coalesce(attrs.parent_sku, drr.parent_sku_drr) AS parent_sku,
      coalesce(toFloat64(attrs.cs), 144) AS case_size,
      drr.drr_ea AS drr_ea,
      coalesce(soh.soh_cs, 0) * coalesce(toFloat64(attrs.cs), 144) AS soh_ea,
      (coalesce(soh.soh_cs, 0) * coalesce(toFloat64(attrs.cs), 144)) / nullIf(drr.drr_ea, 0) AS doi
    FROM drr
    LEFT JOIN soh ON drr.cfa = soh.cfa AND drr.sap_sku = soh.sap_sku
    LEFT JOIN attrs ON attrs.sku_code = drr.sap_sku
    WHERE drr.drr_ea > 0
  ),
  deficits AS (
    SELECT * FROM cfa_states WHERE doi < 7 AND drr_ea > 0
  ),
  surpluses AS (
    SELECT * FROM cfa_states WHERE doi > 22 AND soh_ea > 0
  ),
  /* Combine, map distances, and rank */
  ranked_pairs AS (
    SELECT
      d.sap_sku AS sapCode,
      d.sku_name AS skuName,
      d.brand AS brand,
      d.parent_sku AS parentSku,
      d.cfa AS toCfa,
      d.doi AS toDoi,
      d.soh_ea AS toSohEa,
      d.drr_ea AS toDrrEa,
      round(greatest(0, d.drr_ea * 7 - d.soh_ea)) AS needEa,
      s.cfa AS fromCfa,
      s.doi AS fromDoi,
      s.soh_ea AS fromSohEa,
      s.drr_ea AS fromDrrEa,
      round(greatest(0, s.soh_ea - s.drr_ea * 22)) AS fromSurplusEa,
      if(d.cfa = s.cfa, 0, round(greatCircleDistance(dc.lng, dc.lat, sc.lng, sc.lat) / 1000)) AS distanceKm,
      (fromSurplusEa >= needEa) AS safe100Pct,
      least(needEa, fromSurplusEa) AS transferQty,
      row_number() OVER (
        PARTITION BY d.sap_sku, d.cfa 
        ORDER BY if(fromSurplusEa >= needEa, 0, 1) ASC, distanceKm ASC, fromSurplusEa DESC
      ) AS rank
    FROM deficits d
    INNER JOIN surpluses s ON d.sap_sku = s.sap_sku
    INNER JOIN cfa_coords dc ON dc.cfa = d.cfa
    INNER JOIN cfa_coords sc ON sc.cfa = s.cfa
  ),
  best_transfers AS (
    SELECT * EXCEPT(rank)
    FROM ranked_pairs
    WHERE rank = 1 AND transferQty > 0
  )
SELECT * 
FROM best_transfers
WHERE 1=1 ${cityFilterSql}
ORDER BY safe100Pct DESC, distanceKm ASC, transferQty DESC
LIMIT 500
`;

                console.log('[SupplyChain] Executing V2 Stock Transfer query...');
                const rows = await queryClickHouse(query);
                console.log(`[SupplyChain] Got ${rows.length} V2 stock transfer rows from ClickHouse`);

                const data = rows.map((row, index) => {
                    return {
                        id: `ST-${String(index + 1).padStart(3, '0')}`,
                        skuName: row.skuName || '',
                        sapCode: row.sapCode || '',
                        brand: row.brand || '',
                        parentSku: row.parentSku || '',
                        toCfa: titleCase(row.toCfa || ''),
                        fromCfa: titleCase(row.fromCfa || ''),
                        doiFe: row.toDoi !== null ? parseFloat(parseFloat(row.toDoi).toFixed(1)) : null,
                        doiBe: row.fromDoi !== null ? parseFloat(parseFloat(row.fromDoi).toFixed(1)) : null,
                        sohFe: Math.round(row.toSohEa || 0),
                        sohBe: Math.round(row.fromSohEa || 0),
                        cpd: row.toDrrEa !== null ? parseFloat(parseFloat(row.toDrrEa).toFixed(1)) : null,
                        transferQty: Math.round(row.transferQty || 0),
                        distanceKm: row.distanceKm !== null ? Math.round(row.distanceKm) : null,
                        safe100Pct: row.safe100Pct,
                        cityOsa: null
                    };
                });

                return data;
            } catch (error) {
                console.error('[SupplyChain] Error in getStockTransferDataV2:', error.message);
                throw error;
            }
        }, CACHE_TTL.SHORT);
    },

    /**
     * Get Manage Surplus Data
     * Aggregates rb_po_olap rows by sku_name, platform, and facility_name
     */
    async getManageSurplusData(filters = {}) {
        console.log('[SupplyChain] getManageSurplusData called with filters (forcing v2):', filters);
        return await this.getManageSurplusDataV2(filters);
    },

    async getManageSurplusDataV2(filters = {}) {
        console.log('[SupplyChain] getManageSurplusDataV2 called with filters:', filters);
        const cacheKey = generateCacheKey('supply_chain_manage_surplus_v2_res', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                let brandFilterSql = '';
                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    brandFilterSql = `AND lower(brand) IN (${brands})`;
                } else {
                    brandFilterSql = `AND lower(brand) NOT IN ('whiskas','pedigree','sheba','temptations','chappi','catsan')`;
                }

                let cfaClause = '';
                if (filters.city && filters.city !== 'All') {
                    const cities = filters.city.split(',').map(c => `'${c.trim().toLowerCase()}'`).join(',');
                    cfaClause = `AND lower(cfa_name) IN (${cities})`;
                }

                let finalSearchSql = '';
                if (filters.search) {
                    const term = filters.search.trim().toLowerCase();
                    finalSearchSql = `WHERE lower(sku) LIKE '%${term}%'`;
                }

                let days = 30.0;
                let billingDateCondition = `billing_date >= today() - 30`;
                let sohSnapshotDateCondition = `soh.snapshot_date = (SELECT max(snapshot_date) FROM mars.po_stock_on_hand_v2)`;
                let lastBillDateCondition = `billing_date >= today() - 90`;
                let todayReference = `today()`;

                if (filters.startDate || filters.endDate) {
                    let start = null;
                    let end = null;

                    if (filters.startDate) {
                        const startStr = new Date(filters.startDate).toISOString().split('T')[0];
                        billingDateCondition = `billing_date >= toDate('${startStr}')`;
                        start = new Date(startStr);
                    } else {
                        start = new Date();
                        start.setDate(start.getDate() - 30);
                    }

                    if (filters.endDate) {
                        const endStr = new Date(filters.endDate).toISOString().split('T')[0];
                        if (filters.startDate) {
                            billingDateCondition += ` AND billing_date <= toDate('${endStr}')`;
                        } else {
                            const startStr = start.toISOString().split('T')[0];
                            billingDateCondition = `billing_date >= toDate('${startStr}') AND billing_date <= toDate('${endStr}')`;
                        }
                        end = new Date(endStr);
                        sohSnapshotDateCondition = `soh.snapshot_date = (SELECT max(snapshot_date) FROM mars.po_stock_on_hand_v2 WHERE snapshot_date <= toDate('${endStr}'))`;
                        lastBillDateCondition = `billing_date >= toDate('${endStr}') - 90 AND billing_date <= toDate('${endStr}')`;
                        todayReference = `toDate('${endStr}')`;
                    } else {
                        end = new Date();
                    }

                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    days = Math.max(1, diffDays);
                }

                const query = `
WITH drr AS (
  SELECT
    lower(cfa_name) AS cfa,
    replaceRegexpOne(material_code, '[.]0+$', '') AS sap_sku,
    argMax(brand, billing_date) AS brand_drr,
    argMax(parent_sku, billing_date) AS parent_sku_drr,
    argMax(material_description, billing_date) AS sku_name_drr,
    sum(bill_qty_ea) / ${days.toFixed(1)} AS drr_ea,
    sum(net_value) / nullIf(sum(bill_qty_ea), 0) AS unit_price_ea
  FROM mars.po_primary_billing_v2
  WHERE ${billingDateCondition} AND bill_qty_ea > 0 AND cfa_name != ''
    ${brandFilterSql}
    ${cfaClause}
  GROUP BY cfa, sap_sku
),
soh AS (
  SELECT
    lower(p.cfa_name) AS cfa,
    replaceRegexpOne(soh.material_code, '[.]0+$', '') AS sap_sku,
    sum(toFloat64(soh.unrestricted)) AS soh_cs,
    min(soh.batch_expiry) AS nearest_expiry_dt
  FROM mars.po_stock_on_hand_v2 soh
  INNER JOIN mars.po_v_sap_plant_master_v2 p ON p.plant = soh.plant AND p.storage_type = 'CFA'
  WHERE soh.saleable_stock = 'Normal sale' AND soh.unrestricted > 0
    AND ${sohSnapshotDateCondition}
    ${cfaClause}
  GROUP BY cfa, sap_sku
),
last_bill AS (
  SELECT
    lower(cfa_name) AS cfa,
    replaceRegexpOne(material_code, '[.]0+$', '') AS sap_sku,
    max(billing_date) AS last_bill_date
  FROM mars.po_primary_billing_v2
  WHERE ${lastBillDateCondition} AND bill_qty_ea > 0
    ${cfaClause}
  GROUP BY cfa, sap_sku
),
attrs AS (
  SELECT
    sku_code,
    argMax(case_size, valid_from) AS cs,
    argMax(parent_description, valid_from) AS parent_sku
  FROM mars.po_sku_attributes
  WHERE parent_description != '' AND case_size > 0
  GROUP BY sku_code
),
cfa_states AS (
  SELECT
    soh.cfa AS cfa,
    soh.sap_sku AS sap_sku,
    coalesce(drr.sku_name_drr, '') AS sku_name,
    coalesce(drr.brand_drr, '') AS brand,
    coalesce(attrs.parent_sku, drr.parent_sku_drr, '') AS parent_sku,
    coalesce(drr.drr_ea, 0) AS drr_ea,
    coalesce(drr.unit_price_ea, 0) AS price_ea,
    coalesce(soh.soh_cs, 0) * coalesce(toFloat64(attrs.cs), 144) AS soh_ea,
    soh.nearest_expiry_dt AS nearest_expiry_dt,
    if(soh.nearest_expiry_dt IS NOT NULL, dateDiff('day', ${todayReference}, soh.nearest_expiry_dt), 999) AS days_to_expiry,
    if(last_bill.last_bill_date IS NULL, 999, dateDiff('day', last_bill.last_bill_date, ${todayReference})) AS days_since_bill
  FROM soh
  LEFT JOIN drr ON drr.cfa = soh.cfa AND drr.sap_sku = soh.sap_sku
  LEFT JOIN last_bill ON last_bill.cfa = soh.cfa AND last_bill.sap_sku = soh.sap_sku
  LEFT JOIN attrs ON attrs.sku_code = soh.sap_sku
  WHERE soh_ea > 0
),
sku_level_aggregates AS (
  SELECT
    sap_sku,
    any(sku_name) AS sku_name,
    any(brand) AS brand,
    sum(soh_ea) AS total_surplus_ea,
    sum(drr_ea) AS total_drr_ea,
    if(total_drr_ea > 0, total_surplus_ea / total_drr_ea, 9999) AS net_doi,
    count() AS cfas_count,
    countIf(days_since_bill > 30) AS dead_cfa_count,
    min(days_to_expiry) AS min_days_to_expiry,
    any(price_ea) AS avg_price_ea,
    round(((total_surplus_ea * avg_price_ea) / 100000.0), 2) AS value_at_risk_lacs
  FROM cfa_states
  GROUP BY sap_sku
  HAVING countIf(soh_ea / nullIf(drr_ea, 0) < 7) = 0
),
final_data AS (
  SELECT
    sap_sku,
    sku_name,
    brand,
    total_surplus_ea,
    net_doi,
    cfas_count,
    dead_cfa_count,
    min_days_to_expiry,
    value_at_risk_lacs,
    multiIf(min_days_to_expiry <= 30, 'CRITICAL', min_days_to_expiry <= 90 OR dead_cfa_count >= 3, 'HIGH', net_doi > 90 OR dead_cfa_count > 0, 'MEDIUM', 'LOW') AS severity,
    multiIf(min_days_to_expiry <= 30, 'Expiry Disposal', min_days_to_expiry <= 90, 'Trade Marketing', net_doi = 9999, 'Sales Team', dead_cfa_count >= 3, 'Pricing', 'Sales Team') AS team,
    multiIf(min_days_to_expiry <= 30, concat(toString(min_days_to_expiry), 'd to nearest batch expiry — escalate to expiry disposal'), min_days_to_expiry <= 90, concat(toString(min_days_to_expiry), 'd to expiry — push promotional POs to chain'), net_doi = 9999, 'No movement anywhere — sales team to find chain demand or return to supplier', dead_cfa_count >= 3, concat('Dead in ', toString(dead_cfa_count), ' CFAs — discount approval to push to chain'), net_doi > 90, concat(toString(round(net_doi)), 'd network cover — push extra POs or discount'), 'High DOI — review forecast / push POs') AS action_label
  FROM sku_level_aggregates
)
SELECT * FROM (
  SELECT
    concat(sku_name, ' (', sap_sku, ')') AS sku,
    severity AS severity,
    total_surplus_ea AS surplusEa,
    if(net_doi = 9999, '999d+', concat(toString(round(net_doi, 1)), 'd')) AS netDoi,
    cfas_count AS cfasCount,
    dead_cfa_count AS deadCfaCount,
    if(min_days_to_expiry = 999, '—', concat(toString(min_days_to_expiry), 'd')) AS expiry,
    concat(toString(value_at_risk_lacs), 'L') AS valueAtRisk,
    concat(team, ' | ', action_label) AS teamAction
  FROM final_data
)
${finalSearchSql}
ORDER BY multiIf(severity = 'CRITICAL', 1, severity = 'HIGH', 2, severity = 'MEDIUM', 3, 4) ASC, surplusEa DESC
LIMIT 500
`;

                console.log('[SupplyChain] Executing V2 Manage Surplus query...');
                const rows = await queryClickHouse(query);
                console.log(`[SupplyChain] Got ${rows.length} V2 surplus rows from ClickHouse`);

                const priorityMap = { 'CRITICAL': 'Critical', 'HIGH': 'High', 'MEDIUM': 'Medium', 'LOW': 'Low' };

                const data = rows.map((row, index) => {
                    return {
                        id: `MS-${String(index + 1).padStart(3, '0')}`,
                        sku: row.sku || '',
                        severity: row.severity || 'LOW',
                        priority: priorityMap[row.severity] || 'Low',
                        surplusEa: Math.round(parseFloat(row.surplusEa || 0)),
                        netDoi: row.netDoi || '0d',
                        cfasCount: parseInt(row.cfasCount) || 0,
                        deadCfaCount: parseInt(row.deadCfaCount) || 0,
                        expiry: row.expiry || '—',
                        valueAtRisk: row.valueAtRisk || '0L',
                        teamAction: row.teamAction || ''
                    };
                });

                return data;
            } catch (error) {
                console.error('[SupplyChain] Error in getManageSurplusDataV2:', error.message);
                throw error;
            }
        });
    }
};

export default supplyChainService;
