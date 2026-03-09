import fetch from 'node-fetch';

async function debugBlinkitOfftake() {
    try {
        console.log("=== Debugging Blinkit Offtake (01 Oct 25 - 10 Dec 25) ===\n");

        const filters = {
            platform: 'Blinkit',
            brand: 'All',
            location: 'All',
            startDate: '2025-10-01',
            endDate: '2025-12-10'
        };

        console.log("Filters:", filters);
        console.log("");

        const url = `http://localhost:3000/api/watchtower/summary?${new URLSearchParams(filters)}`;
        console.log("API URL:", url);
        console.log("");

        const response = await fetch(url);
        const data = await response.json();

        console.log("=== API Response ===");
        console.log("\n1. Summary Metrics:");
        console.log("   Offtake:", data.summaryMetrics?.offtakes);
        console.log("   Offtake Trend:", data.summaryMetrics?.offtakesTrend);
        console.log("   Market Share:", data.summaryMetrics?.marketShare);
        console.log("   Availability:", data.summaryMetrics?.stockAvailability);
        console.log("   SOS:", data.summaryMetrics?.shareOfSearch);

        if (data.topMetrics && data.topMetrics.length > 0) {
            const offtakeMetric = data.topMetrics[0];
            console.log("\n2. Offtake Chart Data:");
            console.log("   Labels:", offtakeMetric.labels);
            console.log("   Values:", offtakeMetric.chart);
            console.log("   Label:", offtakeMetric.label);
            console.log("   Trend:", offtakeMetric.trend);
        }

        if (data.platformOverview) {
            console.log("\n3. Platform Overview:");
            const blinkitPlatform = data.platformOverview.find(p => p.label === 'Blinkit');
            if (blinkitPlatform) {
                console.log("   Blinkit Platform Data:");
                const offtakeColumn = blinkitPlatform.columns.find(c => c.title === 'Offtakes');
                console.log("   Offtake Value:", offtakeColumn?.value);
            } else {
                console.log("   ❌ Blinkit not found in platformOverview");
            }
        }

        console.log("\n=== Full Response ===");
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error:", error.message);
        if (error.cause) {
            console.error("Cause:", error.cause);
        }
    }
}

debugBlinkitOfftake();
