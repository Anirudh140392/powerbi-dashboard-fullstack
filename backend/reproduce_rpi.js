import { queryClickHouse } from './src/config/clickhouse.js';

async function reproduce() {
    const startDate = '2026-03-01';
    const endDate = '2026-03-25'; // As per user's earlier query
    const platform = 'Blinkit';

    console.log(`Checking RPI for ${platform} from ${startDate} to ${endDate}`);

    // Query 1: KPI Logic (Similar to getPricingKpis)
    const kpiQuery = `
    SELECT
        AVG(CASE WHEN Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(Selling_Price)), 0) ELSE NULL END) as our_avg,
        AVG(CASE WHEN Comp_flag = '1' THEN ifNull(toFloat64OrZero(toString(Selling_Price)), 0) ELSE NULL END) as comp_avg,
        our_avg / NULLIF(comp_avg, 0) as rpi
    FROM rb_pdp_olap
    WHERE Platform = '${platform}'
      AND DATE BETWEEN '${startDate}' AND '${endDate}'
      AND ifNull(toFloat64OrZero(toString(Selling_Price)), 0) > 0
    `;

    // Query 2: Dimension Overview Logic (Similar to getDimensionOverview grouped by Platform)
    // NOTE: Dimension Overview often has slightly different where clauses or grouping
    const dimQuery = `
    SELECT
        Platform as dimension,
        AVG(CASE WHEN Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(Selling_Price)), 0) ELSE NULL END) as our_avg,
        AVG(CASE WHEN Comp_flag = '1' THEN ifNull(toFloat64OrZero(toString(Selling_Price)), 0) ELSE NULL END) as comp_avg,
        our_avg / NULLIF(comp_avg, 0) as rpi
    FROM rb_pdp_olap
    WHERE Platform = '${platform}'
      AND DATE BETWEEN '${startDate}' AND '${endDate}'
      AND ifNull(toFloat64OrZero(toString(Selling_Price)), 0) > 0
    GROUP BY dimension
    `;

    // Query 3: Dimension Overview grouped by Category on Blinkit
    const catDimQuery = `
    SELECT
        Category as dimension,
        AVG(CASE WHEN Comp_flag = '0' THEN ifNull(toFloat64OrZero(toString(Selling_Price)), 0) ELSE NULL END) as our_avg,
        AVG(CASE WHEN Comp_flag = '1' THEN ifNull(toFloat64OrZero(toString(Selling_Price)), 0) ELSE NULL END) as comp_avg,
        our_avg / NULLIF(comp_avg, 0) as rpi
    FROM rb_pdp_olap
    WHERE Platform = '${platform}'
      AND DATE BETWEEN '${startDate}' AND '${endDate}'
      AND ifNull(toFloat64OrZero(toString(Selling_Price)), 0) > 0
    GROUP BY dimension
    ORDER BY rpi DESC
    `;

    try {
        const kpiRes = await queryClickHouse(kpiQuery);
        console.log('KPI Results:', kpiRes);

        const dimRes = await queryClickHouse(dimQuery);
        console.log('Dimension (Platform) Results:', dimRes);

        const catRes = await queryClickHouse(catDimQuery);
        console.log('Dimension (Category) Results for top 5:', catRes.slice(0, 5));
        
        // Check if there is a category with RPI around 0.3
        const match03 = catRes.find(r => Math.abs((parseFloat(r.rpi) || 0) - 0.3) < 0.1);
        if (match03) {
            console.log('Found a category with RPI around 0.3:', match03);
        } else {
            console.log('No category found with RPI around 0.3');
        }

    } catch (e) {
        console.error(e);
    }
}

reproduce();
