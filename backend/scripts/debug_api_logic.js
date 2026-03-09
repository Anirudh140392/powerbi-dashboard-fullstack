import "dotenv/config";
import { connectDB } from "./src/config/db.js";
import RbPdpOlap from "./src/models/RbPdpOlap.js";
import sequelize from "./src/config/db.js";

async function debug() {
    await connectDB();
    console.log("✅ DB Connected");

    const params = {
        platform: 'Blinkit',
        brand: 'All',
        location: 'All',
        startDate: '2025-12-01',
        endDate: '2025-12-31',
        compareStartDate: '2025-09-01', // SUSPECTED BAD DATES
        compareEndDate: '2025-09-06',   // SUSPECTED BAD DATES
        type: 'availability',
        signalType: 'drainer'
    };

    const start = params.startDate;
    const end = params.endDate;
    const compStart = params.compareStartDate;
    const compEnd = params.compareEndDate;
    const platform = params.platform;
    const brand = params.brand;
    const signalType = params.signalType;

    // Simulate processFilter
    const platformFilter = platform === 'All' ? null : platform;
    const brandFilter = brand === 'All' ? null : brand;

    const replacements = { start, end };
    if (platformFilter) replacements.platform = platformFilter;
    if (brandFilter) replacements.brand = brandFilter;

    const mainMetricExpr = `(SUM(CASE WHEN DATE BETWEEN :start AND :end THEN neno_osa ELSE 0 END) / NULLIF(SUM(CASE WHEN DATE BETWEEN :start AND :end THEN deno_osa ELSE 0 END), 0)) * 100`;
    const compMetricExpr = `(SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN neno_osa ELSE 0 END) / NULLIF(SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN deno_osa ELSE 0 END), 0)) * 100`;
    const metricExpr = `(COALESCE(${mainMetricExpr}, 0) - COALESCE(${compMetricExpr}, 0))`;

    const havingClause = `HAVING ${metricExpr} < 0`;

    const query = `
    SELECT Web_Pid, ${metricExpr} as sortMetric
    FROM rb_pdp_olap
    WHERE (DATE BETWEEN :start AND :end OR DATE BETWEEN :compStart AND :compEnd)
      ${platformFilter ? ' AND Platform = :platform' : ''}
      ${brandFilter ? ' AND Brand LIKE :brand' : ' AND Comp_flag = 0'}
    GROUP BY Web_Pid
    ${havingClause}
    LIMIT 4 OFFSET 0
  `;

    console.log(`Testing with Current[${start} to ${end}] and Comp[${compStart} to ${compEnd}]`);
    try {
        const [rows] = await sequelize.query(query, {
            replacements: { ...replacements, compStart, compEnd }
        });
        console.log(`Results found: ${rows.length}`);
        if (rows.length === 0) {
            console.log("CONFIRMED: NO DRAINERS FOUND WITH THESE DATES.");
        }
    } catch (error) {
        console.error("❌ Query failed:", error);
    }

    process.exit(0);
}

debug().catch(err => {
    console.error(err);
    process.exit(1);
});
