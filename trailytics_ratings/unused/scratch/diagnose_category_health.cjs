const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
    connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=require`,
});

async function test() {
    // Simulate the request params from the UI screenshot
    // Price filter: ₹35 - ₹1795, Platform: All, Scope: Prestige (default)
    const companyId = '857cea4d-fdfc-4ffa-8fb4-f47904ec4233'; // Prestige company — need to check actual UUID
    const price_min = '35';
    const price_max = '1795';
    const price_mode = 'sp';
    const platform = undefined;
    const is_competitor = undefined; // not set = defaults to prestige

    console.log('=== Testing category-health with price filter ===');
    console.log('Params:', { price_min, price_max, price_mode, platform, is_competitor });

    // Step 1: Get the actual company IDs
    const companies = await pool.query("SELECT id, name FROM public.companies LIMIT 10;");
    console.log('\nCompanies in DB:');
    companies.rows.forEach(c => console.log(`  ${c.name}: ${c.id}`));

    // Step 2: Check what price data exists in product_snapshots
    const priceCheck = await pool.query(`
        SELECT 
            MIN(price_sp) as min_sp, MAX(price_sp) as max_sp,
            MIN(price_rp) as min_rp, MAX(price_rp) as max_rp,
            COUNT(*) as total_snapshots,
            COUNT(price_sp) as has_sp,
            COUNT(price_rp) as has_rp,
            COUNT(*) FILTER (WHERE is_competitor = false) as prestige_count,
            COUNT(*) FILTER (WHERE is_competitor = true) as competitor_count
        FROM ratings.product_snapshots
        WHERE company_id = (SELECT id FROM public.companies WHERE name ILIKE '%prestige%' LIMIT 1)
        AND snapshot_date = (SELECT MAX(s2.snapshot_date) FROM ratings.product_snapshots s2 WHERE s2.company_id = company_id AND s2.web_pid = web_pid AND s2.platform = platform);
    `);
    console.log('\nPrice data in product_snapshots (latest snapshots only):');
    console.log(priceCheck.rows[0]);

    // Step 3: Check what companies have snapshot data
    const snapshotCompanies = await pool.query(`
        SELECT c.name, c.id, COUNT(ps.web_pid) as snap_count
        FROM public.companies c
        LEFT JOIN ratings.product_snapshots ps ON ps.company_id = c.id
        GROUP BY c.id, c.name
        ORDER BY snap_count DESC
        LIMIT 10;
    `);
    console.log('\nSnapshot counts per company:');
    snapshotCompanies.rows.forEach(c => console.log(`  ${c.name} (${c.id}): ${c.snap_count} snapshots`));

    // Step 4: Test with the company that has most data
    const topCompany = snapshotCompanies.rows[0];
    if (!topCompany || topCompany.snap_count === '0') {
        console.log('No snapshot data found!');
        await pool.end();
        return;
    }

    console.log('\n=== Testing with top company:', topCompany.name, '===');
    const testCompanyId = topCompany.id;

    // Step 5: Check the price range to understand why 35-1795 returns 0
    const priceRange = await pool.query(`
        SELECT 
            MIN(price_sp) as min_sp, MAX(price_sp) as max_sp,
            MIN(price_rp) as min_rp, MAX(price_rp) as max_rp,
            MIN(COALESCE(price_sp, price_rp)) as min_any,
            MAX(COALESCE(price_sp, price_rp)) as max_any,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_competitor = false) as prestige,
            COUNT(*) FILTER (WHERE is_competitor = true) as competitor
        FROM ratings.product_snapshots
        WHERE company_id = $1
    `, [testCompanyId]);
    console.log('\nPrice range in snapshots:');
    console.log(priceRange.rows[0]);

    // Step 6: Check masters.products for price
    const mpPriceRange = await pool.query(`
        SELECT 
            MIN(selling_price) as min_sp, MAX(selling_price) as max_sp,
            MIN(mrp) as min_rp, MAX(mrp) as max_rp,
            COUNT(*) as total
        FROM masters.products
        WHERE company_id = $1
    `, [testCompanyId]);
    console.log('\nPrice range in masters.products:');
    console.log(mpPriceRange.rows[0]);

    // Step 7: Test the actual totalSql used in category-health 
    const testParams = [testCompanyId];
    let totalWhere = ` AND ps.is_competitor = false`; // default
    const totalPriceExpr = 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
    totalWhere += ` AND ${totalPriceExpr} >= $${testParams.length + 1}`;
    testParams.push(35);
    totalWhere += ` AND ${totalPriceExpr} <= $${testParams.length + 1}`;
    testParams.push(1795);

    const testSql = `
        WITH combined_skus AS (
            SELECT ps.web_pid, ps.platform, ps.rating_count, ps.price_rp, ps.price_sp, 
                   COALESCE(ps.is_competitor, mp.is_competitor, false) as is_competitor
            FROM ratings.product_snapshots ps
            LEFT JOIN masters.products mp ON mp.company_id = ps.company_id AND mp.product_external_id = ps.web_pid AND LOWER(mp.platform) = LOWER(ps.platform)
            WHERE ps.company_id = $1
              AND ps.snapshot_date = (
                  SELECT MAX(snapshot_date) FROM ratings.product_snapshots
                  WHERE company_id = ps.company_id AND web_pid = ps.web_pid AND platform = ps.platform
              )
            UNION
            SELECT r.web_pid, r.platform, 0 as rating_count, mp.mrp as price_rp, COALESCE(mp.selling_price, mp.mop) as price_sp, 
                   r.is_competitor
            FROM ratings.reviews r
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
            WHERE r.company_id = $1
        )
        SELECT 
            COUNT(DISTINCT ps.web_pid) as unique_skus,
            SUM(ps.rating_count) as total_ratings
        FROM combined_skus ps
        LEFT JOIN masters.products mp
            ON mp.company_id = $1
           AND mp.product_external_id = ps.web_pid
           AND LOWER(mp.platform) = LOWER(ps.platform)
        WHERE 1=1
          ${totalWhere}
    `;

    console.log('\nTesting totalSql with price filter 35-1795 (prestige only):');
    console.log('Params:', testParams);
    const totalResult = await pool.query(testSql, testParams);
    console.log('Result:', totalResult.rows[0]);

    // Step 8: Test WITHOUT price filter to confirm data exists
    const noFilterResult = await pool.query(`
        WITH combined_skus AS (
            SELECT ps.web_pid, ps.platform, ps.rating_count, ps.price_rp, ps.price_sp
            FROM ratings.product_snapshots ps
            WHERE ps.company_id = $1
              AND ps.snapshot_date = (
                  SELECT MAX(snapshot_date) FROM ratings.product_snapshots
                  WHERE company_id = ps.company_id AND web_pid = ps.web_pid AND platform = ps.platform
              )
            UNION
            SELECT r.web_pid, r.platform, 0 as rating_count, mp.mrp as price_rp, COALESCE(mp.selling_price, mp.mop) as price_sp
            FROM ratings.reviews r
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
            WHERE r.company_id = $1
              AND r.is_competitor = false
        )
        SELECT 
            COUNT(DISTINCT ps.web_pid) as unique_skus,
            SUM(ps.rating_count) as total_ratings,
            MIN(COALESCE(ps.price_sp, ps.price_rp)) as min_price,
            MAX(COALESCE(ps.price_sp, ps.price_rp)) as max_price
        FROM combined_skus ps
    `, [testCompanyId]);
    console.log('\nResult WITHOUT price filter (prestige):');
    console.log(noFilterResult.rows[0]);

    await pool.end();
}

test().catch(err => {
    console.error('Fatal:', err);
    pool.end();
});
