import { queryClickHouse } from './backend/src/config/clickhouse.js';
(async () => {
    try {
        const result = await queryClickHouse("SELECT Comp_flag, sum(Sales) FROM rb_pdp_olap GROUP BY Comp_flag");
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
})();


