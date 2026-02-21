import { queryClickHouse } from '../config/clickhouse.js';
import { buildClickHouseConditions, generateStandardBuckets } from './watchTowerEngine.js';
import dayjs from 'dayjs';

/**
 * Get Availability (OSA) metrics and trend data
 */
export const getAvailabilityData = async (filters) => {
    const { startDate, endDate, timeStep } = filters;

    // 1. Current Period Data (Focus on our brands: Comp_flag = 0)
    const currConds = buildClickHouseConditions({ ...filters, compFlag: 0 }, 'DATE');
    const osaQuery = `
        SELECT 
            toDate(DATE) as label_date,
            SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as total_neno,
            SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as total_deno
        FROM rb_pdp_olap
        WHERE ${currConds}
        GROUP BY label_date
        ORDER BY label_date
    `;

    const osaData = await queryClickHouse(osaQuery);

    // 2. Previous Period Data for Trend
    let prevStartDate = dayjs(startDate).subtract(1, 'month');
    let prevEndDate = dayjs(endDate).subtract(1, 'month');

    const prevConds = buildClickHouseConditions({
        ...filters,
        compFlag: 0,
        startDate: prevStartDate,
        endDate: prevEndDate
    }, 'DATE');

    const prevOsaQuery = `
        SELECT 
            SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as total_neno,
            SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as total_deno
        FROM rb_pdp_olap
        WHERE ${prevConds}
    `;

    const prevOsaResult = await queryClickHouse(prevOsaQuery);
    const prevNeno = parseFloat(prevOsaResult?.[0]?.total_neno || 0);
    const prevDeno = parseFloat(prevOsaResult?.[0]?.total_deno || 0);
    const prevAvailability = prevDeno > 0 ? (prevNeno / prevDeno) * 100 : 0;

    const currNeno = osaData.reduce((sum, d) => sum + parseFloat(d.total_neno), 0);
    const currDeno = osaData.reduce((sum, d) => sum + parseFloat(d.total_deno), 0);
    const currAvailability = currDeno > 0 ? (currNeno / currDeno) * 100 : 0;

    // 3. Generate Trend Chart
    const buckets = generateStandardBuckets(startDate, endDate, timeStep || 'Daily');
    const chart = buckets.map(bucket => {
        const match = osaData.find(d => dayjs(d.label_date).isSame(dayjs(bucket.groupKey), 'day'));
        return match && parseFloat(match.total_deno) > 0
            ? (parseFloat(match.total_neno) / parseFloat(match.total_deno)) // Normalized 0-1 for sparkline
            : 0;
    });

    // 4. Calculate Percentage Point Change
    const change = currAvailability - prevAvailability;

    return {
        value: currAvailability,
        change,
        chart,
        buckets: buckets.map(b => b.label)
    };
};
