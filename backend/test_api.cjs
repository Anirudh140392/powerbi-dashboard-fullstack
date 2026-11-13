const http = require('http');
http.get('http://localhost:5001/api/content-analysis/platforms?channel=ecommerce', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('EComm:', data));
}).on('error', console.error);

http.get('http://localhost:5001/api/content-analysis/platforms?channel=quickcomm', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('QComm:', data));
}).on('error', console.error);
