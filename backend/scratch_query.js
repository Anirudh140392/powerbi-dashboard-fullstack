import { queryClickHouse } from './src/config/clickhouse.js';
import supplyChainService from './src/services/supplyChainService.js';

async function main() {
    try {
        // Let's call getPrioritizePOData with different filters or date range
        // For example, if we call it with a wide date range like '2026-05-17' to '2026-06-23'
        const filters = {
            startDate: '2026-06-04T00:00:00.000Z',
            endDate: '2026-06-17T23:59:59.000Z',
            platform: 'All',
            brand: 'All',
            status: 'All',
            city: 'All'
        };
        const result = await supplyChainService.getPrioritizePOData(filters);
        console.log("RESULT DATA LENGTH:", result.data.length);
        console.log("RESULT TOTAL COUNT:", result.totalCount);
        console.log("SUMMARY TOTAL POS:", result.summary.totalPOs);
        
        // Let's query ClickHouse directly for the count
        const rawCount = await queryClickHouse("SELECT count(distinct po_number) as cnt FROM mars.rb_po_olap_v2_latest");
        console.log("RAW DISTINCT PO COUNT:", rawCount);
        
        const countByStatus = await queryClickHouse("SELECT po_status, count(distinct po_number) as cnt FROM mars.rb_po_olap_v2_latest GROUP BY po_status");
        console.log("COUNT BY STATUS:", countByStatus);
    } catch (e) {
        console.error("ERROR:", e);
    }
}
main();
