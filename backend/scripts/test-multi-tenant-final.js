import { queryClickHouse } from '../src/config/clickhouse.js';

// Mocking helper to test logic
const getColumnMapping = (dbName) => {
    const mapping = {
        rca_sku_dim: {
            category: (dbName === 'colpal' || dbName === 'gcpl') ? 'Category' : 'category'
        },
        rb_sku_platform: {
            brand_name: (dbName === 'mars') ? 'brand' : 'brand_name',
            brand_category: (dbName === 'mars') ? 'product_category' : (dbName === 'zydus' ? 'category' : 'brand_category')
        }
    };
    return mapping;
};

async function testSchema(dbName) {
    console.log(`\n>>> Testing for DB: ${dbName} <<<`);
    const colMap = getColumnMapping(dbName);
    
    // Test rca_sku_dim column
    const rcaCategoryCol = colMap.rca_sku_dim.category;
    try {
        const query = `SELECT count(${rcaCategoryCol}) as counts FROM ${dbName}.rca_sku_dim`;
        const res = await queryClickHouse(query);
        console.log(`[SUCCESS] ${dbName}.rca_sku_dim.${rcaCategoryCol} exists. Counts: ${res[0].counts}`);
    } catch (e) {
        console.error(`[FAILURE] ${dbName}.rca_sku_dim.${rcaCategoryCol} error:`, e.message);
    }
    
    // Test rb_sku_platform columns
    const brCol = colMap.rb_sku_platform.brand_name;
    const catCol = colMap.rb_sku_platform.brand_category;
    try {
        const query = `SELECT count(${brCol}) as br_counts, count(${catCol}) as cat_counts FROM ${dbName}.rb_sku_platform`;
        const res = await queryClickHouse(query);
        console.log(`[SUCCESS] ${dbName}.rb_sku_platform columns exist. Brand Counts: ${res[0].br_counts}, Cat Counts: ${res[0].cat_counts}`);
    } catch (e) {
        console.error(`[FAILURE] ${dbName}.rb_sku_platform error:`, e.message);
    }
}

async function run() {
    await testSchema('colpal');
    await testSchema('mars');
    await testSchema('gcpl');
    await testSchema('zydus');
    process.exit(0);
}

run();
