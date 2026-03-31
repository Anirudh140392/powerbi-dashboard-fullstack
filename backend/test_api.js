import fetch from 'node-fetch';

async function test() {
    try {
        const res = await fetch('http://localhost:5000/api/watchtower/competition-brand-trends?platform=Blinkit&location=All&brands=Amul&skus=All&category=All&period=1M&timeStep=Daily');
        const data = await res.json();
        
        if (data.brands && data.brands.Amul) {
            console.log('Amul SOS first 5 days:', data.brands.Amul.slice(0, 5).map(i => i.sos));
            console.log('Amul target_sales first 5 days:', data.brands.Amul.slice(0, 5).map(i => i.target_sales));
        } else {
            console.log('No data for Amul');
        }
    } catch(e) {
        console.error(e);
    }
}
test();
