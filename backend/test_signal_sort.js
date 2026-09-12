
import http from 'http';

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error("Invalid JSON: " + body));
                }
            });
        }).on('error', reject);
    });
}

async function testSignalLabSort() {
    try {
        const url = 'http://localhost:5000/api/availability-analysis/signal-lab?type=visibility&signalType=gainer&groupBy=brand&startDate=2026-03-01&endDate=2026-03-08';
        console.log("Fetching: " + url);
        const data = await getJson(url);
        
        if (data.error) {
            console.error("API Error: ", data.error, data.message);
            return;
        }

        console.log("Visibility Gainers (Top 5 by SOS):");
        if (data.skus) {
            data.skus.forEach((s, i) => {
                console.log(`${i+1}. ${s.skuName} | Overall SOS: ${s.kpis.overallSos} | absoluteOsa: ${s.kpis.weightedOsa}`);
            });
        } else {
            console.log("No skus returned in response:", data);
        }

    } catch (e) {
        console.error("Test failed: ", e.message);
    }
}

testSignalLabSort();
