import dayjs from 'dayjs';
import { queryClickHouse } from './src/config/clickhouse.js';

const escapeCH = (str) => str ? str.replace(/'/g, "''") : '';
const RB_SOS_CONDITION = "flag = '1'";

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

async function testTopSearchTerms(keywordTypes) {
    try {
        console.log(`Testing with keywordTypes:`, keywordTypes);

        let mappedType = keywordTypes;
        if (Array.isArray(mappedType)) {
            mappedType = mappedType.map(t => t === 'Competitor' ? 'Competition' : t);
        } else if (mappedType === 'Competitor') {
            mappedType = 'Competition';
        }

        const keywordTypeCond = buildCHCondition(mappedType, 'keyword_type');
        const typeFilter = keywordTypeCond !== '1=1' ? `AND ${keywordTypeCond}` : '';

        const dateCondition = "DATE = '2026-03-11'"; // Mock date
        const platformCondition = "1=1";
        const locationCondition = "1=1";
        const brandSOSCondition = RB_SOS_CONDITION;

        const metricsQuery = `
            SELECT 
                keyword,
                MAX(keyword_type) as type,
                sumIf(toInt32(overall), ${brandSOSCondition}) as rb_overall,
                sum(toInt32(overall)) as total_overall
            FROM rb_kw_olap
            WHERE ${dateCondition}
              AND ${platformCondition}
              AND ${locationCondition}
              ${typeFilter}
            GROUP BY keyword
            LIMIT 5
        `;

        console.log("Generated Query:", metricsQuery);
        const results = await queryClickHouse(metricsQuery);
        console.log("Results count:", results.length);
        if (results.length > 0) {
            console.log("Sample result type:", results[0].type);
        }
    } catch (e) {
        console.error("Test failed", e);
    }
}

async function run() {
    // Test single
    await testTopSearchTerms('Branded');
    console.log('-------------------');
    // Test multi
    await testTopSearchTerms(['Branded', 'Generic']);
    console.log('-------------------');
    // Test multi with Competitor mapping
    await testTopSearchTerms(['Branded', 'Competitor']);
    process.exit(0);
}

run();
