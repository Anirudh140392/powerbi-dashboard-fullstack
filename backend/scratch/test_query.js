import { queryAdminDB } from '../src/config/adminClickhouse.js';
queryAdminDB("SELECT MAX(po_date) as max_date FROM mars.po_primary_sales")
  .then(rows => { console.log('max date:', rows); process.exit(0); })
  .catch(console.error);
