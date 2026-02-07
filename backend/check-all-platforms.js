// Check platforms across all tables
import 'dotenv/config';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import RcaSkuDim from './src/models/RcaSkuDim.js';
import { Sequelize } from 'sequelize';

async function checkAllPlatforms() {
    try {
        console.log('\n=== CHECKING PLATFORMS ACROSS TABLES ===\n');

        // Check rb_pdp_olap
        const rbPdpPlatforms = await RbPdpOlap.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Platform')), 'platform']],
            where: {
                Platform: { [Sequelize.Op.ne]: null }
            },
            raw: true
        });

        console.log('1. rb_pdp_olap table:');
        console.log(`   Total distinct platforms: ${rbPdpPlatforms.length}`);
        rbPdpPlatforms.forEach((p, i) => {
            console.log(`   ${i + 1}. "${p.platform}"`);
        });

        // Check rcasku_dim
        const rcaSkuPlatforms = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('platform')), 'platform']],
            where: {
                platform: { [Sequelize.Op.ne]: null }
            },
            raw: true
        });

        console.log('\n2. rcasku_dim table:');
        console.log(`   Total distinct platforms: ${rcaSkuPlatforms.length}`);
        rcaSkuPlatforms.forEach((p, i) => {
            console.log(`   ${i + 1}. "${p.platform}"`);
        });

        console.log('\n=========================================\n');
        console.log('RECOMMENDATION: Use rb_pdp_olap table for platforms');
        console.log('as it contains the actual transaction data.\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAllPlatforms();
