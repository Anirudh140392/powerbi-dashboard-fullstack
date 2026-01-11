import "dotenv/config";
import { connectDB } from "./src/config/db.js";
import RbPdpOlap from "./src/models/RbPdpOlap.js";
import sequelize from "./src/config/db.js";

async function diagnose() {
    await connectDB();
    console.log("✅ DB Connected");

    const start = '2025-12-01';
    const end = '2025-12-31';
    const compStart = '2025-11-01';
    const compEnd = '2025-11-30';

    const mainMetricExpr = `(SUM(CASE WHEN DATE BETWEEN :start AND :end THEN neno_osa ELSE 0 END) / NULLIF(SUM(CASE WHEN DATE BETWEEN :start AND :end THEN deno_osa ELSE 0 END), 0)) * 100`;
    const compMetricExpr = `(SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN neno_osa ELSE 0 END) / NULLIF(SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN deno_osa ELSE 0 END), 0)) * 100`;
    const metricExpr = `(COALESCE(${mainMetricExpr}, 0) - COALESCE(${compMetricExpr}, 0))`;

    const query = `
    SELECT 
      Web_Pid, 
      Brand,
      Product,
      ${mainMetricExpr} as currOsa,
      ${compMetricExpr} as prevOsa,
      ${metricExpr} as osaChange
    FROM rb_pdp_olap
    WHERE (DATE BETWEEN :start AND :end OR DATE BETWEEN :compStart AND :compEnd)
      AND Platform = 'Blinkit'
      AND Comp_flag = 0
    GROUP BY Web_Pid, Brand, Product
    HAVING osaChange < -0.1
    ORDER BY ABS(osaChange) DESC
    LIMIT 10
  `;

    console.log("Searching for Blinkit Drainers (All Brands)...");

    try {
        const [rows] = await sequelize.query(query, {
            replacements: { start, end, compStart, compEnd }
        });

        console.log(`Found ${rows.length} Drainers.`);
        if (rows.length > 0) {
            rows.forEach(r => {
                console.log(`- ${r.Product} (${r.Brand}): ${r.prevOsa?.toFixed(2)}% -> ${r.currOsa?.toFixed(2)}% (Change: ${r.osaChange?.toFixed(2)}%)`);
            });
        }
    } catch (error) {
        console.error("❌ Query failed:", error);
    }

    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
