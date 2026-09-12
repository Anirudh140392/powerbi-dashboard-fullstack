import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { setCurrentDbName, queryClickHouse } from '../src/config/clickhouse.js';
import dayjs from 'dayjs';

const normalizeFilterArray = (filter) => {
    if (!filter) return [];
    if (Array.isArray(filter)) return filter;
    if (typeof filter === 'string') return filter.split(',').map(s => s.trim()).filter(Boolean);
    return [];
};

const mapCategoryForMs = (arr) => arr;

export const getSubCategoryKpiTest = async (start, end, platformFilter, categoryFilter, locationFilter = null, subCategoryFilter = null, compStart = null, compEnd = null, brandFilter = null) => {
    try {
        const dbName = 'mamaearth';
        const isMamaearth = true;

        const platformArr = normalizeFilterArray(platformFilter);
        const categoryArr = normalizeFilterArray(categoryFilter);
        const locationArr = normalizeFilterArray(locationFilter);

        let platformCond = '';
        if (platformArr && platformArr.length > 0 && !platformArr.includes('All')) {
            const platformConds = platformArr.map(p => `lower(ms.platform) LIKE lower('%${p}%')`).join(' OR ');
            platformCond = `AND (${platformConds})`;
        }

        let locationCond = '';
        if (locationArr && locationArr.length > 0 && !locationArr.includes('All')) {
            locationCond = `AND lower(ms.location) IN (${locationArr.map(l => `'${l.replace(/'/g, "''").toLowerCase()}'`).join(', ')})`;
        }

        let categoryCond = '';
        if (categoryArr && categoryArr.length > 0 && !categoryArr.includes('All')) {
            const mappedCats = mapCategoryForMs(categoryArr);
            categoryCond = `AND ms.category IN (${mappedCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const brandArr = normalizeFilterArray(brandFilter);
        let brandCond = '';
        if (brandArr && brandArr.length > 0 && !brandArr.includes('All')) {
            brandCond = `AND ms.group_brand IN (${brandArr.map(b => `'${b.replace(/'/g, "''")}'`).join(', ')})`;
        }

        const startStr = start.format('YYYY-MM-DD');
        const endStr = end.format('YYYY-MM-DD');

        let prevStartStr, prevEndStr;
        if (compStart && compEnd) {
            prevStartStr = compStart.format('YYYY-MM-DD');
            prevEndStr = compEnd.format('YYYY-MM-DD');
        } else {
            const periodDays = end.diff(start, 'day');
            const prevEnd = start.subtract(1, 'day');
            const prevStart = prevEnd.subtract(periodDays, 'day');
            prevStartStr = prevStart.format('YYYY-MM-DD');
            prevEndStr = prevEnd.format('YYYY-MM-DD');
        }

        const baseCond = `
            ${platformCond}
            ${locationCond}
            ${categoryCond}
            ${brandCond}
            AND ms.category IS NOT NULL AND ms.category != ''
        `;

        // 1. Get distinct subcategories
        let subCategories = [];
        if (isMamaearth) {
            const subCatQuery = `
                SELECT DISTINCT pdp.Product_Subcategory as sub_category
                FROM rb_ms_olap as ms
                JOIN (
                    SELECT DISTINCT Web_Pid, Product_Subcategory 
                    FROM mamaearth.rb_pdp_olap 
                    WHERE Product_Subcategory IS NOT NULL 
                      AND trim(Product_Subcategory) NOT IN ('', '\\\\n', '\\n', '\\\\r\\\\n', '\\r\\n', '\r\n')
                ) as pdp ON ms.web_pid = pdp.Web_Pid
                WHERE toDate(ms.created_on) BETWEEN '${startStr}' AND '${endStr}'
                ${platformCond}
                ${locationCond}
                ${categoryCond}
                ${brandCond}
                ORDER BY sub_category
            `;
            console.log("subCatQuery:\n", subCatQuery);
            const subCatResults = await queryClickHouse(subCatQuery);
            subCategories = subCatResults.map(r => r.sub_category).filter(Boolean);
        } else {
            const subCatQuery = `
                SELECT DISTINCT category as sub_category
                FROM rb_ms_olap as ms
                WHERE toDate(created_on) BETWEEN '${startStr}' AND '${endStr}'
                ${baseCond.replace(/ms\./g, '')}
                ORDER BY category
            `;
            const subCatResults = await queryClickHouse(subCatQuery);
            subCategories = subCatResults.map(r => r.sub_category).filter(Boolean);
        }

        const targetSubCats = normalizeFilterArray(subCategoryFilter);
        const hasTargetSubCats = targetSubCats.length > 0;
        const finalTargetSubCats = hasTargetSubCats ? targetSubCats : subCategories;

        console.log("finalTargetSubCats:", finalTargetSubCats);

        if (finalTargetSubCats.length === 0) {
            return { subCategories: [], brands: [], selectedSubCategory: [] };
        }

        let subCatJoin = '';
        let subCatCond = '';
        if (isMamaearth) {
            subCatJoin = `
                JOIN (
                    SELECT DISTINCT Web_Pid, Product_Subcategory 
                    FROM mamaearth.rb_pdp_olap 
                    WHERE Product_Subcategory IS NOT NULL 
                      AND trim(Product_Subcategory) NOT IN ('', '\\\\n', '\\n', '\\\\r\\\\n', '\\r\\n', '\r\n')
                ) as pdp ON ms.web_pid = pdp.Web_Pid
            `;
            subCatCond = `AND lower(pdp.Product_Subcategory) IN (${finalTargetSubCats.map(c => `'${c.toLowerCase().replace(/'/g, "''")}'`).join(', ')})`;
        } else {
            subCatCond = `AND ms.category IN (${finalTargetSubCats.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')})`;
        }

        // Get total category sales for denominator
        const totalSalesQuery = `
            SELECT SUM(toFloat64OrZero(toString(ms.sales))) as total_sales
            FROM rb_ms_olap as ms
            ${subCatJoin}
            WHERE toDate(ms.created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${platformCond} ${locationCond}
            ${subCatCond}
        `;
        console.log("totalSalesQuery:\n", totalSalesQuery);

        const currentQuery = `
            SELECT ms.group_brand as brand,
                   SUM(toFloat64OrZero(toString(ms.sales))) as total_sales
            FROM rb_ms_olap as ms
            ${subCatJoin}
            WHERE toDate(ms.created_on) BETWEEN '${startStr}' AND '${endStr}'
            ${baseCond}
            ${subCatCond}
            AND ms.group_brand IS NOT NULL AND ms.group_brand != ''
            GROUP BY ms.group_brand
            ORDER BY total_sales DESC
        `;
        console.log("currentQuery:\n", currentQuery);

        const [subCatResults, totalSalesResult, currentResults] = await Promise.all([
            Promise.resolve(subCategories),
            queryClickHouse(totalSalesQuery),
            queryClickHouse(currentQuery)
        ]);

        console.log("Total Sales:", totalSalesResult?.[0]?.total_sales);
        console.log("Brands count:", currentResults.length);
        console.log("Top 5 Brands:");
        console.log(currentResults.slice(0, 5));

    } catch (err) {
        console.error(err);
    }
};

async function run() {
    setCurrentDbName('mamaearth');
    const start = dayjs('2026-03-01');
    const end = dayjs('2026-06-13');
    await getSubCategoryKpiTest(start, end, 'All', 'face care', 'All', 'aha-bha');
    process.exit(0);
}
run();
