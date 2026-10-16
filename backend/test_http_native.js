const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/ecom-rca?platform=All&category=All&brand=boat&drilldownLevel=keyword&drilldownId=boat&kpiCategory=visibility&activeTab=drainers&startDate=2026-03-01&endDate=2026-03-29&compareStartDate=2026-02-01&compareEndDate=2026-02-28',
  method: 'GET',
  timeout: 3000
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      console.log('Rows returned:', j.rows?.length);
      if(j.rows) console.log(JSON.stringify(j.rows.slice(0, 10), null, 2));
    } catch(e) {
      console.log('Response body:', data);
    }
  });
});

req.on('timeout', () => {
  console.log('Request timed out!');
  req.destroy();
});

req.on('error', error => {
  console.error('Request error:', error.message);
});

req.end();
