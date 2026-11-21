const fs = require('fs');
let file = fs.readFileSync('src/components/Analytics/CategoryRca/RCATree.jsx', 'utf8');

// remove isKeywordDrillDown logic
file = file.replace(/const isKeywordDrillDown = isQCPlatform && isKeywordScopedKpi;/g, 'const isKeywordDrillDown = false; // Forced to false for Location drilldown');

fs.writeFileSync('src/components/Analytics/CategoryRca/RCATree.jsx', file);
console.log("Patched RCATree.jsx");
