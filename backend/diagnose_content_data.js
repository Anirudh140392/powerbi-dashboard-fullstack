
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'GCPL',
});

async function runDiagnostics() {
    try {
        console.log("🔍 Diagnosing tb_content_score_data...");

        // 1. Check Date Range
        const dateQuery = `
            SELECT 
                min(extraction_timestamp) as min_date, 
                max(extraction_timestamp) as max_date 
            FROM tb_content_score_data
        `;
        const dateResult = await clickhouse.query({ query: dateQuery, format: 'JSONEachRow' });
        const dateData = await dateResult.json();
        if (dateData.length > 0) {
            console.log("📅 Min Date:", dateData[0].min_date);
            console.log("📅 Max Date:", dateData[0].max_date);
        } else {
            console.log("📅 No date data found");
        }

        // 2. Check Brands (limit 20)
        const brandQuery = `
            SELECT DISTINCT brand_name 
            FROM tb_content_score_data 
            LIMIT 20
        `;
        const brandResult = await clickhouse.query({ query: brandQuery, format: 'JSONEachRow' });
        const brandData = await brandResult.json();
        console.log("🏷️  Brands (Sample):", brandData.map(r => r.brand_name));

        // 3. Check Derived Platforms (Simulation)
        // We can't group by derived logic easily in standard SQL without repeating it, 
        // so let's just fetch some URLs to see what we have.
        const urlQuery = `SELECT url FROM tb_content_score_data LIMIT 20`;
        const urlResult = await clickhouse.query({ query: urlQuery, format: 'JSONEachRow' });
        const urlData = await urlResult.json();
        const platforms = urlData.map(r => {
            if (r.url.includes('amazon')) return 'Amazon';
            if (r.url.includes('blinkit')) return 'Blinkit';
            if (r.url.includes('zepto')) return 'Zepto';
            if (r.url.includes('swiggy')) return 'Instamart';
            return 'Other';
        });
        const fs = await import('fs');
        const output = {
            dateRange: dateData,
            brands: brandData.map(r => r.brand_name),
            platforms: [...new Set(platforms)]
        };
        fs.writeFileSync('diag_output.txt', JSON.stringify(output, null, 2));
        console.log("✅ Written diagnostics to diag_output.txt");

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

runDiagnostics();
