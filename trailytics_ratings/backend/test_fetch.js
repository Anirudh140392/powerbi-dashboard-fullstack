async function run() {
    const res = await fetch('http://localhost:3001/api/ratings/sku-list?company_id=297e37ea-a5ac-47df-bebd-ac44e52b7979');
    console.log(res.status, res.statusText);
    const text = await res.text();
    console.log("Body:", text.substring(0, 200));
}
run();
