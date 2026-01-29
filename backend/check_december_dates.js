import { Sequelize } from 'sequelize';
import sequelize from './src/config/db.js';

async function checkDatesInDatabase() {
    try {
        // Check what dates exist for Detergent category in December
        const query = `
            SELECT 
                DATE(date) as date_only,
                keyword_category,
                COUNT(*) as record_count,
                SUM(impressions) as total_impressions,
                SUM(spend) as total_spend
            FROM tb_zepto_pm_keyword_rca
            WHERE LOWER(keyword_category) = 'detergent'
            AND DATE(date) >= '2024-12-25'
            AND DATE(date) <= '2024-12-31'
            GROUP BY DATE(date), keyword_category
            ORDER BY DATE(date);
        `;

        const results = await sequelize.query(query, {
            type: Sequelize.QueryTypes.SELECT
        });

        console.log('\n📊 Detergent data in December 25-31:');
        console.log('=====================================');

        if (results.length === 0) {
            console.log('❌ NO DATA FOUND for Detergent in this date range!');
        } else {
            results.forEach(row => {
                console.log(`📅 ${row.date_only}: ${row.record_count} records, Impressions: ${row.total_impressions}, Spend: ${row.total_spend}`);
            });
        }

        // Check all categories in December
        const allCatsQuery = `
            SELECT 
                keyword_category,
                DATE(date) as date_only,
                COUNT(*) as record_count
            FROM tb_zepto_pm_keyword_rca
            WHERE LOWER(keyword_category) IN ('bath & body', 'detergent', 'hair care', 'fragrance & talc')
            AND DATE(date) >= '2024-12-25'
            AND DATE(date) <= '2024-12-31'
            GROUP BY keyword_category, DATE(date)
            ORDER BY keyword_category, DATE(date);
        `;

        const allResults = await sequelize.query(allCatsQuery, {
            type: Sequelize.QueryTypes.SELECT
        });

        console.log('\n📊 All categories data in December 25-31:');
        console.log('==========================================');

        const grouped = {};
        allResults.forEach(row => {
            if (!grouped[row.keyword_category]) {
                grouped[row.keyword_category] = [];
            }
            grouped[row.keyword_category].push(row.date_only);
        });

        Object.entries(grouped).forEach(([category, dates]) => {
            console.log(`\n${category}:`);
            console.log(`  Dates with data: ${dates.join(', ')}`);

            // Check for missing dates
            const allDates = [];
            for (let day = 25; day <= 31; day++) {
                allDates.push(`2024-12-${day.toString().padStart(2, '0')}`);
            }
            const missingDates = allDates.filter(d => !dates.includes(d));
            if (missingDates.length > 0) {
                console.log(`  ❌ Missing dates: ${missingDates.join(', ')}`);
            }
        });

        await sequelize.close();
        process.exit(0);

    } catch (error) {
        console.error('Error checking database:', error);
        process.exit(1);
    }
}

checkDatesInDatabase();
