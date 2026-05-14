const axios = require('axios');
(async () => {
  try {
    const res = await axios.get('http://localhost:8000/api/category-rca', {
      params: {
        platform: 'blinkit',
        kpiCategory: 'Organic COMP KEYWORD SOS',
        drilldownLevel: 'keyword',
        drilldownId: 'boat',
        startDate: '2024-04-13',
        endDate: '2024-05-14',
        brandScope: 'boat'
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error(err.response.data);
    } else {
      console.error(err.message);
    }
  }
})();
