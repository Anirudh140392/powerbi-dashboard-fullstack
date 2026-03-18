const axios = require('axios');
async function run() {
    try {
        const query = `
            SELECT 
                keyword_search_product as sku,
                topKIf(1)(POSITION, spons = '1') as ad_pos_arr,
                topKIf(1)(POSITION, organic = '1') as org_pos_arr,
                topKIf(1)(POSITION, overall = '1') as overall_pos_arr,
                topKIf(1)(brand_name_th, brand_name_th != '') as brand_arr
            FROM rb_kw_olap
            WHERE keyword_search_product != '' AND POSITION < 11
            GROUP BY sku
            LIMIT 5
        `;
        const res = await axios.post('http://localhost:8123/', query, {
            auth: { username: 'default', password: '' }
        });
        console.log(res.data);
    } catch(err) { console.error(err.response ? err.response.data : err.message); }
}
run();
