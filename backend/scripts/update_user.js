import adminClickhouse from '../src/config/adminClickhouse.js';

async function updateMapping() {
    try {
        const marsDbId = "256044896700991000";
        const userEmail = "kenilkavar@gmail.com";

        console.log(`Updating ${userEmail} to db_id ${marsDbId}...`);

        // Using ALTER TABLE UPDATE syntax for ClickHouse
        const query = `
            ALTER TABLE tb_user 
            UPDATE db_id = ${marsDbId} 
            WHERE user_email = '${userEmail}'
        `;

        await adminClickhouse.query({ query });
        console.log("Update command sent successfully.");

        // Wait a bit for ClickHouse to process the mutation
        setTimeout(async () => {
            const res = await adminClickhouse.query({
                query: `SELECT user_email, toString(db_id) as db_id FROM tb_user WHERE user_email = '${userEmail}'`,
                format: 'JSONEachRow'
            });
            const data = await res.json();
            console.log("Verified mapping:", JSON.stringify(data, null, 2));
        }, 2000);

    } catch (err) {
        console.error("Update failed:", err.message);
    }
}
updateMapping();
