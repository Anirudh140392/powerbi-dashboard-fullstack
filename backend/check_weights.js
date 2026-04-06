import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function checkWeights() {
    try {
        const query = `
            SELECT 
                Brand, 
                Product, 
                Weight,
                toInt64OrZero(extract(toString(Weight), '^[0-9.]+')) as weight_val,
                count(*) as cnt
            FROM rb_pdp_olap
            WHERE DATE >= '2026-03-01'
            GROUP BY Brand, Product, Weight
            ORDER BY cnt DESC
            LIMIT 20
        `;
        const results = await queryClickHouse(query);
        console.log('Sample Weights:', JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

checkWeights();
