import { createClient } from '@clickhouse/client';

(async () => {
    const client = createClient({
        url: 'http://13.200.55.131:8123',
        username: 'readonly_user',
        password: 'Readonly@123',
        database: 'mars'
    });

    try {
        console.log('--- VERIFYING BRAND FILTER LOGIC (rb_pdp_olap) ---');

        // 1. Check total unique brands in rb_pdp_olap
        const totalBrandsRes = await client.query({
            query: `SELECT COUNT(DISTINCT Brand) as total FROM rb_pdp_olap WHERE Brand IS NOT NULL AND Brand != ''`,
            format: 'JSONEachRow'
        });
        const totalBrands = (await totalBrandsRes.json())[0].total;
        console.log('Total Unique Brands in rb_pdp_olap:', totalBrands);

        // 2. Check brands with Comp_flag = 0 (Own Brands)
        const ownBrandsRes = await client.query({
            query: `SELECT COUNT(DISTINCT Brand) as total FROM rb_pdp_olap WHERE toString(Comp_flag) = '0' AND Brand IS NOT NULL AND Brand != ''`,
            format: 'JSONEachRow'
        });
        const ownBrands = (await ownBrandsRes.json())[0].total;
        console.log('Own Brands (Comp_flag=0):', ownBrands);

        // 3. Check brands with Comp_flag = 1 (Competitor Brands)
        const compBrandsRes = await client.query({
            query: `SELECT COUNT(DISTINCT Brand) as total FROM rb_pdp_olap WHERE toString(Comp_flag) = '1' AND Brand IS NOT NULL AND Brand != ''`,
            format: 'JSONEachRow'
        });
        const compBrands = (await compBrandsRes.json())[0].total;
        console.log('Competitor Brands (Comp_flag=1):', compBrands);

        // 4. Sample Competitor Brands
        const sampleCompRes = await client.query({
            query: `SELECT DISTINCT Brand FROM rb_pdp_olap WHERE toString(Comp_flag) = '1' AND Brand IS NOT NULL AND Brand != '' LIMIT 10`,
            format: 'JSONEachRow'
        });
        const sampleComp = await sampleCompRes.json();
        console.log('Sample Competitor Brands:', sampleComp.map(r => r.Brand));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
})();
