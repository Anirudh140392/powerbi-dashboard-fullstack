const axios = require('axios');
async function test() {
    try {
        const res = await axios.get('http://localhost:3000/api/market-share/trends', {
            params: {
                platform: 'amazon',
                period: '3M',
                timeStep: 'Daily'
            }
        });
        console.log(JSON.stringify(res.data.timeSeries, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
