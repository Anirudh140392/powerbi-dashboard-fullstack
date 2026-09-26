import http from 'http';

function runQuery(sql) {
    const data = sql;
    const auth = Buffer.from('readonly_user:Readonly@123').toString('base64');
    const options = {
        hostname: '13.200.55.131',
        port: 8123,
        path: '/?database=mars',
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
    const res = await runQuery(`SELECT name, type FROM system.columns WHERE table = 'rb_sku_platform' AND database = 'mars' FORMAT JSONEachRow`);
    console.log(res);
}
check();
