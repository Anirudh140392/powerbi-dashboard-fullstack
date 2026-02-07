import "dotenv/config";
import { connectDB } from "./src/config/db.js";
import RcaSkuDim from "./src/models/RcaSkuDim.js";
import { Op } from "sequelize";

async function diagnose() {
    await connectDB();
    console.log("✅ DB Connected");

    const results = await RcaSkuDim.findAll({
        attributes: [[RcaSkuDim.sequelize.fn('DISTINCT', RcaSkuDim.sequelize.col('brand_name')), 'brand_name']],
        where: {
            brand_name: { [Op.like]: '%Kwality%' }
        },
        raw: true
    });

    if (results.length === 0) {
        console.log("❌ No brand matching 'Kwality' found in RcaSkuDim table!");
    } else {
        console.log(`✅ Found ${results.length} brands matching 'Kwality' in RcaSkuDim:`);
        results.forEach(r => console.log(`- ${r.brand_name}`));
    }

    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
