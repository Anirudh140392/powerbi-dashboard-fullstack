import axios from 'axios';

const testCompetitionApi = async () => {
    try {
        const params = {
            platform: 'All',
            location: 'All',
            category: 'All',
            brand: 'All',
            period: '1M'
        };

        console.log('Testing Competition API with params:', params);
        const response = await axios.get('http://localhost:5000/api/availability-analysis/competition', { params });

        if (response.data) {
            if (response.data.brands) {
                console.log('Success! Received', response.data.brands.length, 'brands');
                if (response.data.brands.length > 0) {
                    const firstBrand = response.data.brands[0];
                    console.log('First brand sample:', {
                        brand: firstBrand.brand,
                        osa: firstBrand.osa,
                        doi: firstBrand.doi,
                        fillrate: firstBrand.fillrate
                    });
                }
            }
            if (response.data.skus) {
                console.log('Success! Received', response.data.skus.length, 'skus');
                if (response.data.skus.length > 0) {
                    const firstSku = response.data.skus[0];
                    console.log('First SKU sample:', {
                        sku: firstSku.sku_name,
                        brand: firstSku.brand_name,
                        osa: firstSku.osa,
                        doi: firstSku.doi,
                        fillrate: firstSku.fillrate
                    });
                }
            }
        } else {
            console.error('Invalid response format:', response.data);
        }
    } catch (error) {
        console.error('Error testing API:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
};

testCompetitionApi();
