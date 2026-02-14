
import dotenv from 'dotenv';
dotenv.config();
import { Sequelize, Op } from 'sequelize';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import RbBrandMs from './src/models/RbBrandMs.js';
import RbKw from './src/models/RbKw.js';

async function verifyCleaningEssentials() {
    try {
        const category = 'Cleaning Essentials';
        const platform = 'Zepto'; // Assuming Zepto as per previous context

        console.log(`Verifying data for Category: ${category}, Platform: ${platform}`);

        // 1. Fetch Aggregated Metrics from RbPdpOlap
        const metrics = await RbPdpOlap.findOne({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('Sales')), 'total_sales'],
                [Sequelize.fn('SUM', Sequelize.col('Ad_Spend')), 'total_spend'],
                [Sequelize.fn('SUM', Sequelize.col('Ad_sales')), 'total_ad_sales'],
                [Sequelize.fn('SUM', Sequelize.col('Ad_Clicks')), 'total_clicks'],
                [Sequelize.fn('SUM', Sequelize.col('Ad_Impressions')), 'total_impressions']
            ],
            where: {
                Category: category,
                Platform: platform
            },
            raw: true
        });

        console.log("Raw Metrics (RbPdpOlap):", metrics);

        const totalSales = parseFloat(metrics.total_sales || 0);
        const totalSpend = parseFloat(metrics.total_spend || 0);
        const totalAdSales = parseFloat(metrics.total_ad_sales || 0);
        const totalClicks = parseFloat(metrics.total_clicks || 0);
        const totalImpressions = parseFloat(metrics.total_impressions || 0);

        // Calculate Derived Metrics
        const roas = totalSpend > 0 ? totalAdSales / totalSpend : 0;
        const conversion = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
        const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

        console.log("Calculated Metrics:");
        console.log(`Offtake: ${totalSales}`);
        console.log(`Spend: ${totalSpend}`);
        console.log(`ROAS: ${roas.toFixed(2)}x`);
        console.log(`Inorganic Sales: ${totalAdSales}`);
        console.log(`Conversion: ${conversion.toFixed(1)}%`);
        console.log(`CPM: ${cpm.toFixed(0)}`);
        console.log(`CPC: ${cpc.toFixed(0)}`);

        // 2. SOS Check (Case Insensitive)
        // Note: SOS logic involves comparing brand count vs total count.
        // For simplicity, checking total count for the category here.
        const sosCount = await RbKw.count({
            where: {
                keyword_category: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('keyword_category')), category.toLowerCase()),
                platform_name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('platform_name')), platform.toLowerCase())
            }
        });
        console.log(`SOS Total Records (RbKw): ${sosCount}`);

        // 3. Market Share Check
        const msData = await RbBrandMs.findOne({
            attributes: [[Sequelize.fn('AVG', Sequelize.col('market_share')), 'avg_ms']],
            where: {
                category: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('category')), category.toLowerCase()),
                Platform: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('Platform')), platform.toLowerCase())
            },
            raw: true
        });
        console.log("Market Share (RbBrandMs) for Zepto:", msData);

        // 3b. Check if ANY Market Share data exists for this category
        const anyMsData = await RbBrandMs.findAll({
            attributes: ['category', 'Platform', 'market_share'],
            where: {
                category: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('category')), category.toLowerCase())
            },
            limit: 5,
            raw: true
        });
        console.log("Any Market Share data for 'Cleaning Essentials':", anyMsData);

    } catch (error) {
        console.error("Error verifying data:", error);
    }
}

verifyCleaningEssentials();
