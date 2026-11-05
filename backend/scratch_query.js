import supplyChainService from './src/services/supplyChainService.js';

async function main() {
    try {
        const filters = {
            startDate: '2026-07-05',
            endDate: '2026-08-02',
            platform: 'All',
            brand: 'All',
            status: 'All',
            city: 'All'
        };
        const result = await supplyChainService.getPrioritizePOData(filters);
        console.log("TOTAL POS:", result.data.length);
        console.log("FIRST 5 POS KEY KPIS:");
        result.data.slice(0, 5).forEach((po, i) => {
            console.log(`[${i+1}] PO: ${po.poNumber} | Priority: ${po.priority} | Risk: ₹${po.projectedSalesAtRisk} | Billed: ₹${po.billedValue} | Order: ₹${po.orderValue} | DOI: ${po.avgDoi} | CPD: ${po.consumptionPerDay}`);
        });
    } catch (e) {
        console.error("ERROR:", e);
    }
}
main();
