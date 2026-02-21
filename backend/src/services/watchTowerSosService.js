import { queryClickHouse } from '../config/clickhouse.js';
import { buildClickHouseConditions, generateStandardBuckets } from './watchTowerEngine.js';
import dayjs from 'dayjs';

/**
 * Get Share of Search (SOS) metrics and trend data
 */
export const getSosData = async (filters) => {
    const { startDate, endDate, timeStep } = filters;

    // 1. Column Mapping for rb_kw table
    const sosOptions = {
        dateCol: 'created_on',
        platformCol: 'platform_name',
        locationCol: 'location_name',
        categoryCol: 'keyword_category'
    };

    // 2. Base Conditions (Search Rank < 11)
    const baseConds = buildClickHouseConditions(filters, sosOptions);
    const fullConds = baseConds ? `${baseConds} AND keyword_search_rank < 11` : 'keyword_search_rank < 11';

    // 3. Numerator (Our brands: keyword_is_rb_product = '1')
    const numeratorConds = `${fullConds} AND toString(keyword_is_rb_product) = '1'`;

    // 4. Current Period Calculation
    const [numResult, denomResult] = await Promise.all([
        queryClickHouse(`SELECT count() as cnt FROM rb_kw WHERE ${numeratorConds}`),
        queryClickHouse(`SELECT count() as cnt FROM rb_kw WHERE ${fullConds}`)
    ]);

    const currNum = parseInt(numResult[0]?.cnt || 0);
    const currDenom = parseInt(denomResult[0]?.cnt || 0);
    const currSos = currDenom > 0 ? (currNum / currDenom) * 100 : 0;

    // 5. Previous Period Calculation
    let prevStartDate = dayjs(startDate).subtract(1, 'month');
    let prevEndDate = dayjs(endDate).subtract(1, 'month');

    const prevBaseConds = buildClickHouseConditions({
        ...filters,
        startDate: prevStartDate,
        endDate: prevEndDate
    }, sosOptions);
    const prevFullConds = prevBaseConds ? `${prevBaseConds} AND keyword_search_rank < 11` : 'keyword_search_rank < 11';
    const prevNumeratorConds = `${prevFullConds} AND toString(keyword_is_rb_product) = '1'`;

    const [prevNumResult, prevDenomResult] = await Promise.all([
        queryClickHouse(`SELECT count() as cnt FROM rb_kw WHERE ${prevNumeratorConds}`),
        queryClickHouse(`SELECT count() as cnt FROM rb_kw WHERE ${prevFullConds}`)
    ]);

    const prevNum = parseInt(prevNumResult[0]?.cnt || 0);
    const prevDenom = parseInt(prevDenomResult[0]?.cnt || 0);
    const prevSos = prevDenom > 0 ? (prevNum / prevDenom) * 100 : 0;

    // 6. Generate Trend Chart (requires daily breakdown)
    const trendQuery = `
        SELECT 
            toDate(created_on) as label_date,
            countIf(toString(keyword_is_rb_product) = '1') as num,
            count() as denom
        FROM rb_kw
        WHERE ${fullConds}
        GROUP BY label_date
        ORDER BY label_date
    `;
    const trendData = await queryClickHouse(trendQuery);

    const buckets = generateStandardBuckets(startDate, endDate, timeStep || 'Daily');
    const chart = buckets.map(bucket => {
        const match = trendData.find(d => dayjs(d.label_date).isSame(dayjs(bucket.groupKey), 'day'));
        return match && parseInt(match.denom) > 0
            ? (parseInt(match.num) / parseInt(match.denom)) // Normalized 0-1 for sparkline
            : 0;
    });

    return {
        value: currSos,
        change: currSos - prevSos,
        chart,
        buckets: buckets.map(b => b.label)
    };
};
