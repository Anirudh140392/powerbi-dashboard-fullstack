
import { createClient } from '@clickhouse/client';

const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'mars',
});

async function runCheck() {
    try {
        console.log('Checking brand_name_th for flag=1 rows...');
        const res = await client.query({
            query: "SELECT DISTINCT brand_name_th FROM rb_kw_olap WHERE flag = '1' LIMIT 20",
            format: 'JSONEachRow',
        });
        const data = await res.json();
        console.log('Distinct brands for flag=1:', JSON.stringify(data, null, 2));

        console.log('\nChecking some generic keywords for flag=1...');
        const res2 = await client.query({
            query: "SELECT keyword, keyword_type, brand_name_th FROM rb_kw_olap WHERE flag = '1' AND keyword_type = 'Generic' LIMIT 5",
            format: 'JSONEachRow',
        });
        const data2 = await res2.json();
        console.log('Generic keywords with flag=1:', JSON.stringify(data2, null, 2));

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        await client.close();
    }
}

runCheck();
