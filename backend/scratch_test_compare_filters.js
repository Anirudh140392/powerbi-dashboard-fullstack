import fetch from 'node-fetch';

async function test() {
    try {
        const url = 'http://localhost:5000/api/watchtower/compare-sku/filters';
        console.log("Fetching filters from:", url);
        const res = await fetch(url);
        console.log("Status:", res.status);
        const data = await res.json();
        console.log("Platforms count:", data.platforms?.length);
        console.log("Categories count:", data.categories?.length);
        console.log("Brands count:", data.brands?.length);
        console.log("Sample Brands:", data.brands?.slice(0, 10));
    } catch (e) {
        console.error("Error fetching filters:", e);
    }
}
test();
