const { queryClickHouse } = require('./src/utils/clickhouse');

async function testQuery() {
    try {
        console.log("Fetching distinct keyword types...");
        // This mirrors the logic in getVisibilityKeywordTypes
        const query = `
            SELECT DISTINCT keyword_type 
            FROM rca_pm_olap 
            WHERE keyword_type IS NOT NULL AND keyword_type != ''
            ORDER BY keyword_type ASC
        `;
        const results = await queryClickHouse(query);
        console.log("Raw Results:", results);

        const keywordTypes = ['All', ...results.map(r => r.keyword_type)];
        console.log("Final Extracted Keyword Types:", keywordTypes);
        console.log("Test passed!");
        process.exit(0);

    } catch (e) {
        console.error("Query failed", e);
        process.exit(1);
    }
}
testQuery();
