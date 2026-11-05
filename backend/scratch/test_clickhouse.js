import { queryClickHouse } from '../src/config/clickhouse.js';
import { SUPPLY_ACTION_CTES_V2 } from '../src/services/supplyChainService.js'; // I'll just copy the query

async function testQuery() {
    try {
        const query = `
SELECT
  v2.po_number AS poNo,
  v2.platform AS platform,
  v2.facility_name AS warehouse,
  any(v2.po_status) AS dbStatus,
  toString(max(v2.po_raised_date)) AS poDate,
  toString(max(v2.po_expiry_date)) AS expiryDate,
  if(lower(v2.platform) IN ('zepto','instamart'), NULL, toString(max(v2.appointment_date))) AS appointmentDate,
  any(coalesce(nullIf(joinGet('mars._j_sap_to_attrs', 'brand', coalesce(nullIf(joinGet('mars._j_article_to_sap', 'sap_sku', lower(v2.platform) || ':' || lower(v2.sku_code)), ''), nullIf(joinGet('mars._j_ean_to_dcom', 'sku', v2.ean), ''), nullIf(v2.sap_sku_code, ''))), ''), nullIf(coalesce(nullIf(v2.brand,''), 'test_brand'), ''), '')) AS brandWarehouse,
  groupArray(tuple(
    v2.sku_code,
    v2.sku_description,
    coalesce(nullIf(joinGet('mars._j_sap_to_attrs', 'brand', coalesce(nullIf(joinGet('mars._j_article_to_sap', 'sap_sku', lower(v2.platform) || ':' || lower(v2.sku_code)), ''), nullIf(joinGet('mars._j_ean_to_dcom', 'sku', v2.ean), ''), nullIf(v2.sap_sku_code, ''))), ''), nullIf(coalesce(nullIf(v2.brand,''), 'test_brand'), ''), ''),
    v2.units_ordered,
    v2.units_received,
    v2.line_value_with_tax / 100000,
    if(v2.po_status IN ('completed','fulfilled'),
       v2.line_value_with_tax, v2.line_value_with_tax * v2.units_received / nullIf(v2.units_ordered, 0)) / 100000,
    1.0,
    1,
    1,
    coalesce(nullIf(toFloat64(v2.unit_cost_landed), 0), toFloat64(1.0), 0),
    toString(v2.po_raised_date),
    toString(v2.appointment_date),
    toString(v2.po_expiry_date),
    v2.po_status,
    'image',
    1.0,
    100.0 * v2.units_received / nullIf(v2.units_ordered, 0),
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,
    4.0,
    1.0,
    0,
    0,
    toFloat64(v2.units_received),
    '',
    '',
    0,
    0
  )) AS items
FROM mars.rb_po_olap_v2_latest v2
WHERE lower(v2.po_number) = lower('PO-2026-08912')
GROUP BY poNo, platform, warehouse
LIMIT 2
`;
        const res = await queryClickHouse(query);
        console.log(res);
        process.exit(0);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
testQuery();
