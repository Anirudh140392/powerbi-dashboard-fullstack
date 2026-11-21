import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
  host: 'http://13.203.251.97:8123',
  username: 'yash_user',
  password: 'yash@Gautam0100',
  database: 'prestige',
});

async function run() {
  const queryParams = { companyId: '22', webPid: 'B0CH321V2Q' };
  const sql = `
            WITH latest_snapshots AS (
                SELECT
                    web_pid,
                    lower(platform) AS platform_key_internal,
                    argMax(price_rp, tuple(snapshot_date, created_at)) AS price_rp,
                    argMax(price_sp, tuple(snapshot_date, created_at)) AS price_sp,
                    argMax(category, tuple(snapshot_date, created_at)) AS category,
                    argMax(pareto_status, tuple(snapshot_date, created_at)) AS pareto_status,
                    argMax(rating, tuple(snapshot_date, created_at)) AS rating,
                    argMax(rating_count, tuple(snapshot_date, created_at)) AS rating_count
                FROM product_snapshots ls
                WHERE company_id = {companyId:String} 
                GROUP BY web_pid, lower(platform)
            ),
            cat_catalogue AS (
                SELECT
                    multiIf(trim(lower(mp.category)) IN ('other', 'others'), 'Others', initcap(trim(mp.category))) AS cat_name,
                    count(DISTINCT mp.product_external_id) AS catalogue_sku_count
                FROM products mp
                WHERE mp.company_id = {companyId:String} AND mp.platform != '' AND mp.category != '' 
                GROUP BY cat_name
            )
            SELECT * FROM cat_catalogue
  `;
  try {
      const res = await clickhouse.query({ query: sql, query_params: queryParams, format: 'JSONEachRow' });
      const rows = await res.json();
      console.log(rows);
  } catch (e) {
      console.error(e);
  }
}
run();
