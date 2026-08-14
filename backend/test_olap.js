import { queryClickHouse } from './src/config/clickhouse.js';
async function test() {
  try {
    const qEcom = `
      SELECT DISTINCT platform AS Platform 
      FROM danone.rb_content_olap 
      WHERE isNotNull(platform) AND platform != '\\N' AND platform != '' 
        AND lower(platform) IN (
            SELECT lower(Platform) 
            FROM danone.rb_pdp_olap 
            WHERE isNotNull(Platform) AND lower(CHANNEL) = 'ecommerce'
        )
      ORDER BY Platform
    `;
    const resEcom = await queryClickHouse(qEcom);
    console.log("EComm Content Platforms:", resEcom);
    
    const qQcomm = `
      SELECT DISTINCT platform AS Platform 
      FROM danone.rb_content_olap 
      WHERE isNotNull(platform) AND platform != '\\N' AND platform != '' 
        AND lower(platform) IN (
            SELECT lower(Platform) 
            FROM danone.rb_pdp_olap 
            WHERE isNotNull(Platform) AND lower(CHANNEL) = 'quickcomm'
        )
      ORDER BY Platform
    `;
    const resQcomm = await queryClickHouse(qQcomm);
    console.log("QComm Content Platforms:", resQcomm);
  } catch (e) { console.error(e); }
}
test();
