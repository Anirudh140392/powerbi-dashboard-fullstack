const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

const companyId = '297e37ea-a5ac-47df-bebd-ac44e52b7979'; 

async function run() {
    try {
        const compId = companyId;
        console.log('Using company_id:', compId);

        // Define filters (defaulting to Prestige Only)
        const params = [compId];

        // --- Category Health Unique SKUs Logic ---
        const totalWhere = ` AND COALESCE(ps.is_competitor, mp.is_competitor, false) = false AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) IS NOT NULL AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) != ''`;
        const totalReviewsWhere = ` AND r.is_competitor = false AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) != '' AND r.review_date >= (CURRENT_DATE - INTERVAL '3 months')`;

        const sqlCatHealth = `
            WITH latest_snaps AS (
                SELECT DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)
                    ps.company_id, ps.platform, ps.web_pid, ps.rating_count, ps.category, ps.is_competitor
                FROM ratings.product_snapshots ps
                WHERE ps.company_id = $1
                ORDER BY ps.company_id, ps.platform, ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
            ),
            snap_skus AS (
                SELECT ps.web_pid, ps.platform
                FROM latest_snaps ps
                LEFT JOIN masters.products mp ON mp.company_id = $1 AND mp.product_external_id = ps.web_pid AND LOWER(mp.platform) = LOWER(ps.platform)
                WHERE 1=1 ${totalWhere}
            ),
            review_only_skus AS (
                SELECT DISTINCT r.web_pid, r.platform
                FROM ratings.reviews r
                LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
                WHERE r.company_id = $1 ${totalReviewsWhere}
                AND NOT EXISTS (
                    SELECT 1 FROM latest_snaps ps
                    WHERE ps.company_id = $1 AND ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
                )
            ),
            all_skus AS (
                SELECT web_pid, platform FROM snap_skus
                UNION ALL
                SELECT web_pid, platform FROM review_only_skus
            )
            SELECT COUNT(DISTINCT web_pid) as count FROM all_skus
        `;

        const resCat = await pool.query(sqlCatHealth, params);
        console.log('Category Health Unique SKUs:', resCat.rows[0].count);

        // --- Executive Health Logic ---
        const snapshotCompetitorFilter = `AND COALESCE(ps.is_competitor, mp.is_competitor, false) = false`;
        const reviewCompetitorFilter = `AND COALESCE(r.is_competitor, false) = false`;

        const sqlExecHealth = `
              WITH latest_snapshots AS (
                  SELECT DISTINCT ON (LOWER(ps.platform), ps.web_pid)
                      ps.web_pid, LOWER(ps.platform) AS platform_key, ps.category
                  FROM ratings.product_snapshots ps
                  LEFT JOIN masters.products mp ON mp.company_id = ps.company_id AND mp.product_external_id = ps.web_pid AND LOWER(mp.platform) = LOWER(ps.platform)
                  WHERE ps.company_id = $1 ${snapshotCompetitorFilter}
                    AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) IS NOT NULL
                    AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) != ''
                  ORDER BY LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
              ),
              review_stats AS (
                  SELECT r.web_pid, LOWER(r.platform) AS platform_key
                  FROM ratings.reviews r
                  LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
                  WHERE r.company_id = $1 ${reviewCompetitorFilter}
                    AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL
                    AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) != ''
                    AND r.review_date >= (CURRENT_DATE - INTERVAL '3 months')
                  GROUP BY r.web_pid, LOWER(r.platform)
              ),
              sku_scope AS (
                  SELECT web_pid, platform_key FROM latest_snapshots
                  UNION
                  SELECT web_pid, platform_key FROM review_stats
              )
              SELECT COUNT(DISTINCT web_pid) as count FROM sku_scope
        `;

        const resExec = await pool.query(sqlExecHealth, params);
        console.log('Executive Health Unique SKUs:', resExec.rows[0].count);

        // Find the diff
        const sqlDiff = `
            WITH cat_skus AS (
                WITH latest_snaps AS (
                    SELECT DISTINCT ON (ps.company_id, ps.platform, ps.web_pid)
                        ps.company_id, ps.platform, ps.web_pid, ps.category, ps.is_competitor
                    FROM ratings.product_snapshots ps
                    WHERE ps.company_id = $1
                    ORDER BY ps.company_id, ps.platform, ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
                ),
                snap_skus AS (
                    SELECT ps.web_pid
                    FROM latest_snaps ps
                    LEFT JOIN masters.products mp ON mp.company_id = $1 AND mp.product_external_id = ps.web_pid AND LOWER(mp.platform) = LOWER(ps.platform)
                    WHERE 1=1 ${totalWhere}
                ),
                review_only_skus AS (
                    SELECT r.web_pid
                    FROM ratings.reviews r
                    LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
                    WHERE r.company_id = $1 ${totalReviewsWhere}
                    AND NOT EXISTS (
                        SELECT 1 FROM latest_snaps ps
                        WHERE ps.company_id = $1 AND ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
                    )
                )
                SELECT web_pid FROM snap_skus UNION SELECT web_pid FROM review_only_skus
            ),
            exec_skus AS (
                WITH latest_snapshots AS (
                    SELECT DISTINCT ON (LOWER(ps.platform), ps.web_pid)
                        ps.web_pid
                    FROM ratings.product_snapshots ps
                    LEFT JOIN masters.products mp ON mp.company_id = ps.company_id AND mp.product_external_id = ps.web_pid AND LOWER(mp.platform) = LOWER(ps.platform)
                    WHERE ps.company_id = $1 ${snapshotCompetitorFilter}
                        AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) IS NOT NULL
                        AND COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, '')) != ''
                    ORDER BY LOWER(ps.platform), ps.web_pid, ps.snapshot_date DESC, ps.created_at DESC NULLS LAST
                ),
                review_stats AS (
                    SELECT r.web_pid
                    FROM ratings.reviews r
                    LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
                    WHERE r.company_id = $1 ${reviewCompetitorFilter}
                        AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NOT NULL
                        AND COALESCE(NULLIF(r.category, ''), NULLIF(mp.category, '')) != ''
                        AND r.review_date >= (CURRENT_DATE - INTERVAL '3 months')
                    GROUP BY r.web_pid, LOWER(r.platform)
                )
                SELECT web_pid FROM latest_snapshots UNION SELECT web_pid FROM review_stats
            )
            SELECT web_pid FROM cat_skus EXCEPT SELECT web_pid FROM exec_skus
        `;

        const resDiff = await pool.query(sqlDiff, params);
        console.log('SKUs in Cat Health but NOT in Exec Health (Count):', resDiff.rowCount);
        if (resDiff.rowCount > 0) {
            console.log('Sample missing SKUs:', resDiff.rows.slice(0, 5).map(r => r.web_pid));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
