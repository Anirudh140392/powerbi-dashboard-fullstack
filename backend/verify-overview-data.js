import dayjs from 'dayjs';
import { queryClickHouse } from './src/config/clickhouse.js';

const escapeCH = (str) => str ? str.replace(/'/g, "''") : '';

function buildCHCondition(value, column, options = {}) {
    const { isBrand = false, isCategory = false } = options;

    const isAll = (val) => {
        if (!val) return true;
        if (Array.isArray(val)) {
            return val.some(v => {
                const lower = String(v).toLowerCase();
                return lower === 'all' || lower === 'all india';
            });
        }
        const lower = String(val).toLowerCase();
        return lower === 'all' || lower === 'all india';
    };

    if (isBrand && isAll(value)) return "flag = '1'";
    if (isAll(value)) return "1=1";

    const list = typeof value === 'string'
        ? value.split(',').map(v => v.trim()).filter(v => !isAll(v))
        : Array.isArray(value) ? value.filter(v => !isAll(v)) : [value];

    if (list.length === 0) return isBrand ? "flag = '1'" : "1=1";

    if (isCategory) {
        return `LOWER(${column}) IN (${list.map(v => `'${escapeCH(String(v).toLowerCase())}'`).join(', ')})`;
    }
    return `${column} IN (${list.map(v => `'${escapeCH(v)}'`).join(', ')})`;
}

async function calculateAllSOS(dateFrom, dateTo, keywordType = null) {
    try {
        const platformCondition = "1=1";
        const locationCondition = "1=1";
        const keywordCondition = "1=1";
        const keywordTypeCondition = buildCHCondition(keywordType, 'keyword_type');
        const categoryCondition = "1=1";

        const query = `
            SELECT 
                ROUND(sumIf(toInt32(overall), flag = '1') * 100.0 / nullIf(sum(toInt32(overall)), 0), 2) AS overall_sos,
                ROUND(sumIf(toInt32(spons), flag = '1') * 100.0 / nullIf(sum(toInt32(spons)), 0), 2) AS sponsored_sos,
                ROUND(sumIf(toInt32(organic), flag = '1') * 100.0 / nullIf(sum(toInt32(organic)), 0), 2) AS organic_sos
            FROM rb_kw_olap
            WHERE DATE BETWEEN '${dateFrom}' AND '${dateTo}'
              AND ${platformCondition}
              AND ${locationCondition}
              AND ${keywordCondition}
              AND ${keywordTypeCondition}
              AND ${categoryCondition}
        `;

        console.log(`Query for keywordType [${keywordType}]:`, query);
        const result = await queryClickHouse(query);
        return result[0];
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

async function runTest() {
    const dateFrom = '2025-12-01';
    const dateTo = '2026-03-11';

    const types = ['All', 'Branded', 'Generic', 'Competition'];

    for (const type of types) {
        const res = await calculateAllSOS(dateFrom, dateTo, type);
        console.log(`Results for ${type}:`, JSON.stringify(res, null, 2));
        console.log('-----------------------------------');
    }
    process.exit(0);
}

runTest();
