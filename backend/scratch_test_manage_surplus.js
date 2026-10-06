import supplyChainService from './src/services/supplyChainService.js';
import fs from 'fs';

async function run() {
    try {
        console.log("Calling getManageSurplusData with June 14 to June 22, 2026...");
        const result = await supplyChainService.getManageSurplusData({
            startDate: '2026-06-14',
            endDate: '2026-06-22'
        });
        console.log(`Returned ${result.length} items total.`);

        const output = {
            dateRange: '2026-06-14 to 2026-06-22',
            totalItems: result.length,
            first15Items: result.slice(0, 15)
        };

        fs.writeFileSync('C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\3ebca2fe-4770-4faa-8291-41f794c0b69a\\scratch\\manage_surplus_june_14_to_22.json', JSON.stringify(output, null, 2));
        console.log("Wrote results to manage_surplus_june_14_to_22.json");
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

run();
