import RbPdpOlap from './src/models/RbPdpOlap.js';
import { Op, Sequelize } from 'sequelize';
import sequelize from './src/config/db.js';
import dayjs from 'dayjs';

async function debugBlinkitOfftake() {
    try {
        console.log("=== Debugging Blinkit Offtake (01 Oct 25 - 10 Dec 25) ===\n");

        const startDate = dayjs('2025-10-01').startOf('day').toDate();
        const endDate = dayjs('2025-12-10').endOf('day').toDate();

        console.log("Date Range:", startDate, "to", endDate);
        console.log("");

        // 1. Check if there's ANY data for Blinkit in rb_pdp_olap
        console.log("1. Checking for ANY Blinkit data in rb_pdp_olap...");
        const blinkitCount = await RbPdpOlap.count({
            where: {
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), 'blinkit')
            }
        });
        console.log(`   Total Blinkit records: ${blinkitCount}`);

        if (blinkitCount === 0) {
            console.log("\n❌ NO BLINKIT DATA FOUND in rb_pdp_olap table!");

            // Check what platforms exist
            const platforms = await RbPdpOlap.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Platform')), 'platform']],
                raw: true
            });
            console.log("\nAvailable platforms in rb_pdp_olap:");
            platforms.forEach(p => console.log(`   - ${p.platform}`));

            process.exit(0);
        }

        // 2. Check Blinkit data in the specific date range
        console.log("\n2. Checking Blinkit data in date range (01 Oct 25 - 10 Dec 25)...");
        const blinkitInRangeCount = await RbPdpOlap.count({
            where: {
                DATE: { [Op.between]: [startDate, endDate] },
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), 'blinkit')
            }
        });
        console.log(`   Blinkit records in date range: ${blinkitInRangeCount}`);

        if (blinkitInRangeCount === 0) {
            console.log("\n❌ NO BLINKIT DATA in this date range!");

            // Check what date ranges exist for Blinkit
            const dateRange = await RbPdpOlap.findOne({
                attributes: [
                    [Sequelize.fn('MIN', Sequelize.col('DATE')), 'min_date'],
                    [Sequelize.fn('MAX', Sequelize.col('DATE')), 'max_date']
                ],
                where: {
                    Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), 'blinkit')
                },
                raw: true
            });
            console.log("\nBlinkit date range in rb_pdp_olap:");
            console.log(`   Min Date: ${dateRange.min_date}`);
            console.log(`   Max Date: ${dateRange.max_date}`);

            process.exit(0);
        }

        // 3. Calculate the actual offtake with exact query
        console.log("\n3. Calculating Offtake (SUM of Sales)...");
        const offtakeResult = await RbPdpOlap.findOne({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
                [Sequelize.fn('MIN', Sequelize.col('Sales')), 'min_sales'],
                [Sequelize.fn('MAX', Sequelize.col('Sales')), 'max_sales'],
                [Sequelize.fn('AVG', Sequelize.col('Sales')), 'avg_sales']
            ],
            where: {
                DATE: { [Op.between]: [startDate, endDate] },
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), 'blinkit')
            },
            raw: true
        });

        console.log(`   Total Offtake: ₹${(offtakeResult.total_sales || 0).toLocaleString('en-IN')}`);
        console.log(`   Record Count: ${offtakeResult.count}`);
        console.log(`   Min Sales: ₹${(offtakeResult.min_sales || 0).toLocaleString('en-IN')}`);
        console.log(`   Max Sales: ₹${(offtakeResult.max_sales || 0).toLocaleString('en-IN')}`);
        console.log(`   Avg Sales: ₹${(offtakeResult.avg_sales || 0).toLocaleString('en-IN')}`);

        // 4. Check sample records
        console.log("\n4. Sample Blinkit records in date range (first 5):");
        const samples = await RbPdpOlap.findAll({
            attributes: ['DATE', 'Brand', 'Platform', 'Location', 'Product', 'Sales'],
            where: {
                DATE: { [Op.between]: [startDate, endDate] },
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), 'blinkit')
            },
            limit: 5,
            raw: true
        });

        samples.forEach((s, i) => {
            console.log(`   ${i + 1}. Date: ${s.DATE}, Brand: ${s.Brand}, Sales: ₹${s.Sales}, Product: ${s.Product?.substring(0, 30)}`);
        });

        // 5. Check breakdown by month
        console.log("\n5. Monthly breakdown:");
        const monthlyData = await RbPdpOlap.findAll({
            attributes: [
                [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m'), 'month'],
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
            ],
            where: {
                DATE: { [Op.between]: [startDate, endDate] },
                Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), 'blinkit')
            },
            group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m')],
            order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('DATE'), '%Y-%m'), 'ASC']],
            raw: true
        });

        monthlyData.forEach(m => {
            console.log(`   ${m.month}: ₹${(m.total_sales || 0).toLocaleString('en-IN')} (${m.count} records)`);
        });

        console.log("\n✅ Debug complete!");
        process.exit(0);

    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

debugBlinkitOfftake();
