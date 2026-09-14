import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { setCurrentDbName } from '../src/config/clickhouse.js';
import { getSubCategoryKpi } from '../src/services/marketShareHelper.js';
import dayjs from 'dayjs';

async function run() {
    setCurrentDbName('mamaearth');
    const start = dayjs('2026-03-01');
    const end = dayjs('2026-06-13');
    const result = await getSubCategoryKpi(start, end, 'All', 'face care', 'All', 'aha-bha');
    console.log("SubCategories:", result.subCategories);
    console.log("Brands count:", result.brands.length);
    console.log("Top 5 Brands with metrics:");
    console.log(result.brands.slice(0, 5));
    process.exit(0);
}
run().catch(console.error);
