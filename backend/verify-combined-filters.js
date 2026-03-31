import dayjs from 'dayjs';
import { queryClickHouse } from './src/config/clickhouse.js';

const escapeCH = (str) => str ? str.replace(/'/g, "''") : '';
const RB_SOS_CONDITION = "flag = '1'";

function buildCHCondition(value, column, options = {}) {
    const isAll = (val) => {
        if (!val) return true;
        if (Array.isArray(val)) return val.some(v => String(v).toLowerCase() === 'all');
        return String(val).toLowerCase() === 'all';
    };
    if (isAll(value)) return "1=1";
    const list = Array.isArray(value) ? value : [value];
    return `${column} IN (${list.map(v => `'${escapeCH(v)}'`).join(', ')})`;
}

async function test(filters) {
    console.log(`\nTesting with filters:`, JSON.stringify(filters));

    let typeConds = [];
    const processType = (val) => {
        if (!val || val === 'All') return null;
        if (Array.isArray(val)) return val.map(t => t === 'Competitor' ? 'Competition' : t);
        return val === 'Competitor' ? 'Competition' : val;
    };

    const widgetType = processType(filters.filter);
    const globalType = processType(filters.keywordType);

    if (widgetType) typeConds.push(buildCHCondition(widgetType, 'keyword_type'));
    if (globalType) typeConds.push(buildCHCondition(globalType, 'keyword_type'));

    const typeFilter = typeConds.length > 0 ? `AND ${typeConds.join(' AND ')}` : '';

    const query = `
        SELECT keyword, MAX(keyword_type) as type, count() as total
        FROM rb_kw_olap
        WHERE DATE = (SELECT MAX(DATE) FROM rb_kw_olap)
          AND POSITION < 11
          ${typeFilter}
        GROUP BY keyword
        LIMIT 3
    `;

    console.log("SQL Segment:", typeFilter);
    const results = await queryClickHouse(query);
    console.log("Result sample:", results.map(r => `${r.keyword} (${r.type})`));
}

async function run() {
    await test({ filter: 'Branded', keywordType: 'All' });
    await test({ filter: 'Generic', keywordType: 'All' });
    // Conflict test: Widget Tab "Branded" AND Global Dropdown "Generic" -> Should be empty/filtered
    await test({ filter: 'Branded', keywordType: 'Generic' });
    process.exit(0);
}
run();
