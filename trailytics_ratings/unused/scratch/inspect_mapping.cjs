const { Pool } = require('pg');
const pool = new Pool({
    host: '3.7.138.75', database: 'adsauto', user: 'adsauto',
    password: 'Adsauto7060', port: 5432, ssl: { rejectUnauthorized: false }
});

async function run() {
    // 1. Category columns across key tables
    const cols = await pool.query(`
        SELECT table_schema, table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema IN ('ratings','masters')
          AND table_name IN ('product_snapshots','products','reviews')
          AND column_name ILIKE '%categor%'
        ORDER BY table_schema, table_name, column_name
    `);
    console.log('\n=== CATEGORY COLUMNS ===');
    console.table(cols.rows);

    // 2. Sample product_snapshots category values
    const psSnap = await pool.query(`
        SELECT web_pid, platform, category, product_name
        FROM ratings.product_snapshots
        WHERE category IS NOT NULL AND category != ''
        LIMIT 10
    `);
    console.log('\n=== product_snapshots sample ===');
    console.table(psSnap.rows);

    // 3. Sample masters.products category values
    const mpProds = await pool.query(`
        SELECT product_external_id, platform, category, master_category, product_name
        FROM masters.products
        WHERE category IS NOT NULL OR master_category IS NOT NULL
        LIMIT 10
    `);
    console.log('\n=== masters.products sample ===');
    console.table(mpProds.rows);

    // 4. Sample reviews category values
    const rv = await pool.query(`
        SELECT web_pid, platform, category, is_competitor
        FROM ratings.reviews
        WHERE category IS NOT NULL AND category != ''
        LIMIT 10
    `);
    console.log('\n=== ratings.reviews sample ===');
    console.table(rv.rows);

    // 5. Distinct categories from product_snapshots
    const distinctCats = await pool.query(`
        SELECT DISTINCT category, COUNT(*) as cnt
        FROM ratings.product_snapshots
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category ORDER BY cnt DESC LIMIT 20
    `);
    console.log('\n=== Distinct categories in product_snapshots ===');
    console.table(distinctCats.rows);

    await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
