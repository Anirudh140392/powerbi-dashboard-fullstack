process.env.CLICKHOUSE_DB = 'mars';

async function test() {
    try {
        const supplyChainService = (await import('./src/services/supplyChainService.js')).default;
        console.log("3. Testing getSKUTrendData...");
        const trend = await supplyChainService.getSKUTrendData('0f39bfbe-7f0d-460a-84e2-56ce74f2ee97', 'daily');
        console.log("Trend object:", JSON.stringify(trend, null, 2));
    } catch(err) {
        console.error("Test failed with error:", err);
    }
    process.exit(0);
}
test();
