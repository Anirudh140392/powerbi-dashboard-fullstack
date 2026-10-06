const { createClient } = require('@clickhouse/client');
const client = createClient({
    url: 'http://localhost:8123',
    username: 'default',
    password: '',
    database: 'prestige'
});
async function run() {
    try {
        const res = await client.query({
            query: `
                SELECT 
                    star_distribution,
                    JSONExtractInt(star_distribution, '1') AS s1,
                    JSONExtractInt(star_distribution, '2') AS s2
                FROM product_snapshots 
                WHERE star_distribution != '' AND star_distribution != '{}' 
                LIMIT 5
            `,
            format: 'JSONEachRow'
        });
        const rows = await res.json();
        console.log(rows);
    } catch (e) {
        console.error(e);
    }
}
run();
