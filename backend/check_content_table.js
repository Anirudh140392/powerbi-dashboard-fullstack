
import dotenv from 'dotenv';
dotenv.config();
import { queryClickHouse } from './src/config/clickhouse.js';

const checkTable = async () => {
    try {
        console.log("🔍 Checking tb_content_score_data structure...");

        // 1. Check if table exists and get 1 row
        const query = `SELECT * FROM tb_content_score_data LIMIT 1`;
        const result = await queryClickHouse(query);

        console.log("✅ Result:", JSON.stringify(result, null, 2));

        // 2. Get column types if possible (or just infer from result)
        // ClickHouse 'DESCRIBE table' might work if supported by the wrapper, but select * is safer for now.

    } catch (error) {
        console.error("❌ Error checking table:", error);
    }
};

checkTable();
