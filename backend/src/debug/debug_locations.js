import { queryClickHouse } from '../config/clickhouse.js';
async function run() {
  try {
    const locations = await queryClickHouse("SELECT DISTINCT location FROM rca_sku_dim");
    console.log("Locations from rca_sku_dim:", locations);
  } catch (err) {
    console.error(err);
  }
}
run();
