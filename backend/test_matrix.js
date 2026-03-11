import visibilityService from './src/services/visibilityService.js';
import dayjs from 'dayjs';

async function testMatrix() {
    try {
<<<<<<< HEAD
        const query = `
            SELECT 
                platform_name as name,
                ROUND(countIf(toString(keyword_is_rb_product) = '1') * 100.0 / nullIf(count(), 0), 1) AS overall_sos,
                ROUND(countIf(toString(keyword_is_rb_product) = '1' AND toString(spons_flag) = '1') * 100.0 / nullIf(count(), 0), 1) AS sponsored_sos,
                ROUND(countIf(toString(keyword_is_rb_product) = '1' AND toString(spons_flag) != '1') * 100.0 / nullIf(count(), 0), 1) AS organic_sos,
                ROUND(countIf(toString(keyword_is_rb_product) = '1' AND (toDate(created_on) < '2025-01-01' OR spons_flag = '1')) * 100.0 / nullIf(count(), 0), 1) AS display_sos
            FROM rb_kw_olap
            WHERE toDate(created_on) BETWEEN '2024-01-01' AND '2025-12-31' AND keyword_search_rank < 11 AND platform_name IS NOT NULL AND platform_name != ''
            GROUP BY platform_name
            ORDER BY count() DESC
            LIMIT 15
        `;
        const resultSet = await client.query({ query, format: 'JSONEachRow' });
        const data = await resultSet.json();
        console.log("Data:", data);
    } catch (e) {
        console.error(e);
=======
        const filters = {
            startDate: dayjs().subtract(7, 'days').format('YYYY-MM-DD'),
            endDate: dayjs().format('YYYY-MM-DD')
        };
        console.log('Testing getPlatformKpiMatrix with filters:', filters);
        const result = await visibilityService.getPlatformKpiMatrix(filters);

        // Let's see if it returned the mock data
        if (result && result.platformData && result.platformData.rows) {
            const hasAmazon = result.platformData.rows.some(r => Object.keys(r).includes('AMAZON'));
            console.log('Returned rows:', result.platformData.rows.length);
            console.log('Contains Amazon?', hasAmazon);
            console.log('Are we returning mock data? ->', hasAmazon ? 'YES' : 'NO');
        } else {
            console.log('Invalid response structure:', result);
        }
    } catch (err) {
        console.error('Fatal Error calling getPlatformKpiMatrix:', err);
>>>>>>> 12b95b029b97e6a6715cc889706176291c8f96e8
    }
    process.exit(0);
}

testMatrix();
