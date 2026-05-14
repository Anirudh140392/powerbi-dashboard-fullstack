const axios = require('axios');

async function test() {
    try {
        const res = await axios.get('http://localhost:5000/api/category-rca/drilldown', {
            params: {
                drilldownLevel: 'brand',
                kpiCategory: 'Organic Comp Keyword SOS',
                platform: 'blinkit'
            }
        });
        console.log("Status:", res.status);
        console.log("Rows returned:", res.data.rows.length);
        console.log("First 3 rows:", res.data.rows.slice(0, 3));
    } catch (err) {
        console.error("Error:", err.message);
        if (err.response) console.error(err.response.data);
    }
}

test();
