import axios from 'axios';

async function verifyFixes() {
    const baseURL = 'http://localhost:5000/api'; // Assuming default port
    try {
        console.log('--- VERIFYING INVENTORY MATRIX ---');
        const res = await axios.get(`${baseURL}/inventory-analysis/matrix`, {
            params: {
                startDate: '2025-12-01',
                endDate: '2025-12-12'
            }
        });
        
        const data = res.data.data;
        console.log(`Received ${data.length} rows.`);
        
        const competitors = data.filter(r => 
            r.sku.toLowerCase().includes('5 star') || 
            r.sku.toLowerCase().includes('amul')
        );
        
        if (competitors.length > 0) {
            console.error('❌ FAILED: Found competitor SKUs in matrix:', competitors.map(c => c.sku));
        } else {
            console.log('✅ SUCCESS: No competitor SKUs found in matrix.');
        }
        
        const negatives = data.filter(r => r.inventory < 0);
        if (negatives.length > 0) {
            console.error('❌ FAILED: Found negative inventory values:', negatives.slice(0, 5));
        } else {
            console.log('✅ SUCCESS: No negative inventory values found.');
        }

    } catch (err) {
        console.error('Error during verification:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}

verifyFixes();
