
import { queryClickHouse } from './src/config/clickhouse.js';

async function listRBBrands() {
    try {
        const res = await queryClickHouse("SELECT DISTINCT brand_name_th FROM rb_kw_olap WHERE flag = '1'");
        console.log('RB Brands (flag=1):');
        console.table(res);

        const boomerRes = await queryClickHouse("SELECT DISTINCT brand_name_th, flag FROM rb_kw_olap WHERE brand_name_th ILIKE '%boomer%'");
        console.log('Boomer records:');
        console.table(boomerRes);

    } catch (err) {
        console.error('Error:', err);
    }
}

listRBBrands();
