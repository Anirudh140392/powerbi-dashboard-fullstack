import http from 'http';
http.get('http://localhost:4000/api/watchtower/competition-data?period=mtd&platform=All&location=All&categories=All', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const oralb = data.brands.find(b => b.brand === 'Oral-B');
      console.log('Oral-B brand metrics:', JSON.stringify(oralb, null, 2));
    } catch(e) {
      console.log(e);
    }
  });
});
