const fs = require('fs');
const file = './trailytics_ratings/backend/src/controllers/overview/overview.controller.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/uniqExact\(canonical_sku\)/g, 'uniq(canonical_sku)');
content = content.replace(/uniqExactIf\(canonical_sku/g, 'uniqIf(canonical_sku');
content = content.replace(/count\(DISTINCT r\.web_pid\)/g, 'uniq(r.web_pid)');
content = content.replace(/count\(DISTINCT mp\.product_external_id\)/g, 'uniq(mp.product_external_id)');

fs.writeFileSync(file, content);
console.log('Fixed memory intensive functions');
