
import dotenv from 'dotenv';
dotenv.config();
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import TbZeptoBrandSalesAnalytics from './src/models/TbZeptoBrandSalesAnalytics.js';
import TbBlinkitSalesData from './src/models/TbBlinkitSalesData.js';
import RbKw from './src/models/RbKw.js';
import RbBrandMs from './src/models/RbBrandMs.js';
import RcaSkuDim from './src/models/RcaSkuDim.js';

async function verifyDairyDay() {
    try {
        const brand = 'Dairy Day';
        const platform = 'Zepto';

        console.log(`Verifying data for Brand: ${brand}, Platform: ${platform}`);

        // 0. Check Bunge Database
        try {
            const bungeBrands = await sequelize.query("SELECT DISTINCT brand_name FROM Bunge.tb_zepto_brand_sales_analytics WHERE brand_name LIKE '%Dairy%'", { type: Sequelize.QueryTypes.SELECT });
            console.log("Brands matching 'Dairy' in Bunge.tb_zepto_brand_sales_analytics:", bungeBrands);
        } catch (err) {
            console.log("Could not query Bunge database:", err.message);
        }

    } catch (error) {
        console.error("Error verifying data:", error);
    }
}

verifyDairyDay();
