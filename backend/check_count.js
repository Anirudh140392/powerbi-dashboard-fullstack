import "dotenv/config";
import { connectDB } from "./src/config/db.js";
import RbPdpOlap from "./src/models/RbPdpOlap.js";
import sequelize from "./src/config/db.js";

async function diagnose() {
    await connectDB();
    console.log("✅ DB Connected");

    try {
        const result = await sequelize.query("SELECT COUNT(*) as count FROM rb_pdp_olap LIMIT 1");
        console.log("Full Result Structure:");
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("❌ failed:", error);
    }

    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
