
import 'dotenv/config';
import { Sequelize, Op } from 'sequelize';
import sequelize from './src/config/db.js';
import RbPdpOlap from './src/models/RbPdpOlap.js';
import RcaSkuDim from './src/models/RcaSkuDim.js';
import RbKw from './src/models/RbKw.js';
import TbZeptoBrandSalesAnalytics from './src/models/TbZeptoBrandSalesAnalytics.js';
import TbBlinkitSalesData from './src/models/TbBlinkitSalesData.js';
import dayjs from 'dayjs';

const debugBrands = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection established.');

        const platform = 'blinkit'; // Check Blinkit
        const category = 'Hair care'; // Keep category

        // 1. Fetch Brands from RcaSkuDim (Fixed Logic)
        const rcaWhere = {
            platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform')), platform.toLowerCase()),
            brand_category: sequelize.where(sequelize.fn('LOWER', sequelize.col('brand_category')), category.toLowerCase())
        };

        const rcaBrands = await RcaSkuDim.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: rcaWhere,
            raw: true
        });
        const rcaBrandList = rcaBrands.map(b => b.brand_name);
        console.log(`RCA Brands Found (${rcaBrandList.length}):`, rcaBrandList.slice(0, 5));

        // Add Date Filter (Last 6 Months)
        const endDate = dayjs();
        const startDate = endDate.subtract(6, 'month');

        const dateFilter = { [Op.between]: [startDate.toDate(), endDate.toDate()] };

        // 2. Fetch Brands from RbPdpOlap (Offtake Logic) with Date
        const offtakeWhere = {
            DATE: dateFilter,
            Platform: sequelize.where(sequelize.fn('LOWER', sequelize.col('Platform')), platform.toLowerCase()),
            Category: sequelize.where(sequelize.fn('LOWER', sequelize.col('Category')), category.toLowerCase())
        };

        const pdpBrands = await RbPdpOlap.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Brand')), 'Brand']],
            where: offtakeWhere,
            raw: true
        });
        const pdpBrandList = pdpBrands.map(b => b.Brand);
        console.log(`PDP Brands Found with Date (${pdpBrandList.length}):`, pdpBrandList.slice(0, 5));

        // 3. Compare Lists
        const rcaSet = new Set(rcaBrandList.map(b => b.toLowerCase()));
        const pdpSet = new Set(pdpBrandList.map(b => b.toLowerCase()));

        const inRcaNotInPdp = rcaBrandList.filter(b => !pdpSet.has(b.toLowerCase()));
        console.log(`In RCA but not in PDP (Potential Data Mismatch):`, inRcaNotInPdp.slice(0, 5));

        // 4. Check SOS Logic (Current vs Fixed)
        const sosWhereCurrent = {
            platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platform.toLowerCase()),
            keyword_category: category // NO LOWER()
        };

        const sosWhereFixed = {
            kw_crawl_date: dateFilter,
            platform_name: sequelize.where(sequelize.fn('LOWER', sequelize.col('platform_name')), platform.toLowerCase()),
            keyword_category: sequelize.where(sequelize.fn('LOWER', sequelize.col('keyword_category')), category.toLowerCase())
        };

        const sosCountCurrent = await RbKw.count({ where: sosWhereCurrent });
        const sosCountFixed = await RbKw.count({ where: sosWhereFixed });

        // 5. Check Market Share Logic
        const msWhereCurrent = {
            category: category // NO LOWER()
        };
        const msWhereFixed = {
            category: sequelize.where(sequelize.fn('LOWER', sequelize.col('category')), category.toLowerCase())
        };

        // Check if RbBrandMs has 'category' column first? Assuming it does based on service code.
        // But wait, service uses 'Platform' and 'Location' with capital letters in msWhere.
        // Let's check RbBrandMs model if possible, or just try count.

        // 6. Calculate Metrics for 'Godrej No.1'
        const brandName = 'Godrej No.1';
        const offtakeBrandWhere = {
            ...offtakeWhere,
            Brand: brandName
        };

        const bbluntCount = await RbPdpOlap.count({ where: offtakeBrandWhere });
        console.log(`Godrej No.1 Rows (Offtake):`, bbluntCount);

        if (bbluntCount > 0) {
            const bbluntSales = await RbPdpOlap.sum('Ad_sales', { where: offtakeBrandWhere });
            console.log(`Godrej No.1 Ad_sales (Offtake):`, bbluntSales);

            // Inspect actual values
            const sampleRows = await RbPdpOlap.findAll({
                attributes: ['Sales', 'Ad_sales'],
                where: offtakeBrandWhere,
                limit: 5,
                raw: true
            });
            console.log('Sample Sales/Ad_sales Values:', sampleRows);
        }

        // 7. Check Source Tables
        const zeptoBrand = 'Bblunt';
        const zeptoWhere = {
            brand_name: zeptoBrand,
            // sales_date: dateFilter // Check column name in model
        };
        // TbZeptoBrandSalesAnalytics has 'sales_date'
        zeptoWhere.sales_date = dateFilter;

        // Import models dynamically if needed, or assume they are imported at top
        // const TbZeptoBrandSalesAnalytics = (await import('./src/models/TbZeptoBrandSalesAnalytics.js')).default;
        // const TbBlinkitSalesData = (await import('./src/models/TbBlinkitSalesData.js')).default;

        const zeptoCount = await TbZeptoBrandSalesAnalytics.count({ where: zeptoWhere });
        console.log(`TbZepto Rows for ${zeptoBrand}:`, zeptoCount);

        // Check distinct brands in TbZepto
        const zeptoBrands = await TbZeptoBrandSalesAnalytics.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            limit: 10,
            raw: true
        });
        console.log('TbZepto Sample Brands:', zeptoBrands.map(b => b.brand_name));

        const blinkitBrand = 'Godrej No.1';
        const blinkitWhere = {
            item_name: { [Op.like]: `%${blinkitBrand}%` }, // Blinkit has item_name, manufacturer_name?
            // DATE is STRING in model? '2025-11-09'?
            // If DATE is string, dateFilter won't work directly.
        };
        // Check Blinkit model again. DATE is STRING. created_on is DATE.
        // Let's use created_on for now.
        blinkitWhere.created_on = dateFilter;

        const blinkitCount = await TbBlinkitSalesData.count({ where: blinkitWhere });
        console.log(`TbBlinkit Rows for ${blinkitBrand}:`, blinkitCount);


        // Check RbKw Brands
        const kwBrands = await RbKw.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: sosWhereFixed,
            raw: true
        });
        console.log(`RbKw Brands Found (${kwBrands.length}):`, kwBrands.map(b => b.brand_name).slice(0, 5));

        const sosBrandWhere = {
            ...sosWhereFixed,
            brand_name: brandName
        };
        const bbluntSosCount = await RbKw.count({ where: sosBrandWhere });
        console.log(`Bblunt SOS Count:`, bbluntSosCount);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
};

debugBrands();
