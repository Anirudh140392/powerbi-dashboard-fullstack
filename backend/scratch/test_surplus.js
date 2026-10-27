import { queryClickHouse } from '../src/config/clickhouse.js';

const query = `
WITH drr AS (
  SELECT
    lower(cfa_name) AS cfa,
    replaceRegexpOne(material_code, '[.]0+$', '') AS sap_sku,
    argMax(brand, billing_date) AS brand_drr,
    argMax(parent_sku, billing_date) AS parent_sku_drr,
    argMax(material_description, billing_date) AS sku_name_drr,
    sum(bill_qty_ea) / 30.0 AS drr_ea,
    sum(net_value) / nullIf(sum(bill_qty_ea), 0) AS unit_price_ea
  FROM mars.po_primary_billing_v2
  WHERE billing_date >= today() - 30 AND bill_qty_ea > 0 AND cfa_name != ''
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
    AND soh.snapshot_date = (SELECT max(snapshot_date) FROM mars.po_stock_on_hand_v2)
  GROUP BY cfa, sap_sku
),
last_bill AS (
  SELECT
    lower(cfa_name) AS cfa,
    replaceRegexpOne(material_code, '[.]0+$', '') AS sap_sku,
    max(billing_date) AS last_bill_date
  FROM mars.po_primary_billing_v2
  WHERE billing_date >= today() - 90 AND bill_qty_ea > 0
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
    if(soh.nearest_expiry_dt IS NOT NULL, dateDiff('day', today(), soh.nearest_expiry_dt), 999) AS days_to_expiry,
    if(last_bill.last_bill_date IS NULL, 999, dateDiff('day', last_bill.last_bill_date, today())) AS days_since_bill
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
)
SELECT count(*) as count FROM sku_level_aggregates;
`;

async function run() {
  try {
    const r = await queryClickHouse(query);
    console.log(r);
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
