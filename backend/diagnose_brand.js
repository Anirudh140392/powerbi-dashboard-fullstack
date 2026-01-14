import "dotenv/config";
import { connectDB } from "./src/config/db.js";
import RbPdpOlap from "./src/models/RbPdpOlap.js";
import { Op } from "sequelize";

async function diagnose() {
    await connectDB();
    console.log("✅ DB Connected");

    const currentStart = "2025-12-15";
    const currentEnd = "2025-12-31";
    const compStart = "2025-12-01";
    const compEnd = "2025-12-14";

    // Find brands that exist in BOTH periods for Blinkit
    const brandsWithData = await RbPdpOlap.findAll({
        attributes: [
            'Brand',
            [RbPdpOlap.sequelize.fn('COUNT', '*'), 'total_count']
        ],
        where: {
            Platform: "Blinkit",
            [Op.or]: [
                { DATE: { [Op.between]: [currentStart, currentEnd] } },
                { DATE: { [Op.between]: [compStart, compEnd] } }
            ]
        },
        group: ['Brand'],
        offset: 0,
        raw: true
    });

    console.log(`Found ${brandsWithData.length} brands with data in Dec for Blinkit.`);

    if (brandsWithData.length > 0) {
        // Check for a few brands specifically if they have data in BOTH
        for (let i = 0; i < Math.min(10, brandsWithData.length); i++) {
            const brand = brandsWithData[i].Brand;
            const countCurr = await RbPdpOlap.count({ where: { Brand: brand, Platform: "Blinkit", DATE: { [Op.between]: [currentStart, currentEnd] } } });
            const countComp = await RbPdpOlap.count({ where: { Brand: brand, Platform: "Blinkit", DATE: { [Op.between]: [compStart, compEnd] } } });
            console.log(`Brand: ${brand} | Curr: ${countCurr} | Comp: ${countComp}`);
        }
    }

    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
