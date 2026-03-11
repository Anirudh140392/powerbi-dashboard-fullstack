
import 'dotenv/config';
import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

const PRODUCT_CATEGORY_SQL = `if(Product_Category IS NOT NULL AND Product_Category != '' AND Product_Category != '0', 
    Product_Category, 
    multiIf(LOWER(Brand) IN ('orbit', 'doublemint', 'boomer', 'skittles'), 'GMFC', 
            LOWER(Brand) IN ('snickers', 'galaxy', 'bounty', 'twix', 'mars', 'm&m'), 
                if(LOWER(toString(Product)) LIKE '%gift%' OR LOWER(toString(Product)) LIKE '%tin pack%' OR LOWER(toString(Product)) LIKE '%minis%', 
                   'Chocolates (Gifting)', 
                   'Chocolates (Non Gifting)'), 
            'Others')
)`;

const CITY_NORMALIZATION_SQL = `multiIf(
    lower(p.Location) = 'bangalore', 'bengaluru',
    lower(p.Location) = 'gurgaon', 'gurugram',
    lower(p.Location) = 'ahemdabad', 'ahmedabad',
    lower(p.Location) = 'ahmedabad', 'ahmedabad',
    p.Location
)`;

async function debugDimensionOverview(dimension = 'category') {
    try {
        const endDate = dayjs().format('YYYY-MM-DD');
        const startDate = dayjs().subtract(14, 'day').format('YYYY-MM-DD');
        const isLocation = dimension === 'location' || dimension === 'city';
        const groupByExpr = isLocation ? CITY_NORMALIZATION_SQL : PRODUCT_CATEGORY_SQL;

        const periodDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
        const compareEndDate = dayjs(startDate).subtract(1, 'day').format('YYYY-MM-DD');
        const compareStartDate = dayjs(compareEndDate).subtract(periodDays - 1, 'day').format('YYYY-MM-DD');

        const query = `
        SELECT
            ${groupByExpr} AS dimension_name,
            COUNT(*) as row_count,
            AVG(CASE WHEN p.DATE BETWEEN '${startDate}' AND '${endDate}' THEN 1 ELSE 0 END) as in_current_period
        FROM rb_pdp_olap p
        WHERE p.DATE BETWEEN '${compareStartDate}' AND '${endDate}'
          AND ${groupByExpr} IS NOT NULL
          AND ${groupByExpr} != ''
        GROUP BY dimension_name
        ORDER BY row_count DESC
        LIMIT 10
        `;

        console.log(`Executing debug query for ${dimension}...`);
        const results = await queryClickHouse(query);
        console.log(`Results for ${dimension}:`, JSON.stringify(results, null, 2));
    } catch (error) {
        console.error('Debug query failed:', error);
    }
}

async function run() {
    await debugDimensionOverview('category');
    await debugDimensionOverview('city');
    process.exit(0);
}

run();
