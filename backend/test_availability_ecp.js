import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function testAvailabilityCityEcp() {
    try {
        console.log('Testing Availability Analysis City ECP Drilldown API...');
        const response = await axios.get(`${API_BASE}/availability-analysis/brand-sku-city-day?dayRange=7`);

        if (response.data.success) {
            console.log('✅ API call successful');
            const data = response.data.data;
            console.log(`Total brands: ${data.length}`);

            let foundEcp = false;
            for (const brand of data) {
                if (brand.skus) {
                    for (const sku of brand.skus) {
                        if (sku.cities) {
                            for (const city of sku.cities) {
                                for (const date in city.days) {
                                    const metrics = city.days[date];
                                    if (metrics.ecp > 0) {
                                        console.log(`✅ Found valid ECP in ${brand.brand} -> ${sku.name} -> ${city.name}: ${metrics.ecp}`);
                                        foundEcp = true;
                                        break;
                                    }
                                }
                                if (foundEcp) break;
                            }
                        }
                        if (foundEcp) break;
                    }
                }
                if (foundEcp) break;
            }

            if (!foundEcp) {
                console.warn('⚠️ No ECP > 0 found in the returned data. This might be due to missing data in ClickHouse.');
            }
        } else {
            console.error('❌ API call failed:', response.data);
        }
    } catch (error) {
        console.error('❌ Error testing API:', error.message);
    }
}

testAvailabilityCityEcp();
