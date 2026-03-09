import "dotenv/config";
import { connectDB } from "./src/config/db.js";
import RbPdpOlap from "./src/models/RbPdpOlap.js";

async function diagnose() {
    await connectDB();
    console.log("✅ DB Connected");

    const platforms = await RbPdpOlap.findAll({
        attributes: [
            'Platform',
            [RbPdpOlap.sequelize.fn('COUNT', '*'), 'count'],
            [RbPdpOlap.sequelize.fn('MIN', RbPdpOlap.sequelize.col('DATE')), 'minD'],
            [RbPdpOlap.sequelize.fn('MAX', RbPdpOlap.sequelize.col('DATE')), 'maxD']
        ],
        group: ['Platform'],
        raw: true
    });

    console.log("SUMMARY_START");
    platforms.forEach(p => {
        console.log(`PLATFORM: ${p.Platform} | COUNT: ${p.count} | RANGE: ${p.minD} to ${p.maxD}`);
    });
    console.log("SUMMARY_END");

    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
