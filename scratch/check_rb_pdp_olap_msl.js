import http from 'http';

function runQuery(sql, db = 'mars') {
    const data = sql;
    const auth = Buffer.from('readonly_user:Readonly@123').toString('base64');
    const options = {
        hostname: '13.200.55.131',
        port: 8123,
        path: `/?database=${db}`,
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
            'Content-Length': Buffer.byteLength(data),
            'Authorization': 'Basic ' + auth
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => resolve(resData));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function check() {
    console.log("Checking columns containing case-insensitive msl in pidilite:");
    try {
        const res1 = await runQuery(`SELECT name, type FROM system.columns WHERE table = 'rb_pdp_olap' AND database = 'pidilite' AND name ILIKE '%msl%' FORMAT JSONEachRow`, 'pidilite');
        console.log("pidilite system.columns output:", res1);
    } catch (e) {
        console.log("Error checking system.columns:", e);
    }

    console.log("Checking columns containing case-insensitive msl in mars:");
    try {
        const res2 = await runQuery(`SELECT name, type FROM system.columns WHERE table = 'rb_pdp_olap' AND database = 'mars' AND name ILIKE '%msl%' FORMAT JSONEachRow`, 'mars');
        console.log("mars system.columns output:", res2);
    } catch (e) {
        console.log("Error checking system.columns:", e);
    }
}
check();
