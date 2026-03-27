async function run() {
    try {
        const url = 'http://localhost:5000/api/category-rca?drilldownLevel=brand&kpiCategory=offtake&activeTab=drainers';
        const res = await fetch(url);
        const data = await res.json();
        console.log("Drainers result:");
        console.log(JSON.stringify(data.rows?.slice(0, 3) || data, null, 2));

        const url2 = 'http://localhost:5000/api/category-rca?drilldownLevel=brand&kpiCategory=offtake&activeTab=gainers';
        const res2 = await fetch(url2);
        const data2 = await res2.json();
        console.log("Gainers result:");
        console.log(JSON.stringify(data2.rows?.slice(0, 3) || {}, null, 2));
    } catch (err) {
        console.error(err);
    }
}
run();
