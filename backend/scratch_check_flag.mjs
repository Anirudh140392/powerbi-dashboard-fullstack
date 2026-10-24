import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
});

async function main() {
    const ownBrandSubquery = `SELECT DISTINCT lower(Brand) FROM cheffin.rb_pdp_olap WHERE Comp_flag = 0 AND Brand IS NOT NULL AND Brand != ''`;

    const q = `
        SELECT 
            keyword,
            COUNTIf(lower(brand) IN (${ownBrandSubquery})) as rb_overall,
            COUNTIf(lower(brand) IN (${ownBrandSubquery}) AND toInt32(spons) = 0) as rb_organic,
            COUNTIf(lower(brand) IN (${ownBrandSubquery}) AND toInt32(spons) = 1) as rb_sponsored,
            COUNT(*) as total_overall,
            COUNTIf(toInt32(spons) = 0) as total_organic,
            COUNTIf(toInt32(spons) = 1) as total_spons,
            ROUND(COUNTIf(lower(brand) IN (${ownBrandSubquery})) * 100.0 / nullIf(COUNT(*), 0), 2) as overall_sos,
            ROUND(COUNTIf(lower(brand) IN (${ownBrandSubquery}) AND toInt32(spons) = 0) * 100.0 / nullIf(COUNTIf(toInt32(spons) = 0), 0), 2) as organic_sos,
            ROUND(COUNTIf(lower(brand) IN (${ownBrandSubquery}) AND toInt32(spons) = 1) * 100.0 / nullIf(COUNTIf(toInt32(spons) = 1), 0), 2) as paid_sos
        FROM cheffin.rb_kw_olap
        WHERE DATE = '2026-06-01' AND platform_name = 'amazon'
          AND keyword = 'kitchens of india ready to eat meal'
        GROUP BY keyword
    `;
    const res = await client.query({ query: q, format: 'JSONEachRow' });
    const data = await res.json();
    console.log('Fixed SOS for "kitchens of india ready to eat meal":');
    console.log(JSON.stringify(data, null, 2));

    // Expected: rb_overall=3, total_overall=10 → 30% overall SOS
    // rb_sponsored=3, total_spons=4 → 75% paid SOS
    // rb_organic=0, total_organic=6 → 0% organic SOS
    process.exit(0);
}
main();
