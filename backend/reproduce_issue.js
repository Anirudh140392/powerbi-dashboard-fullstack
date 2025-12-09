import 'dotenv/config';
import service from './src/services/watchTowerService.js';
const { getSummaryMetrics } = service;
import dayjs from 'dayjs';

// Mock req/res
const req = {
    query: {
        startDate: '2025-10-01',
        endDate: '2025-12-09',
        platform: 'Zepto',
        brand: 'Aer',
        location: 'All',
        brandsOverviewPlatform: 'Zepto',
        brandsOverviewCategory: 'Fragrances & Grooming'
    }
};

const res = {
    json: (data) => {
        console.log("Response Data:");
        if (data.brandsOverview) {
            console.log("Brands Overview Count:", data.brandsOverview.length);
            data.brandsOverview.slice(0, 3).forEach(b => {
                console.log(`Brand: ${b.label}, Key: ${b.key}, Type: ${b.type}`);
                console.log("Columns:", b.columns.map(c => `${c.title}: ${c.value}`).join(', '));
            });
        } else {
            console.log("No brandsOverview data found.");
        }

        if (data.categoryOverview) {
            console.log("\nCategory Overview Count:", data.categoryOverview.length);
            data.categoryOverview.slice(0, 3).forEach(c => {
                console.log(`Category: ${c.label}, Key: ${c.key}, Type: ${c.type}`);
                console.log("Columns:", c.columns.map(col => `${col.title}: ${col.value}`).join(', '));
            });
        } else {
            console.log("\nNo categoryOverview data found.");
        }
    },
    status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
};

async function run() {
    try {
        console.log("Running getSummaryMetrics...");
        const result = await getSummaryMetrics(req.query);
        res.json(result);
    } catch (error) {
        console.error("Error:", error);
    }
}

run();
