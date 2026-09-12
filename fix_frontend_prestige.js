import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const files = [
    'trailytics_ratings/frontend/src/components/CompetitorIntelligence.tsx',
    'trailytics_ratings/frontend/src/components/StarDistributionChart.tsx',
    'trailytics_ratings/frontend/src/components/SegmentMatrixView.tsx',
    'trailytics_ratings/frontend/src/components/PriceVarianceStrip.tsx',
    'trailytics_ratings/frontend/src/components/ReviewIntelligenceExplorer.tsx'
];

for (const relPath of files) {
    const fullPath = path.join('/Users/2004yashgautamgmail.com/Documents/trailytics/trailytics_ds/powerbi-dashboard-fullstack', relPath);
    let content = readFileSync(fullPath, 'utf8');
    
    // We only want to replace 'Prestige' where it's used as a brand string
    // This is a bit tricky, but since we want to be fully dynamic:
    content = content.replace(/'Prestige'/g, 'getActiveBrandName()');
    content = content.replace(/"Prestige"/g, 'getActiveBrandName()');
    
    // But we need to make sure getActiveBrandName is imported!
    if (!content.includes('getActiveBrandName')) {
        // Find the last import statement
        const lastImportIndex = content.lastIndexOf('import ');
        const endOfLastImport = content.indexOf('\n', lastImportIndex);
        
        const importPath = relPath.includes('/ui/') ? '../../utils/tenant' : '../utils/tenant';
        
        content = content.slice(0, endOfLastImport + 1) + 
                  `import { getActiveBrandName } from '${importPath}';\n` + 
                  content.slice(endOfLastImport + 1);
    }
    
    writeFileSync(fullPath, content);
    console.log(`Updated ${relPath}`);
}
