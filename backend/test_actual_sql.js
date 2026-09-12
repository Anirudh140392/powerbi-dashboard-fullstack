import { getPdpKPIsByCategory, getCWDateRange } from './src/services/categoryPerfSummaryDataService.js';

async function test() {
    // Just mock queryAdminDB inside the module to see the query string
    const fs = require('fs');
    let content = fs.readFileSync('./src/services/categoryPerfSummaryDataService.js', 'utf8');
    
    // Quick regex to extract the query from getPdpKPIsByCategory
    const match = content.match(/export const getPdpKPIsByCategory = async.*?try \{.*?const query = `(.*?)`;/s);
    if(match) {
        let queryStr = match[1];
        // Evaluate it with our variables
        let dbName = 'mars';
        let cwStart = '2026-08-28';
        let isRolling = true;
        let CATEGORY_EXPR = "if(Category IS NULL OR Category = '', 'UNCATEGORIZED', Category)";
        let platClause = "AND lower(Platform) = 'blinkit'";
        let brandClause = "";
        
        // simple eval wrapper
        let evalQuery = eval("`" + queryStr + "`");
        console.log("EVALUATED QUERY:\n", evalQuery);
    }
}
test();
