(async () => {
    try {
        const res = await fetch('http://localhost:5000/api/insights?signal=Remove+Ad+Low+OSA', {
            headers: {
                'db-name': 'mars',
                'Authorization': 'Bearer ' // Assuming auth may not be strict on token validity in dev
            }
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(e) {
        console.error(e);
    }
})();
