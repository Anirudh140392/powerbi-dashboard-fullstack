import { clickhouse } from './src/config/clickhouse.js';

async function run() {
  try {
    const r = await clickhouse.query('SELECT platform, sum(toFloat64(total_ad_spend)) as spend FROM rb_pm_olap GROUP BY platform').toPromise();
    console.log(r);
  } catch (e) {
    console.error(e);
  }
}
run();
