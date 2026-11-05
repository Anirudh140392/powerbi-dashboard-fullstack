import clickhouse from '../src/config/clickhouse.js';

async function test() {
    try {
        console.log("Checking categories in danone.product_snapshots:");
        const res1 = await clickhouse.query({
            query: "SELECT DISTINCT category FROM danone.product_snapshots",
            format: 'JSONEachRow'
        });
        const rows1 = await res1.json();
        console.log("snapshots categories:", rows1);

        console.log("\nChecking categories in danone.products:");
        const res2 = await clickhouse.query({
            query: "SELECT DISTINCT category FROM danone.products",
            format: 'JSONEachRow'
        });
        const rows2 = await res2.json();
        console.log("products categories:", rows2);

        console.log("\nChecking categories in danone.ml_reviews:");
        const res3 = await clickhouse.query({
            query: "SELECT DISTINCT category FROM danone.ml_reviews",
            format: 'JSONEachRow'
        });
        const rows3 = await res3.json();
        console.log("ml_reviews categories:", rows3);
    } catch (e) {
        console.error("Error:", e.message);
    }
    process.exit(0);
}

test();
