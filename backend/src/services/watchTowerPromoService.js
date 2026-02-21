import { queryClickHouse } from '../config/clickhouse.js';
import { buildClickHouseConditions, generateStandardBuckets } from './watchTowerEngine.js';
import dayjs from 'dayjs';

/**
 * Get Promo Depth metrics and trend data
 */
export const getPromoData = async (filters) => {
    const { startDate, endDate, timeStep } = filters;

    // 1. Current Period Calculation (Focus on our brands: Comp_flag = 0)
    const currConds = buildClickHouseConditions({ ...filters, compFlag: 0 }, { dateCol: 'DATE' });
    const promoQuery = `
        SELECT 
            toDate(DATE) as label_date,
            AVG(if(toFloat64OrZero(toString(MRP)) > 0, (toFloat64OrZero(toString(MRP)) - toFloat64OrZero(toString(Selling_Price))) / toFloat64OrZero(toString(MRP)), 0)) * 100 as avg_promo
        FROM rb_pdp_olap
        WHERE ${currConds}
        GROUP BY label_date
        ORDER BY label_date
    `;

    const promoData = await queryClickHouse(promoQuery);

    // 2. Previous Period Calculation
    let prevStartDate = dayjs(startDate).subtract(1, 'month');
    let prevEndDate = dayjs(endDate).subtract(1, 'month');

    const prevConds = buildClickHouseConditions({
        ...filters,
        compFlag: 0,
        startDate: prevStartDate,
        endDate: prevEndDate
    }, { dateCol: 'DATE' });

    const prevPromoQuery = `
        SELECT AVG(if(toFloat64OrZero(toString(MRP)) > 0, (toFloat64OrZero(toString(MRP)) - toFloat64OrZero(toString(Selling_Price))) / toFloat64OrZero(toString(MRP)), 0)) * 100 as avg_promo
        FROM rb_pdp_olap
        WHERE ${prevConds}
    `;

    const prevPromoResult = await queryClickHouse(prevPromoQuery);
    const prevPromo = parseFloat(prevPromoResult?.[0]?.avg_promo || 0);

    // Weighted average for the whole period (total promo depth)
    const currPromo = promoData.length > 0
        ? promoData.reduce((sum, d) => sum + parseFloat(d.avg_promo), 0) / promoData.length
        : 0;

    // 3. Generate Trend Chart
    const buckets = generateStandardBuckets(startDate, endDate, timeStep || 'Daily');
    const chart = buckets.map(bucket => {
        const match = promoData.find(d => dayjs(d.label_date).isSame(dayjs(bucket.groupKey), 'day'));
        return match ? parseFloat(match.avg_promo) / 100 : 0; // Normalized 0-1 for sparkline
    });

    return {
        value: currPromo,
        change: currPromo - prevPromo, // Percentage point change
        chart,
        buckets: buckets.map(b => b.label)
    };
};
