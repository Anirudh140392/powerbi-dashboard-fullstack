import fetch from 'node-fetch';
(async () => {
    const res = await fetch('http://localhost:3001/api/ratings/sku-list?brand=mintop');
    console.log(res.status);
    console.log(await res.text());
})();
