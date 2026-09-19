import http from 'http';

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(data) }));
        }).on('error', reject);
    });
}

async function testTrendApi() {
    try {
        const url1 = 'http://localhost:5000/api/availability-analysis/kpi-trends?category=GMFC&period=1M&timeStep=Daily&platform=Blinkit';
        console.log('Fetching:', url1);
        const res1 = await fetchUrl(url1);
        console.log('Status code:', res1.statusCode);
        console.log('Time Series Length:', res1.data.timeSeries ? res1.data.timeSeries.length : 0);
        if (res1.data.timeSeries && res1.data.timeSeries.length > 0) {
            console.log('First point:', res1.data.timeSeries[0]);
        }
        
        const url2 = 'http://localhost:5000/api/availability-analysis/kpi-trends?category=Chocolates%20(Gifting)&period=1M&timeStep=Daily&platform=Blinkit';
        console.log('\nFetching:', url2);
        const res2 = await fetchUrl(url2);
        console.log('Status code:', res2.statusCode);
        console.log('Time Series Length:', res2.data.timeSeries ? res2.data.timeSeries.length : 0);

        process.exit(0);
    } catch (error) {
        console.error('Error fetching API:', error.message);
        process.exit(1);
    }
}

testTrendApi();
