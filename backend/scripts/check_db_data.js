import dotenv from 'dotenv';
dotenv.config();


const { default: sequelize } = await import('./src/config/db.js');

async function checkData() {
    try {
        const dateFrom = '2025-12-01';
        const dateTo = '2025-12-31';
        const platform = 'Amazon';

        console.log(`--- Checking rows for ${platform} between ${dateFrom} and ${dateTo} ---`);
        const results = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM rb_kw 
      WHERE platform_name = :platform 
        AND kw_crawl_date BETWEEN :dateFrom AND :dateTo
    `, {
            replacements: { platform, dateFrom, dateTo },
            type: sequelize.QueryTypes.SELECT
        });

        console.log('Query results:', JSON.stringify(results));
        const count = results[0] ? results[0].count : 0;
        console.log('Count:', count);

        if (count > 0) {
            console.log('\n--- Checking brands for this range ---');
            const brands = await sequelize.query(`
        SELECT brand_name, COUNT(*) as impressions
        FROM rb_kw 
        WHERE platform_name = :platform 
          AND kw_crawl_date BETWEEN :dateFrom AND :dateTo
          AND brand_name IS NOT NULL AND brand_name != ''
        GROUP BY brand_name
        ORDER BY impressions DESC
        LIMIT 5
      `, {
                replacements: { platform, dateFrom, dateTo },
                type: sequelize.QueryTypes.SELECT
            });
            console.log('Top Brands:', brands);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkData();
