import { queryClickHouse } from '../backend/src/config/clickhouse.js';
import dayjs from '../backend/node_modules/dayjs/dayjs.min.js';

async function main() {
    try {
        const targetDate = '2026-06-02';
        const currentEndDate = dayjs(targetDate);
        const currentStartDate = currentEndDate.subtract(29, 'days'); // 30 day range
        const extendedStartDate = currentStartDate.subtract(30, 'days');
        
        const baseFilter = `Platform = 'blinkit' AND Comp_flag = 0 AND Brand = 'galaxy'`;
        
        // 1. Get the card DOI value (mainDoiQuery style)
        const cardDoiQuery = `
            WITH
                daily_inventory AS (
                    SELECT
                        DATE,
                        SUM(ifNull(toFloat64OrZero(toString(Inventory)), 0)) AS total_inventory
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                      AND ${baseFilter}
                    GROUP BY DATE
                ),
                latest_inventory_stats AS (
                    SELECT
                        argMax(total_inventory, DATE) AS latest_inventory,
                        max(DATE) AS latest_date
                    FROM daily_inventory
                ),
                sales_stats AS (
                    SELECT
                        SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS total_qty_sold_30d
                    FROM rb_pdp_olap
                    WHERE DATE BETWEEN
                          dateSub(DAY, 29, (SELECT latest_date FROM latest_inventory_stats))
                          AND (SELECT latest_date FROM latest_inventory_stats)
                      AND ${baseFilter}
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
            CROSS JOIN sales_stats
        `;
        
        const cardDoiRes = await queryClickHouse(cardDoiQuery);
        console.log("Card DOI Value for 2026-06-02:", cardDoiRes);
        
        // 2. Get the trend DOI value using our new daily_rolling logic
        const trendQuery = `
            WITH daily_metrics AS (
                SELECT 
                    DATE,
                    SUM(ifNull(toFloat64OrZero(toString(Inventory)), 0)) as total_inventory,
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) as total_qty_sold
                FROM rb_pdp_olap
                WHERE DATE BETWEEN '${extendedStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
                  AND ${baseFilter}
                GROUP BY DATE
            ),
            daily_rolling AS (
                SELECT
                    DATE,
                    total_inventory,
                    total_qty_sold,
                    SUM(total_qty_sold) OVER (
                        ORDER BY DATE 
                        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
                    ) AS rolling_qty_sold_30d
                FROM daily_metrics
            )
            SELECT 
                DATE as date_group,
                total_inventory,
                rolling_qty_sold_30d,
                IF(rolling_qty_sold_30d > 0, (total_inventory / rolling_qty_sold_30d) * 30, 0) as DOI
            FROM daily_rolling
            WHERE DATE BETWEEN '${currentStartDate.format('YYYY-MM-DD')}' AND '${currentEndDate.format('YYYY-MM-DD')}'
            ORDER BY DATE ASC
        `;
        
        const trendRes = await queryClickHouse(trendQuery);
        console.log("Trend DOI Values (Last 5):", trendRes.slice(-5));
        
    } catch (err) {
        console.error(err);
    }
}

main();
