import axios from 'axios';
async function check() {
  const url = "http://localhost:5000/api/ecom-rca?platform=All&category=All&brand=boat&drilldownLevel=keyword&drilldownId=boat&kpiCategory=visibility&activeTab=drainers&startDate=2026-03-01&endDate=2026-03-29&compareStartDate=2026-02-01&compareEndDate=2026-02-28";
  try {
    const r = await axios.get(url);
    const j = r.data;
    console.log("Rows returned:", j.rows?.length);
    if(j.rows) console.log(JSON.stringify(j.rows.slice(0, 10), null, 2));
  } catch(e) {
    console.error("Fetch failed:", e.message);
  }
}
check();
