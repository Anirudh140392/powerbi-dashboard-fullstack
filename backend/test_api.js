const axios = require('axios');
(async () => {
  try {
    const res = await axios.get('http://localhost:8000/api/category-rca', {
      params: {
        platform: 'blinkit',
        kpiCategory: 'Organic COMP KEYWORD SOS',
        drilldownLevel: 'keyword',
        drilldownId: 'Mars',
        startDate: '2023-01-01',
        endDate: '2024-01-01',
        brandScope: 'Mars'
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
})();
