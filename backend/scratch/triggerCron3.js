import { queryAdminDB } from '../src/config/adminClickhouse.js';
import { generateDynamicAlertEmailHtml } from '../src/utils/dynamicAlertEmailTemplate.js';
import nodemailer from 'nodemailer';

async function run() {
    try {
        const alerts = await queryAdminDB("SELECT * FROM admin_master.tb_alert WHERE alert_name LIKE '%Keyword%'");
        if (alerts.length === 0) return;
        const alert = alerts[0];
        
        const dbs = await queryAdminDB(`SELECT db_name FROM admin_master.tb_database WHERE toString(db_id) = '${alert.db_id}'`);
        const dbName = dbs[0].db_name;
        
        const threshold = parseFloat(alert.threshold_value) || 10;
        const kwQuery = `
            WITH
                ${threshold} AS delta_threshold,
                latest_date AS (
                    SELECT MAX(DATE) AS max_date
                    FROM \`${dbName}\`.rb_kw_olap
                    WHERE DATE IS NOT NULL
                ),
                week_boundaries AS (
                    SELECT max_date, subtractDays(max_date, toDayOfWeek(max_date) % 7) AS current_week_start
                    FROM latest_date
                ),
                current_week AS (
                    SELECT
                        platform_name AS Platform,
                        keyword AS KEYWORD,
                        keyword_type AS BCG,
                        ROUND(sumIf(ifNull(overall, 0), flag = 1) * 100.0 / nullIf(sum(ifNull(overall, 0)), 0), 2) AS SOS
                    FROM \`${dbName}\`.rb_kw_olap
                    CROSS JOIN week_boundaries b
                    WHERE DATE >= b.current_week_start AND DATE < b.current_week_start + INTERVAL 7 DAY
                    GROUP BY Platform, KEYWORD, BCG
                ),
                l4w AS (
                    SELECT
                        platform_name AS Platform,
                        keyword AS KEYWORD,
                        keyword_type AS BCG,
                        ROUND(sumIf(ifNull(overall, 0), flag = 1) * 100.0 / nullIf(sum(ifNull(overall, 0)), 0), 2) AS l4w_sos
                    FROM \`${dbName}\`.rb_kw_olap
                    CROSS JOIN week_boundaries b
                    WHERE DATE >= b.current_week_start - INTERVAL 28 DAY AND DATE < b.current_week_start
                    GROUP BY Platform, KEYWORD, BCG
                ),
                keyword_metrics AS (
                    SELECT
                        c.Platform, c.KEYWORD, c.BCG, c.SOS, l.l4w_sos AS \`L4W SOS\`, ROUND(c.SOS - l.l4w_sos, 2) AS DELTA
                    FROM current_week c
                    INNER JOIN l4w l ON c.Platform = l.Platform AND c.KEYWORD = l.KEYWORD AND c.BCG = l.BCG
                )
            SELECT
                Platform, KEYWORD, SOS, \`L4W SOS\`, DELTA, BCG
            FROM keyword_metrics
            WHERE DELTA > delta_threshold
            ORDER BY Platform, BCG, DELTA DESC
            LIMIT 10 BY Platform, BCG
        `;
        const kwStats = await queryAdminDB(kwQuery);
        
        let dynamicEmailData = [];
        if (kwStats.length > 0) {
            const platformsMap = new Map();
            kwStats.forEach(k => {
                let platLabelLocal = k.Platform || 'Unknown';
                let bcgLabel = k.BCG || 'Uncategorized';
                
                if (!platformsMap.has(platLabelLocal)) {
                    platformsMap.set(platLabelLocal, new Map());
                }
                const bcgMap = platformsMap.get(platLabelLocal);
                if (!bcgMap.has(bcgLabel)) {
                    bcgMap.set(bcgLabel, []);
                }
                
                bcgMap.get(bcgLabel).push([
                    k.KEYWORD || 'Unknown',
                    parseFloat(k.SOS).toFixed(2) + '%',
                    parseFloat(k['L4W SOS']).toFixed(2) + '%',
                    parseFloat(k.DELTA).toFixed(2) + '%'
                ]);
            });

            for (const [platformName, bcgMap] of platformsMap.entries()) {
                const tables = [];
                for (const [bcg, rows] of bcgMap.entries()) {
                    tables.push({
                        tableName: bcg,
                        headers: ['Keyword', 'CW SOS %', 'L4W Avg %', 'Delta'],
                        rows: rows
                    });
                }
                dynamicEmailData.push({
                    platformName,
                    tables
                });
            }
        }
        
        const platformData = Array.isArray(dynamicEmailData) ? dynamicEmailData : (dynamicEmailData ? [dynamicEmailData] : []);
        console.log(`Generated platformData. Number of platforms: ${platformData.length}`);
        
        const emailHtml = generateDynamicAlertEmailHtml({
            logoUrl: '',
            companyName: 'Mars',
            istNow: new Date(),
            alertName: 'Keyword Delta SOS',
            severityLevel: 'Warning',
            currentMetricValue: '10%',
            metricDelta: 10,
            operator: '<=',
            threshold: threshold,
            platformData: platformData,
        });
        
        console.log(`Generated emailHtml. Length: ${emailHtml.length}`);
        
        const preview = emailHtml.substring(0, 500);
        console.log("HTML Preview (first 500 chars):", preview.substring(0, 100) + '...');
        console.log("HTML length:", emailHtml.length);
        
        // Write to file to inspect manually
        import('fs').then(fs => fs.promises.writeFile('scratch/output_email.html', emailHtml));
        console.log("Saved to scratch/output_email.html");
    } catch(e) {
        console.error(e);
    }
}
run();
