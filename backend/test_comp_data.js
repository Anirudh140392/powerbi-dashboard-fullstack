import * as dotenv from 'dotenv';
dotenv.config();

import { getAvailabilityCompetitionData } from './src/services/availabilityService.js';

async function run() {
  const filters = { platform: 'Blinkit', period: '1M', location: 'All', category: 'All', brand: 'All' };
  console.log("Testing with filters:", filters);
  const data = await getAvailabilityCompetitionData(filters);
  console.log("Brands count:", data.brands.length);
  if (data.brands.length > 0) {
    console.log("First brand:", data.brands[0]);
  } else {
    console.log(data);
  }
  process.exit();
}
run().catch(console.error);
