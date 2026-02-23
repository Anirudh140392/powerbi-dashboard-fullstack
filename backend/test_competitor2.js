import axios from 'axios';
async function run() {
    try {
        const res = await axios.get('http://localhost:5000/api/watchtower/competition-data?period=mtd&platform=All&location=All&categories=All');
        const d = res.data;
        console.log("Got response:", JSON.stringify(d.brands.find(b => b.brand === 'Oral-B'), null, 2));
    } catch(e) {
        console.error(e.message);
    }
}
run();
