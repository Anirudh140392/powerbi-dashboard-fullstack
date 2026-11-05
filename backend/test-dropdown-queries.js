import RbPdpOlap from './src/models/RbPdpOlap.js';
import RcaSkuDim from './src/models/RcaSkuDim.js';
import { Sequelize } from 'sequelize';
import sequelize from './src/config/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function testQueries() {
    try {
        console.log('🔍 Testing Dropdown Queries\n');

        // Test 1: Check if Comp_flag column exists
        console.log('=== Test 1: Check Comp_flag ===');
        const sample = await RbPdpOlap.findOne({ raw: true });
        console.log('Sample row columns:', Object.keys(sample || {}));
        console.log('Has Comp_flag?', sample && 'Comp_flag' in sample);
        console.log();

        // Test 2: Get brands WITHOUT Comp_flag filter for Zepto
        console.log('=== Test 2: Brands (No Filter) for Zepto ===');
        const brandsNoFilter = await RbPdpOlap.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Brand')), 'brand']],
            where: {
                Platform: sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Platform')),
                    'zepto'
                )
            },
            limit: 10,
            raw: true
        });
        console.log('Found brands:', brandsNoFilter.map(b => b.brand));
        console.log();

        // Test 3: Get brands WITH Comp_flag = 0
        console.log('=== Test 3: Brands (Comp_flag=0) for Zepto ===');
        const brandsWithFlag = await RbPdpOlap.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Brand')), 'brand']],
            where: {
                Comp_flag: 0,
                Platform: sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Platform')),
                    'zepto'
                )
            },
            limit: 10,
            raw: true
        });
        console.log('Found brands with Comp_flag:', brandsWithFlag.map(b => b.brand));
        console.log();

        // Test 4: Get locations from RbPdpOlap
        console.log('=== Test 4: Locations from RbPdpOlap ===');
        const locationsFromPdp = await RbPdpOlap.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Location')), 'location']],
            where: {
                Platform: sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('Platform')),
                    'zepto'
                )
            },
            limit: 10,
            raw: true
        });
        console.log('Found locations:', locationsFromPdp.map(l => l.location));
        console.log();

        // Test 5: Check RcaSkuDim table
        console.log('=== Test 5: Check RcaSkuDim ===');
        const rcaSample = await RcaSkuDim.findOne({ raw: true });
        console.log('RcaSkuDim sample columns:', Object.keys(rcaSample || {}));
        console.log();

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testQueries();
