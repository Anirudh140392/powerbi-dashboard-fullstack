import { getCategorySize } from './src/services/marketShareHelper.js';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log("--- Testing Category Size Calculation ---");
    const start = dayjs('2026-06-05');
    const end = dayjs('2026-06-09');
    const platform = 'blinkit';
    const category = 'bathing';

    console.log(`Filters: Platform=${platform}, Category=${category}, Dates=${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`);

    try {
        const size = await getCategorySize(start, end, platform, category);
        console.log("Result Category Size:", JSON.stringify(size, null, 2));

        if (size.size > 0) {
            console.log("✅ Success: Data retrieved.");
        } else {
            console.log("⚠️ Warning: Size is 0. Check filters or DB content.");
        }
    } catch (err) {
        console.error("❌ Test Failed:", err.message);
    }
}

test().then(() => process.exit(0));
