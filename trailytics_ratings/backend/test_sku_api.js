import 'dotenv/config';
import http from 'http';

http.get('http://localhost:3001/api/ratings/sku-list?company_id=00000000-0000-0000-0000-000000000000', (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        try {
            console.log(JSON.parse(data));
        } catch(e) {
            console.log("Data:", data);
        }
    });
}).on('error', err => {
    console.error("Error:", err.message);
});
