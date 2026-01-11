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

    const query = `
    SELECT 
      Web_Pid, 
      Brand,
      SUM(CASE WHEN DATE BETWEEN :start AND :end THEN neno_osa ELSE 0 END) as currNeno,
      SUM(CASE WHEN DATE BETWEEN :start AND :end THEN deno_osa ELSE 0 END) as currDeno,
      SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN neno_osa ELSE 0 END) as prevNeno,
      SUM(CASE WHEN DATE BETWEEN :compStart AND :compEnd THEN deno_osa ELSE 0 END) as prevDeno
    FROM rb_pdp_olaps
    WHERE Comp_flag = 0
    GROUP BY Web_Pid, Brand
  `;

    try {
        const [rows] = await sequelize.query(query, {
            replacements: { start, end, compStart, compEnd }
        });

        console.log(`Total SKUs checked: ${rows.length}`);

        const drainers = rows.map(r => {
            const currOSA = r.currDeno > 0 ? (r.currNeno / r.currDeno) * 100 : 0;
            const prevOSA = r.prevDeno > 0 ? (r.prevNeno / r.prevDeno) * 100 : 0;
            return { ...r, currOSA, prevOSA, osaChange: currOSA - prevOSA };
        }).filter(d => d.osaChange < -0.1)
            .sort((a, b) => a.osaChange - b.osaChange);

        console.log(`Found ${drainers.length} SKUs with OSA decrease > 0.1%`);

        if (drainers.length > 0) {
            console.log("Top 5 Drainers:");
            drainers.slice(0, 5).forEach(d => {
                console.log(`- ${d.Web_Pid} (${d.Brand}): ${d.prevOSA.toFixed(2)}% -> ${d.currOSA.toFixed(2)}% (Change: ${d.osaChange.toFixed(2)}%)`);
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
