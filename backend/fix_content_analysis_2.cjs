const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'contentAnalysisService.js');
let content = fs.readFileSync(filePath, 'utf8');

// The blocks look like this:
/*
        // Brand filter
        if (brand && brand !== 'All') {
            ...
        }
*/
// We can just use string replacements to comment them out or remove them.
content = content.replace(/\/\/ Brand filter[\s\S]*?if\s*\(brandConditions\.length\s*>\s*0\)\s*\{\s*query\s*\+=\s*` AND \(\$\{brandConditions\.join\(' OR '\)\}\)`;\s*\}\s*\}/g, '/* Brand filter removed as column does not exist */');

content = content.replace(/\/\/ Location \/ Zone filter[\s\S]*?if\s*\(zoneConditions\.length\s*>\s*0\)\s*\{\s*query\s*\+=\s*` AND \(\$\{zoneConditions\.join\(' OR '\)\}\)`;\s*\}\s*\}/g, '/* Location filter removed as column does not exist */');

// There are also trends specific blocks
content = content.replace(/\/\/ Brand filter \(Trends\)[\s\S]*?if\s*\(brandConditions\.length\s*>\s*0\)\s*\{\s*query\s*\+=\s*` AND \(\$\{brandConditions\.join\(' OR '\)\}\)`;\s*\}\s*\}/g, '/* Brand filter removed as column does not exist */');

content = content.replace(/\/\/ Location \/ Zone filter \(Trends\)[\s\S]*?if\s*\(zoneConditions\.length\s*>\s*0\)\s*\{\s*query\s*\+=\s*` AND \(\$\{zoneConditions\.join\(' OR '\)\}\)`;\s*\}\s*\}/g, '/* Location filter removed as column does not exist */');

// There are also PlatformBreakdown blocks
content = content.replace(/\/\/ Brand filter \(PlatformBreakdown\)[\s\S]*?if\s*\(brandConditions\.length\s*>\s*0\)\s*\{\s*query\s*\+=\s*` AND \(\$\{brandConditions\.join\(' OR '\)\}\)`;\s*\}\s*\}/g, '/* Brand filter removed as column does not exist */');

content = content.replace(/\/\/ Location \/ Zone filter \(PlatformBreakdown\)[\s\S]*?if\s*\(zoneConditions\.length\s*>\s*0\)\s*\{\s*query\s*\+=\s*` AND \(\$\{zoneConditions\.join\(' OR '\)\}\)`;\s*\}\s*\}/g, '/* Location filter removed as column does not exist */');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Filters removed!");
