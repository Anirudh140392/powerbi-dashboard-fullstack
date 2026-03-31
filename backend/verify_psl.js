
import axios from 'axios';

async function verifyPsl() {
    const baseUrl = 'http://localhost:5000/api/availability-analysis/absolute-osa/platform-kpi-matrix';
    const params = {
        viewMode: 'Platform',
        startDate: '2025-03-01',
        endDate: '2025-03-07'
    };

    try {
        console.log('Fetching Platform KPI Matrix...');
        const response = await axios.get(baseUrl, { params });
        const data = response.data;

        console.log('Columns:', data.columns);
        const pslRow = data.rows.find(r => r.kpi.toLowerCase() === 'psl');

        if (pslRow) {
            console.log('✅ PSL Row found!');
            console.log('PSL Data Sample:', JSON.stringify(pslRow, null, 2).substring(0, 500) + '...');
            
            // Check if values are numeric and not all zero/null
            const platforms = data.columns.filter(c => c !== 'KPI');
            platforms.forEach(p => {
                console.log(`Platform ${p}: PSL = ${pslRow[p]}`);
            });
        } else {
            console.log('❌ PSL Row NOT found!');
            console.log('Available KPIs:', data.rows.map(r => r.kpi));
        }

    } catch (error) {
        console.error('Error verifying PSL:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

verifyPsl();
