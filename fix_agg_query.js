const fs = require('fs');
const file = 'backend/src/services/alertCronService.js';
let content = fs.readFileSync(file, 'utf8');

const targetCityAggQuery = `                    const aggQuery = \`
                        WITH
                            latest_date AS (
                                SELECT MAX(DATE) AS max_date
                                FROM \\\`\${dbName}\\\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL \${pdpFilterClause} AND Comp_flag = 0
                            ),
                            week_boundaries AS (
                                SELECT max_date, subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7) AS current_week_start
                                FROM latest_date
                            ),
                            weekly_stats AS (
                                SELECT
                                    subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                                    sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS neno,
                                    sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS deno
                                FROM \\\`\${dbName}\\\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL \${pdpFilterClause} AND Comp_flag = 0
                                GROUP BY week_start
                            ),
                            weekly_osa AS (
                                SELECT week_start, if(deno > 0, neno / deno * 100, 100) AS osa
                                FROM weekly_stats
                            )
                        SELECT
                            (SELECT osa FROM weekly_osa CROSS JOIN week_boundaries WHERE week_start = current_week_start) AS cw_osa,
                            (SELECT avg(osa) FROM weekly_osa CROSS JOIN week_boundaries WHERE week_start >= current_week_start - INTERVAL 28 DAY AND week_start < current_week_start) AS l4w_osa
                    \`;`;

const replacementCityAggQuery = `                    const aggQuery = \`
                        WITH
                            latest_date AS (
                                SELECT MAX(DATE) AS max_date
                                FROM \\\`\${dbName}\\\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL \${pdpFilterClause} AND Comp_flag = 0
                            ),
                            week_boundaries AS (
                                SELECT max_date, \${isRolling ? 'max_date - INTERVAL 6 DAY' : 'subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7)'} AS current_week_start
                                FROM latest_date
                            ),
                            weekly_stats AS (
                                SELECT
                                    \${isRolling ? 'if(DATE >= (SELECT current_week_start FROM week_boundaries LIMIT 1), \\'cw\\', \\'l4w\\')' : 'subtractDays(DATE, toDayOfWeek(DATE) % 7)'} AS week_start,
                                    sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS neno,
                                    sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS deno
                                FROM \\\`\${dbName}\\\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL \${pdpFilterClause} AND Comp_flag = 0
                                  \${isRolling ? 'AND DATE >= (SELECT current_week_start FROM week_boundaries LIMIT 1) - INTERVAL 28 DAY' : ''}
                                GROUP BY week_start
                            ),
                            weekly_osa AS (
                                SELECT week_start, if(deno > 0, neno / deno * 100, 100) AS osa
                                FROM weekly_stats
                            )
                        SELECT
                            (SELECT osa FROM weekly_osa CROSS JOIN week_boundaries WHERE week_start = \${isRolling ? '\\'cw\\'' : 'current_week_start'}) AS cw_osa,
                            (SELECT \${isRolling ? 'osa' : 'avg(osa)'} FROM weekly_osa CROSS JOIN week_boundaries WHERE \${isRolling ? 'week_start = \\'l4w\\'' : 'week_start >= current_week_start - INTERVAL 28 DAY AND week_start < current_week_start'}) AS l4w_osa
                    \`;`;

if (content.includes(targetCityAggQuery)) {
    content = content.replace(targetCityAggQuery, replacementCityAggQuery);
    console.log("Successfully replaced aggQuery for low_osa_bottom_city");
} else {
    console.log("Could not find aggQuery for low_osa_bottom_city");
}

fs.writeFileSync(file, content);
