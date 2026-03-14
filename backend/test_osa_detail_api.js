import availabilityService from './src/services/availabilityService.js';
import dayjs from 'dayjs';

async function testOsaDetailFilterDirect() {
    try {
        console.log('Testing OSA Detail Service directly with ownBrandsOnly=true...');
        const filters = {
            ownBrandsOnly: 'true',
            startDate: '2026-03-10', // Narrow down dates to reduce data
            endDate: '2026-03-11'
        };

        const data = await availabilityService.getAbsoluteOsaPercentageDetail(filters);

        if (!Array.isArray(data)) {
            console.error('Invalid response format:', typeof data);
            return;
        }

        console.log(`Received ${data.length} records.`);
        
        // Get unique brands from the formatted results (formattedData has 'brand' property)
        // Wait, the service returns formattedData, which is an array of objects with 'brand'
        const brands = [...new Set(data.map(r => r.brand).filter(Boolean))];
        brands.sort();
        console.log('Unique Brands found in response:', brands);

        // Competitor brands identified from user screenshot
        const competitors = ['Cadbury', 'Amul', 'Mondelez', 'Britannia', 'Hershey', 'Nestle', 'Ferrero'];
        const foundCompetitors = brands.filter(b => {
            const lowerB = b.toLowerCase();
            return competitors.some(c => lowerB.includes(c.toLowerCase()));
        });

        if (foundCompetitors.length > 0) {
            console.error('FAIL: Found competitor-like brands in filtered results:', foundCompetitors);
        } else {
            console.log('SUCCESS: No known competitor brands found.');
        }

    } catch (error) {
        console.error('Error during test:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

testOsaDetailFilterDirect();
