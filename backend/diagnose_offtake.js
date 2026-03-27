
import ch from './src/config/clickhouse.js';

async function diagnose() {
    console.log("--- Diagnosing Offtake Data ---");
    const query = `
        SELECT
            SUM(Sales) AS total_sales
        FROM rb_pdp_olap
        WHERE DATE BETWEEN toDate('2026-02-24') AND toDate('2026-03-11') 
        AND Comp_flag='0'
    `;
    
    try {
        const resultSet = await ch.query({
            query: query,
            format: 'JSONEachRow',
        });
        const rows = await resultSet.json();
        console.log("Result of user query (Feb 24 - Mar 11):", rows);
        
        const queryCurrent = `
            SELECT
                SUM(Sales) AS total_sales
            FROM rb_pdp_olap
            WHERE DATE BETWEEN toDate('2026-03-12') AND toDate('2026-03-27')
            AND Comp_flag='0'
        `;
        const resultSetCurrent = await ch.query({
            query: queryCurrent,
            format: 'JSONEachRow',
        });
        const rowsCurrent = await resultSetCurrent.json();
        console.log("Result of likely current period (Mar 12 - Mar 27):", rowsCurrent);

        const queryByPlatform = `
            SELECT
                Platform,
                SUM(Sales) AS total_sales
            FROM rb_pdp_olap
            WHERE DATE BETWEEN toDate('2026-02-24') AND toDate('2026-03-11')
            AND Comp_flag='0'
            GROUP BY Platform
        `;
        const resultSetPlatform = await ch.query({
            query: queryByPlatform,
            format: 'JSONEachRow',
        });
        const platformRows = await resultSetPlatform.json();
        console.log("Sales by Platform (Feb 24 - Mar 11):", platformRows);

        console.log("--- Schema Check ---");
        const resultSetSchema = await ch.query({
            query: 'DESCRIBE rb_pdp_olap',
            format: 'JSONEachRow',
        });
        const schemaRows = await resultSetSchema.json();
        const compFlag = schemaRows.find(r => r.name === 'Comp_flag');
        console.log("!!! Comp_flag type:", compFlag ? compFlag.type : 'Not found');

        console.log("!!! Sales by Platform:");
        platformRows.forEach(r => console.log(`!!! ${r.Platform}: ${r.total_sales}`));

    } catch (err) {
        console.error("Query failed:", err);
    }
}

diagnose();
