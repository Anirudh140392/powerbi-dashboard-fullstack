import http from 'http';

function checkEndpoint(urlStr) {
    return new Promise((resolve, reject) => {
        http.get(urlStr, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        }).on('error', reject);
    });
}

async function testApi() {
    try {
        console.log("Calling promo-violation-filters endpoint...");
        const res = await checkEndpoint('http://localhost:5000/api/reports/promo-violation-filters');
        console.log("Response:", res);
    } catch (err) {
        console.error("API error:", err.message);
    }
}

testApi();
