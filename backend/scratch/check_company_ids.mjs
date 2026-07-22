import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { queryAdminDB } = await import('../src/config/adminClickhouse.js');

console.log('Querying tb_database...');
const rows = await queryAdminDB('SELECT db_name, toString(db_id) as db_id, company_id FROM tb_database ORDER BY db_name');
console.log('\n=== tb_database rows ===');
rows.forEach(r => console.log(` db_name=${r.db_name} | db_id=${r.db_id} | company_id=${r.company_id}`));
process.exit(0);
