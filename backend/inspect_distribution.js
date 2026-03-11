
import { queryClickHouse } from './src/config/clickhouse.js';

async function inspectData() {
    try {
        console.log('--- Inspecting rb_kw_olap distribution ---');
        
        const platformFlagRes = await queryClickHouse('SELECT platform_name, flag, count() as total FROM rb_kw_olap GROUP BY platform_name, flag');
        console.log('Platform/Flag distribution:');
        console.table(platformFlagRes);

        const latestDateRes = await queryClickHouse('SELECT MAX(DATE) as maxDate FROM rb_kw_olap');
        const maxDate = latestDateRes[0].maxDate;
        console.log('Latest Date in DB:', maxDate);

        const blinkitRes = await queryClickHouse(`SELECT count() as total FROM rb_kw_olap WHERE platform_name = 'Blinkit' AND DATE = '${maxDate}'`);
        console.log(`Blinkit records for ${maxDate}:`, blinkitRes[0].total);

        const blinkitRBRes = await queryClickHouse(`SELECT count() as total FROM rb_kw_olap WHERE platform_name = 'Blinkit' AND DATE = '${maxDate}' AND flag = '1'`);
        console.log(`Blinkit RB (flag=1) records for ${maxDate}:`, blinkitRBRes[0].total);

    } catch (err) {
        console.error('Error:', err);
    }
}

inspectData();
