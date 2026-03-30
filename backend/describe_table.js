
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function describe() {
    const client = createClient({
        url: process.env.CLICKHOUSE_URL,
        username: process.env.CLICKHOUSE_USER,
        password: process.env.CLICKHOUSE_PASSWORD,
        database: process.env.CLICKHOUSE_DB
    });
    
    const result = await client.query({
        query: 'DESCRIBE rb_pdp_olap',
        format: 'JSONEachRow'
    });
    const data = await result.json();
    console.log(JSON.stringify(data, null, 2));
}

describe().then(() => process.exit());
