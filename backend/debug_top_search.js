
import { createClient } from '@clickhouse/client';

const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'mars',
});

async function runDebug() {
    try {
        console.log('Checking MAX(DATE) in rb_kw_olap...');
        const maxDateRes = await client.query({
            query: 'SELECT MAX(DATE) as maxDate FROM rb_kw_olap',
            format: 'JSONEachRow',
        });
        const maxDateData = await maxDateRes.json();
        const maxDate = maxDateData[0].maxDate;
        console.log('MAX(DATE):', maxDate);

        const EXCLUDED_LOCATIONS = "'Nation', 'National', 'All India', 'Total', 'India', 'nation', 'national', 'all india'";
        const locationFilter = `AND location_name NOT IN (${EXCLUDED_LOCATIONS})`;

        const runTest = async (filterName, typeFilter) => {
            console.log(`\n--- Testing Filter: ${filterName} ---`);
            const query = `
                SELECT 
                    keyword,
                    MAX(keyword_type) as type,
                    sumIf(toInt32(overall), flag = '1') as rb_overall,
                    sum(toInt32(overall)) as total_overall
                FROM rb_kw_olap
                WHERE DATE = '${maxDate}' AND POSITION < 11
                  ${locationFilter}
                  ${typeFilter}
                GROUP BY keyword
                HAVING sumIf(toInt32(overall), flag = '1') > 0
                ORDER BY total_overall DESC
                LIMIT 5
            `;
            const resultSet = await client.query({ query, format: 'JSONEachRow' });
            const data = await resultSet.json();
            console.log(`Results count for ${filterName}:`, data.length);
            if (data.length > 0) {
                console.log(`Sample:`, data[0].keyword, 'Type:', data[0].type, 'RB Vol:', data[0].rb_overall);
            }
        };

        await runTest('All (No Type Filter)', "");
        await runTest('Branded', "AND keyword_type = 'Branded'");

    } catch (error) {
        console.error('Query failed:', error);
    } finally {
        await client.close();
    }
}

runDebug();
