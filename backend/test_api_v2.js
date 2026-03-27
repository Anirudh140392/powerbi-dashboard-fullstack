
import axios from 'axios';

async function testApi() {
    try {
        // User's mentioned range: Feb 24 - Mar 11 (comparison period)
        // Let's assume current period is Mar 12 - Mar 27 (16 days)
        const res = await axios.get('http://localhost:5000/api/ecom-offtake', {
            params: {
                startDate: '2026-03-12',
                endDate: '2026-03-27',
                compareStartDate: '2026-02-24',
                compareEndDate: '2026-03-11',
                // platform: 'All Platforms', // Let's test what happens with All
                brand: 'All Brands',
                category: 'All Categories'
            }
        });
        console.log("API Result:");
        console.log("Current Formatted:", res.data.currFormatted, "(Raw:", res.data.currTotal, ")");
        console.log("Previous Formatted:", res.data.prevFormatted, "(Raw:", res.data.prevTotal, ")");
        console.log("Variance:", res.data.varianceStr);
        
        if (res.data.prevTotal === 0) {
            console.log("WARNING: prevTotal is 0! Direct SQL check might be needed.");
        }
    } catch (err) {
        console.error("API Failed:", err.message);
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        }
    }
}

testApi();
