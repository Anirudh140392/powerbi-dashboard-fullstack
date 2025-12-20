// Check locations in database
import 'dotenv/config';
import RcaSkuDim from './src/models/RcaSkuDim.js';
import { Sequelize } from 'sequelize';

async function checkLocations() {
    try {
        const locations = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('location')), 'location']],
            where: {
                location: { [Sequelize.Op.ne]: null }
            },
            order: [['location', 'ASC']],
            raw: true
        });

        console.log('\n=== LOCATIONS IN DATABASE ===');
        console.log('Total distinct locations:', locations.length);
        console.log('\nLocation list:');
        locations.forEach((l, i) => {
            console.log(`${i + 1}. "${l.location}"`);
        });
        console.log('\n=============================\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkLocations();
