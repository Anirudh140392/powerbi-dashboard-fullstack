import axios from 'axios';

async function testParams(params) {
    try {
        const url = `http://localhost:5000/api/visibility-analysis/search-terms?${new URLSearchParams(params).toString()}`;
        console.log(`\nTesting: ${JSON.stringify(params)}`);
        const res = await axios.get(url);
        console.log(`Terms Count: ${res.data.terms?.length}`);
        if (res.data.terms?.length > 0) {
            console.log(`First term: ${res.data.terms[0].keyword} (Total: ${res.data.terms[0].total})`);
        }
    } catch (e) {
        console.log(`Error:`, e.message);
    }
}

async function run() {
    await testParams({ filter: 'All', keywordType: 'All' });
    await testParams({ filter: 'All', keywordType: 'Branded' });
    await testParams({ filter: 'All', keywordType: ['Branded', 'Generic'] });
    await testParams({ filter: 'Branded', keywordType: 'All' });
    await testParams({ filter: 'Branded', keywordType: 'Generic' });
}

run();
