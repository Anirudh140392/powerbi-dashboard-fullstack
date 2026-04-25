const { ClickHouse } = require('clickhouse');
const clickhouse = new ClickHouse({
  url: 'http://216.48.177.108',
  port: 8123,
  debug: false,
  basicAuth: { username: 'default', password: '' }
});
async function main() {
  const rs = await clickhouse.query('DESCRIBE TABLE demo.rb_ms_olap FORMAT JSONEachRow').toPromise();
  console.log(rs.slice(0, 15));
}
main();
