async function verifyParity() {
    try {
        const catRes = await fetch('http://localhost:3001/api/ratings/category-health', {
            headers: { 'x-company-id': 'prestige' } 
        });
        const execRes = await fetch('http://localhost:3001/api/ratings/executive-health', {
            headers: { 'x-company-id': 'prestige' }
        });

        const catData = await catRes.json();
        const execData = await execRes.json();

        if (catData.error) {
            console.error('Cat Health Error:', catData.error);
            return;
        }
        if (execData.error) {
            console.error('Exec Health Error:', execData.error);
            return;
        }

        if (!catData.categories) {
            console.error('Cat Data has no categories:', catData);
            return;
        }

        const catSummary = {
            pareto: catData.categories.reduce((s, c) => s + (c.paretoCount || 0), 0),
            nonPareto: catData.categories.reduce((s, c) => s + (c.nonParetoCount || 0), 0),
            npd: catData.categories.reduce((s, c) => s + (c.npdCount || 0), 0)
        };

        const execSummary = {
            pareto: execData.Pareto.total,
            nonPareto: execData['Non-Pareto'].total,
            npd: execData.NPD.total
        };

        console.log('Category Health Counts:', catSummary);
        console.log('Executive Overview Counts:', execSummary);

        if (catSummary.pareto === execSummary.pareto && 
            catSummary.nonPareto === execSummary.nonPareto && 
            catSummary.npd === execSummary.npd) {
            console.log('✅ SUCCESS: Counts are perfectly consistent!');
        } else {
            console.log('❌ DISCREPANCY DETECTED:');
            console.log('Diff Pareto:', catSummary.pareto - execSummary.pareto);
            console.log('Diff Non-Pareto:', catSummary.nonPareto - execSummary.nonPareto);
            console.log('Diff NPD:', catSummary.npd - execSummary.npd);
        }

    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

verifyParity();
