import { queryAdminDB } from '/Users/2004yashgautamgmail.com/Documents/trailytics/trailytics_ds/powerbi-dashboard-fullstack/backend/src/config/adminClickhouse.js';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { generateDynamicAlertEmailHtml } from '/Users/2004yashgautamgmail.com/Documents/trailytics/trailytics_ds/powerbi-dashboard-fullstack/backend/src/utils/dynamicAlertEmailTemplate.js';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
dotenv.config({ path: '/Users/2004yashgautamgmail.com/Documents/trailytics/trailytics_ds/powerbi-dashboard-fullstack/backend/.env' });

const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.Alert_email || process.env.ALERT_EMAIL || 'business@trailytics.com',
        pass: process.env.Alert_email_password || process.env.ALERT_EMAIL_PASSWORD
    },
    tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
    }
});

async function check() {
    try {
        const query = `
            SELECT *
            FROM admin_master.tb_alert
            WHERE alert_type = 'keyword_delta_sos'
        `;
        const alerts = await queryAdminDB(query);
        const alert = alerts[0];
        
        console.log("Found alert:", alert.id);

        const threshold = parseFloat(alert.threshold_value) || 10;
        let pList = Array.isArray(alert.platforms) ? alert.platforms : JSON.parse(alert.platforms);
        const kwFilterClause = `AND lower(platform_name) IN (${pList.map(p => `'${p.trim().toLowerCase()}'`).join(',')})`;
        
        const dbName = 'mars';

        const kwQuery = `
            WITH
                ${threshold} AS delta_threshold,
                latest_date AS (
                    SELECT MAX(DATE) AS max_date
                    FROM \`${dbName}\`.rb_kw_olap
                    WHERE DATE IS NOT NULL ${kwFilterClause}
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
                    WHERE DATE >= b.current_week_start AND DATE < b.current_week_start + INTERVAL 7 DAY ${kwFilterClause}
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
                    WHERE DATE >= b.current_week_start - INTERVAL 28 DAY AND DATE < b.current_week_start ${kwFilterClause}
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
            WHERE abs(DELTA) > delta_threshold
            ORDER BY Platform, BCG, abs(DELTA) DESC
            LIMIT 5 BY Platform, BCG
        `;
        
        const aggKwQuery = `
            WITH
                latest_date AS (
                    SELECT MAX(DATE) AS max_date
                    FROM \`${dbName}\`.rb_kw_olap
                    WHERE DATE IS NOT NULL ${kwFilterClause}
                ),
                week_boundaries AS (
                    SELECT subtractDays(max_date, toDayOfWeek(max_date) % 7) AS current_week_start
                    FROM latest_date
                ),
                keyword_sos AS (
                    SELECT
                        keyword,
                        keyword_type,
                        sumIf(ifNull(overall, 0), flag = 1) * 100.0 / nullIf(sum(ifNull(overall, 0)), 0) AS SOS
                    FROM \`${dbName}\`.rb_kw_olap
                    CROSS JOIN week_boundaries b
                    WHERE DATE >= b.current_week_start AND DATE < b.current_week_start + INTERVAL 7 DAY ${kwFilterClause}
                    GROUP BY keyword, keyword_type
                )
            SELECT ROUND(avg(SOS), 2) AS agg_sos FROM keyword_sos;
        `;

        const [kwStats, aggKwStats] = await Promise.all([
            queryAdminDB(kwQuery),
            queryAdminDB(aggKwQuery)
        ]);
        
        const isTriggered = kwStats.length > 0;
        const overallCwSos = parseFloat(aggKwStats[0]?.agg_sos) || 0;
        
        const platLabel = "Blinkit";
        const platPrefix = "Blinkit ";
        
        const metricDetails = {
            ruleType: 'Keyword Delta SOS',
            calculatedOSA: isTriggered ? overallCwSos.toFixed(2) + '%' : '0%',
            aggDelta: isTriggered ? parseFloat(kwStats[0].DELTA).toFixed(2) : 0,
            conditionText: `${platPrefix}Keyword SOS Delta > ${threshold} (Segmented by BCG)`,
        };

        let dynamicEmailData = null;
        if (isTriggered) {
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

            dynamicEmailData = [];
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
        
        const now = new Date();
        const istDate = toZonedTime(now, 'Asia/Kolkata');
        const istNow = format(istDate, 'yyyy-MM-dd HH:mm:ss');
        
        const emailHtml = generateDynamicAlertEmailHtml({
            logoUrl: 'https://trailytics.com/logo.png',
            companyName: 'Mars',
            istNow,
            alertName: alert.alert_name || metricDetails.ruleType,
            severityLevel: alert.severity_level || 'Warning',
            currentMetricValue: metricDetails.calculatedOSA,
            metricDelta: metricDetails.aggDelta,
            operator: '<=',
            threshold: threshold,
            platformData: Array.isArray(dynamicEmailData) ? dynamicEmailData : (dynamicEmailData ? [dynamicEmailData] : []),
        });

        const fromEmail = process.env.Alert_email || process.env.ALERT_EMAIL || 'business@trailytics.com';
        const mailOptions = {
            from: `"Trailytics Alerts" <${fromEmail}>`,
            to: 'yash.g@trailytics.com',
            subject: `🚨 ALERT TRIGGERED: ${alert.alert_name}`,
            text: `Test`,
            html: emailHtml,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[AlertCron] HTML email sent successfully. Message ID: ${info.messageId}`);
    } catch(e) {
        console.error(e);
    }
}
check();
