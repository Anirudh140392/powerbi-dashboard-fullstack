import { readFileSync, writeFileSync } from 'fs';

const file = '/Users/2004yashgautamgmail.com/Documents/trailytics/trailytics_ds/powerbi-dashboard-fullstack/trailytics_ratings/backend/src/controllers/overview/overview.controller.js';
let content = readFileSync(file, 'utf8');

const targetStr = `multiIf(coalesce(r.is_competitor, 0) = 0, 'Prestige', initcap(lower(r.brand))) AS brand,`;
const replacementStr = `multiIf(coalesce(r.is_competitor, 0) = 0, initcap({dbName:String}), initcap(lower(r.brand))) AS brand,`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);

    // Now inject dbName into queryParams for getCompetitorBenchmark
    const queryParamsStr = `const queryParams = { companyId: String(req.companyId) };`;
    const queryParamsReplacement = `const queryParams = { companyId: String(req.companyId), dbName: getTargetDb(req) };`;
    
    // There are multiple queryParams declarations. We need to replace only the one in getCompetitorBenchmark.
    // getCompetitorBenchmark starts around line 1170.
    const funcStart = content.indexOf('export const getCompetitorBenchmark');
    if (funcStart !== -1) {
        const nextQueryParams = content.indexOf(queryParamsStr, funcStart);
        if (nextQueryParams !== -1 && nextQueryParams < funcStart + 2000) {
            content = content.substring(0, nextQueryParams) + queryParamsReplacement + content.substring(nextQueryParams + queryParamsStr.length);
        }
    }

    writeFileSync(file, content);
    console.log('Replaced Prestige in overview.controller.js!');
} else {
    console.log('Target string not found in overview.controller.js');
}
