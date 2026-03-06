const http = require('http');

const options = {
    hostname: 'localhost',
    port: 8123,
    method: 'POST',
    path: '/'
};

const req = http.request(options, (res) => {
    let rawData = '';
    res.on('data', (chunk) => {
        rawData += chunk;
    });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            console.log("Columns related to spons/disp/ad:");
            parsedData.data.forEach(r => {
                const n = r.name.toLowerCase();
                if (n.includes('spons') || n.includes('disp') || n.includes('ad')) {
                    console.log(`- ${r.name} (${r.type})`);
                }
            });
        } catch (e) {
            console.error(e.message);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write("SELECT name, type FROM system.columns WHERE table = 'rb_kw' FORMAT JSON");
req.end();
