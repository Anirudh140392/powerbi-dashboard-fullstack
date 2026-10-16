import dotenv from 'dotenv';

dotenv.config();

console.error('db_spec_scraper.ts is disabled. It writes masters.products directly and needs an audited master QC store before it can be used safely.');
process.exit(1);
