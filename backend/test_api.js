const http = require('http');
const req = http.get('http://localhost:5001/api/content-analysis/platforms?channel=ecommerce', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('EComm:', data));
});
req.on('error', console.error);
