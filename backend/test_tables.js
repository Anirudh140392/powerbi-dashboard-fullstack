import { createClient } from '@clickhouse/client';

const client = createClient({
  url: 'http://13.200.55.131:8123',
  username: 'kenil_user',
  password: 'Kenil@Kavar0604',
  database: 'mamaearth'
});

async function run() {
  try {
    const query = `
      SELECT 
        delivery_date, 
        DATE,
        coalesce(parseDateTimeBestEffortOrNull(delivery_date), parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE))))) as parsed_date,
        dateDiff('day', DATE, coalesce(parseDateTimeBestEffortOrNull(delivery_date), parseDateTimeBestEffortOrNull(concat(delivery_date, ' ', toString(toYear(DATE)))))) as diff
      FROM rb_pdp_olap 
      WHERE Platform = 'flipkart' AND delivery_date IS NOT NULL AND delivery_date != ''
      LIMIT 10
    `;
    const resultSet = await client.query({ query, format: 'JSONEachRow' });
    const dataset = await resultSet.json();
    console.log("Coalesce Parsed Date check for flipkart in rb_pdp_olap table:");
    console.log(dataset);
  } catch (error) {
    console.error("Error querying:", error.message);
  } finally {
    await client.close();
  }
}

run();
