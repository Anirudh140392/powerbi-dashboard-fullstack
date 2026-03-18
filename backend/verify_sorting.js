
import { queryClickHouse } from './src/config/clickhouse.js';

async function verifySorting() {
    const start = '2026-03-01';
    const end = '2026-03-08';
    
    try {
        const sosSubquery = `
            (SELECT 
                LOWER(TRIM(brand)) as b_key, 
                (sum(toInt32(overall)) / nullIf(sum(sum(toInt32(overall))) OVER (), 0)) * 100 as sos
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${start}' AND '${end}'
            GROUP BY b_key
            )
        `;
        
        const query = `
            SELECT 
                p.Brand, 
                (sum(if(toDate(p.DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(p.neno_osa)), 0.0), 0.0)) / nullIf(sum(if(toDate(p.DATE) BETWEEN '${start}' AND '${end}', ifNull(toFloat64OrZero(toString(p.deno_osa)), 0.0), 0.0)), 0)) * 100 as absoluteOsa,
                k.sos as absoluteSos
            FROM rb_pdp_olap p
            LEFT JOIN ${sosSubquery} k ON LOWER(TRIM(p.Brand)) = k.b_key
            WHERE toDate(p.DATE) BETWEEN '${start}' AND '${end}'
              AND (p.Comp_flag = 0 OR p.Comp_flag = '0')
            GROUP BY p.Brand, k.sos
            ORDER BY absoluteSos DESC
            LIMIT 5
        `;
        
        const results = await queryClickHouse(query);
        console.log("Visibility Gainers (Top 5 by SOS):");
        console.log(JSON.stringify(results, null, 2));

    } catch (e) {
        console.error(e);
    }
}

verifySorting();
