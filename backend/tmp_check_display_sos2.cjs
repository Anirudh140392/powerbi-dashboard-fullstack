const axios = require('axios');

async function test() {
    try {
        const query = "SELECT name, type FROM system.columns WHERE table = 'rb_kw' FORMAT JSON";
        const response = await axios.post('http://localhost:8123/', query);

        const data = response.data;
        if (data && data.data) {
            console.log("Checking available columns related to display or sponsored:");
            data.data.forEach(r => {
                if (r.name.toLowerCase().includes('spons') || r.name.toLowerCase().includes('disp') || r.name.toLowerCase().includes('ad')) {
                    console.log(r.name, r.type);
                }
            });
        }
    } catch (e) {
        console.error(e.message);
    }
}
test();
