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
      SELECT DISTINCT 
        delivery_date, 
        typeof(delivery_date),
        count() as count
      FROM pdp 
      WHERE platform = 'Flipkart'
      GROUP BY delivery_date, typeof(delivery_date)
      ORDER BY count DESC
      LIMIT 10
    `;
    const resultSet = await client.query({ query, format: 'JSONEachRow' });
    const dataset = await resultSet.json();
    console.log("Delivery Dates for Flipkart in pdp table:");
    console.log(dataset);
    
  } catch (error) {
    console.error("Error querying:", error.message);
  } finally {
    await client.close();
  }
}

run();
