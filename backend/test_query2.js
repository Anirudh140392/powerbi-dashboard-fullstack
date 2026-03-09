import { createClient } from '@clickhouse/client';
import dayjs from 'dayjs';

(async () => {
    const client = createClient({
        url: 'http://13.200.55.131:8123',
        username: 'readonly_user',
        password: 'Readonly@123',
        database: 'mars'
    });

    try {
        const endDate = dayjs('2026-03-09');
        const startDate = endDate.subtract(30, 'days');

        console.log('--- TESTING SOS QUERIES ---');

        // 1. Overall Deno
        const denoResult = await client.query({
            query: `SELECT COUNT(*) AS overall_deno FROM rb_kw WHERE keyword_search_rank < 11 AND toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}'`,
            format: 'JSONEachRow'
        });
        const denoRows = await denoResult.json();
        const deno = denoRows[0].overall_deno;
        console.log('Overall Deno:', deno);

        // 2. Brand Neno
        const nenoResult = await client.query({
            query: `SELECT brand_name_th, COUNT(*) AS overall_neno FROM rb_kw WHERE keyword_search_rank < 11 AND toDate(created_on) BETWEEN '${startDate.format('YYYY-MM-DD')}' AND '${endDate.format('YYYY-MM-DD')}' GROUP BY brand_name_th ORDER BY overall_neno DESC LIMIT 5`,
            format: 'JSONEachRow'
        });
        const nenoRows = await nenoResult.json();
        console.log('Top 5 Brands Neno:');
        nenoRows.forEach(r => {
            const sos = (r.overall_neno / deno * 100).toFixed(2);
            console.log(`${r.brand_name_th}: ${r.overall_neno} (SOS: ${sos}%)`);
        });

    } catch (e) {
        console.error(e);
    }
})();
