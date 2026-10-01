const http = require('http');

const query = "SELECT name, type FROM system.columns WHERE table = 'rb_kw_olap' FORMAT JSON";
const requestBody = query;

const req = http.request({
    hostname: 'localhost',
    port: 8123,
    method: 'POST',
    headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(requestBody)
    }
}, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Available columns with disp/spons/ad:');
            json.data.forEach(col => {
                const n = col.name.toLowerCase();
                if (n.includes('disp') || n.includes('spons') || n.includes('ad')) {
                    console.log(`${col.name}: ${col.type}`);
                }
            });
            console.log('\nAll columns:');
            console.log(json.data.map(c => c.name).join(', '));
        } catch (e) {
            console.error('Parse error:', e, data);
        }
    });
});

req.on('error', (e) => console.error('Req error:', e));
req.write(requestBody);
req.end();
