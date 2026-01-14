import "dotenv/config";
import { connectDB } from "./src/config/db.js";
import RbPdpOlap from "./src/models/RbPdpOlap.js";
import sequelize from "./src/config/db.js";

async function diagnose() {
  await connectDB();
  console.log("✅ DB Connected");

  try {
    const [schema] = await sequelize.query("DESCRIBE rb_pdp_olap");
    console.log("--- TABLE SCHEMA ---");
    console.log(JSON.stringify(schema, null, 2));

    const [counts] = await sequelize.query(`
      SELECT 
        Platform,
        Comp_flag,
        COUNT(*) as count,
        MIN(DATE) as minDate,
        MAX(DATE) as maxDate
      FROM rb_pdp_olap
      GROUP BY Platform, Comp_flag
    `);
    console.log("--- RECORD COUNTS ---");
    console.log(JSON.stringify(counts, null, 2));

    const [samples] = await sequelize.query(`
      SELECT Web_Pid, Brand, neno_osa, deno_osa, DATE, Comp_flag
      FROM rb_pdp_olap 
      WHERE DATE BETWEEN '2025-12-01' AND '2025-12-31'
        AND Comp_flag = 0
      LIMIT 10
    `);
    console.log("--- OUR BRANDS SAMPLES (DEC) ---");
    console.log(JSON.stringify(samples, null, 2));

    const [brands] = await sequelize.query(`
      SELECT DISTINCT Brand 
      FROM rb_pdp_olap 
      WHERE Comp_flag = 0 
      LIMIT 20
    `);
    console.log("--- OUR BRANDS LIST ---");
    console.log(JSON.stringify(brands, null, 2));

  } catch (error) {
    console.error("❌ Inspection failed:", error);
  }

  process.exit(0);
}

diagnose().catch(err => {
  console.error(err);
  process.exit(1);
});
