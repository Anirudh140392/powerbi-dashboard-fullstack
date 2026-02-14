// Test the Watch Tower API to see what platforms are returned
import 'dotenv/config';
import axios from 'axios';

async function testAPI() {
    try {
        console.log('\n=== TESTING WATCH TOWER API ===\n');

        const response = await axios.get('http://localhost:5000/api/watchtower/platform-overview', {
            params: {
                months: 1,
                brand: 'All',
                location: 'All',
                category: 'All',
                platform: 'All'
            }
        });

        const platforms = response.data;

        console.log(`Total platforms returned: ${platforms.length}\n`);

        platforms.forEach((p, i) => {
            console.log(`${i + 1}. ${p.label} (${p.type})`);
            console.log(`   Key: ${p.key}`);
            console.log(`   Columns: ${p.columns.length} metrics`);
            console.log('');
        });

        console.log('===========================\n');

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testAPI();
