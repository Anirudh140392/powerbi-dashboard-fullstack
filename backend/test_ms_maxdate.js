import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function testMsMaxDate() {
    try {
        const platform = 'Blinkit';
        const msMaxRes = await queryClickHouse(`
            SELECT MAX(toDate(created_on)) as max_date
            FROM rb_ms_olap
            WHERE sales IS NOT NULL AND sales > 0 AND lower(platform) = '${platform.toLowerCase()}'
        `);
        console.log('Blinkit max date in rb_ms_olap:', msMaxRes[0]?.max_date);

        const msEndDate = dayjs(msMaxRes[0]?.max_date);
        const msStartDate = msEndDate.subtract(30, 'days');

        console.log(`Using date range for rb_ms_olap: ${msStartDate.format('YYYY-MM-DD')} to ${msEndDate.format('YYYY-MM-DD')}`);

        const brandSalesQuery = await queryClickHouse(`
            SELECT group_brand as brand, SUM(toFloat64OrZero(toString(sales))) as brand_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${msStartDate.format('YYYY-MM-DD')}' AND '${msEndDate.format('YYYY-MM-DD')}'
              AND sales IS NOT NULL
              AND lower(platform) = '${platform.toLowerCase()}'
            GROUP BY group_brand
            ORDER BY brand_sales DESC
            LIMIT 10
        `);
        console.log('\nBrand sales (top 10):', brandSalesQuery);

        const catSalesQuery = await queryClickHouse(`
            SELECT category, SUM(toFloat64OrZero(toString(sales))) as total_cat_sales
            FROM rb_ms_olap
            WHERE toDate(created_on) BETWEEN '${msStartDate.format('YYYY-MM-DD')}' AND '${msEndDate.format('YYYY-MM-DD')}'
              AND sales IS NOT NULL
              AND lower(platform) = '${platform.toLowerCase()}'
            GROUP BY category
        `);
        console.log('\nCategory sales:', catSalesQuery);

        const catSalesMap = new Map(catSalesQuery.map(r => [r.category?.toLowerCase(), parseFloat(r.total_cat_sales || 0)]));
        const totalCatSales = Array.from(catSalesMap.values()).reduce((a, b) => a + b, 0);

        console.log('\n--- CALCULATED OFFTAKE SHARE FOR TOP BRANDS ---');
        brandSalesQuery.forEach(b => {
            const bSales = parseFloat(b.brand_sales || 0);
            const offtakeShare = totalCatSales > 0 ? (bSales / totalCatSales) * 100 : 0;
            console.log(`Brand: "${b.brand}" | Sales: ₹${bSales.toLocaleString()} | Offtake Share: ${offtakeShare.toFixed(2)}%`);
        });

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testMsMaxDate();
