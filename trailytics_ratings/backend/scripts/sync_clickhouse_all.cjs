/**
 * Orchestrator — runs the three ClickHouse → Postgres syncs in order:
 *   master → reviews → prices
 *
 * Drop-in replacement for sync_mysql_all.cjs. The Temporal worker's
 * runMysqlSync activity now spawns this script (env var COMPANY_ID required).
 */
const { spawn } = require('child_process');
const path = require('path');

const scripts = [
    'sync_clickhouse_master.cjs',
    'sync_clickhouse_reviews.cjs',
    'sync_clickhouse_prices.cjs',
];

function runScript(scriptName) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, scriptName)], { stdio: 'inherit' });
        child.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`${scriptName} exited with code ${code}`));
        });
    });
}

async function main() {
    for (const script of scripts) {
        console.log(`\n=== Running ${script} ===`);
        await runScript(script);
    }
    console.log('\nClickHouse sync chain complete.');
}

main().catch(err => {
    console.error('Sync chain failed:', err.message);
    process.exit(1);
});
