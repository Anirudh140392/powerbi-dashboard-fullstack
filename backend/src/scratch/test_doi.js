import 'dotenv/config';
import { queryClickHouse } from '../config/clickhouse.js';

async function test() {
    try {
        console.log("Running direct query test...");
        
        const q = `
            WITH
            daily_inventory AS
            (
                SELECT
                    DATE,
                    SUM(ifNull(toFloat64OrZero(toString(Inventory)), 0)) AS total_inventory
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '2025-01-01' AND '2025-01-10'
                  AND Platform = 'blinkit'
                  AND Comp_flag = 0
                GROUP BY DATE
                HAVING total_inventory > 0
            ),
            
            latest_inventory_stats AS
            (
                SELECT
                    argMax(total_inventory, DATE) AS latest_inventory,
                    max(DATE) AS latest_date
                FROM daily_inventory
            ),
            
            sales_stats AS
            (
                SELECT
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS total_qty_sold_30d
                FROM rb_pdp_olap
                WHERE DATE BETWEEN
                      dateSub(DAY, 29, (SELECT latest_date FROM latest_inventory_stats))
                      AND (SELECT latest_date FROM latest_inventory_stats)
                  AND Platform = 'blinkit'
                  AND Comp_flag = 0
            )
            
            SELECT
                latest_date,
                latest_inventory,
                total_qty_sold_30d,
                ROUND(
                    IF(
                        total_qty_sold_30d > 0,
                        (latest_inventory / total_qty_sold_30d) * 30,
                        0
                    ),
                    2
                ) AS DOI
            FROM latest_inventory_stats
            CROSS JOIN sales_stats;
        `;
        
        const res = await queryClickHouse(q);
        console.log("Result:", JSON.stringify(res, null, 2));
    } catch (err) {
        console.error("Error in query:", err);
    }
}

test();
