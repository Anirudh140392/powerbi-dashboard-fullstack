const fs = require('fs');
const file = 'backend/src/services/alertCronService.js';
let content = fs.readFileSync(file, 'utf8');

const targetKwCond = `                else if (alertType === 'keyword_delta_sos') {
                    isDynamicAlert = true;
                    const kwQuery = \`
                        WITH
                            -- Dynamic Delta threshold
                            \${threshold} AS delta_threshold,

                            latest_date AS (
                                SELECT
                                    MAX(DATE) AS max_date
                                FROM \\\`\${dbName}\\\`.rb_kw_olap
                                WHERE DATE IS NOT NULL \${kwFilterClause}
                            ),

                            week_boundaries AS (
                                SELECT
                                    max_date,

                                    -- Latest completed Sunday-Saturday week
                                    subtractDays(
                                        max_date,
                                        toDayOfWeek(max_date) % 7 + 7
                                    ) AS current_week_start

                                FROM latest_date
                            ),`;

const replaceKwCond = `                else if (alertType === 'keyword_delta_sos' || alertType === 'keyword_delta_sos_weekly') {
                    isDynamicAlert = true;
                    const isRolling = alertType.endsWith('_weekly');
                    const kwQuery = \`
                        WITH
                            -- Dynamic Delta threshold
                            \${threshold} AS delta_threshold,

                            latest_date AS (
                                SELECT
                                    MAX(DATE) AS max_date
                                FROM \\\`\${dbName}\\\`.rb_kw_olap
                                WHERE DATE IS NOT NULL \${kwFilterClause}
                            ),

                            week_boundaries AS (
                                SELECT
                                    max_date,

                                    \${isRolling ? 'max_date - INTERVAL 6 DAY' : 'subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7)'} AS current_week_start

                                FROM latest_date
                            ),`;

const targetKwCurrentWeek = `                                CROSS JOIN week_boundaries b

                                WHERE
                                    DATE >= b.current_week_start
                                    AND DATE < b.current_week_start + INTERVAL 7 DAY`;

const replaceKwCurrentWeek = `                                CROSS JOIN week_boundaries b

                                WHERE
                                    DATE >= b.current_week_start
                                    AND DATE <= \${isRolling ? 'b.max_date' : 'b.current_week_start + INTERVAL 6 DAY'}`;

if (content.includes(targetKwCond)) {
    content = content.replace(targetKwCond, replaceKwCond);
    content = content.replace(targetKwCurrentWeek, replaceKwCurrentWeek);
    console.log("Successfully replaced keyword_delta_sos alert");
} else {
    console.log("Could not find keyword_delta_sos alert");
}

fs.writeFileSync(file, content);
