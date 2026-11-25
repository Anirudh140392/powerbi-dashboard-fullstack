import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

async function run() {
  try {
    const res1 = await api.get('/watchtower/overview?startDate=2026-04-01&endDate=2026-04-30&compareStartDate=2026-03-01&compareEndDate=2026-03-31');
    console.log("Response 1 (March compare):");
    console.log(res1.data.topMetrics.map(m => `${m.name}: ${m.trend}`));

    const res2 = await api.get('/watchtower/overview?startDate=2026-04-01&endDate=2026-04-30&compareStartDate=2026-02-01&compareEndDate=2026-02-28');
    console.log("Response 2 (February compare):");
    console.log(res2.data.topMetrics.map(m => `${m.name}: ${m.trend}`));

  } catch (error) {
    console.error(error.response?.data || error.message);
  }
}

run();
