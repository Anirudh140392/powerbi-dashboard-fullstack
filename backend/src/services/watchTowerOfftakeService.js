import { queryClickHouse } from '../config/clickhouse.js';
import { buildClickHouseConditions, escapeStr, generateStandardBuckets } from './watchTowerEngine.js';
import dayjs from 'dayjs';

/**
 * Get core offtake metrics and trend data
 */
export const getOfftakeData = async (filters) => {
    const { startDate, endDate, period, timeStep } = filters;

    // 1. Current Period Data
    const currConds = buildClickHouseConditions(filters, 'DATE');
    const offtakeQuery = `
        SELECT 
            toDate(DATE) as label_date,
            SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as total_sales
        FROM rb_pdp_olap
        WHERE ${currConds}
        GROUP BY label_date
        ORDER BY label_date
    `;

    const offtakeData = await queryClickHouse(offtakeQuery);

    // 2. Previous Period Data for Trend
    let prevStartDate = dayjs(startDate).subtract(1, 'month');
    let prevEndDate = dayjs(endDate).subtract(1, 'month');

    // Simple MoM for now, unless custom comparison is specified
    const prevConds = buildClickHouseConditions({
        ...filters,
        startDate: prevStartDate,
        endDate: prevEndDate
    }, 'DATE');

    const prevOfftakeQuery = `
        SELECT SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as total_sales
        FROM rb_pdp_olap
        WHERE ${prevConds}
    `;

    const prevOfftakeResult = await queryClickHouse(prevOfftakeQuery);
    const prevTotalOfftake = parseFloat(prevOfftakeResult?.[0]?.total_sales || 0);
    const currTotalOfftake = offtakeData.reduce((sum, d) => sum + parseFloat(d.total_sales), 0);

    // 3. Generate Trend Chart
    const buckets = generateStandardBuckets(startDate, endDate, timeStep || 'Daily');
    const chart = buckets.map(bucket => {
        const match = offtakeData.find(d => dayjs(d.label_date).isSame(dayjs(bucket.groupKey), 'day'));
        return match ? parseFloat(match.total_sales) / 10000000 : 0; // Convert to Cr
    });

    // 4. Calculate Change
    const change = prevTotalOfftake > 0 ? ((currTotalOfftake - prevTotalOfftake) / prevTotalOfftake) * 100 : 0;

    return {
        total: currTotalOfftake,
        change,
        chart,
        buckets: buckets.map(b => b.label)
    };
};
