const fs = require('fs');

const frontendPath = '/home/asus/Pictures/powerbi-dashboard-fullstack/frontend/src/components/AllVisiblityAnalysis/SearchTermsPerformance.jsx';
let content = fs.readFileSync(frontendPath, 'utf8');

// The summary row variables might currently use volShare
let summaryMatch = content.match(/const summaryVolPercent = [^;]+/g);
if (summaryMatch) {
   console.log("Summary match:", summaryMatch[0]);
}

let rowVolMatch = content.match(/\{row\.volShare > 0[^\}]+%\s*VOL\./g);
if (rowVolMatch) {
   console.log("Row match:", rowVolMatch[0]);
}
