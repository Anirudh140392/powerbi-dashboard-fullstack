import axios from 'axios';
import 'dotenv/config';

const API_URL = 'http://localhost:5000/api';

async function verifyFix() {
    console.log('Verifying Competition Fix...');
    try {
        const response = await axios.get(`${API_URL}/visibility-analysis/competition`, {
            params: {
                platform: 'Zepto',
                period: '1M'
            }
        });

        console.log('Status:', response.status);
        console.log('Brands found:', response.data.brands?.length || 0);
        console.log('SKUs found:', response.data.skus?.length || 0);

        if (response.data.brands?.length > 0) {
            console.log('Sample Brand:', response.data.brands[0].brand);
        }

        if (response.data.brands?.length > 0 || response.data.skus?.length > 0) {
            console.log('✅ Fix Verified: Data is now returning for Competition tab.');
        } else {
            console.log('❌ Fix Failed: Competition tab data is still empty.');
        }
    } catch (error) {
        console.error('Error during verification:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

verifyFix();
