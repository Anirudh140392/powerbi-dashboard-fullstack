import supplyChainService from './src/services/supplyChainService.js';
import fs from 'fs';

async function run() {
    try {
        console.log("Calling getStockTransferData with June 12 to June 23, 2026 dates...");
        const result = await supplyChainService.getStockTransferData({
            startDate: '2026-06-12',
            endDate: '2026-06-23'
        });
        console.log(`Returned ${result.length} items total.`);

        const snickersOnly = result.filter(item => item.brand === 'Snickers');
        console.log(`Returned ${snickersOnly.length} items for Snickers brand.`);

        const targetSkuMatches = result.filter(item => item.sapCode === '60020835');
        console.log(`Matches for SKU 60020835 (Snickers Valuepack):`);
        console.log(targetSkuMatches.map(item => ({
            toCfa: item.toCfa,
            fromCfa: item.fromCfa,
            doiFe: item.doiFe,
            doiBe: item.doiBe,
            sohFe: item.sohFe,
            sohBe: item.sohBe,
            cpd: item.cpd,
            transferQty: item.transferQty,
            distanceKm: item.distanceKm,
            safe100Pct: item.safe100Pct
        })));

        const output = {
            dateRange: '2026-06-01 to 2026-06-23',
            totalItems: result.length,
            targetSku: targetSkuMatches,
            first15Items: result.slice(0, 15)
        };

        fs.writeFileSync('C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\3ebca2fe-4770-4faa-8291-41f794c0b69a\\scratch\\june_1_to_23_output.json', JSON.stringify(output, null, 2));
        console.log("Wrote results to june_1_to_23_output.json");
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

run();
