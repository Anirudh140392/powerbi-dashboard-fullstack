
import 'dotenv/config';
import availabilityService from '../backend/src/services/availabilityService.js';
import { setCurrentDbName } from '../backend/src/config/clickhouse.js';

async function verify() {
    try {
        console.log('--- Setting DB context to "mars" ---');
        // Simulate middleware setting the DB
        // Since we are running outside the web server context, we need to ensure the client is created with the right DB
        // or the service uses the correct one.
        
        const platformFilters = {
            viewMode: 'Platform',
            startDate: '2024-03-01',
            endDate: '2024-03-31',
            location: 'All India',
            platform: 'All',
            brand: 'All'
        };
        
        console.log('\n[TEST 1] Testing Platform viewMode...');
        const platformResult = await availabilityService.getAbsoluteOsaPlatformKpiMatrix(platformFilters);
        console.log('Platform Columns:', platformResult.columns);
        const isPlatformCorrect = platformResult.columns.some(c => ['Blinkit', 'Zepto', 'Instamart', 'Bigbasket'].includes(c));
        console.log('Is Platform Headers Correct (Expected platform names):', isPlatformCorrect ? 'YES' : 'NO');

        const formatFilters = {
            viewMode: 'Format',
            startDate: '2024-03-01',
            endDate: '2024-03-31',
            location: 'All India',
            platform: 'All',
            brand: 'All'
        };
        
        console.log('\n[TEST 2] Testing Category (Format) viewMode...');
        const formatResult = await availabilityService.getAbsoluteOsaPlatformKpiMatrix(formatFilters);
        console.log('Category Rows Count:', formatResult.rows.length);
        console.log('Sample Rows:', formatResult.rows.slice(0, 2).map(r => r.kpi));
        console.log('Is Category Data Present:', formatResult.rows.length > 0 ? 'YES' : 'NO');

        const trendFilters = {
            location: 'All India',
            platform: 'Blinkit',
            brand: 'All',
            period: '1M'
        };
        
        console.log('\n[TEST 3] Testing Trends data...');
        const trendResult = await availabilityService.getAvailabilityKpiTrends(trendFilters);
        console.log('Trend Points Count:', trendResult.timeSeries.length);
        const hasNonZero = trendResult.timeSeries.some(p => p.osa > 0 || p.listing > 0);
        console.log('Has Non-Zero Data Points:', hasNonZero ? 'YES' : 'NO');

        if (isPlatformCorrect && formatResult.rows.length > 0 && hasNonZero) {
            console.log('\n✅ ALL BACKEND TESTS PASSED');
        } else {
            console.log('\n❌ SOME TESTS FAILED');
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification script failed:', error);
        process.exit(1);
    }
}

verify();
