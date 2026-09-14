import { queryClickHouse } from './src/config/clickhouse.js';
import { getTableColumns, columnExists, resolveColumn } from './src/utils/schemaHelper.js';

async function test(channel) {
  const verifyCols = await getTableColumns('rb_product_verify', 'mars');
  const hasChannelVerify = columnExists(verifyCols, 'channel');
  const verifyPlatformCol = resolveColumn(verifyCols, 'platform', 'Platform');
  const verifyChannelCol = resolveColumn(verifyCols, 'channel', 'Channel');

  let query = `SELECT DISTINCT ${verifyPlatformCol} AS Platform FROM mars.rb_product_verify WHERE isNotNull(${verifyPlatformCol}) AND ${verifyPlatformCol} != '\\\\N' AND ${verifyPlatformCol} != ''`;
  if (hasChannelVerify && channel && channel !== 'All') {
      const isEcom = channel.toLowerCase().includes('ecom') || channel.toLowerCase().includes('e-com');
      const searchPattern = isEcom ? '%ecom%' : (channel.toLowerCase().includes('quick') ? '%quick%' : `%${channel.toLowerCase().replace(/'/g, "''")}%`);
      query += ` AND lower(${verifyChannelCol}) LIKE '${searchPattern}'`;
  }
  query += ` ORDER BY Platform`;
  console.log("Query:", query);
  
  const result = await queryClickHouse(query);
  const platforms = result.map(row => row.Platform).filter(Boolean);
  console.log(channel, ":", platforms);
}

test('quickcomm').then(() => test('ecommerce')).catch(console.error);
