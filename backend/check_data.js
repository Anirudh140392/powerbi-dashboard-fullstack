import sequelize from './src/config/db.js';
import TbZeptoPmKeywordRca from './src/models/TbZeptoPmKeywordRca.js';
import { Op } from 'sequelize';

async function checkData() {
    try {
        const targetCategories = ['bath & body', 'detergent', 'hair care', 'fragrance & talc'];

        console.log("Checking categories in DB...");
        const cats = await TbZeptoPmKeywordRca.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('keyword_category')), 'category']],
            raw: true
        });
        console.log("Found categories:", cats.map(c => c.category));

        console.log("\nChecking data for target categories...");
        const count = await TbZeptoPmKeywordRca.count({
            where: sequelize.where(
                sequelize.fn('LOWER', sequelize.col('keyword_category')),
                { [Op.in]: targetCategories }
            )
        });
        console.log("Total records for target categories:", count);

        if (count > 0) {
            const samples = await TbZeptoPmKeywordRca.findAll({
                where: sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('keyword_category')),
                    { [Op.in]: targetCategories }
                ),
                limit: 5,
                raw: true
            });
            console.log("\nSample records:");
            console.log(JSON.stringify(samples, null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkData();
