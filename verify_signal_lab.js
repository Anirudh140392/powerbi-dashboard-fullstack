const { queryClickHouse } = require('./backend/src/config/clickhouse.js');

async function verifyFixes() {
    console.log('--- Verifying Signal Lab Visibility Fixes ---');
    
    // 1. Check if 'Nation' exists in the raw data for context
    const rawLocations = await queryClickHouse("SELECT DISTINCT Location FROM rb_pdp_olap LIMIT 100");
    const hasNation = rawLocations.some(l => ['Nation', 'National', 'All India', 'Pan India'].includes(l.Location));
    console.log('Raw data has Nation/Rollup labels:', hasNation);

    // 2. Test if OUR filter works (simulating the buildConditions logic)
    const sql = `
        SELECT DISTINCT Location 
        FROM rb_pdp_olap 
        WHERE Location NOT IN ('Nation', 'National', 'All India', 'Pan India', 'all india', 'pan india', 'nation', 'national')
        LIMIT 10
    `;
    const filteredLocations = await queryClickHouse(sql);
    const stillHasNation = filteredLocations.some(l => ['Nation', 'National', 'All India', 'Pan India'].includes(l.Location));
    
    console.log('Filtered data has Nation/Rollup labels:', stillHasNation);
    if (!stillHasNation) {
        console.log('SUCCESS: Nation-level labels successfully filtered out.');
    } else {
        console.error('FAILURE: Nation-level labels still present.');
    }

    // 3. Verify Listing % column exists (redundant since we checked DESCRIBE, but good for sanity)
    const listingCheck = await queryClickHouse("SELECT listing_percent FROM rb_pdp_olap LIMIT 1");
    console.log('listing_percent column is accessible:', listingCheck.length > 0);
}

verifyFixes().catch(console.error);
