import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import ecomRcaService from './src/services/ecomRcaService.js';

async function testSOS() {
    try {
        console.log('--- Phase 1: Test Overall SOS ---');
        const filtersBrand = {
            platform: 'Blinkit',
            category: 'All',
            kpiCategory: 'Share of Search Overall',
            drilldownLevel: 'brand'
        };
        const resBrand = await ecomRcaService.getEcomRcaData(filtersBrand);
        
        const sovNode = resBrand.tree.children[0].children.find(c => c.id === 'sov-overall');
        console.log('Share of Search Overall Node:', JSON.stringify(sovNode, null, 2));
        
        if (sovNode && sovNode.value !== '0.0% ' && sovNode.value !== 'NaN%') {
            console.log('✅ SOS Overall value found:', sovNode.value);
        } else {
            console.log('❌ SOS Overall value missing or invalid:', sovNode?.value);
        }

        console.log('\n--- Phase 2: Test Brand Level Drilldown ---');
        const brands = resBrand.rows.map(r => r.name);
        console.log('Brands found:', brands);
        
        // Check if only Mars brands are present (approximately)
        const marsBrands = ['boomer', 'bounty', 'doublemint', 'galaxy', 'm&m', 'mars', 'orbit', 'skittles', 'snickers', 'twix'];
        const allAreMars = brands.every(b => marsBrands.includes(b.toLowerCase()));
        if (allAreMars && brands.length > 0) {
            console.log('✅ Only Mars brands found in drilldown.');
        } else {
            console.log('⚠️ Some non-Mars brands or no brands found. (Check if this is expected for the dataset)');
        }

        if (brands.length > 0) {
            const firstBrand = brands[0];
            console.log(`\n--- Phase 3: Test Keyword Level Drilldown for Brand: ${firstBrand} ---`);
            const filtersKw = {
                ...filtersBrand,
                drilldownLevel: 'keyword',
                drilldownId: firstBrand
            };
            const resKw = await ecomRcaService.getEcomRcaData(filtersKw);
            console.log(`Keywords found for ${firstBrand}:`, resKw.rows.slice(0, 5).map(r => r.name));
            
            if (resKw.rows.length > 0) {
                console.log('✅ Keyword drilldown successful.');
                
                const firstKw = resKw.rows[0].name;
                console.log(`\n--- Phase 4: Test Location Level Drilldown for Keyword: ${firstKw} ---`);
                const filtersLoc = {
                    ...filtersBrand,
                    drilldownLevel: 'location',
                    drilldownId: firstKw
                };
                const resLoc = await ecomRcaService.getEcomRcaData(filtersLoc);
                console.log(`Locations found for ${firstKw}:`, resLoc.rows.slice(0, 5).map(r => r.name));
                
                if (resLoc.rows.length > 0) {
                    console.log('✅ Location drilldown successful.');
                } else {
                    console.log('❌ Location drilldown failed (no rows found).');
                }
            } else {
                console.log('❌ Keyword drilldown failed (no rows found).');
            }
        }

    } catch (err) {
        console.error('ERROR during verification:', err);
    }
}

testSOS();
