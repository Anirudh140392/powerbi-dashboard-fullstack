
import axios from 'axios';

const apiBase = 'http://localhost:5000/api';

async function verifyPlatformOverview() {
    try {
        console.log('--- Verifying Platform Overview API ---');
        const response = await axios.get(`${apiBase}/watchtower/platform-overview`, {
            params: {
                period: '3M',
                brand: 'All',
                location: 'All',
                category: 'All'
            }
        });

        const data = response.data;
        if (!Array.isArray(data)) {
            console.error('Error: Response is not an array');
            return;
        }

        const allRow = data.find(row => row.label === 'All');
        if (allRow) {
            console.log('All Row Columns:');
            allRow.columns.forEach(col => {
                console.log(`- ${col.title}: ${col.value} (Change: ${col.change?.text || 'N/A'}, Meta Units: ${col.meta?.units})`);
            });
        }

        const blinkitRow = data.find(row => row.label === 'Blinkit');
        if (blinkitRow) {
            console.log('\nBlinkit Columns:');
            blinkitRow.columns.forEach(col => {
                console.log(`- ${col.title}: ${col.value} (Change: ${col.change?.text || 'N/A'}, Meta Units: ${col.meta?.units})`);
            });
        }

    } catch (error) {
        console.error('Error during verification:', error.message);
    }
}

verifyPlatformOverview();
