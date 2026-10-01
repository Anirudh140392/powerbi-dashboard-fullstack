import { createClient } from '@clickhouse/client';
import 'dotenv/config';

const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'mars',
});

async function inspectData() {
    try {
        console.log('Checking rb_pdp_olap table...');

        const countRes = await client.query({
            query: 'SELECT count() as count FROM rb_pdp_olap',
            format: 'JSONEachRow'
        });
        const count = await countRes.json();
        console.log('Total rows in rb_pdp_olap:', count[0].count);

        const dateRes = await client.query({
            query: 'SELECT min(DATE) as min_date, max(DATE) as max_date FROM rb_pdp_olap',
            format: 'JSONEachRow'
        });
        const dates = await dateRes.json();
        console.log('Date range:', dates[0].min_date, 'to', dates[0].max_date);

        const activeOsaRes = await client.query({
            query: 'SELECT count() as count FROM rb_pdp_olap WHERE toInt64(deno_osa) > 0',
            format: 'JSONEachRow'
        });
        const activeOsa = await activeOsaRes.json();
        console.log('Rows with deno_osa > 0:', activeOsa[0].count);

        const osaChangeRes = await client.query({
            query: "SELECT Web_Pid, min(DATE) as min_d, max(DATE) as max_d, sum(toInt64(neno_osa)) as total_neno, sum(toInt64(deno_osa)) as total_deno FROM rb_pdp_olap GROUP BY Web_Pid HAVING total_deno > 0 LIMIT 5",
            format: 'JSONEachRow'
        });
        const osaChanges = await osaChangeRes.json();
        console.log('SKUs with some OSA data:', JSON.stringify(osaChanges, null, 2));

        const compFlagRes = await client.query({
            query: 'SELECT Comp_flag, count() as count FROM rb_pdp_olap GROUP BY Comp_flag',
            format: 'JSONEachRow'
        });
        const compFlags = await compFlagRes.json();
        console.log('Comp_flag distribution:', compFlags);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

inspectData();
