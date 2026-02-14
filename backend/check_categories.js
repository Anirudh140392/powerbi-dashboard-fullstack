
import { clickhouse } from './src/config/clickhouse.js';

const checkCategories = async () => {
    try {
        console.log('--- checking categories ---');
        const rcaResult = await clickhouse.query('SELECT DISTINCT category FROM rca_sku_dim WHERE category IS NOT NULL ORDER BY category').toPromise();
        console.log('RCA Categories:', JSON.stringify(rcaResult.map(r => r.category)));

        const olapResult = await clickhouse.query('SELECT DISTINCT Category FROM rb_pdp_olap WHERE Category IS NOT NULL ORDER BY Category').toPromise();
        console.log('OLAP Categories:', JSON.stringify(olapResult.map(r => r.Category)));
    } catch (error) {
        console.error('Error:', error);
    }
};

checkCategories();
