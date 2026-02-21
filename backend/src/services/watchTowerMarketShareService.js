import { queryClickHouse } from '../config/clickhouse.js';
import { buildClickHouseConditions, generateStandardBuckets } from './watchTowerEngine.js';
import dayjs from 'dayjs';

/**
 * Get Market Share metrics and trend data
 */
export const getMarketShareData = async (filters) => {
    const { startDate, endDate, timeStep, brand } = filters;

    // 1. Column Mapping for test_brand_MS table
    const msOptions = {
        dateCol: 'created_on',
        platformCol: 'Platform',
        locationCol: 'Location',
        categoryCol: 'category',
        brandCol: 'brand'
    };

    // 2. Get valid brands (comp_flag = 0) from RcaSkuDim if no specific brand is selected
    // Note: In a real production system, this list could be cached globally.
    let brandsForNumerator = [];
    if (brand && brand !== 'All') {
        brandsForNumerator = Array.isArray(brand) ? brand : [brand];
    } else {
        const validBrands = await queryClickHouse(`SELECT DISTINCT brand_name FROM rca_sku_dim WHERE comp_flag = 0 AND brand_name IS NOT NULL`);
        brandsForNumerator = validBrands.map(b => b.brand_name).filter(Boolean);
    }

    if (brandsForNumerator.length === 0) {
        return { value: 0, change: 0, chart: [], buckets: [] };
    }

    const brandInClause = brandsForNumerator.map(b => `'${b.replace(/'/g, "''")}'`).join(', ');

    // 3. Current Period Calculation
    const currBaseConds = buildClickHouseConditions(filters, msOptions);
    const msConds = currBaseConds ? `${currBaseConds} AND sales IS NOT NULL` : 'sales IS NOT NULL';

    const [currNumResult, currDenomResult] = await Promise.all([
        queryClickHouse(`SELECT SUM(toFloat64OrZero(toString(sales))) as our_sales FROM test_brand_MS WHERE ${msConds} AND brand IN (${brandInClause})`),
        queryClickHouse(`SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales FROM test_brand_MS WHERE ${msConds}`)
    ]);

    const currNum = parseFloat(currNumResult[0]?.our_sales || 0);
    const currDenom = parseFloat(currDenomResult[0]?.total_sales || 0);
    const currMs = currDenom > 0 ? (currNum / currDenom) * 100 : 0;

    // 4. Previous Period Calculation
    let prevStartDate = dayjs(startDate).subtract(1, 'month');
    let prevEndDate = dayjs(endDate).subtract(1, 'month');

    const prevBaseConds = buildClickHouseConditions({
        ...filters,
        startDate: prevStartDate,
        endDate: prevEndDate
    }, msOptions);
    const prevMsConds = prevBaseConds ? `${prevBaseConds} AND sales IS NOT NULL` : 'sales IS NOT NULL';

    const [prevNumResult, prevDenomResult] = await Promise.all([
        queryClickHouse(`SELECT SUM(toFloat64OrZero(toString(sales))) as our_sales FROM test_brand_MS WHERE ${prevMsConds} AND brand IN (${brandInClause})`),
        queryClickHouse(`SELECT SUM(toFloat64OrZero(toString(sales))) as total_sales FROM test_brand_MS WHERE ${prevMsConds}`)
    ]);

    const prevNum = parseFloat(prevNumResult[0]?.our_sales || 0);
    const prevDenom = parseFloat(prevDenomResult[0]?.total_sales || 0);
    const prevMs = prevDenom > 0 ? (prevNum / prevDenom) * 100 : 0;

    // 5. Generate Trend Chart (requires daily breakdown)
    const trendQuery = `
        SELECT 
            toDate(created_on) as label_date,
            SUM(if(brand IN (${brandInClause}), toFloat64OrZero(toString(sales)), 0)) as our_sales,
            SUM(toFloat64OrZero(toString(sales))) as total_sales
        FROM test_brand_MS
        WHERE ${msConds}
        GROUP BY label_date
        ORDER BY label_date
    `;
    const trendData = await queryClickHouse(trendQuery);

    const buckets = generateStandardBuckets(startDate, endDate, timeStep || 'Daily');
    const chart = buckets.map(bucket => {
        const match = trendData.find(d => dayjs(d.label_date).isSame(dayjs(bucket.groupKey), 'day'));
        return match && parseFloat(match.total_sales) > 0
            ? (parseFloat(match.our_sales) / parseFloat(match.total_sales)) // Normalized 0-1 for sparkline
            : 0;
    });

    return {
        value: currMs,
        change: currMs - prevMs,
        chart,
        buckets: buckets.map(b => b.label)
    };
};
