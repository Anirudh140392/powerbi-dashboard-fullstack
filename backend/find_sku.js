import { queryAdminDB } from './src/config/adminClickhouse.js';

async function run() {
    try {
        const query = `
            SELECT DISTINCT Product, Web_Pid
            FROM mamaearth.rb_pdp_olap
            WHERE Product ILIKE '%hyaluronic sunscreen%'
               OR Product ILIKE '%sunscreen aqua gel%'
            LIMIT 20
        `;
        const result = await queryAdminDB(query);
        console.log("Matching products:", result);
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}
run();
