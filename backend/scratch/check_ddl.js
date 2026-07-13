import { queryClickHouse } from '../src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function getDDL() {
    try {
        const dicts = ['dict_city_alias', 'dict_feeder_city', 'dict_article_to_sap', 'dict_ean_to_dcom'];
        for (const d of dicts) {
            console.log(`\n=== DDL for ${d} ===`);
            try {
                const res = await queryClickHouse(`SHOW CREATE DICTIONARY mars.${d}`);
                console.log(res[0].statement);
            } catch (err) {
                console.log(`Failed to get dictionary DDL for ${d}, trying as table...`);
                try {
                    const res = await queryClickHouse(`SHOW CREATE TABLE mars.${d}`);
                    console.log(res[0].statement);
                } catch (e2) {
                    console.error(`Both failed for ${d}:`, e2.message);
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

getDDL();
