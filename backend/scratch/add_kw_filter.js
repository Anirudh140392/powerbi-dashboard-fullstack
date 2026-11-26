const fs = require('fs');
const file = '/Users/2004yashgautamgmail.com/Documents/trailytics/trailytics_ds/powerbi-dashboard-fullstack/backend/src/services/alertCronService.js';
let content = fs.readFileSync(file, 'utf8');

const insertStr = `

/**
 * Build SQL filter clause for rb_kw_olap
 */
const buildKwFilterClause = (platforms) => {
    const conds = [];
    if (Array.isArray(platforms) && platforms.length > 0) {
        const filteredPlats = platforms.filter(p => p && p !== 'All Platforms');
        if (filteredPlats.length > 0) {
            conds.push(\`lower(platform_name) IN (\${filteredPlats.map(p => \`'\${p.trim().toLowerCase()}'\`).join(',')})\`);
        }
    }
    return conds.length > 0 ? ' AND ' + conds.join(' AND ') : '';
};
`;

content = content.replace('const buildPmFilterClause = (platforms, brands) => {', insertStr + '\nconst buildPmFilterClause = (platforms, brands) => {');
fs.writeFileSync(file, content);
console.log('Done');
