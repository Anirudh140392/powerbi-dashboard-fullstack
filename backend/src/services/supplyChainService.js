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
        const cacheKey = generateCacheKey('supply_chain_prioritize_po_v2', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                // Resolve the current client's ClickHouse schema dynamically
                const db = getCurrentDbName();
                // Build dynamic filter conditions with prefix 'v2'
                const conditions = ["(NOT (v2.po_status IN ('fulfilled','completed','grn_done','expired','rejected') OR v2.po_status LIKE 'cancelled%'))"];
                conditions.push("lower(coalesce(nullIf(v2.brand,''), pdp.brand_pdp)) NOT IN ('whiskas','pedigree','sheba','temptations','chappi','catsan')");

                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(v2.platform) IN (${platforms})`);
                }
                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(coalesce(nullIf(v2.brand,''), pdp.brand_pdp)) IN (${brands})`);
                }
                if (filters.city && filters.city !== 'All') {
                    const cities = filters.city.split(',').map(c => `'${c.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(v2.city) IN (${cities})`);
                }
                if (filters.status && filters.status !== 'All') {
                    const statuses = filters.status.split(',').map(s => `'${s.trim().toLowerCase()}'`).join(',');
                    conditions.push(`lower(v2.po_status) IN (${statuses})`);
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

                const whereClause = conditions.join(' AND ');

                const query = `
WITH
  pdp AS (
    SELECT
      lower(Platform) AS plat,
      coalesce(nullIf(dictGet('${db}.dict_city_alias', 'canonical_city', tuple(lower(toString(Location)))), ''),
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
    FROM ${db}.rb_pdp_olap
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
    FROM ${db}.po_chain_kpi_daily
    WHERE snapshot_date = (SELECT max(snapshot_date) FROM ${db}.po_chain_kpi_daily)
 
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
    FROM ${db}.po_feeder_serving_area f
    INNER JOIN ${db}.po_chain_kpi_daily c
      ON c.platform = f.platform
      AND lower(c.city) = lower(f.served_city)
      AND c.snapshot_date = (SELECT max(snapshot_date) FROM ${db}.po_chain_kpi_daily)
    WHERE f.served_city != ''
    GROUP BY f.platform, lower(f.facility_name), c.sap_sku_code
  ),
  sku_cs AS (
    SELECT sku_code, argMax(case_size, valid_from) AS cs
    FROM ${db}.po_sku_attributes
    WHERE case_size > 0
    GROUP BY sku_code
  ),
  cfa_soh AS (
    SELECT
      lower(p.cfa_name) AS city_match,
      sku_cs.sku_code AS sap_sku,
      sum(toFloat64(soh.unrestricted) * sku_cs.cs) AS eaches
    FROM ${db}.po_stock_on_hand_v2 soh
    INNER JOIN ${db}.po_v_sap_plant_master_v2 p
      ON p.plant = soh.plant AND p.storage_type = 'CFA'
    INNER JOIN sku_cs
      ON sku_cs.sku_code = replaceRegexpOne(soh.material_code, '[.]0+$', '')
    WHERE soh.saleable_stock = 'Normal sale' AND soh.unrestricted > 0
    GROUP BY city_match, sap_sku
  ),
  lt_master AS (
    SELECT lower(platform) AS plat, argMax(lead_time_days, valid_from) AS lt_days
    FROM ${db}.po_lead_time_master
    WHERE platform NOT LIKE 'test-%'
    GROUP BY plat
  )
 
SELECT
  v2.po_number AS poNo,
  any(rb_plat.pf_name) AS platform,
  v2.facility_name AS warehouse,
  any(v2.po_status) AS dbStatus,
  toString(max(v2.po_raised_date)) AS poDate,
  toString(max(v2.po_expiry_date)) AS expiryDate,
  if(lower(v2.platform) IN ('zepto','instamart'), NULL, toString(max(v2.appointment_date))) AS appointmentDate,
  any(coalesce(nullIf(v2.brand,''), pdp.brand_pdp)) AS brandWarehouse,
  sum(toFloat64(v2.line_value_with_tax)) AS order_value,
  sum(toFloat64(v2.line_value_with_tax)) / 100000.0 AS totalOrderValue,
  sum(toFloat64(if(v2.po_status IN ('completed','fulfilled'),
       v2.line_value_with_tax, v2.line_value_with_tax * v2.units_received / nullIf(v2.units_ordered, 0)))) / 100000.0 AS totalBilledValue,
  sum(toFloat64(v2.units_ordered)) AS totalOrderedQty,
  sum(toFloat64(v2.units_received)) AS totalFulfilledQty,
  100.0 * sum(toFloat64(v2.units_received)) / nullIf(sum(toFloat64(v2.units_ordered)), 0) AS fillRate,
  argMax(toFloat64(chain.chain_total) / nullIf(toFloat64(chain.drr_sustained), 0), v2.po_raised_date) AS avg_doi,
  sum(
    least(
      toFloat64(v2.line_value_with_tax),
      if(chain.chain_total IS NULL OR toFloat64(chain.drr_ea) <= 0, 0,
        greatest(0,
          coalesce(toFloat64(lt_master.lt_days), 4.0)
          - toFloat64(chain.chain_total) / nullIf(toFloat64(chain.drr_sustained), 0)
        )
        * toFloat64(chain.drr_ea)
        * coalesce(nullIf(toFloat64(v2.unit_cost_landed), 0), 0)
      )
    )
  ) / 100000.0 AS potential_sales_loss,
  if(sum(pdp.deno) > 0, 100.0 * sum(pdp.neno) / sum(pdp.deno), NULL) AS avgOSA,
  count(distinct v2.sku_code) AS skuCount,
  sum(toFloat64(chain.drr_ea)) AS consumptionPerDay
FROM ${db}.rb_po_olap_v2_latest v2
LEFT JOIN ${db}.rb_platform rb_plat ON lower(rb_plat.pf_name) = lower(v2.platform)
LEFT JOIN pdp   ON pdp.plat   = v2.platform AND pdp.sku_key   = v2.sku_code      AND pdp.city   = coalesce(nullIf(dictGet('${db}.dict_city_alias', 'canonical_city', tuple(lower(if(v2.city != '', v2.city, dictGet('${db}.dict_feeder_city', 'city', tuple(lower(v2.platform) || ':' || lower(trim(v2.facility_name)))))))), ''), lower(if(v2.city != '', v2.city, dictGet('${db}.dict_feeder_city', 'city', tuple(lower(v2.platform) || ':' || lower(trim(v2.facility_name)))))))
LEFT JOIN chain ON chain.plat = v2.platform AND chain.sap_sku = coalesce(nullIf(dictGet('${db}.dict_article_to_sap', 'sap_sku', tuple(lower(v2.platform) || ':' || lower(v2.sku_code))), ''), nullIf(dictGet('${db}.dict_ean_to_dcom', 'sku', tuple(v2.ean)), ''), nullIf(v2.sap_sku_code, ''))  AND chain.key = coalesce(nullIf(coalesce(nullIf(dictGet('${db}.dict_city_alias', 'canonical_city', tuple(lower(if(v2.city != '', v2.city, dictGet('${db}.dict_feeder_city', 'city', tuple(lower(v2.platform) || ':' || lower(trim(v2.facility_name)))))))), ''), lower(if(v2.city != '', v2.city, dictGet('${db}.dict_feeder_city', 'city', tuple(lower(v2.platform) || ':' || lower(trim(v2.facility_name))))))), ''), lower(v2.facility_name))
LEFT JOIN cfa_soh ON coalesce(nullIf(dictGet('${db}.dict_city_alias', 'canonical_city', tuple(lower(if(v2.city != '', v2.city, dictGet('${db}.dict_feeder_city', 'city', tuple(lower(v2.platform) || ':' || lower(trim(v2.facility_name)))))))), ''), lower(if(v2.city != '', v2.city, dictGet('${db}.dict_feeder_city', 'city', tuple(lower(v2.platform) || ':' || lower(trim(v2.facility_name))))))) = coalesce(nullIf(dictGet('${db}.dict_city_alias', 'canonical_city', tuple(lower(cfa_soh.city_match))), ''), lower(cfa_soh.city_match)) AND coalesce(nullIf(dictGet('${db}.dict_article_to_sap', 'sap_sku', tuple(lower(v2.platform) || ':' || lower(v2.sku_code))), ''), nullIf(dictGet('${db}.dict_ean_to_dcom', 'sku', tuple(v2.ean)), ''), nullIf(v2.sap_sku_code, '')) = cfa_soh.sap_sku
LEFT JOIN lt_master ON lt_master.plat = v2.platform
WHERE ${whereClause}
GROUP BY poNo, v2.platform, warehouse
ORDER BY potential_sales_loss DESC
`;

                console.log('[SupplyChain] Executing Prioritize PO query...');
                const rows = await queryClickHouse(query);
                console.log(`[SupplyChain] Got ${rows.length} PO rows from ClickHouse`);

                // Post-process: compute PSL, Priority, format fields
                const data = rows.map(row => {
                    const orderValue = row.order_value === null ? null : parseFloat(row.order_value);
                    const avgDoi = row.avg_doi === null ? null : parseFloat(row.avg_doi);
                    const fillRate = row.fillRate === null ? null : parseFloat(row.fillRate);
                    const priority = computePriority(avgDoi, fillRate, row.expiryDate);

                    return {
                         poNumber: row.poNo,
                         priority,
                         projectedSalesAtRisk: Math.round(parseFloat(row.potential_sales_loss || 0) * 100000),
                         platformWarehouse: `${titleCase(row.platform || '')} - ${titleCase(row.warehouse || '')}`,
                         platform: row.platform,
                         facilityName: row.warehouse,
                         city: titleCase(row.warehouse || ''),
                         status: titleCase(row.dbStatus || ''),
                         rawStatus: row.dbStatus,
                         orderValue: orderValue !== null ? Math.round(orderValue) : null,
                         billedValue: row.totalBilledValue !== null ? Math.round(parseFloat(row.totalBilledValue) * 100000) : null,
                         raisedOn: formatDate(row.poDate),
                         apptDate: formatDate(row.appointmentDate),
                         expiry: formatDate(row.expiryDate),
                         rawExpiryDate: row.expiryDate,
                         avgDoi: avgDoi !== null ? Math.round(avgDoi) : null,
                         lt: 4,
                         fillRate: fillRate !== null ? parseFloat(fillRate.toFixed(1)) : null,
                         confirmFill: fillRate !== null ? parseFloat(fillRate.toFixed(1)) : null,
                         pickFill: fillRate !== null ? parseFloat(fillRate.toFixed(1)) : null,
                         billFill: fillRate !== null ? parseFloat(fillRate.toFixed(1)) : null,
                         grnFill: fillRate !== null ? parseFloat(fillRate.toFixed(1)) : null,
                         consumptionPerDay: row.consumptionPerDay !== null ? parseFloat(row.consumptionPerDay) : null,
                         skuCount: parseInt(row.skuCount) || 0,
                         brand: titleCase(row.brandWarehouse || ''),
                         category: '',
                         distributor: ''
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
                    ? data.reduce((sum, d) => sum + (d.fillRate || 0), 0) / data.length
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
                const db = getCurrentDbName();
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
                    FROM ${db}.rb_po_olap
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
                const db = getCurrentDbName();
                const [platforms, brands, categories, cities, statuses] = await Promise.all([
                    queryClickHouse(`SELECT DISTINCT platform FROM ${db}.rb_po_olap WHERE platform IS NOT NULL AND platform != '' ORDER BY platform`),
                    queryClickHouse(`SELECT DISTINCT brand FROM ${db}.rb_po_olap WHERE brand IS NOT NULL AND brand != '' ORDER BY brand`),
                    queryClickHouse(`SELECT DISTINCT category FROM ${db}.rb_po_olap WHERE category IS NOT NULL AND category != '' ORDER BY category`),
                    queryClickHouse(`SELECT DISTINCT city FROM ${db}.rb_po_olap WHERE city IS NOT NULL AND city != '' ORDER BY city`),
                    queryClickHouse(`SELECT DISTINCT po_status FROM ${db}.rb_po_olap WHERE po_status IS NOT NULL AND po_status != '' ORDER BY po_status`)
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
                const db = getCurrentDbName();
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
                        FROM ${db}.rb_pdp_olap
                        WHERE Web_Pid = '${webPid}'
                        GROUP BY DATE
                    ) p
                    LEFT JOIN (
                        SELECT
                            po_raised_date,
                            sum(ifNull(neno_osa, 0)) as total_neno_osa,
                            sum(ifNull(deno_osa, 0)) as total_deno_osa
                        FROM ${db}.rb_po_olap
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
        console.log('[SupplyChain] getStockTransferData called with filters:', filters);
        const cacheKey = generateCacheKey('supply_chain_stock_transfer_v2', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const db = getCurrentDbName();
                let platformCondition = '';
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim().toLowerCase()}'`).join(',');
                    platformCondition = `AND sapCode IN (SELECT DISTINCT sap_sku_code FROM ${db}.po_chain_kpi_daily WHERE lower(platform) IN (${platforms}))`;
                }

                let brandCondition = '';
                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    brandCondition = `AND lower(brand) IN (${brands})`;
                }

                let searchCondition = '';
                if (filters.search) {
                    const searchTerm = filters.search.trim().toLowerCase();
                    searchCondition = `AND (lower(skuName) LIKE '%${searchTerm}%' OR lower(fromCfa) LIKE '%${searchTerm}%' OR lower(toCfa) LIKE '%${searchTerm}%')`;
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
      SELECT DISTINCT lower(cfa_name) AS cfa FROM ${db}.po_v_primary_billing_latest WHERE cfa_name NOT IN ('', '-')
      UNION DISTINCT
      SELECT DISTINCT lower(p.cfa_name) AS cfa FROM ${db}.po_stock_on_hand_v2 soh INNER JOIN ${db}.po_v_sap_plant_master_v2 p ON p.plant = soh.plant WHERE cfa_name NOT IN ('', '-')
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
  /* DRR per CFA per SKU (trailing 30-day billing) excluding Petcare */
  drr AS (
    SELECT
      lower(cfa_name) AS cfa,
      replaceRegexpOne(material_code, '[.]0+$', '') AS sap_sku,
      argMax(brand, billing_date) AS brand_drr,
      argMax(parent_sku, billing_date) AS parent_sku_drr,
      argMax(material_description, billing_date) AS sku_name_drr,
      sum(bill_qty_eaches) / 30.0 AS drr_ea
    FROM ${db}.po_v_primary_billing_latest
    WHERE billing_date >= today() - 30 AND bill_qty_eaches > 0 AND cfa_name NOT IN ('', '-')
      AND lower(brand) NOT IN ('whiskas','pedigree','sheba','temptations','chappi','catsan')
    GROUP BY cfa, sap_sku
  ),
  /* Current SOH per CFA per SKU (latest MB52 snapshot) */
  soh AS (
    SELECT
      lower(p.cfa_name) AS cfa,
      replaceRegexpOne(soh.material_code, '[.]0+$', '') AS sap_sku,
      sum(toFloat64(soh.unrestricted)) AS soh_cs
    FROM ${db}.po_stock_on_hand_v2 soh
    INNER JOIN ${db}.po_v_sap_plant_master_v2 p ON p.plant = soh.plant
    WHERE soh.saleable_stock = 'Normal sale' AND soh.unrestricted > 0
      AND soh.snapshot_date = (SELECT max(snapshot_date) FROM ${db}.po_stock_on_hand_v2)
    GROUP BY cfa, sap_sku
  ),
  /* Case size and hierarchy configuration */
  attrs AS (
    SELECT sku_code,
      argMax(case_size, valid_from) AS cs,
      argMax(parent_description, valid_from) AS parent_sku
    FROM ${db}.po_sku_attributes
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
WHERE 1=1 ${platformCondition} ${brandCondition} ${searchCondition}
ORDER BY safe100Pct DESC, distanceKm ASC, transferQty DESC
LIMIT 500
`;

                console.log('[SupplyChain] Executing Stock Transfer query...');
                const rows = await queryClickHouse(query);
                console.log(`[SupplyChain] Got ${rows.length} stock transfer rows from ClickHouse`);

                const data = rows.map((row, index) => {
                    return {
                        id: `ST-${String(index + 1).padStart(3, '0')}`,
                        skuName: row.skuName || '',
                        sapCode: row.sapCode || '',
                        fromCfa: titleCase(row.fromCfa || ''),
                        toCfa: titleCase(row.toCfa || ''),
                        distanceKm: row.distanceKm !== null ? parseFloat(row.distanceKm) : null,
                        doiFe: row.toDoi !== null ? Math.round(parseFloat(row.toDoi)) : null,
                        doiBe: row.fromDoi !== null ? Math.round(parseFloat(row.fromDoi)) : null,
                        sohFe: row.toSohEa !== null ? Math.round(parseFloat(row.toSohEa)) : null,
                        sohBe: row.fromSohEa !== null ? Math.round(parseFloat(row.fromSohEa)) : null,
                        cpd: row.toDrrEa !== null ? Math.round(parseFloat(row.toDrrEa)) : null,
                        transferQty: row.transferQty !== null ? Math.round(parseFloat(row.transferQty)) : null,
                        safe100Pct: row.safe100Pct
                    };
                });

                return data;
            } catch (error) {
                console.error('[SupplyChain] Error in getStockTransferData:', error.message);
                throw error;
            }
        }, CACHE_TTL.SHORT);
    },

    /**
     * Get Manage Surplus Data
     * Aggregates rb_po_olap rows by sku_name, platform, and facility_name
     */
    async getManageSurplusData(filters = {}) {
        console.log('[SupplyChain] getManageSurplusData called with filters:', filters);
        const cacheKey = generateCacheKey('supply_chain_manage_surplus_v4', filters);

        return await getCachedOrCompute(cacheKey, async () => {
            try {
                const db = getCurrentDbName();
                let platformCondition = '';
                if (filters.platform && filters.platform !== 'All') {
                    const platforms = filters.platform.split(',').map(p => `'${p.trim().toLowerCase()}'`).join(',');
                    platformCondition = `AND sap_sku IN (SELECT DISTINCT sap_sku_code FROM ${db}.po_chain_kpi_daily WHERE lower(platform) IN (${platforms}))`;
                }

                let brandCondition = '';
                if (filters.brand && filters.brand !== 'All') {
                    const brands = filters.brand.split(',').map(b => `'${b.trim().toLowerCase()}'`).join(',');
                    brandCondition = `AND lower(brand) IN (${brands})`;
                }

                let searchCondition = '';
                if (filters.search) {
                    const searchTerm = filters.search.trim().toLowerCase();
                    searchCondition = `AND (lower(sku_name) LIKE '%${searchTerm}%' OR lower(sap_sku) LIKE '%${searchTerm}%')`;
                }

                const query = `
WITH drr AS (SELECT lower(cfa_name) AS cfa, replaceRegexpOne(material_code, '[.]0+$', '') AS sap_sku, argMax(brand, billing_date) AS brand_drr, argMax(parent_sku, billing_date) AS parent_sku_drr, argMax(material_description, billing_date) AS sku_name_drr, sum(bill_qty_eaches) / 30.0 AS drr_ea, sum(net_value) / nullIf(sum(bill_qty_eaches), 0) AS unit_price_ea FROM ${db}.po_v_primary_billing_latest WHERE billing_date >= today() - 30 AND bill_qty_eaches > 0 AND cfa_name != '' AND lower(brand) NOT IN ('whiskas','pedigree','sheba','temptations','chappi','catsan') GROUP BY cfa, sap_sku), soh AS (SELECT lower(p.cfa_name) AS cfa, replaceRegexpOne(soh.material_code, '[.]0+$', '') AS sap_sku, sum(toFloat64(soh.unrestricted)) AS soh_cs, min(soh.batch_expiry) AS nearest_expiry_dt FROM ${db}.po_stock_on_hand_v2 soh INNER JOIN ${db}.po_v_sap_plant_master_v2 p ON p.plant = soh.plant AND p.storage_type = 'CFA' WHERE soh.saleable_stock = 'Normal sale' AND soh.unrestricted > 0 GROUP BY cfa, sap_sku), last_bill AS (SELECT lower(cfa_name) AS cfa, replaceRegexpOne(material_code, '[.]0+$', '') AS sap_sku, max(billing_date) AS last_bill_date FROM ${db}.po_v_primary_billing_latest WHERE billing_date >= today() - 90 AND bill_qty_eaches > 0 GROUP BY cfa, sap_sku), attrs AS (SELECT sku_code, argMax(case_size, valid_from) AS cs, argMax(parent_description, valid_from) AS parent_sku FROM ${db}.po_sku_attributes WHERE parent_description != '' AND case_size > 0 GROUP BY sku_code), cfa_states AS (SELECT soh.cfa AS cfa, soh.sap_sku AS sap_sku, coalesce(drr.sku_name_drr, '') AS sku_name, coalesce(drr.brand_drr, '') AS brand, coalesce(attrs.parent_sku, drr.parent_sku_drr, '') AS parent_sku, coalesce(drr.drr_ea, 0) AS drr_ea, coalesce(drr.unit_price_ea, 0) AS price_ea, coalesce(soh.soh_cs, 0) * coalesce(toFloat64(attrs.cs), 144) AS soh_ea, soh.nearest_expiry_dt AS nearest_expiry_dt, if(soh.nearest_expiry_dt IS NOT NULL, dateDiff('day', today(), soh.nearest_expiry_dt), 999) AS days_to_expiry, if(last_bill.last_bill_date IS NULL, 999, dateDiff('day', last_bill.last_bill_date, today())) AS days_since_bill FROM soh LEFT JOIN drr ON drr.cfa = soh.cfa AND drr.sap_sku = soh.sap_sku LEFT JOIN last_bill ON last_bill.cfa = soh.cfa AND last_bill.sap_sku = soh.sap_sku LEFT JOIN attrs ON attrs.sku_code = soh.sap_sku WHERE soh_ea > 0), sku_level_aggregates AS (SELECT sap_sku, any(sku_name) AS sku_name, any(brand) AS brand, sum(soh_ea) AS total_surplus_ea, sum(drr_ea) AS total_drr_ea, if(total_drr_ea > 0, total_surplus_ea / total_drr_ea, 9999) AS net_doi, count() AS cfas_count, countIf(days_since_bill > 30) AS dead_cfa_count, min(days_to_expiry) AS min_days_to_expiry, any(price_ea) AS avg_price_ea, round(((total_surplus_ea * avg_price_ea) / 100000.0), 2) AS value_at_risk_lacs FROM cfa_states GROUP BY sap_sku HAVING countIf(soh_ea / nullIf(drr_ea, 0) < 7) = 0), final_data AS (SELECT sap_sku, sku_name, brand, total_surplus_ea, net_doi, cfas_count, dead_cfa_count, min_days_to_expiry, value_at_risk_lacs, multiIf(min_days_to_expiry <= 30, 'CRITICAL', min_days_to_expiry <= 90 OR dead_cfa_count >= 3, 'HIGH', net_doi > 90 OR dead_cfa_count > 0, 'MEDIUM', 'LOW') AS severity, multiIf(min_days_to_expiry <= 30, 'Expiry Disposal', min_days_to_expiry <= 90, 'Trade Marketing', net_doi = 9999, 'Sales Team', dead_cfa_count >= 3, 'Pricing', 'Sales Team') AS team, multiIf(min_days_to_expiry <= 30, concat(toString(min_days_to_expiry), 'd to nearest batch expiry — escalate to expiry disposal'), min_days_to_expiry <= 90, concat(toString(min_days_to_expiry), 'd to expiry — push promotional POs to chain'), net_doi = 9999, 'No movement anywhere — sales team to find chain demand or return to supplier', dead_cfa_count >= 3, concat('Dead in ', toString(dead_cfa_count), ' CFAs — discount approval to push to chain'), net_doi > 90, concat(toString(round(net_doi)), 'd network cover — push extra POs or discount'), 'High DOI — review forecast / push POs') AS action_label FROM sku_level_aggregates) SELECT concat(sku_name, ' (', sap_sku, ')') AS "SKU", severity AS "SEVERITY", total_surplus_ea AS "SURPLUS EA", if(net_doi = 9999, '999d+', concat(toString(round(net_doi, 1)), 'd')) AS "NET DOI", cfas_count AS "CFAS", dead_cfa_count AS "DEAD CFAS", if(min_days_to_expiry = 999, '—', concat(toString(min_days_to_expiry), 'd')) AS "EXPIRY", concat(toString(value_at_risk_lacs), 'L') AS "₹L RISK", concat(team, ' | ', action_label) AS "TEAM / ACTION" FROM final_data
WHERE 1=1 ${platformCondition} ${brandCondition} ${searchCondition}
ORDER BY multiIf(severity = 'CRITICAL', 1, severity = 'HIGH', 2, severity = 'MEDIUM', 3, 4) ASC, value_at_risk_lacs DESC LIMIT 500
`;

                console.log('[SupplyChain] Executing Manage Surplus query...');
                const rows = await queryClickHouse(query);
                console.log(`[SupplyChain] Got ${rows.length} surplus rows from ClickHouse`);

                const data = rows.map((row, index) => {
                    return {
                        id: `MS-${String(index + 1).padStart(3, '0')}`,
                        sku: row.SKU,
                        priority: row.SEVERITY,
                        surplusEa: row['SURPLUS EA'] !== null ? Math.round(parseFloat(row['SURPLUS EA'])) : null,
                        netDoi: row['NET DOI'],
                        cfasCount: row.CFAS !== null ? parseInt(row.CFAS) : null,
                        deadCfaCount: row['DEAD CFAS'] !== null ? parseInt(row['DEAD CFAS']) : null,
                        expiry: row.EXPIRY,
                        valueAtRisk: row['₹L RISK'],
                        teamAction: row['TEAM / ACTION']
                    };
                });

                return data;

            } catch (error) {
                console.error('[SupplyChain] Error in getManageSurplusData:', error.message);
                throw error;
            }
        }, CACHE_TTL.SHORT);
    }
};

export default supplyChainService;
