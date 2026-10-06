import supplyChainService from './src/services/supplyChainService.js';

async function test() {
    console.log("Fetching Prioritize PO...");
    try {
        const res = await supplyChainService.getPrioritizePOData({ platform: 'Zepto' });
        console.log(`Success! Total POs: ${res.data.length}, High Priority: ${res.summary.highPriority}`);
        if (res.data.length > 0) {
            console.log("Sample PO:", res.data[0]);
        }
    } catch (e) {
        console.error("Prioritize PO failed:", e.message);
    }

    console.log("Fetching Stock Transfer...");
    try {
        const res = await supplyChainService.getStockTransferData({ platform: 'Zepto' });
        console.log(`Success! Total Stock Transfers: ${res.length}`);
        if (res.length > 0) {
            console.log("Sample Stock Transfer:", res[0]);
        }
    } catch (e) {
        console.error("Stock Transfer failed:", e.message);
    }

    console.log("Fetching Manage Surplus...");
    try {
        const res = await supplyChainService.getManageSurplusData({ platform: 'Zepto' });
        console.log(`Success! Total Surplus Items: ${res.length}`);
        if (res.length > 0) {
            console.log("Sample Surplus Item:", res[0]);
        }
    } catch (e) {
        console.error("Manage Surplus failed:", e.message);
    }
}

test();
