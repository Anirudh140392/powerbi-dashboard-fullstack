const { Pool } = require('pg');
require('dotenv').config();

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const pool = new Pool({
    host: requireEnv('DB_HOST'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(requireEnv('DB_PORT'), 10),
    ssl: { rejectUnauthorized: false },
});

async function runBulkSpecEnricher() {
    const companyId = requireEnv('COMPANY_ID');
    console.log('[System] Master spec enrichment requested.');
    console.log(`[System] Company ID: ${companyId}`);

    const { rows } = await pool.query(`
        SELECT COUNT(*)::int AS pending_count
        FROM masters.products
        WHERE company_id = $1
          AND ((material IS NULL OR material = '') OR (wattage IS NULL OR wattage = ''))
    `, [companyId]);

    const pendingCount = rows[0]?.pending_count || 0;
    console.log(`[System] Pending master rows missing spec fields: ${pendingCount}`);
    throw new Error('Master Spec Enrichment is disabled because no audited master QC table exists. Add a reviewed master-audit store before enabling production writes.');
}

runBulkSpecEnricher()
    .catch(async (error) => {
        console.error(error.message || error);
        await pool.end();
        process.exit(1);
    });
