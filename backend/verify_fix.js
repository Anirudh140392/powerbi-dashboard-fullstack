
import { queryClickHouse } from './src/config/clickhouse.js';

async function verifyFix() {
    try {
        const query = `
            SELECT
                p.Brand,
                p.Product,
                COALESCE(
                    NULLIF(SUM(CASE WHEN p.DATE BETWEEN '2026-03-01' AND '2026-03-08' THEN ifNull(toFloat64OrZero(toString(p.Sales)), 0) ELSE 0 END), 0),
                    NULLIF(SUM(CASE WHEN m.created_on BETWEEN '2026-03-01' AND '2026-03-08' THEN ifNull(toFloat64OrZero(toString(m.sales)), 0) ELSE 0 END), 0),
                    0
                ) AS offtake
            FROM rb_pdp_olap p
            LEFT JOIN rb_brand_ms m ON p.Web_Pid = m.web_pid AND p.DATE = m.created_on
            WHERE p.DATE BETWEEN '2026-03-01' AND '2026-03-08'
              AND p.Comp_flag = '1'
              AND p.Brand = 'Nestle'
            GROUP BY p.Brand, p.Product
            HAVING offtake > 0
            LIMIT 5
        `;
        const results = await queryClickHouse(query);
        console.log("Competitor SKUs with non-zero offtake after fix:");
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error(e);
    }
}

verifyFix();
