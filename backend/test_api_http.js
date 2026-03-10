import http from 'http';

http.get('http://localhost:5000/api/watchtower/competition-brand-trends?platform=Blinkit&location=All&brands=Amul,Ferrero&skus=All&category=All&period=1M&timeStep=Daily', (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const data = JSON.parse(rawData);
            if (data.brands && data.brands.Amul) {
                console.log('Amul SOS first 5 days:', data.brands.Amul.slice(0, 5).map(i => i.sos));
            } else {
                console.log('No data for Amul');
            }
        } catch (e) {
            console.error(e.message);
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
