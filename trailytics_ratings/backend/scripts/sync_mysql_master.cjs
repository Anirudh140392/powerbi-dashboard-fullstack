/**
 * MySQL -> PostgreSQL Master Sync
 *
 * Source: rb_sku_platform
 * Target: masters.products
 *
 * Rules:
 * - company_id is env-scoped
 * - Pareto source of truth is rb_sku_platform.sku_type
 * - blank sku_type becomes Non-Pareto
 * - existing NPD rows are preserved
 */
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
require('dotenv').config();

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

const pgPool = new Pool({
    host: requireEnv('DB_HOST'),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    max: 5,
});

const COMPANY_ID = requireEnv('COMPANY_ID');
const MYSQL_CONFIG = {
    host: requireEnv('PRESTIGE_MYSQL_HOST'),
    port: parseInt(requireEnv('PRESTIGE_MYSQL_PORT'), 10),
    user: requireEnv('PRESTIGE_MYSQL_USER'),
    password: requireEnv('PRESTIGE_MYSQL_PASSWORD'),
    database: requireEnv('PRESTIGE_MYSQL_DATABASE'),
    connectTimeout: 15000,
};

const PLATFORM_MAP = {
    Amazon: 'amazon',
    Flipkart: 'flipkart',
    Blinkit: 'blinkit',
    Zepto: 'zepto',
    Instamart: 'instamart',
    JioMart: 'jiomart',
};

function cleanString(value) {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).trim();
    if (!cleaned || cleaned === '0' || cleaned === '\\N' || cleaned === '\\\\N') return null;
    return cleaned;
}

// Canonicalize category strings so case/whitespace variants collapse to one bucket
// (prevents the "others" vs "Others" split that produced two separate slices).
function canonicalizeCategory(value) {
    const cleaned = cleanString(value);
    if (!cleaned) return null;
    const normalized = cleaned.replace(/\s+/g, ' ');
    const lower = normalized.toLowerCase();
    const CANONICAL = {
        'others': 'Others',
        'other': 'Others',
        'misc': 'Others',
        'miscellaneous': 'Others',
    };
    if (CANONICAL[lower]) return CANONICAL[lower];
    // Title-case fallback: "pressure cooker" -> "Pressure Cooker"
    return normalized.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(' ');
}

function normalizePareto(value, existingPareto) {
    // NPD is sticky once set — protects manual designations across syncs.
    if (existingPareto === 'NPD') return 'NPD';
    const cleaned = cleanString(value);
    if (!cleaned) return existingPareto || 'Non-Pareto';
    return cleaned === 'Pareto' ? 'Pareto' : 'Non-Pareto';
}

// Pull a single wattage token out of an arbitrary spec string and normalize to "<N>W".
// Handles: "750WATT", "750 W", "1500WATT,1.5LITRE", "1.5 KW".
function extractWattage(spec) {
    if (!spec) return null;
    const m = spec.match(/(\d+(?:\.\d+)?)\s*(kw|w|watt|watts)\b/i);
    if (!m) return null;
    let watts = parseFloat(m[1]);
    if (!Number.isFinite(watts) || watts <= 0) return null;
    if (/kw/i.test(m[2])) watts = watts * 1000;
    return `${Math.round(watts)}W`;
}

// Pull a capacity token (e.g. "1.5L", "5 LITRE", "3LTR") and normalize to "<N>L".
function extractCapacity(spec) {
    if (!spec) return null;
    const m = spec.match(/(\d+(?:\.\d+)?)\s*(l|ltr|litre|litres|liter|liters)\b/i);
    if (!m) return null;
    const litres = parseFloat(m[1]);
    if (!Number.isFinite(litres) || litres <= 0) return null;
    // Keep one decimal only when meaningful (1.5L stays, 5.0L -> 5L)
    return `${Number.isInteger(litres) ? litres : litres.toFixed(1)}L`;
}

// User-given specific category names (set in masters.products.master_category
// via Excel upload / manual edit). When master_category matches one of these
// it overrides the coarser MySQL brand_category — e.g. a Kadai whose product
// name contains "Induction Compatible" was historically tagged as Induction
// Cooktop because brand_category came back as a generic appliance label, but
// the user-classified master_category said "Kadai". master_category wins.
const SPECIFIC_TAXONOMY = new Set([
    'Pressure Cooker','Kadai','Fry Pan','Tawa','Dosa Tawa',
    'Other Cookware','Cookware','Cookware Set','Gas Stove',
    'Mixer Grinder','Kettle','Rice Cooker','Toaster & OTG','Air Fryer',
    'Wet Grinder','Induction Cooktop','Sandwich Maker','Grill & Sandwich Maker',
    'Hand Blender','Glasstops and Hobs','Food Processor','Juicer','Iron',
    'Waffle Maker','Air Oven','Combo','Bottle',
]);

function resolveCategory(brandCategory, existingMasterCategory) {
    // master_category is the user's authoritative call (set outside this sync,
    // typically via an Excel import). When it's a specific known type, use it.
    if (existingMasterCategory && SPECIFIC_TAXONOMY.has(existingMasterCategory)) {
        return existingMasterCategory;
    }
    return canonicalizeCategory(brandCategory);
}

function parseSpec(value) {
    const spec = cleanString(value);
    if (!spec) return { wattage: null, capacity: null };
    const wattage = extractWattage(spec);
    const capacity = extractCapacity(spec);
    // If neither pattern matched but the spec exists, store the raw string in capacity
    // so we don't lose the data (downstream code already treats it as a generic spec).
    if (!wattage && !capacity) return { wattage: null, capacity: spec };
    return { wattage, capacity };
}

async function main() {
    console.log('=== MySQL -> PostgreSQL MASTER Sync ===\n');

    const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    console.log('Connected to MySQL');

    const [mysqlProducts] = await mysqlConn.query(`
        SELECT
            web_pid, sku_name, sku_title, platform_name, brand_name,
            brand_category, sub_category, sku_type, mrp, MOP AS mop,
            sku_qty, is_competitor, ean_code, rb_code, item_code
        FROM rb_sku_platform
        WHERE web_pid IS NOT NULL AND web_pid != ''
    `);

    const { rows: existingProducts } = await pgPool.query(`
        SELECT id, product_external_id, platform, pareto_status, master_category
        FROM masters.products
        WHERE company_id = $1
    `, [COMPANY_ID]);

    const existingLookup = new Map();
    for (const row of existingProducts) {
        existingLookup.set(`${row.product_external_id}|${row.platform || ''}`, row);
    }

    const pgClient = await pgPool.connect();
    let inserted = 0;
    let updated = 0;
    try {
        await pgClient.query('BEGIN');

        for (const product of mysqlProducts) {
            const webPid = cleanString(product.web_pid);
            if (!webPid) continue;

            const platform = PLATFORM_MAP[product.platform_name] || cleanString(product.platform_name)?.toLowerCase();
            if (!platform) continue;

            const lookupKey = `${webPid}|${platform}`;
            const existing = existingLookup.get(lookupKey);
            const skuDescription = cleanString(product.sku_name) || cleanString(product.sku_title);
            const { wattage, capacity } = parseSpec(product.sku_qty);
            const paretoStatus = normalizePareto(product.sku_type, existing?.pareto_status || null);

            const params = [
                COMPANY_ID,
                webPid,
                skuDescription,
                skuDescription,
                platform,
                resolveCategory(product.brand_category, existing?.master_category || null),
                canonicalizeCategory(product.sub_category),
                cleanString(product.brand_name),
                paretoStatus,
                cleanString(product.mrp) ? Number(product.mrp) : null,
                cleanString(product.mop) ? Number(product.mop) : null,
                product.is_competitor === 1,
                cleanString(product.ean_code) || cleanString(product.rb_code) || cleanString(product.item_code),
                wattage,
                capacity,
            ];

            if (existing) {
                // params layout: [0]company_id [1]web_pid [2]description [3]name
                // [4]platform [5]category [6]subcategory [7]brand_name [8]pareto
                // [9]mrp [10]mop [11]is_competitor [12]sku_code [13]wattage [14]capacity
                await pgClient.query(`
                    UPDATE masters.products
                    SET
                        description = COALESCE($1, description),
                        category = COALESCE($2, category),
                        subcategory = COALESCE($3, subcategory),
                        brand_name = COALESCE($4, brand_name),
                        pareto_status = COALESCE($5, pareto_status),
                        mrp = COALESCE($6, mrp),
                        mop = COALESCE($7, mop),
                        is_competitor = $8,
                        sku_code = COALESCE($9, sku_code),
                        wattage = COALESCE($10, wattage),
                        capacity = COALESCE($11, capacity),
                        last_synced_at = NOW()
                    WHERE id = $12
                `, [
                    params[2], params[5], params[6], params[7], params[8],
                    params[9], params[10], params[11], params[12], params[13],
                    params[14], existing.id,
                ]);
                updated++;
            } else {
                await pgClient.query(`
                    INSERT INTO masters.products (
                        company_id, product_external_id, product_name, description, platform,
                        category, subcategory, brand_name, pareto_status,
                        mrp, mop, is_competitor, sku_code, wattage, capacity
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                `, params);
                inserted++;
            }
        }

        await pgClient.query('COMMIT');
    } catch (error) {
        await pgClient.query('ROLLBACK');
        throw error;
    } finally {
        pgClient.release();
        await mysqlConn.end();
        await pgPool.end();
    }

    console.log(`Master sync complete. Inserted: ${inserted}, Updated: ${updated}`);
}

main().catch(error => {
    console.error('Fatal:', error.message);
    process.exit(1);
});
