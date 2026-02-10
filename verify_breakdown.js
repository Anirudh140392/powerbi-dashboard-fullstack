// Verification script using global fetch (Node 18+)

async function testBreakdown(dimension) {
    console.log(`\n--- Testing ${dimension} breakdown ---`);
    try {
        const url = `http://localhost:5000/api/availability-analysis/absolute-osa/platform-kpi-matrix?viewMode=Platform&drillDimension=${dimension}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        console.log('Columns:', data.columns);
        const osaRow = data.rows.find(r => r.kpi === 'OSA');
        if (osaRow) {
            console.log('OSA Breakdown Keys:', Object.keys(osaRow.breakdown || {}));
            const firstEntity = Object.keys(osaRow.breakdown || {})[0];
            if (firstEntity) {
                console.log(`Breakdown for ${firstEntity}:`, osaRow.breakdown[firstEntity]);
            }
        } else {
            console.log('OSA row not found');
        }
    } catch (err) {
        console.error(`Error testing ${dimension}:`, err.message);
    }
}

async function runTests() {
    await testBreakdown('region');
    await testBreakdown('period');
    await testBreakdown('competitors');
}

runTests();
