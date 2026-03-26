import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:5000/api/ecom-offtake?platform=Amazon&category=All');
    console.log(JSON.stringify(res.data.brandMetrics.slice(0,2), null, 2));
    const rca = await axios.get('http://localhost:5000/api/category-rca?platform=Amazon&category=All');
    console.log(JSON.stringify(rca.data.rows.slice(0,2), null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
test();
