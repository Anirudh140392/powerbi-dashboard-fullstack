/**
 * SOS Debug Script
 * Verifies Share of Search calculation for Zepto with Brand = All
 * 
 * Run with: node src/debug/debug_sos.js
 */

import 'dotenv/config';
import { Sequelize, Op } from 'sequelize';
import sequelize from '../config/db.js';
import RbPdpOlap from '../models/RbPdpOlap.js';
import RbKw from '../models/RbKw.js';
import dayjs from 'dayjs';

const debugSOS = async () => {
    console.log('='.repeat(60));
    console.log('SOS DEBUG: Zepto, Brand = All');
    console.log('='.repeat(60));

    try {
        // Connect to DB
        await sequelize.authenticate();
        console.log('✅ Connected to database\n');

        // Date range (current month)
        const startDate = dayjs('2025-12-01');
        const endDate = dayjs('2025-12-29');
        console.log(`📅 Date Range: ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}\n`);

        // ===== STEP 1: Get OUR brands from rb_pdp_olap (Comp_flag = 0) =====
        console.log('--- STEP 1: Get OUR brands (Comp_flag = 0) from rb_pdp_olap ---');
        const ourBrands = await RbPdpOlap.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Brand')), 'brand']],
            where: { Comp_flag: 0 },
            raw: true
        });
        const ourBrandList = ourBrands.map(b => b.brand).filter(b => b);
        console.log(`Found ${ourBrandList.length} OUR brands:\n`, ourBrandList);
        console.log();

        // ===== STEP 2: Check brand names in rb_kw table =====
        console.log('--- STEP 2: Check ALL brand names in rb_kw (Zepto) ---');
        const allBrandsInKw = await RbKw.findAll({
            attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('brand_name')), 'brand_name']],
            where: {
                platform_name: 'Zepto',
                kw_crawl_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
            },
            raw: true
        });
        const kwBrandList = allBrandsInKw.map(b => b.brand_name).filter(b => b);
        console.log(`Found ${kwBrandList.length} distinct brands in rb_kw for Zepto:\n`, kwBrandList.slice(0, 20), '...');
        console.log();

        // ===== STEP 3: Check which of OUR brands exist in rb_kw =====
        console.log('--- STEP 3: Match OUR brands in rb_kw ---');
        const matchingBrands = ourBrandList.filter(b => kwBrandList.includes(b));
        const nonMatchingBrands = ourBrandList.filter(b => !kwBrandList.includes(b));
        console.log(`Matching brands (${matchingBrands.length}):`, matchingBrands);
        console.log(`Non-matching brands (${nonMatchingBrands.length}):`, nonMatchingBrands);
        console.log();

        // ===== STEP 4: Calculate SOS =====
        console.log('--- STEP 4: Calculate SOS ---');

        const baseWhere = {
            platform_name: 'Zepto',
            kw_crawl_date: { [Op.between]: [startDate.toDate(), endDate.toDate()] }
        };

        // Numerator: Count rows for OUR brands only
        const numeratorWhere = {
            ...baseWhere,
            brand_name: { [Op.in]: ourBrandList }
        };
        const numerator = await RbKw.count({ where: numeratorWhere });
        console.log(`🔢 Numerator (OUR brands rows): ${numerator.toLocaleString()}`);

        // Denominator: Count ALL rows (total market)
        const denominator = await RbKw.count({ where: baseWhere });
        console.log(`🔢 Denominator (ALL rows): ${denominator.toLocaleString()}`);

        // SOS Calculation
        const sos = denominator > 0 ? (numerator / denominator) * 100 : 0;
        console.log(`\n📊 SOS = (${numerator.toLocaleString()} / ${denominator.toLocaleString()}) × 100`);
        console.log(`📊 SOS = ${sos.toFixed(2)}%`);

        // ===== STEP 5: Breakdown by brand =====
        console.log('\n--- STEP 5: SOS breakdown by OUR brand ---');
        for (const brand of ourBrandList) {
            const brandCount = await RbKw.count({
                where: {
                    ...baseWhere,
                    brand_name: brand
                }
            });
            const brandSos = denominator > 0 ? (brandCount / denominator) * 100 : 0;
            console.log(`  ${brand}: ${brandCount.toLocaleString()} rows → ${brandSos.toFixed(2)}% SOS`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('DEBUG COMPLETE');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await sequelize.close();
    }
};

debugSOS();
