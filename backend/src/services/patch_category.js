const fs = require('fs');
const filepath = 'watchTowerService.js';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Replace the comment blocks
const commentRegex = /([ \t]*)\/\/ NOTE: Category filter from rca_sku_dim NOT applied to rb_pdp_olap\n[ \t]*\/\/ because rb_pdp_olap\.Category has tier values \(Bronze\/Gold\/Silver\/Others\)\n(?:[ \t]*\/\/ which don't match rca_sku_dim categories \(Chocolates\/GMFC\/etc\.\)\n)?/g;

content = content.replace(commentRegex, (match, indent, offset, str) => {
    let varName = 'category';
    let escapeFn = 'escapeStrMain';
    let arrName = 'conditions';

    const start = Math.max(0, offset - 200);
    const end = Math.min(str.length, offset + 300);
    const contextStr = str.slice(start, offset);
    const afterStr = str.slice(offset, end);
    const fullContext = contextStr + afterStr;

    if (contextStr.includes('categoryFilter') && !contextStr.slice(-50).includes('category =')) {
        varName = 'categoryFilter';
    } else if (afterStr.includes('filters.category')) {
        varName = 'filters.category';
    }

    if (fullContext.includes('escapeStrMo')) {
        escapeFn = 'escapeStrMo';
    } else if (fullContext.includes('escapeStrMain')) {
        escapeFn = 'escapeStrMain';
    } else if (fullContext.includes('escapeStr(')) {
        escapeFn = 'escapeStr';
    }

    if (afterStr.includes('prevConditions.push')) {
        arrName = 'prevConditions';
    } else if (afterStr.includes('conds.push(')) {
        arrName = 'conds';
    }

    return `${indent}// Apply Category filter for rb_pdp_olap
${indent}const catArrLocal = normalizeFilterArray(${varName});
${indent}if (catArrLocal && catArrLocal.length > 0) {
${indent}    ${arrName}.push(\`Category IN (\${catArrLocal.map(c => \`'\${${escapeFn}(c)}'\`).join(', ')})\`);
${indent}}
`;
});

// 2. Replace Category with Category in existing OSA Trend logic
content = content.replace(
    "osaConds.push(`Category IN (${catArr.map(c => `'${osaEscapeStr(c)}'`).join(', ')})`);",
    "osaConds.push(`Category IN (${catArr.map(c => `'${osaEscapeStr(c)}'`).join(', ')})`);"
);
content = content.replace(
    "osaConds.push(`Category = '${osaEscapeStr(catArr[0])}'`);",
    "osaConds.push(`Category = '${osaEscapeStr(catArr[0])}'`);"
);

// 3. Replace Category with Category in Category Overview logic
content = content.replace(
    "SELECT DISTINCT Category as category FROM rb_pdp_olap",
    "SELECT DISTINCT Category as category FROM rb_pdp_olap"
);
content = content.replace(
    "AND Category IS NOT NULL AND Category != '' AND Category != '0' ORDER BY category",
    "AND Category IS NOT NULL AND Category != '' AND Category != '0' ORDER BY category"
);
content = content.replace(
    "`Category = '${escapeStrMain(catName)}'`",
    "`Category = '${escapeStrMain(catName)}'`"
);
content = content.replace(
    "AND Category = '${escapeStrMain(catName)}'",
    "AND Category = '${escapeStrMain(catName)}'"
);

fs.writeFileSync(filepath, content);
console.log("Patching complete.");
