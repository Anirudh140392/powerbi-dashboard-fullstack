
import "dotenv/config";
import { queryClickHouse } from './src/config/clickhouse.js';
import fs from 'fs';

const checkColumns = async () => {
    try {
        const query = `
            SELECT name
            FROM system.columns 
            WHERE table = 'tb_content_score_data'
        `;

        const result = await queryClickHouse(query);
        const columns = result.map(r => r.name);
        fs.writeFileSync('check_content_columns.json', JSON.stringify(columns, null, 2));

    } catch (error) {
        console.error("Error:", error);
    }
};

checkColumns();
