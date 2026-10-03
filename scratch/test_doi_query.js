import { queryClickHouse } from '../backend/src/config/clickhouse.js';

async function main() {
    try {
        const query = `
            WITH daily_metrics AS (
                SELECT 
                    DATE,
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) as total_qty_sold
                FROM rb_pdp_olap
                WHERE Platform = 'blinkit' AND Comp_flag = 0 AND DATE BETWEEN '2026-05-02' AND '2026-06-30'
                GROUP BY DATE
            )
            SELECT 
                DATE,
                total_qty_sold,
                SUM(total_qty_sold) OVER (
                    ORDER BY DATE 
                    ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
                ) AS rolling_30d
            FROM daily_metrics
            ORDER BY DATE DESC
            LIMIT 5
        `;
        const res = await queryClickHouse(query);
        console.log("Query success:", JSON.stringify(res, null, 2));
    } catch (err) {
        console.error("Query failed:", err);
    }
}
main();
