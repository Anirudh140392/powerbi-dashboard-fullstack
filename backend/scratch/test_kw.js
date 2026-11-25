import dotenv from 'dotenv';
dotenv.config();
import { queryAdminDB } from '../src/config/adminClickhouse.js';

(async () => {
    try {
        const query = `
            WITH
                10 AS delta_threshold,
                latest_date AS (
                    SELECT MAX(DATE) AS max_date
                    FROM \`anirudh140392_db\`.rb_kw_olap
                    WHERE DATE IS NOT NULL
                ),
                week_boundaries AS (
                    SELECT max_date, subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7) AS current_week_start
                    FROM latest_date
                ),
                current_week AS (
                    SELECT
                        lower(platform_name) AS platform,
                        keyword AS keyword,
                        keyword_type AS bcg,
                        ROUND(sumIf(ifNull(overall, 0), flag = 1) * 100.0 / nullIf(sum(ifNull(overall, 0)), 0), 2) AS sos
                    FROM \`anirudh140392_db\`.rb_kw_olap
                    CROSS JOIN week_boundaries b
                    WHERE DATE >= b.current_week_start AND DATE < b.current_week_start + INTERVAL 7 DAY
                    GROUP BY platform_name, keyword, keyword_type
                ),
                l4w AS (
                    SELECT
                        lower(platform_name) AS platform,
                        keyword AS keyword,
                        keyword_type AS bcg,
                        ROUND(sumIf(ifNull(overall, 0), flag = 1) * 100.0 / nullIf(sum(ifNull(overall, 0)), 0), 2) AS l4w_sos
                    FROM \`anirudh140392_db\`.rb_kw_olap
                    CROSS JOIN week_boundaries b
                    WHERE DATE >= b.current_week_start - INTERVAL 28 DAY AND DATE < b.current_week_start
                    GROUP BY platform_name, keyword, keyword_type
                ),
                keyword_metrics AS (
                    SELECT
                        c.platform, c.keyword, c.bcg, c.sos, l.l4w_sos AS \`l4w sos\`,
                        ROUND(l.l4w_sos - c.sos, 2) AS delta
                    FROM current_week c
                    INNER JOIN l4w l ON c.platform = l.platform AND c.keyword = l.keyword AND c.bcg = l.bcg
                )
            SELECT platform, keyword, sos, \`l4w sos\`, delta, bcg
            FROM keyword_metrics
            WHERE delta > delta_threshold
            ORDER BY platform, bcg, delta DESC
            LIMIT 10 BY platform, bcg
        `;
        const res = await queryAdminDB(query);
        console.log("Result rows:", res.length);
        if(res.length > 0) console.log(res[0]);
    } catch(e) { console.error(e); }
    process.exit(0);
})();
