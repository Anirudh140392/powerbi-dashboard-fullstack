const { spawn } = require('child_process');
const path = require('path');

const scripts = [
    'sync_mysql_master.cjs',
    'sync_mysql_reviews.cjs',
    'sync_prices_from_mysql.cjs',
];

function runScript(scriptName) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
            stdio: 'inherit',
        });

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
    console.log('\nMySQL sync chain complete.');
}

main().catch(err => {
    console.error('Sync chain failed:', err.message);
    process.exit(1);
});
