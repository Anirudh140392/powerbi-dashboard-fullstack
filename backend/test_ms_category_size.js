import { getCategorySize } from './src/services/marketShareHelper.js';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log("--- Testing Category Size Calculation ---");
    const start = dayjs().subtract(30, 'day');
    const end = dayjs();
    const platform = 'Blinkit';
    const category = 'Chocolates (Non Gifting)';

    console.log(`Filters: Platform=${platform}, Category=${category}, Dates=${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`);

    try {
        const size = await getCategorySize(start, end, platform, category);
        console.log("Result Category Size:", size);

        if (size > 0) {
            console.log("✅ Success: Data retrieved.");
        } else {
            console.log("⚠️ Warning: Size is 0. Check filters or DB content.");
        }
    } catch (err) {
        console.error("❌ Test Failed:", err.message);
    }
}

test().then(() => process.exit(0));
