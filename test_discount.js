import { ClickHouse } from 'clickhouse';

const clickhouse = new ClickHouse({
    url: 'http://localhost:8123',
    debug: false,
    basicAuth: null,
    isSessionPerQuery: false,
    format: 'json',
    config: {
        database: 'mars'
    }
});

async function testDiscount() {
    const query = `
        SELECT 
            Brand,
            AVG(CASE WHEN toFloat64OrZero(toString(MRP)) > 0 
                     THEN (toFloat64OrZero(toString(MRP)) - toFloat64OrZero(toString(Selling_Price))) / toFloat64OrZero(toString(MRP)) 
                     ELSE 0 END) * 100 as avg_discount
        FROM rb_pdp_olap
        WHERE Brand = 'Snickers'
        GROUP BY Brand
    `;
    const data = await clickhouse.query(query).toPromise();
    console.log('Discount Data for Snickers:', data);
}

testDiscount().catch(console.error);
