
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const url = "http://13.200.55.131:8123";
const username = "readonly_user";
const password = "Readonly@123";

async function listDbs() {
    try {
        const client = createClient({ url, username, password });
        const result = await client.query({ query: 'SHOW DATABASES', format: 'JSONEachRow' });
        const data = await result.json();
        console.log(JSON.stringify(data));
    } catch(e) {
        console.error(e);
    }
}

listDbs().then(() => process.exit());
