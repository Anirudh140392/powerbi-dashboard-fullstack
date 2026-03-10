import axios from 'axios';
import 'dotenv/config';

const API_URL = 'http://localhost:5000/api';

async function verifyFilters() {
    console.log('Verifying Competition Filter Options Fix...');
    try {
        // 1. Test brands for Instamart
        const resBrandsInstamart = await axios.get(`${API_URL}/visibility-analysis/filter-options`, {
            params: { filterType: 'brands', platform: 'Instamart' }
        });
        console.log('Instamart brands count:', resBrandsInstamart.data.options?.length);
        if (resBrandsInstamart.data.options?.length > 0) {
            console.log('Sample Instamart brand:', resBrandsInstamart.data.options[0]);
        }

        // 2. Test brands for Zepto (different platform)
        const resBrandsZepto = await axios.get(`${API_URL}/visibility-analysis/filter-options`, {
            params: { filterType: 'brands', platform: 'Zepto' }
        });
        console.log('Zepto brands count:', resBrandsZepto.data.options?.length);

        // 3. Test formats for Instamart
        const resFormatsInstamart = await axios.get(`${API_URL}/visibility-analysis/filter-options`, {
            params: { filterType: 'formats', platform: 'Instamart' }
        });
        console.log('Instamart formats (Categories):', resFormatsInstamart.data.options?.length);

        // 4. Compare brands with and without platform (to ensure isolation)
        const resBrandsAll = await axios.get(`${API_URL}/visibility-analysis/filter-options`, {
            params: { filterType: 'brands', platform: 'All' }
        });
        console.log('All platforms brands count:', resBrandsAll.data.options?.length);

        console.log('✅ Filter Verification Complete.');
    } catch (error) {
        console.error('Error during filter verification:', error.message);
    }
}

verifyFilters();
