import "dotenv/config";
import { connectDB } from "./src/config/db.js";
import RbPdpOlap from "./src/models/RbPdpOlap.js";
import { Op } from "sequelize";

async function diagnose() {
    await connectDB();
    console.log("✅ DB Connected");

    const results = await RbPdpOlap.findAll({
        attributes: [[RbPdpOlap.sequelize.fn('DISTINCT', RbPdpOlap.sequelize.col('Brand')), 'Brand']],
        where: {
            [Op.or]: [
                { Brand: { [Op.like]: '%Amul%' } },
                { Brand: { [Op.like]: '%Mother%' } }
            ]
        },
        raw: true
    });

    if (results.length === 0) {
        console.log("❌ Neither 'Amul' nor 'Mother Dairy' found in rb_pdp_olaps!");
    } else {
        console.log(`✅ Found brands:`);
        results.forEach(r => console.log(`- ${r.Brand}`));
    }

    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
