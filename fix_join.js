const fs = require('fs');
const file = 'backend/src/services/alertCronService.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('LEFT JOIN l4w l ON c.Platform = l.Platform AND c.Web_Pid = l.Web_Pid', 'LEFT JOIN l4w_product l ON c.Platform = l.Platform AND c.Web_Pid = l.Web_Pid');

fs.writeFileSync(file, content);
