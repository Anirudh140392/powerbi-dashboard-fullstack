const visibilityService = require('./src/services/visibilityService').default;
const dayjs = require('dayjs');

// Mock queryClickHouse to capture the SQL
const originalQuery = require('./src/config/clickHouse').queryClickHouse;
let capturedQueries = [];

require('./src/config/clickHouse').queryClickHouse = async (query, params) => {
    capturedQueries.push({ query, params });
    return []; // Return empty result
};

async function test_various_segments() {
    const filters = {
        startDate: '2024-03-01',
        endDate: '2024-03-07',
        channel: 'Ecommerce',
        platform: 'All',
        location: 'All',
        brand: 'All',
        category: 'All'
    };

    console.log('--- Testing SOS Gainers & Drainers (Ecommerce) ---');
    await visibilityService.getSOSGainersAndDrainers(filters);
    console.log('Query:', capturedQueries[capturedQueries.length - 1].query.replace(/\s+/g, ' ').substring(0, 500), '...');

    console.log('\n--- Testing Keywords At Glance (Ecommerce) ---');
    await visibilityService.getKeywordsAtGlance(filters);
    console.log('Query:', capturedQueries[capturedQueries.length - 1].query.replace(/\s+/g, ' ').substring(0, 500), '...');

    console.log('\n--- Testing Search Terms Performance (Ecommerce) ---');
    await visibilityService.getSearchTermsPerformance(filters);
    console.log('Query:', capturedQueries[capturedQueries.length - 1].query.replace(/\s+/g, ' ').substring(0, 500), '...');

    const qcFilters = { ...filters, channel: 'Quickcomm' };
    console.log('\n--- Testing Competition (Quickcomm) ---');
    await visibilityService.getVisibilityCompetition(qcFilters);
    // Find the query that matches the competition volume or main query
    const qcQuery = capturedQueries.find(q => q.query.includes('Quickcomm') || q.query.includes('Blinkit'));
    if (qcQuery) {
        console.log('QC Query found');
    } else {
        console.log('QC Query not found in captured queries');
    }
}

test_various_segments().catch(console.error);
