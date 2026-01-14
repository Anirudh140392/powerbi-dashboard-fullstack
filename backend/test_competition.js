import dotenv from 'dotenv';
dotenv.config();

const { default: sequelize } = await import('./src/config/db.js');
import dayjs from 'dayjs';

// Copy the exact logic from getVisibilityCompetition in visibilityService.js
async function testCompetitionQuery() {
    try {
        console.log('===== Testing getVisibilityCompetition logic =====');

        // Step 1: Get max date
        const [maxDateResult] = await sequelize.query(`
      SELECT MAX(kw_crawl_date) as maxDate FROM rb_kw WHERE kw_crawl_date IS NOT NULL
    `, { type: sequelize.QueryTypes.SELECT });

        console.log('Step 1 - Max date result:', maxDateResult);

        if (!maxDateResult?.maxDate) {
            console.log('No data found!');
            return;
        }

        const latestDate = dayjs(maxDateResult.maxDate);
        console.log('Step 2 - Latest date:', latestDate.format('YYYY-MM-DD'));

        // Step 3: Calculate date range
        const period = '1M';
        const days = 30;
        const currentEnd = latestDate;
        const currentStart = currentEnd.subtract(days, 'day');

        const currentReplacements = {
            dateFrom: currentStart.format('YYYY-MM-DD'),
            dateTo: currentEnd.format('YYYY-MM-DD')
        };
        console.log('Step 3 - Date range:', currentReplacements);

        // Step 4: Get total volume
        const totalQuery = `
      SELECT COUNT(*) as total FROM rb_kw
      WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
        AND 1=1
        AND 1=1
    `;
        console.log('Step 4 - Executing total volume query...');
        const totalResult = await sequelize.query(totalQuery, {
            replacements: currentReplacements,
            type: sequelize.QueryTypes.SELECT
        });
        console.log('Total volume result:', totalResult);

        const currentVolume = Number(totalResult[0]?.total) || 1;
        console.log('Current volume:', currentVolume);

        // Step 5: Get brands
        const brandQuery = `
      SELECT 
        brand_name,
        ROUND(COUNT(*) * 100.0 / ${currentVolume}, 2) AS overall_sos,
        ROUND(SUM(CASE WHEN spons_flag = 1 THEN 1 ELSE 0 END) * 100.0 / ${currentVolume}, 2) AS sponsored_sos,
        ROUND(SUM(CASE WHEN (spons_flag = 0 OR spons_flag IS NULL) THEN 1 ELSE 0 END) * 100.0 / ${currentVolume}, 2) AS organic_sos,
        COUNT(*) as impressions
      FROM rb_kw
      WHERE kw_crawl_date BETWEEN :dateFrom AND :dateTo
        AND 1=1
        AND 1=1
        AND brand_name IS NOT NULL AND brand_name != ''
      GROUP BY brand_name
      ORDER BY impressions DESC
      LIMIT 20
    `;
        console.log('Step 5 - Executing brand query...');
        const brands = await sequelize.query(brandQuery, {
            replacements: currentReplacements,
            type: sequelize.QueryTypes.SELECT
        });
        console.log('Brands found:', brands.length);
        console.log('First 5 brands:', brands.slice(0, 5));

        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

testCompetitionQuery();
