import dotenv from 'dotenv';
dotenv.config();
import { connectClickHouse, queryClickHouse } from './src/config/clickhouse.js';
import availabilityService from './src/services/availabilityService.js';

async function test() {
    try {
        await connectClickHouse();
        
        console.log('Querying distinct platforms/categories/brands with data...');
        const samples = await queryClickHouse(`
            SELECT Platform, Category, Brand 
            FROM rb_pdp_olap 
            WHERE deno_osa > 0 AND Qty_Sold > 0
            LIMIT 5
        `);
        console.log('Samples:', samples);

        if (samples.length === 0) {
            console.log('No samples found with deno_osa > 0 and Qty_Sold > 0');
            process.exit(0);
        }

        const filter = {
            platform: samples[0].Platform,
            category: samples[0].Category,
            brand: samples[0].Brand,
            period: '1M',
            timeStep: 'Daily'
        };
        console.log('Using filter:', filter);

        console.log('Testing getAvailabilityCompetitionBrandTrends on Daily timeStep...');
        const brandTrends = await availabilityService.getAvailabilityCompetitionBrandTrends(filter);

        const brandNames = Object.keys(brandTrends.doi || {});
        console.log('Brands found:', brandNames);
        if (brandNames.length > 0) {
            const firstBrand = brandNames[0];
            const doiTrend = brandTrends.doi[firstBrand];
            console.log(`DOI daily trends for ${firstBrand} (first 10 elements):`, doiTrend.slice(0, 10));
        }

        console.log('\nTesting getAvailabilityCompetitionSkuTrends on Daily timeStep...');
        const skuTrends = await availabilityService.getAvailabilityCompetitionSkuTrends(filter);

        const skuNames = Object.keys(skuTrends.doi || {});
        console.log('SKUs found:', skuNames);
        if (skuNames.length > 0) {
            const firstSku = skuNames[0];
            const doiTrend = skuTrends.doi[firstSku];
            console.log(`DOI daily trends for ${firstSku} (first 10 elements):`, doiTrend.slice(0, 10));
        }

    } catch (err) {
        console.error('Error during test:', err);
    }
    process.exit(0);
}

test();
