// Quick API test script to check Blinkit offtake
// Run this in your browser console while the app is running

const filters = {
    platform: 'Blinkit',
    brand: 'All',
    location: 'All',
    startDate: '2025-10-01',
    endDate: '2025-12-10',
    months: 2
};

console.log("Testing Blinkit Offtake with filters:", filters);

fetch('http://localhost:3000/api/watchtower/summary?' + new URLSearchParams(filters))
    .then(res => res.json())
    .then(data => {
        console.log("\n=== API Response ===");
        console.log("Offtake:", data.summaryMetrics?.offtakes);
        console.log("\nFull Summary Metrics:", data.summaryMetrics);

        if (data.topMetrics && data.topMetrics[0]) {
            console.log("\nOfftake Chart Data:", data.topMetrics[0].chart);
            console.log("Chart Labels:", data.topMetrics[0].labels);
        }
    })
    .catch(err => console.error("Error:", err));
