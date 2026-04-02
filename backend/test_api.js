import axios from 'axios';
async function test() {
  try {
    const res = await axios.get('http://localhost:5000/api/watchtower/category-overview?keyword%5B%5D=All&startDate=2026-03-01&endDate=2026-03-31&compareStartDate=2026-02-01&compareEndDate=2026-02-28:1');
    console.log("Success", res.status);
  } catch(e) {
    console.log("Error:", e.response ? e.response.status : e.message);
    if(e.response) {
      console.log("Data:", e.response.data);
    }
  }
}
test();
