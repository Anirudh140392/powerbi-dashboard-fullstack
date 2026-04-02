import { getDimensionTrends } from './src/services/pricingAnalysisService.js';
import { schemaHelper } from './src/utils/schemaHelper.js';

async function test() {
    const filters = {
        dimension: 'platform',
        dimensionValue: 'Zepto',
        platform: 'Blinkit',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        timeStep: 'Daily'
    };

    console.log("Testing getDimensionTrends with filters:", filters);

    // I'll wrap it in a try/catch and see if it throws or what SQL it would generate
    // Actually, I'll just look at the code to see if there are any obvious issues.
    
    // I want to see what query is formed. 
    // Since I can't easily intercept the queryClickHouse in the running service, 
    // I'll just check the column names.
    const src = schemaHelper.getSource();
    const f = schemaHelper.getFields();
    
    console.log("Field mapping - Date:", f.date, "Platform:", f.platform, "Sales:", f.wSales);
}

test();
