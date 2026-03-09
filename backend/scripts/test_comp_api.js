import axios from 'axios';
async function run() {
    try {
        const res = await axios.get('http://127.0.0.1:8000/api/watchtower/competition-data?period=mtd&platform=All&location=All&categories=All');
        const data = res.data;
        const oralb = data.brands.find(b => b.brand === 'Oral-B');
        console.log(JSON.stringify(oralb, null, 2));
    } catch(e) {
        if (e.response) {
            console.error('Error response:', e.response.status, e.response.data);
        } else {
            console.error('Network error:', e.message);
        }
    }
}
run();
