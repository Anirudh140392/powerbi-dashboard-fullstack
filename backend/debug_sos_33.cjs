const pkg = require('@clickhouse/client');
const client = pkg.createClient({
    url: 'http://13.200.55.131:8123',
    password: 'Kenil@Kavar0604',
    username: 'kenil_user',
    database: 'pidilite'
});

async function run() {
    // Query A: brand=fevicol filter (old approach) per location
    const qA = `
        SELECT location_name,
            COUNT(*) as total,
            COUNTIf(brand = 'fevicol') as fevicol_rows,
            COUNTIf(toInt32(spons) = 1) as total_ads,
            COUNTIf(brand = 'fevicol' AND toInt32(spons) = 1) as fevicol_ads,
            ROUND(COUNTIf(brand = 'fevicol' AND toInt32(spons) = 1) * 100.0 / NULLIF(COUNTIf(toInt32(spons) = 1), 0), 2) as paid_sos_brand_filter,
            ROUND(COUNTIf(brand = 'fevicol') * 100.0 / NULLIF(COUNT(*), 0), 2) as overall_sos_brand_filter
        FROM rb_kw_olap
        WHERE lower(keyword) = 'fevi quick'
          AND DATE = '2026-06-01'
          AND platform_name = 'blinkit'
        GROUP BY location_name
        ORDER BY location_name
    `;
    const rsA = await client.query({ query: qA, format: 'JSONEachRow' });
    const dataA = await rsA.json();
    console.log('=== Scenario A: brand=fevicol filter per location ===');
    dataA.forEach(r => console.log(`  loc=${r.location_name} | total=${r.total} | fevicol=${r.fevicol_rows} | ads=${r.total_ads} | fevi_ads=${r.fevicol_ads} | paid_sos=${r.paid_sos_brand_filter}% | overall_sos=${r.overall_sos_brand_filter}%`));

    // Query B: flag=1 approach per location
    const qB = `
        SELECT location_name,
            COUNT(*) as total,
            COUNTIf(toInt32(flag) = 1) as flag1,
            COUNTIf(toInt32(spons) = 1) as total_ads,
            COUNTIf(toInt32(flag) = 1 AND toInt32(spons) = 1) as flag1_ads,
            ROUND(COUNTIf(toInt32(flag) = 1) * 100.0 / NULLIF(COUNT(*), 0), 2) as overall_sos,
            ROUND(COUNTIf(toInt32(flag) = 1 AND toInt32(spons) = 1) * 100.0 / NULLIF(COUNTIf(toInt32(spons) = 1), 0), 2) as paid_sos
        FROM rb_kw_olap
        WHERE lower(keyword) = 'fevi quick'
          AND DATE = '2026-06-01'
          AND platform_name = 'blinkit'
        GROUP BY location_name
        ORDER BY location_name
    `;
    const rsB = await client.query({ query: qB, format: 'JSONEachRow' });
    const dataB = await rsB.json();
    console.log('\n=== Scenario B: flag=1 approach per location ===');
    dataB.forEach(r => console.log(`  loc=${r.location_name} | total=${r.total} | flag1=${r.flag1} | ads=${r.total_ads} | flag1_ads=${r.flag1_ads} | overall_sos=${r.overall_sos}% | paid_sos=${r.paid_sos}%`));

    // Query C: CTE approach - what does Fevicol brand get with is_target filter?
    const qC = `
        WITH brand_counts AS (
            SELECT platform_name, location_name, keyword, brand,
                COUNT(*) AS brand_rows,
                SUM(CASE WHEN toInt32(spons) = 1 THEN 1 ELSE 0 END) AS ad_rows,
                SUM(CASE WHEN toInt32(spons) = 0 THEN 1 ELSE 0 END) AS organic_rows,
                MAX(CASE WHEN toInt32(flag) = 1 THEN 1 ELSE 0 END) AS is_target
            FROM rb_kw_olap
            WHERE lower(keyword) = 'fevi quick'
              AND DATE = '2026-06-01'
              AND platform_name = 'blinkit'
            GROUP BY platform_name, location_name, keyword, brand
        ),
        keyword_level_sos AS (
            SELECT *, 
                ROUND(brand_rows * 100.0 / NULLIF(SUM(brand_rows) OVER (PARTITION BY platform_name, location_name, keyword), 0), 2) AS overall_sos_pct,
                ROUND(ad_rows * 100.0 / NULLIF(SUM(ad_rows) OVER (PARTITION BY platform_name, location_name, keyword), 0), 2) AS ad_sos_pct,
                ROUND(organic_rows * 100.0 / NULLIF(SUM(organic_rows) OVER (PARTITION BY platform_name, location_name, keyword), 0), 2) AS organic_sos_pct
            FROM brand_counts
        )
        SELECT location_name, brand, is_target, brand_rows, ad_rows, organic_rows,
               overall_sos_pct, ad_sos_pct, organic_sos_pct
        FROM keyword_level_sos
        WHERE is_target = 1
        ORDER BY location_name, brand
    `;
    const rsC = await client.query({ query: qC, format: 'JSONEachRow' });
    const dataC = await rsC.json();
    console.log('\n=== CTE approach: is_target=1 rows (per brand per location) ===');
    dataC.forEach(r => console.log(`  loc=${r.location_name} | brand=${r.brand} | is_target=${r.is_target} | rows=${r.brand_rows} | ads=${r.ad_rows} | org=${r.organic_rows} | overall=${r.overall_sos_pct}% | ad=${r.ad_sos_pct}% | org=${r.organic_sos_pct}%`));

    // Query D: CTE approach - final aggregated per location (AVG across brands with is_target=1)
    const qD = `
        WITH brand_counts AS (
            SELECT platform_name, location_name, keyword, brand,
                COUNT(*) AS brand_rows,
                SUM(CASE WHEN toInt32(spons) = 1 THEN 1 ELSE 0 END) AS ad_rows,
                SUM(CASE WHEN toInt32(spons) = 0 THEN 1 ELSE 0 END) AS organic_rows,
                MAX(CASE WHEN toInt32(flag) = 1 THEN 1 ELSE 0 END) AS is_target
            FROM rb_kw_olap
            WHERE lower(keyword) = 'fevi quick'
              AND DATE = '2026-06-01'
              AND platform_name = 'blinkit'
            GROUP BY platform_name, location_name, keyword, brand
        ),
        keyword_level_sos AS (
            SELECT *, 
                ROUND(brand_rows * 100.0 / NULLIF(SUM(brand_rows) OVER (PARTITION BY platform_name, location_name, keyword), 0), 2) AS overall_sos_pct,
                ROUND(ad_rows * 100.0 / NULLIF(SUM(ad_rows) OVER (PARTITION BY platform_name, location_name, keyword), 0), 2) AS ad_sos_pct,
                ROUND(organic_rows * 100.0 / NULLIF(SUM(organic_rows) OVER (PARTITION BY platform_name, location_name, keyword), 0), 2) AS organic_sos_pct
            FROM brand_counts
        )
        SELECT location_name AS city,
            ROUND(AVG(overall_sos_pct), 2) AS overall_sos,
            ROUND(AVG(COALESCE(ad_sos_pct, 0)), 2) AS paid_sos,
            ROUND(AVG(organic_sos_pct), 2) AS organic_sos
        FROM keyword_level_sos
        WHERE is_target = 1
        GROUP BY location_name
        ORDER BY location_name
    `;
    const rsD = await client.query({ query: qD, format: 'JSONEachRow' });
    const dataD = await rsD.json();
    console.log('\n=== CTE approach: FINAL aggregated per location ===');
    dataD.forEach(r => console.log(`  city=${r.city} | overall_sos=${r.overall_sos}% | paid_sos=${r.paid_sos}% | organic_sos=${r.organic_sos}%`));

    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
