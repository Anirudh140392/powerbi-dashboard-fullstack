import "dotenv/config";
import { connectDB } from "./src/config/db.js";
import RbPdpOlap from "./src/models/RbPdpOlap.js";
import { Op } from "sequelize";

async function diagnose() {
    await connectDB();
    console.log("✅ DB Connected");

    const countRaw = await RbPdpOlap.count();
    console.log("TOTAL_RAW_RECORDS:", countRaw);

    const zeptoCount = await RbPdpOlap.count({ where: { Platform: "Zepto" } });
    console.log("ZEPTO_TOTAL_RECORDS:", zeptoCount);

    const dateInfo = await RbPdpOlap.findAll({
        attributes: [
            [RbPdpOlap.sequelize.fn('MIN', RbPdpOlap.sequelize.col('DATE')), 'minDate'],
            [RbPdpOlap.sequelize.fn('MAX', RbPdpOlap.sequelize.col('DATE')), 'maxDate']
        ],
        where: { Platform: "Zepto" },
        raw: true
    });
    console.log("ZEPTO_MIN_DATE:", dateInfo[0].minDate);
    console.log("ZEPTO_MAX_DATE:", dateInfo[0].maxDate);

    const signalDates = {
        start: "2025-12-01",
        end: "2025-12-31",
        compStart: "2025-09-01",
        compEnd: "2025-09-06"
    };

    const currentPeriodCount = await RbPdpOlap.count({
        where: {
            Platform: "Zepto",
            DATE: { [Op.between]: [signalDates.start, signalDates.end] }
        }
    });
    console.log(`ZEPTO_RECOREDS_DECEMBER_2025: ${currentPeriodCount}`);

    const compPeriodCount = await RbPdpOlap.count({
        where: {
            Platform: "Zepto",
            DATE: { [Op.between]: [signalDates.compStart, signalDates.compEnd] }
        }
    });
    console.log(`ZEPTO_RECORDS_SEPTEMBER_2025_COMPARISON: ${compPeriodCount}`);

    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
