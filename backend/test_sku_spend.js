import { createClient } from '@clickhouse/client';
import moment from 'moment';

const client = createClient({
    url: 'http://13.200.55.131:8123',
    username: 'readonly_user',
    password: 'Readonly@123',
    database: 'colpal',
});
async function run() {
    const rs = await client.query({ 
        query: `
            SELECT Product,
                   SUM(ifNull(toFloat64OrZero(replaceRegexpAll(toString(Ad_Spend), '[^0-9.-]', '')), 0)) as total_spend
            FROM rb_pdp_olap
            WHERE Brand='Oral-B' AND Product IS NOT NULL AND Product != ''
            GROUP BY Product
        `, 
        format: 'JSONEachRow' 
    });
    console.log(await rs.json());
    process.exit(0);
}
run();
