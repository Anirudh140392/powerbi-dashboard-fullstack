import supplyChainService from './src/services/supplyChainService.js';

async function test() {
    try {
        console.log("=== PO Filters Options ===");
        const filters = await supplyChainService.getPOFilterOptions();
        console.log(filters);
    } catch (e) {
        console.error(e.message);
    }
    process.exit(0);
}
test();
