import { readFileSync, writeFileSync } from 'fs';

const file = '/Users/2004yashgautamgmail.com/Documents/trailytics/trailytics_ds/powerbi-dashboard-fullstack/trailytics_ratings/backend/src/controllers/reviews/reviews.controller.js';
let content = readFileSync(file, 'utf8');

content = content.replace("const dbName = getTargetDb(req);", "const dbName = getTargetDb(req);\nconsole.log('GET REVIEWS QUERY:', sql);\nconsole.log('PARAMS:', params);");

writeFileSync(file, content);
console.log('Added logging!');
