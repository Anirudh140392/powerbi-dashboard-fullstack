import http from 'http';

const webPid = '8901058863642'; // Snickers bar
const url = `http://localhost:5000/api/availability-analysis/signal-lab/city-details?webPid=${webPid}&signalType=drainer&type=sales&startDate=2024-11-20&endDate=2024-12-20`;

console.log(`Checking URL: ${url}`);

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        try {
            const json = JSON.parse(data);
            if (json && json.cities && json.cities.length > 0) {
                const firstCity = json.cities[0];
                console.log('Metrics for first city:', {
                    city: firstCity.city,
                    offtakes: firstCity.estOfftake,
                    orders: firstCity.orders,
                    asp: firstCity.asp,
                    roas: firstCity.roas,
                    ctr: firstCity.ctr,
                    clicks: firstCity.clicks,
                    drr: firstCity.drr
                });
            } else {
                console.log('No cities returned or empty response');
            }
        } catch (e) {
            console.error('Failed to parse JSON:', e.message);
            console.log('Raw data:', data.substring(0, 500));
        }
    });
}).on('error', (err) => {
    console.error('Error fetching data:', err.message);
});
