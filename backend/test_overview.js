import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    let query = `
            SELECT 
                AVG(verification_title) * 100 AS titleScore,
                AVG(verification_image) * 100 AS imageScore,
                AVG(
                    multiIf(
                        pf_id = 6, (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0)) / 5.0,
                        pf_id IN (1, 2, 3, 4, 7, 9), (coalesce(secondary_verification_image_2,0) + coalesce(secondary_verification_image_3,0) + coalesce(secondary_verification_image_4,0) + coalesce(secondary_verification_image_5,0) + coalesce(secondary_verification_image_6,0) + coalesce(secondary_verification_image_7,0)) / 6.0,
                        0.0
                    )
                ) * 100 AS siScore,
                AVG(
                    multiIf(
                        pf_id IN (2, 6, 7, 9), description_verification / 1.0,
                        pf_id IN (1, 3, 4), (bulletin_verification + description_verification) / 2.0,
                        (bulletin_verification + description_verification) / 2.0
                    )
                ) * 100 AS descScore,
                AVG(IF(lower(Platform) IN ('bigbasket', 'flipkart', 'amazon'), IF(pdp_rating_value >= 4.2, 1.0, 0.0), NULL)) * 100 AS ratingScore
            FROM rb_product_verify
            WHERE 1=1
            AND toDate(created_on) BETWEEN '2026-05-01' AND '2026-05-01'
            AND (lower(Platform) = 'blinkit')
            AND lower(Channel) = lower('quickcomm')
        `;

    try {
        const rs = await queryClickHouse(query);
        console.log("Success:", rs);
    } catch (e) {
        console.error("Error:", e.message);
    }
    process.exit(0);
}
run();
