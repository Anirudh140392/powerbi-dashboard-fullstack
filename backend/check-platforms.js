// Quick script to check platforms in database
import 'dotenv/config';
import RcaSkuDim from './src/models/RcaSkuDim.js';
import { Sequelize } from 'sequelize';
import sequelize from './src/config/db.js';

async function checkPlatforms() {
    try {
        const platforms = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('platform')), 'platform']],
            where: {
                platform: { [Sequelize.Op.ne]: null }
            },
            raw: true
        });

        console.log('\n=== PLATFORMS IN DATABASE ===');
        console.log('Total distinct platforms:', platforms.length);
        console.log('\nPlatform list:');
        platforms.forEach((p, i) => {
            console.log(`${i + 1}. "${p.platform}"`);
        });
        console.log('\n============================\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkPlatforms();
