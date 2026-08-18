// src/services/alertCronService.js
// Background task to send email alerts every 1 minute
import nodemailer from 'nodemailer';
import { queryAdminDB } from '../config/adminClickhouse.js';
import { decrypt } from '../utils/encryption.js';

import { generateDynamicAlertEmailHtml } from '../utils/dynamicAlertEmailTemplate.js';
import { fetchAllPlatformCategoryKPIs, getCWDateRange } from './categoryPerfSummaryDataService.js';
import { generateCategoryPerfSummaryEmailHtml } from '../utils/categoryPerfSummaryEmailTemplate.js';
import { buildAlertTemplateComponents, buildAlertFullText } from '../utils/whatsappTemplate.js';
import { sendWhatsappMessage } from './whatsappService.js';
import { getCompanyLogo, getLatestDataDate, computeDateRanges, getBrandOsaByPlatform, getImpactedSkus, getAggregateOsa } from './alertDataService.js';

let cronIntervalId = null;

/**
 * Initialize nodemailer transport with Outlook credentials from .env
 */
const getTransporter = () => {
    const fromEmail = process.env.SMTP_USER || process.env.ALERT_EMAIL || process.env.Alert_email;
    const password = process.env.SMTP_PASS || process.env.ALERT_EMAIL_PASSWORD || process.env.Alert_email_password;
    const host = process.env.SMTP_HOST || 'smtp.office365.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);

    if (!fromEmail || !password) {
        console.warn('[AlertCron] SMTP credentials are not set in .env');
        return null;
    }

    return nodemailer.createTransport({
        host: host,
        port: port,
        secure: port === 465,
        auth: {
            user: fromEmail,
            pass: password,
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false,
        }
    });
};

/**
 * Helper to evaluate conditional operators dynamically (e.g. less than, greater than, equal to)
 */
const evalCondition = (val, op, thresh) => {
    if (!op) return val < thresh;
    const lowerOp = String(op).toLowerCase();
    if (lowerOp.includes('greater') || lowerOp.includes('gt') || lowerOp.includes('>')) {
        return val > thresh;
    }
    if (lowerOp.includes('equal') || lowerOp.includes('eq') || lowerOp.includes('=')) {
        return Math.abs(val - thresh) < 0.01;
    }
    return val < thresh;
};

/**
 * Format string operators into mathematical symbols (e.g. "gt" -> ">", "lt" -> "<")
 */
const formatOperatorSymbol = (op) => {
    if (!op) return '<';
    const lowerOp = String(op).toLowerCase();
    if (lowerOp.includes('gte') || lowerOp.includes('>=')) return '>=';
    if (lowerOp.includes('greater') || lowerOp.includes('gt') || lowerOp.includes('>')) return '>';
    if (lowerOp.includes('lte') || lowerOp.includes('<=')) return '<=';
    if (lowerOp.includes('equal') || lowerOp.includes('eq') || lowerOp.includes('=')) return '=';
    return '<';
};

/**
 * Extract user-selected platform name for display (e.g. "Blinkit", "Amazon")
 */
const getPlatformLabel = (platforms) => {
    if (Array.isArray(platforms) && platforms.length > 0) {
        const filtered = platforms.filter(p => p && p !== 'All Platforms');
        if (filtered.length > 0) {
            return filtered.join(', ');
        }
    }
    return '';
};

/**
 * Build SQL filter clause for rb_pdp_olap (Platform, Brand)
 */
const buildPdpFilterClause = (platforms, brands) => {
    const conds = [];
    if (Array.isArray(platforms) && platforms.length > 0) {
        const filteredPlats = platforms.filter(p => p && p !== 'All Platforms');
        if (filteredPlats.length > 0) {
            conds.push(`lower(Platform) IN (${filteredPlats.map(p => `'${p.trim().toLowerCase()}'`).join(',')})`);
        }
    }
    if (Array.isArray(brands) && brands.length > 0) {
        const filteredBrands = brands.filter(b => b && b !== 'All Brands');
        if (filteredBrands.length > 0) {
            conds.push(`lower(Brand) IN (${filteredBrands.map(b => `'${b.trim().toLowerCase()}'`).join(',')})`);
        }
    }
    return conds.length > 0 ? ' AND ' + conds.join(' AND ') : '';
};

/**
 * Build SQL filter clause for rb_kw_olap
 */
const buildKwFilterClause = (platforms, brands) => {
    const conds = [];
    if (Array.isArray(platforms) && platforms.length > 0) {
        const filteredPlats = platforms.filter(p => p && p !== 'All Platforms');
        if (filteredPlats.length > 0) {
            conds.push(`lower(platform_name) IN (${filteredPlats.map(p => `'${p.trim().toLowerCase()}'`).join(',')})`);
        }
    }
    if (Array.isArray(brands) && brands.length > 0) {
        const filteredBrands = brands.filter(b => b && b !== 'All Brands');
        if (filteredBrands.length > 0) {
            conds.push(`lower(brand) IN (${filteredBrands.map(b => `'${b.trim().toLowerCase()}'`).join(',')})`);
        }
    }
    return conds.length > 0 ? ' AND ' + conds.join(' AND ') : '';
};

/**
 * Build SQL filter clause for rb_pm_olap (Platform, brand)
 */
const buildPmFilterClause = (platforms, brands) => {
    const conds = [];
    if (Array.isArray(platforms) && platforms.length > 0) {
        const filteredPlats = platforms.filter(p => p && p !== 'All Platforms');
        if (filteredPlats.length > 0) {
            conds.push(`lower(Platform) IN (${filteredPlats.map(p => `'${p.trim().toLowerCase()}'`).join(',')})`);
        }
    }
    if (Array.isArray(brands) && brands.length > 0) {
        const filteredBrands = brands.filter(b => b && b !== 'All Brands');
        if (filteredBrands.length > 0) {
            conds.push(`lower(brand) IN (${filteredBrands.map(b => `'${b.trim().toLowerCase()}'`).join(',')})`);
        }
    }
    return conds.length > 0 ? ' AND ' + conds.join(' AND ') : '';
};

/**
 * Get current Indian Standard Time (IST) as formatted DateTime string (YYYY-MM-DD HH:mm:ss)
 */
const getISTDateTimeString = () => {
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffsetMs);
    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    const hours = String(istTime.getHours()).padStart(2, '0');
    const minutes = String(istTime.getMinutes()).padStart(2, '0');
    const seconds = String(istTime.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Helper to get currency symbol based on database name.
 * Uses AED for 'hayatna' and Rupees (₹) for all other client databases.
 */
const getCurrencySymbol = (dbName) => {
    if (!dbName) return '₹';
    const lower = String(dbName).toLowerCase().trim();
    if (lower === 'hayatna') {
        return 'AED ';
    }
    return '₹';
};

/**
 * Helper to check if enough time has passed since last_email_sent or last_whatsapp_msg_sent according to alert_frequency
 * - Real-time: Always send (no frequency delay)
 * - Minutes: Requires >= N minutes elapsed since last dispatch
 * - Hourly: Requires >= 1 hour (3600 sec) elapsed since last dispatch
 * - Daily: Requires >= 24 hours (86400 sec) elapsed since last dispatch
 * - Weekly: Requires >= 7 days (604800 sec) elapsed since last dispatch
 */
const shouldSendBasedOnFrequency = (lastSentDateStr, alertFrequency) => {
    // If no message has ever been sent, dispatch immediately when condition triggers
    if (!lastSentDateStr || String(lastSentDateStr).includes('\\N') || String(lastSentDateStr).trim() === '' || String(lastSentDateStr).startsWith('1970')) {
        return { allowed: true, reason: 'First dispatch' };
    }

    // Parse lastSentDateStr into Date object
    const normalizedStr = String(lastSentDateStr).replace(' ', 'T');
    const lastSentDate = new Date(normalizedStr);
    
    if (isNaN(lastSentDate.getTime())) {
        return { allowed: true, reason: 'Invalid last dispatch date, allowing dispatch' };
    }

    const now = new Date();
    const diffMs = now.getTime() - lastSentDate.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = (diffMs / (60 * 60 * 1000)).toFixed(1);

    const freqLower = String(alertFrequency || '').toLowerCase().trim();

    if (freqLower.includes('real-time') || freqLower.includes('realtime') || freqLower.includes('real time')) {
        return { allowed: true, reason: 'Real-time frequency' };
    }

    // Custom minute parsing (e.g. "30 minutes", "15 mins")
    const matchMins = freqLower.match(/(\d+)\s*(min|minute)/);
    if (matchMins) {
        const requiredMins = parseInt(matchMins[1], 10);
        const requiredMs = requiredMins * 60 * 1000;
        if (diffMs >= requiredMs) {
            return { allowed: true, reason: `${requiredMins}-minute frequency met (${diffMins} mins passed)` };
        } else {
            const minsRemaining = Math.ceil((requiredMs - diffMs) / (60 * 1000));
            return {
                allowed: false,
                reason: `Frequency is ${requiredMins} minutes. Only ${diffMins} mins passed since last dispatch (${lastSentDateStr} IST). Waiting ${minsRemaining} more mins.`
            };
        }
    }

    if (freqLower.includes('hourly') || freqLower.includes('hour')) {
        const oneHourMs = 60 * 60 * 1000;
        if (diffMs >= oneHourMs) {
            return { allowed: true, reason: `Hourly frequency met (${diffHours} hrs passed)` };
        } else {
            const minsRemaining = Math.ceil((oneHourMs - diffMs) / (60 * 1000));
            return { 
                allowed: false, 
                reason: `Frequency is Hourly. Only ${diffMins} mins passed since last dispatch (${lastSentDateStr} IST). Waiting ${minsRemaining} more mins.` 
            };
        }
    }

    if (freqLower.includes('daily') || freqLower.includes('day')) {
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (diffMs >= oneDayMs) {
            return { allowed: true, reason: `Daily frequency met (${diffHours} hrs passed)` };
        } else {
            const hoursRemaining = ((oneDayMs - diffMs) / (60 * 60 * 1000)).toFixed(1);
            return { 
                allowed: false, 
                reason: `Frequency is Daily. Only ${diffHours} hrs passed since last dispatch (${lastSentDateStr} IST). Waiting ${hoursRemaining} more hours.` 
            };
        }
    }

    if (freqLower.includes('weekly') || freqLower.includes('week')) {
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        if (diffMs >= oneWeekMs) {
            return { allowed: true, reason: `Weekly frequency met` };
        } else {
            const daysRemaining = ((oneWeekMs - diffMs) / (24 * 60 * 60 * 1000)).toFixed(1);
            return { 
                allowed: false, 
                reason: `Frequency is Weekly. Only ${diffHours} hrs passed since last dispatch (${lastSentDateStr} IST). Waiting ${daysRemaining} more days.` 
            };
        }
    }

    return { allowed: true, reason: 'Default fallback' };
};

/**
 * Task executed every 2 minutes.
 * Iterates over each alert in tb_alert one by one:
 * 1. Resolves db_name using STRICT EXACT string match on the alert's db_id against tb_database.
 * 2. Evaluates the 4 condition presets across rb_pdp_olap and rb_pm_olap tables.
 * 3. Checks alert_frequency cooldown against last_email_sent.
 * 4. Sends alert email via Outlook SMTP if trigger conditions match and recipient email is entered.
 * 5. Saves current IST timestamp to last_email_sent column in ClickHouse.
 */
export const runEmailAlertsJob = async () => {
    const istNow = getISTDateTimeString();
    console.log(`[AlertCron ${istNow} IST] Running scheduled email alerts job...`);
    
    const transporter = getTransporter();
    if (!transporter) {
        console.error('[AlertCron] Aborting job: Nodemailer transporter is not configured');
        return;
    }

    try {
        // 1. Fetch database mappings (db_id -> db_name + logo_url)
        const dbList = await queryAdminDB(`
            SELECT toString(db_id) as db_id, db_name, logo_url 
            FROM tb_database
        `);

        const dbMap = new Map();
        const logoMap = new Map();
        for (const row of dbList) {
            dbMap.set(row.db_id, row.db_name);
            logoMap.set(row.db_id, row.logo_url || '');
        }

        // 2. Fetch all configured alerts with last_email_sent, alert_frequency, and scheduled_day
        const alerts = await queryAdminDB(`
            SELECT 
                toString(id) as id,
                toString(db_id) as db_id,
                send_email,
                whatsapp_no,
                alert_name,
                alert_type,
                platforms,
                brands,
                conditional_operator,
                threshold_value,
                benchmark_period,
                alert_frequency,
                severity_level,
                scheduled_day,
                toString(last_email_sent) as last_email_sent,
                toString(last_whatsapp_msg_sent) as last_whatsapp_msg_sent
            FROM tb_alert
        `);

        if (alerts.length === 0) {
            console.log('[AlertCron] No active alert configurations found.');
            return;
        }

        console.log(`[AlertCron] Processing ${alerts.length} alert rules one by one...`);

        for (const alert of alerts) {
            // Strict exact string match on db_id
            const dbName = dbMap.get(alert.db_id);
            if (!dbName) {
                console.warn(`[AlertCron] No exact database match resolved for db_id: "${alert.db_id}". Skipping rule "${alert.alert_name}".`);
                continue;
            }

            const sendEmail = alert.send_email ? decrypt(alert.send_email) : '';
            const whatsappNo = alert.whatsapp_no ? decrypt(alert.whatsapp_no) : '';

            // User requirement: If user has NOT entered email or whatsapp number, then don't send
            if ((!sendEmail || !sendEmail.includes('@')) && (!whatsappNo || !whatsappNo.trim())) {
                console.log(`[AlertCron] Rule "${alert.alert_name}" has no email or WhatsApp entered. Skipping notification.`);
                continue;
            }

            const currency = getCurrencySymbol(dbName);
            const alertType = (alert.alert_type || 'low_osa').toLowerCase();

            // ── CATEGORY PERFORMANCE SUMMARY HANDLER ─────────────────────────
            // When alert_type is 'category_perf_summary', this is a scheduled
            // weekly digest (not condition-triggered). It fires on the
            // scheduled_day and sends the category performance summary email.
            if (alertType === 'category_perf_summary' || alertType.includes('category_perf_summary')) {
                try {
                    // 1. Check if today is the scheduled day
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const now = new Date();
                    const istOffsetMs = 5.5 * 60 * 60 * 1000;
                    const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffsetMs);
                    const todayDayName = dayNames[istNow.getDay()];
                    const scheduledDay = (alert.scheduled_day || '').trim();

                    if (scheduledDay && scheduledDay.toLowerCase() !== todayDayName.toLowerCase()) {
                        console.log(`[AlertCron] Performance Summary "${alert.alert_name}" scheduled for ${scheduledDay}, today is ${todayDayName}. Skipping.`);
                        continue;
                    }

                    // 2. Enforce strict ONCE-PER-DAY logic for scheduled summaries
                    if (!sendEmail || !sendEmail.includes('@')) {
                        console.log(`[AlertCron] Performance Summary "${alert.alert_name}" has no email. Skipping.`);
                        continue;
                    }
                    
                    const fmtDate = (d) => {
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        return `${y}-${m}-${dd}`;
                    };
                    const todayStr = fmtDate(istNow);
                    
                    let alreadySentToday = false;
                    if (alert.last_email_sent && !String(alert.last_email_sent).includes('\\N')) {
                        const normalizedStr = String(alert.last_email_sent).replace(' ', 'T');
                        const lastSentDate = new Date(normalizedStr);
                        if (!isNaN(lastSentDate.getTime())) {
                            if (fmtDate(lastSentDate) === todayStr) {
                                alreadySentToday = true;
                            }
                        }
                    }

                    if (alreadySentToday) {
                        console.log(`[AlertCron] Performance Summary "${alert.alert_name}" already sent today (${todayStr}). Skipping.`);
                        continue;
                    }

                    // 3. Determine platforms to iterate
                    const alertPlatforms = (Array.isArray(alert.platforms) && alert.platforms.length > 0)
                        ? alert.platforms.filter(p => p && p !== 'All Platforms')
                        : [];

                    if (alertPlatforms.length === 0) {
                        console.warn(`[AlertCron] Performance Summary "${alert.alert_name}" has no specific platforms. Skipping.`);
                        continue;
                    }

                    // 4. Get CW date range for display (uses same Sun-Sat logic as other alerts)
                    const dateRange = await getCWDateRange(dbName, alertPlatforms[0]);
                    console.log(`[AlertCron] 📊 Performance Summary "${alert.alert_name}" on ${dbName} | CW: ${dateRange.cwStart} – ${dateRange.cwEnd} | L4W: ${dateRange.l4wStart} – ${dateRange.l4wEnd}`);

                    // 5. Fetch KPIs per platform per category (CW/L4W computed inside data service)
                    let platformCategoryCards = [];
                    for (const plat of alertPlatforms) {
                        try {
                            const categoryData = await fetchAllPlatformCategoryKPIs(
                                dbName, plat, alert.brands
                            );
                            for (const catData of categoryData) {
                                platformCategoryCards.push({
                                    platform: plat,
                                    categoryName: catData.categoryName,
                                    kpis: catData.kpis
                                });
                            }
                        } catch (kpiErr) {
                            console.error(`[AlertCron] Failed to fetch KPIs for ${plat} on ${dbName}:`, kpiErr.message);
                        }
                    }

                    if (platformCategoryCards.length === 0) {
                        console.warn(`[AlertCron] No KPI data returned for any platform/category in "${alert.alert_name}". Skipping email.`);
                        continue;
                    }

                    // 6. Generate HTML
                    const logoUrl = logoMap.get(alert.db_id) || '';
                    const companyDisplayName = dbName ? (dbName.charAt(0).toUpperCase() + dbName.slice(1)) : 'Company';

                    const emailHtml = generateCategoryPerfSummaryEmailHtml({
                        logoUrl,
                        companyName: companyDisplayName,
                        cwStart: dateRange.cwStart,
                        cwEnd: dateRange.cwEnd,
                        l4wStart: dateRange.l4wStart,
                        l4wEnd: dateRange.l4wEnd,
                        currency,
                        platformCategoryCards,
                    });

                    // 7. Send email
                    const fromEmail = process.env.Alert_email || process.env.ALERT_EMAIL || 'business@trailytics.com';
                    const mailOptions = {
                        from: `"Trailytics Alerts" <${fromEmail}>`,
                        to: sendEmail,
                        subject: `📊 Performance Summary: ${alert.alert_name} — ${companyDisplayName}`,
                        text: `Hi,\n\nYour weekly Performance Summary for ${companyDisplayName} is ready.\n\nPlatforms: ${alertPlatforms.join(', ')}\nData as of: ${dateRange.cwEnd}\n\nBest regards,\nTrailytics Team`,
                        html: emailHtml,
                    };

                    try {
                        const info = await transporter.sendMail(mailOptions);
                        console.log(`[AlertCron] 📧 Performance Summary email sent to ${sendEmail}. Message ID: ${info.messageId}`);

                        const istDateTimeStr = getISTDateTimeString();
                        const updateQuery = `
                            ALTER TABLE admin_master.tb_alert
                            UPDATE last_email_sent = parseDateTimeBestEffort('${istDateTimeStr}')
                            WHERE id = toUUID('${alert.id}')
                        `;
                        await queryAdminDB(updateQuery);
                        console.log(`[AlertCron] Saved last_email_sent for Performance Summary "${alert.alert_name}": ${istDateTimeStr} IST`);
                    } catch (sendErr) {
                        console.error(`[AlertCron] Failed to send Performance Summary email to ${sendEmail}:`, sendErr.message);
                    }
                } catch (perfErr) {
                    console.error(`[AlertCron] Performance Summary error for "${alert.alert_name}" on ${dbName}:`, perfErr.message);
                }
                continue; // Skip the regular alert flow for performance_summary
            }

            // ── REGULAR ALERT HANDLING (condition-based) ─────────────────────
            const pdpFilterClause = buildPdpFilterClause(alert.platforms, alert.brands);
            const pmFilterClause = buildPmFilterClause(alert.platforms, alert.brands);
            const kwFilterClause = buildKwFilterClause(alert.platforms, alert.brands);
            const threshold = parseFloat(alert.threshold_value) || 85;

            let isTriggered = false;
            let metricDetails = {};
            let isDynamicAlert = false;
            let dynamicEmailData = null;

            try {
                // Rule 1: Low OSA Alert (low_osa, low_osa_percent)
                if (alertType === 'low_osa' || alertType === 'low_osa_percent') {
                    const pdpQuery = `
                        SELECT 
                            sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                            sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno
                        FROM \`${dbName}\`.rb_pdp_olap
                        WHERE DATE = (SELECT MAX(DATE) FROM \`${dbName}\`.rb_pdp_olap WHERE DATE IS NOT NULL ${pdpFilterClause})
                        ${pdpFilterClause}
                    `;
                    const pdpStats = await queryAdminDB(pdpQuery);
                    const neno = parseFloat(pdpStats[0]?.neno) || 0;
                    const deno = parseFloat(pdpStats[0]?.deno) || 0;
                    const osa = deno > 0 ? (neno / deno) * 100 : 100;
                    
                    isTriggered = evalCondition(osa, alert.conditional_operator, threshold);
                    const platLabel = getPlatformLabel(alert.platforms);
                    const platPrefix = platLabel ? `${platLabel} ` : '';
                    const opSym = formatOperatorSymbol(alert.conditional_operator);

                    metricDetails = {
                        ruleType: 'Low OSA Alert',
                        calculatedOSA: `${osa.toFixed(2)}%`,
                        conditionText: `${platPrefix}OSA (${osa.toFixed(2)}%) ${opSym} ${threshold}%`,
                    };
                }
                // Rule 1b: Low OSA Alert (Bottom % City Level)
                else if (alertType === 'low_osa_bottom_city') {
                    isDynamicAlert = true;
                    const pct = (threshold / 100).toFixed(2);
                    const pdpQuery = `
                        WITH
                            latest_date AS (
                                SELECT MAX(DATE) AS max_date
                                FROM \`${dbName}\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL ${pdpFilterClause} AND Comp_flag = 0
                            ),
                            week_boundaries AS (
                                SELECT
                                    max_date,
                                    subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7) AS current_week_start
                                FROM latest_date
                            ),
                            weekly_city_stats AS (
                                SELECT
                                    Platform, Location AS City,
                                    subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                                    sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS neno,
                                    sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS deno,
                                    sum(ifNull(toFloat64OrZero(toString(Sales)), 0)) AS sales
                                FROM \`${dbName}\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL ${pdpFilterClause} AND Comp_flag = 0
                                  AND Location IS NOT NULL AND lower(Location) NOT IN ('other', 'others', 'null', 'undefined', '')
                                GROUP BY Platform, City, week_start
                            ),
                            weekly_osa AS (
                                SELECT
                                    Platform, City, week_start, sales,
                                    if(deno > 0, neno / deno * 100, 100) AS osa
                                FROM weekly_city_stats
                            ),
                            current_week AS (
                                SELECT w.Platform, w.City, w.osa
                                FROM weekly_osa w
                                CROSS JOIN week_boundaries b
                                WHERE w.week_start = b.current_week_start
                            ),
                            l4w_city AS (
                                SELECT w.Platform, w.City, avg(w.osa) AS l4w_avg, sum(w.sales) AS l4w_sales
                                FROM weekly_osa w
                                CROSS JOIN week_boundaries b
                                WHERE w.week_start >= b.current_week_start - INTERVAL 28 DAY
                                  AND w.week_start < b.current_week_start
                                GROUP BY w.Platform, w.City
                            ),
                            city_metrics AS (
                                SELECT
                                    c.Platform, c.City, c.osa, l.l4w_avg, l.l4w_sales, c.osa - l.l4w_avg AS delta
                                FROM current_week c
                                LEFT JOIN l4w_city l ON c.Platform = l.Platform AND c.City = l.City
                            ),
                            city_sales_weightage AS (
                                SELECT
                                    *,
                                    if(sum(l4w_sales) OVER (PARTITION BY Platform) > 0,
                                       l4w_sales / sum(l4w_sales) OVER (PARTITION BY Platform) * 100,
                                       0) AS city_sales_weightage
                                FROM city_metrics
                            ),
                            bottom_threshold AS (
                                SELECT Platform, quantile(${pct})(osa) AS threshold
                                FROM city_sales_weightage
                                GROUP BY Platform
                            )
                        SELECT
                            m.Platform, m.City, m.osa, m.l4w_avg, m.delta, m.city_sales_weightage
                        FROM city_sales_weightage m
                        INNER JOIN bottom_threshold t ON m.Platform = t.Platform
                        WHERE m.osa <= t.threshold AND m.osa > 0
                        ORDER BY m.Platform, m.osa ASC
                        LIMIT 10 BY m.Platform
                    `;
                    const aggQuery = `
                        WITH
                            latest_date AS (
                                SELECT MAX(DATE) AS max_date
                                FROM \`${dbName}\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL ${pdpFilterClause} AND Comp_flag = 0
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
                                FROM \`${dbName}\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL ${pdpFilterClause} AND Comp_flag = 0
                                GROUP BY week_start
                            ),
                            weekly_osa AS (
                                SELECT week_start, if(deno > 0, neno / deno * 100, 100) AS osa
                                FROM weekly_stats
                            )
                        SELECT
                            (SELECT osa FROM weekly_osa CROSS JOIN week_boundaries WHERE week_start = current_week_start) AS cw_osa,
                            (SELECT avg(osa) FROM weekly_osa CROSS JOIN week_boundaries WHERE week_start >= current_week_start - INTERVAL 28 DAY AND week_start < current_week_start) AS l4w_osa
                    `;
                    const [pdpStats, aggStats] = await Promise.all([
                        queryAdminDB(pdpQuery),
                        queryAdminDB(aggQuery)
                    ]);
                    const bottomCities = pdpStats;
                    isTriggered = bottomCities.length > 0;
                    
                    const cwOsa = parseFloat(aggStats[0]?.cw_osa) || 0;
                    const l4wOsa = parseFloat(aggStats[0]?.l4w_osa) || 0;
                    const aggDelta = cwOsa - l4wOsa;
                    
                    const platLabel = getPlatformLabel(alert.platforms);
                    const platPrefix = platLabel ? `${platLabel} ` : '';

                    metricDetails = {
                        ruleType: 'Low OSA Alert (Bottom % City Level)',
                        calculatedOSA: cwOsa.toFixed(2) + '%',
                        aggDelta: aggDelta.toFixed(2),
                        conditionText: `${platPrefix}Bottom ${threshold}% cities by OSA (Platform-wise)`,
                    };

                    if (isTriggered) {
                        const platforms = [...new Set(bottomCities.map(c => c.Platform))];
                        dynamicEmailData = platforms.map(plat => {
                            const platCities = bottomCities.filter(c => c.Platform === plat).slice(0, 10);
                            return {
                                platformName: plat,
                                headers: ['City Name', 'CW OSA %', 'L4W Avg %', 'Delta', 'Sales Weightage'],
                                rows: platCities.map(c => [
                                    c.City || 'Unknown', 
                                    parseFloat(c.osa).toFixed(2) + '%', 
                                    parseFloat(c.l4w_avg || 0).toFixed(2) + '%', 
                                    parseFloat(c.delta || 0).toFixed(2) + '%', 
                                    parseFloat(c.city_sales_weightage || 0).toFixed(2) + '%'
                                ])
                            };
                        });
                    }
                }
                // Rule 1c: Low OSA Alert (Bottom % Product Level)
                else if (alertType === 'low_osa_bottom_product') {
                    isDynamicAlert = true;
                    const pct = (threshold / 100).toFixed(2);
                    const pdpQuery = `
                        WITH
                            latest_date AS (
                                SELECT MAX(DATE) AS max_date
                                FROM \`${dbName}\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL ${pdpFilterClause} AND Comp_flag = 0
                            ),
                            week_boundaries AS (
                                SELECT
                                    max_date,
                                    subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7) AS current_week_start
                                FROM latest_date
                            ),
                            weekly_product_stats AS (
                                SELECT
                                    Platform, Web_Pid, any(Product) AS Product, any(msl) AS msl,
                                    subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                                    sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS neno,
                                    sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS deno
                                FROM \`${dbName}\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL ${pdpFilterClause} AND Comp_flag = 0
                                  AND Product IS NOT NULL AND lower(Product) NOT IN ('other', 'others', 'null', 'undefined', '')
                                GROUP BY Platform, Web_Pid, week_start
                            ),
                            weekly_osa AS (
                                SELECT
                                    Platform, Web_Pid, Product, msl, week_start,
                                    if(deno > 0, neno / deno * 100, 100) AS osa
                                FROM weekly_product_stats
                            ),
                            current_week AS (
                                SELECT w.Platform, w.Web_Pid, w.Product, w.msl, w.osa
                                FROM weekly_osa w
                                CROSS JOIN week_boundaries b
                                WHERE w.week_start = b.current_week_start
                            ),
                            l4w AS (
                                SELECT w.Platform, w.Web_Pid, avg(w.osa) AS l4w_avg
                                FROM weekly_osa w
                                CROSS JOIN week_boundaries b
                                WHERE w.week_start >= b.current_week_start - INTERVAL 28 DAY
                                  AND w.week_start < b.current_week_start
                                GROUP BY w.Platform, w.Web_Pid
                            ),
                            product_metrics AS (
                                SELECT
                                    c.Platform, c.Web_Pid, c.Product, c.msl, c.osa, l.l4w_avg, c.osa - l.l4w_avg AS delta
                                FROM current_week c
                                LEFT JOIN l4w l ON c.Platform = l.Platform AND c.Web_Pid = l.Web_Pid
                            ),
                            bottom_threshold AS (
                                SELECT Platform, quantile(${pct})(osa) AS threshold
                                FROM product_metrics
                                GROUP BY Platform
                            )
                        SELECT
                            m.Platform, m.Web_Pid, m.Product, m.msl, m.osa, m.l4w_avg, m.delta
                        FROM product_metrics m
                        INNER JOIN bottom_threshold t ON m.Platform = t.Platform
                        WHERE m.osa <= t.threshold AND m.osa > 0
                        ORDER BY m.Platform, m.osa ASC
                        LIMIT 10 BY m.Platform
                    `;
                    const aggQuery = `
                        WITH
                            latest_date AS (
                                SELECT MAX(DATE) AS max_date
                                FROM \`${dbName}\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL ${pdpFilterClause} AND Comp_flag = 0
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
                                FROM \`${dbName}\`.rb_pdp_olap
                                WHERE DATE IS NOT NULL ${pdpFilterClause} AND Comp_flag = 0
                                GROUP BY week_start
                            ),
                            weekly_osa AS (
                                SELECT week_start, if(deno > 0, neno / deno * 100, 100) AS osa
                                FROM weekly_stats
                            )
                        SELECT
                            (SELECT osa FROM weekly_osa CROSS JOIN week_boundaries WHERE week_start = current_week_start) AS cw_osa,
                            (SELECT avg(osa) FROM weekly_osa CROSS JOIN week_boundaries WHERE week_start >= current_week_start - INTERVAL 28 DAY AND week_start < current_week_start) AS l4w_osa
                    `;
                    const [pdpStats, aggStats] = await Promise.all([
                        queryAdminDB(pdpQuery),
                        queryAdminDB(aggQuery)
                    ]);
                    const bottomProducts = pdpStats;
                    isTriggered = bottomProducts.length > 0;
                    
                    const cwOsa = parseFloat(aggStats[0]?.cw_osa) || 0;
                    const l4wOsa = parseFloat(aggStats[0]?.l4w_osa) || 0;
                    const aggDelta = cwOsa - l4wOsa;
                    
                    const platLabel = getPlatformLabel(alert.platforms);
                    const platPrefix = platLabel ? `${platLabel} ` : '';

                    metricDetails = {
                        ruleType: 'Low OSA Alert (Bottom % Product Level)',
                        calculatedOSA: cwOsa.toFixed(2) + '%',
                        aggDelta: aggDelta.toFixed(2),
                        conditionText: `${platPrefix}Bottom ${threshold}% products by OSA (Platform-wise)`,
                    };

                    if (isTriggered) {
                        const platforms = [...new Set(bottomProducts.map(p => p.Platform))];
                        dynamicEmailData = platforms.map(plat => {
                            const platProducts = bottomProducts.filter(p => p.Platform === plat).slice(0, 10);
                            return {
                                platformName: plat,
                                headers: ['Product Name', 'CW OSA %', 'L4W Avg %', 'Delta', 'MSL Status'],
                                rows: platProducts.map(p => {
                                    let mslStatus = 'non-pareto';
                                    if (p.msl == 1 || p.msl == '1') {
                                        mslStatus = 'pareto';
                                    }
                                    return [
                                        p.Product || 'Unknown', 
                                        parseFloat(p.osa).toFixed(2) + '%', 
                                        parseFloat(p.l4w_avg || 0).toFixed(2) + '%', 
                                        parseFloat(p.delta || 0).toFixed(2) + '%', 
                                        mslStatus
                                    ];
                                })
                            };
                        });
                    }
                }
                // Rule 1d: Keyword Delta SOS Alert
                else if (alertType === 'keyword_delta_sos') {
                    isDynamicAlert = true;
                    const kwQuery = `
                        WITH
                            -- Dynamic Delta threshold
                            ${threshold} AS delta_threshold,

                            latest_date AS (
                                SELECT
                                    MAX(DATE) AS max_date
                                FROM \`${dbName}\`.rb_kw_olap
                                WHERE DATE IS NOT NULL ${kwFilterClause}
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
                            ),

                            -- Latest completed Sunday-Saturday week
                            current_week AS (
                                SELECT
                                    lower(platform_name) AS platform,
                                    keyword AS keyword,
                                    keyword_type AS bcg,

                                    ROUND(
                                        sumIf(
                                            ifNull(overall, 0),
                                            flag = 1
                                        ) * 100.0
                                        /
                                        nullIf(
                                            sum(ifNull(overall, 0)),
                                            0
                                        ),
                                        2
                                    ) AS sos

                                FROM \`${dbName}\`.rb_kw_olap

                                CROSS JOIN week_boundaries b

                                WHERE
                                    DATE >= b.current_week_start
                                    AND DATE < b.current_week_start + INTERVAL 7 DAY
                                    ${kwFilterClause}
                                    AND keyword IS NOT NULL AND lower(keyword) NOT IN ('other', 'others', 'null', 'undefined', '')

                                GROUP BY
                                    lower(platform_name),
                                    keyword,
                                    keyword_type
                            ),

                            -- Previous 4 completed Sunday-Saturday weeks
                            l4w AS (
                                SELECT
                                    lower(platform_name) AS platform,
                                    keyword AS keyword,
                                    keyword_type AS bcg,

                                    ROUND(
                                        sumIf(
                                            ifNull(overall, 0),
                                            flag = 1
                                        ) * 100.0
                                        /
                                        nullIf(
                                            sum(ifNull(overall, 0)),
                                            0
                                        ),
                                        2
                                    ) AS l4w_sos

                                FROM \`${dbName}\`.rb_kw_olap

                                CROSS JOIN week_boundaries b

                                WHERE
                                    DATE >= b.current_week_start - INTERVAL 28 DAY
                                    AND DATE < b.current_week_start
                                    ${kwFilterClause}
                                    AND keyword IS NOT NULL AND lower(keyword) NOT IN ('other', 'others', 'null', 'undefined', '')

                                GROUP BY
                                    lower(platform_name),
                                    keyword,
                                    keyword_type
                            ),

                            keyword_metrics AS (
                                SELECT
                                    c.platform,
                                    c.keyword,
                                    c.bcg,
                                    c.sos,
                                    l.l4w_sos AS \`l4w sos\`,

                                    -- L4W SOS - Current Week SOS
                                    ROUND(
                                        l.l4w_sos - c.sos,
                                        2
                                    ) AS delta

                                FROM current_week c

                                INNER JOIN l4w l
                                    ON c.platform = l.platform
                                    AND c.keyword = l.keyword
                                    AND c.bcg = l.bcg
                            )

                        SELECT
                            platform,
                            keyword,
                            sos,
                            \`l4w sos\`,
                            delta,
                            bcg

                        FROM keyword_metrics

                        WHERE
                            delta > delta_threshold

                        ORDER BY
                            platform,
                            bcg,
                            delta DESC
                        LIMIT 10 BY platform, bcg
                    `;
                    
                    const aggKwQuery = `
                        WITH
                            latest_date AS (
                                SELECT MAX(DATE) AS max_date
                                FROM \`${dbName}\`.rb_kw_olap
                                WHERE DATE IS NOT NULL ${kwFilterClause}
                            ),
                            week_boundaries AS (
                                SELECT max_date, subtractDays(max_date, toDayOfWeek(max_date) % 7 + 7) AS current_week_start
                                FROM latest_date
                            ),
                            keyword_sos AS (
                                SELECT
                                    keyword AS keyword,
                                    keyword_type AS keyword_type,
                                    ROUND(
                                        sumIf(
                                            ifNull(overall, 0),
                                            flag = 1
                                        ) * 100.0
                                        /
                                        nullIf(
                                            sum(ifNull(overall, 0)),
                                            0
                                        ),
                                        2
                                    ) AS sos
                                FROM \`${dbName}\`.rb_kw_olap
                                CROSS JOIN week_boundaries b
                                WHERE DATE >= b.current_week_start AND DATE < b.current_week_start + INTERVAL 7 DAY ${kwFilterClause}
                                GROUP BY keyword, keyword_type
                            )
                        SELECT ROUND(avg(sos), 2) AS agg_sos FROM keyword_sos;
                    `;

                    const [kwStats, aggKwStats] = await Promise.all([
                        queryAdminDB(kwQuery),
                        queryAdminDB(aggKwQuery)
                    ]);
                    isTriggered = kwStats.length > 0;
                    
                    const platLabel = getPlatformLabel(alert.platforms);
                    const platPrefix = platLabel ? `${platLabel} ` : '';

                    const overallCwSos = parseFloat(aggKwStats[0]?.agg_sos) || 0;

                    metricDetails = {
                        ruleType: 'Keyword Delta SOS',
                        calculatedOSA: isTriggered ? overallCwSos.toFixed(2) + '%' : '0%',
                        aggDelta: isTriggered ? (-parseFloat(kwStats[0].delta)).toFixed(2) : 0,
                        conditionText: `${platPrefix}Keyword SOS Delta > ${threshold} (Segmented by BCG)`,
                    };

                    if (isTriggered) {
                        try {
                            const platformsMap = new Map();
                            const selectedPlats = (Array.isArray(alert.platforms) && alert.platforms.length > 0) 
                                ? alert.platforms.filter(p => p && p !== 'All Platforms') 
                                : [];

                            kwStats.forEach(k => {
                                let platLabelLocal = (k.platform || 'Unknown').toLowerCase();
                                let bcgLabel = k.bcg || 'Uncategorized';
                                
                                if (!platformsMap.has(platLabelLocal)) {
                                    platformsMap.set(platLabelLocal, new Map());
                                }
                                const bcgMap = platformsMap.get(platLabelLocal);
                                if (!bcgMap.has(bcgLabel)) {
                                    bcgMap.set(bcgLabel, []);
                                }
                                
                                bcgMap.get(bcgLabel).push([
                                    k.keyword || 'Unknown',
                                    parseFloat(k.sos).toFixed(2) + '%',
                                    parseFloat(k['l4w sos']).toFixed(2) + '%',
                                    (-parseFloat(k.delta)).toFixed(2) + '%'
                                ]);
                            });

                            dynamicEmailData = [];
                            for (const [platformNameLower, bcgMap] of platformsMap.entries()) {
                                const originalPlat = selectedPlats.find(p => p.toLowerCase() === platformNameLower) || 
                                                     (platformNameLower.charAt(0).toUpperCase() + platformNameLower.slice(1));

                                const tables = [];
                                for (const [bcg, rows] of bcgMap.entries()) {
                                    if (rows && rows.length > 0) {
                                        tables.push({
                                            tableName: bcg,
                                            headers: ['Keyword', 'CW SOS %', 'L4W Avg %', 'Delta'],
                                            rows: rows
                                        });
                                    }
                                }
                                
                                if (tables.length > 0) {
                                    dynamicEmailData.push({
                                        platformName: originalPlat,
                                        tables
                                    });
                                }
                            }
                            console.log(`[AlertCron DEBUG] Successfully mapped dynamicEmailData. Length: ${dynamicEmailData.length}`);
                        } catch (mappingErr) {
                            console.error(`[AlertCron ERROR] Failed mapping dynamicEmailData for Keyword Delta SOS:`, mappingErr);
                        }
                    }
                }
                // Rule 2: Low OSA + Active Ads Alert (low_osa_ads)
                // (OSA from rb_pdp_olap, Ad Spend from rb_pm_olap, ignoring Campaign=Active)
                else if (alertType === 'low_osa_ads' || alertType.includes('ads')) {
                    // Check OSA from rb_pdp_olap
                    const pdpQuery = `
                        SELECT 
                            sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                            sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno
                        FROM \`${dbName}\`.rb_pdp_olap
                        WHERE DATE = (SELECT MAX(DATE) FROM \`${dbName}\`.rb_pdp_olap WHERE DATE IS NOT NULL ${pdpFilterClause})
                        ${pdpFilterClause}
                    `;
                    const pdpStats = await queryAdminDB(pdpQuery);
                    const neno = parseFloat(pdpStats[0]?.neno) || 0;
                    const deno = parseFloat(pdpStats[0]?.deno) || 0;
                    const osa = deno > 0 ? (neno / deno) * 100 : 100;

                    // Check Ad Spend from rb_pm_olap
                    const pmQuery = `
                        SELECT 
                            sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) as total_ad_spend
                        FROM \`${dbName}\`.rb_pm_olap
                        WHERE DATE = (SELECT MAX(DATE) FROM \`${dbName}\`.rb_pm_olap WHERE DATE IS NOT NULL ${pmFilterClause})
                        ${pmFilterClause}
                    `;
                    const pmStats = await queryAdminDB(pmQuery);
                    const adSpend = parseFloat(pmStats[0]?.total_ad_spend) || 0;

                    const isOsaMet = evalCondition(osa, alert.conditional_operator, threshold);
                    isTriggered = isOsaMet && adSpend > 0;

                    const platLabel = getPlatformLabel(alert.platforms);
                    const platPrefix = platLabel ? `${platLabel} ` : '';
                    const opSym = formatOperatorSymbol(alert.conditional_operator);

                    metricDetails = {
                        ruleType: 'Low OSA + Active Ads Alert',
                        calculatedOSA: `${osa.toFixed(2)}%`,
                        adSpend: `${currency}${adSpend.toFixed(2)}`,
                        conditionText: `${platPrefix}OSA (${osa.toFixed(2)}%) ${opSym} ${threshold}% AND Ad Spend (${currency}${adSpend.toFixed(2)}) > 0`,
                    };
                }
                // Rule 3: Sharp Promo/Discount Change Alert (promo_discount_change)
                else if (alertType === 'promo_discount_change' || alertType.includes('promo') || alertType.includes('discount')) {
                    // Check Discount from rb_pdp_olap (Current vs Baseline)
                    const discQuery = `
                        SELECT 
                            avg(ifNull(toFloat64OrZero(toString(Discount)), 0)) as curr_discount
                        FROM \`${dbName}\`.rb_pdp_olap
                        WHERE DATE = (SELECT MAX(DATE) FROM \`${dbName}\`.rb_pdp_olap WHERE DATE IS NOT NULL ${pdpFilterClause})
                        ${pdpFilterClause}
                    `;
                    const baseDiscQuery = `
                        SELECT 
                            avg(ifNull(toFloat64OrZero(toString(Discount)), 0)) as base_discount
                        FROM \`${dbName}\`.rb_pdp_olap
                        WHERE DATE < (SELECT MAX(DATE) FROM \`${dbName}\`.rb_pdp_olap WHERE DATE IS NOT NULL)
                          AND DATE >= subtractDays((SELECT MAX(DATE) FROM \`${dbName}\`.rb_pdp_olap WHERE DATE IS NOT NULL), 7)
                          ${pdpFilterClause}
                    `;
                    const [discStats, baseDiscStats] = await Promise.all([
                        queryAdminDB(discQuery),
                        queryAdminDB(baseDiscQuery)
                    ]);

                    const currDisc = parseFloat(discStats[0]?.curr_discount) || 0;
                    const baseDisc = parseFloat(baseDiscStats[0]?.base_discount) || 0;
                    
                    const shiftPct = baseDisc > 0 ? Math.abs(((currDisc - baseDisc) / baseDisc) * 100) : Math.abs(currDisc - baseDisc);
                    isTriggered = shiftPct >= threshold;

                    const platLabel = getPlatformLabel(alert.platforms);
                    const platPrefix = platLabel ? `${platLabel} ` : '';

                    metricDetails = {
                        ruleType: 'Sharp Promo/Discount Change Alert',
                        currentDiscount: `${currDisc.toFixed(2)}%`,
                        baselineDiscount: `${baseDisc.toFixed(2)}%`,
                        discountShift: `${shiftPct.toFixed(2)}%`,
                        conditionText: `${platPrefix}Discount Shift (${shiftPct.toFixed(2)}%) >= ${threshold}% [Curr: ${currDisc.toFixed(2)}%, Base: ${baseDisc.toFixed(2)}%]`,
                    };
                }
                // Rule 4: Category Health Alert (category_health)
                else if (alertType === 'category_health' || alertType.includes('health')) {
                    // Check multi-metrics from rb_pdp_olap & rb_pm_olap
                    const pdpQuery = `
                        SELECT 
                            sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                            sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno,
                            avg(ifNull(toFloat64OrZero(toString(Selling_Price)), 0)) as avg_price,
                            sum(ifNull(toFloat64OrZero(toString(Sales)), 0)) / nullIf(sum(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)), 0) as asp,
                            avg(ifNull(toFloat64OrZero(toString(Discount)), 0)) as avg_discount
                        FROM \`${dbName}\`.rb_pdp_olap
                        WHERE DATE = (SELECT MAX(DATE) FROM \`${dbName}\`.rb_pdp_olap WHERE DATE IS NOT NULL ${pdpFilterClause})
                        ${pdpFilterClause}
                    `;
                    const pmQuery = `
                        SELECT 
                            sum(ifNull(toFloat64OrZero(toString(ad_spend)), 0)) as total_ad_spend
                        FROM \`${dbName}\`.rb_pm_olap
                        WHERE DATE = (SELECT MAX(DATE) FROM \`${dbName}\`.rb_pm_olap WHERE DATE IS NOT NULL ${pmFilterClause})
                        ${pmFilterClause}
                    `;

                    const [pdpStats, pmStats] = await Promise.all([
                        queryAdminDB(pdpQuery),
                        queryAdminDB(pmQuery)
                    ]);

                    const neno = parseFloat(pdpStats[0]?.neno) || 0;
                    const deno = parseFloat(pdpStats[0]?.deno) || 0;
                    const osa = deno > 0 ? (neno / deno) * 100 : 100;
                    const price = parseFloat(pdpStats[0]?.avg_price) || 0;
                    const asp = parseFloat(pdpStats[0]?.asp) || price;
                    const discount = parseFloat(pdpStats[0]?.avg_discount) || 0;
                    const adSpend = parseFloat(pmStats[0]?.total_ad_spend) || 0;

                    // Health check: Triggered if OSA < threshold OR discount > threshold
                    isTriggered = osa < threshold || discount > threshold;

                    const platLabel = getPlatformLabel(alert.platforms);
                    const platPrefix = platLabel ? `${platLabel} ` : '';

                    const formattedAdSpend = `${currency}${Math.round(adSpend).toLocaleString('en-IN')}`;

                    metricDetails = {
                        ruleType: 'Category Health Alert',
                        calculatedOSA: `${osa.toFixed(2)}%`,
                        averagePrice: `${currency}${price.toFixed(2)}`,
                        averageASP: `${currency}${asp.toFixed(2)}`,
                        averageDiscount: `${discount.toFixed(2)}%`,
                        adSpend: formattedAdSpend,
                        conditionText: `${platPrefix}Category Health • OSA: ${osa.toFixed(2)}%, Discount: ${discount.toFixed(2)}%, Ad Spend: ${formattedAdSpend}`,
                    };
                }
                // Fallback default (OSA Check)
                else {
                    const pdpQuery = `
                        SELECT 
                            sum(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) as neno,
                            sum(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) as deno
                        FROM \`${dbName}\`.rb_pdp_olap
                        WHERE DATE = (SELECT MAX(DATE) FROM \`${dbName}\`.rb_pdp_olap WHERE DATE IS NOT NULL ${pdpFilterClause})
                        ${pdpFilterClause}
                    `;
                    const pdpStats = await queryAdminDB(pdpQuery);
                    const neno = parseFloat(pdpStats[0]?.neno) || 0;
                    const deno = parseFloat(pdpStats[0]?.deno) || 0;
                    const osa = deno > 0 ? (neno / deno) * 100 : 100;
                    
                    isTriggered = evalCondition(osa, alert.conditional_operator, threshold);
                    const platLabel = getPlatformLabel(alert.platforms);
                    const platPrefix = platLabel ? `${platLabel} ` : '';
                    const opSym = formatOperatorSymbol(alert.conditional_operator);

                    metricDetails = {
                        ruleType: alert.alert_name || 'Custom Alert',
                        calculatedOSA: `${osa.toFixed(2)}%`,
                        conditionText: `${platPrefix}OSA (${osa.toFixed(2)}%) ${opSym} ${threshold}%`,
                    };
                }

                if (isTriggered) {
                    console.log(`[AlertCron] 🚨 Rule TRIGGERED for "${alert.alert_name}" on ${dbName} [Condition: ${metricDetails.conditionText}]`);

                    // ── Fetch enriched data for the dynamic sales_enablement template ──
                    const logoUrl = logoMap.get(alert.db_id) || '';
                    const companyDisplayName = dbName ? (dbName.charAt(0).toUpperCase() + dbName.slice(1)) : 'Company';
                    const latestDateStr = await getLatestDataDate(dbName);
                    const dateRanges = computeDateRanges(alert.benchmark_period, latestDateStr);
                    console.log(`[AlertCron] Date ranges for "${alert.alert_name}": latestDate=${latestDateStr}, benchmark="${alert.benchmark_period}", current=${dateRanges.currentStart} to ${dateRanges.currentEnd}, prev=${dateRanges.prevStart} to ${dateRanges.prevEnd}`);
                    const alertOpSym = formatOperatorSymbol(alert.conditional_operator);

                    // Determine which platforms to iterate over
                    const alertPlatforms = (Array.isArray(alert.platforms) && alert.platforms.length > 0)
                        ? alert.platforms.filter(p => p && p !== 'All Platforms')
                        : [];

                    // Fetch aggregate OSA for header metrics
                    let aggregateOsa = { currentOsa: 0, previousOsa: 0, delta: 0 };
                    try {
                        aggregateOsa = await getAggregateOsa(
                            dbName, alert.platforms, alert.brands,
                            dateRanges.currentStart, dateRanges.currentEnd,
                            dateRanges.prevStart, dateRanges.prevEnd
                        );
                    } catch (aggErr) {
                        console.warn(`[AlertCron] Could not fetch aggregate OSA for "${alert.alert_name}":`, aggErr.message);
                    }

                    // Fetch per-platform brand OSA + impacted SKUs
                    const platformData = [];
                    for (const plat of (alertPlatforms.length > 0 ? alertPlatforms : [''])) {
                        let brands = [];
                        let skus = [];
                        try {
                            if (plat) {
                                brands = await getBrandOsaByPlatform(
                                    dbName, plat, alert.brands,
                                    dateRanges.currentStart, dateRanges.currentEnd,
                                    dateRanges.prevStart, dateRanges.prevEnd,
                                    alert.threshold_value
                                );
                                skus = await getImpactedSkus(
                                    dbName, plat, alert.brands,
                                    dateRanges.currentStart, dateRanges.currentEnd,
                                    dateRanges.prevStart, dateRanges.prevEnd,
                                    3,
                                    alert.threshold_value
                                );
                                console.log(`[AlertCron] ${plat}: ${brands.length} brands, ${skus.length} impacted SKUs returned (threshold=${alert.threshold_value})`);
                            }
                        } catch (pdErr) {
                            console.warn(`[AlertCron] Could not fetch platform data for ${plat} on ${dbName}:`, pdErr.message);
                        }
                        platformData.push({
                            platform: plat || 'All Platforms',
                            brands,
                            skus,
                        });
                    }

                    // 1. Email Alert Dispatch
                    if (sendEmail && sendEmail.includes('@')) {
                        const emailFreqCheck = shouldSendBasedOnFrequency(alert.last_email_sent, alert.alert_frequency);
                        if (emailFreqCheck.allowed) {
                            console.log(`[AlertCron] Email frequency check passed (${emailFreqCheck.reason})! Checking impacted SKUs before sending email to ${sendEmail}...`);

                            const totalImpactedSkus = platformData.reduce((sum, pd) => sum + (pd.skus ? pd.skus.length : 0), 0);

                            if (totalImpactedSkus > 0 || isDynamicAlert) {
                                let emailHtml = '';
                                if (isDynamicAlert && !isTriggered) {
                                    console.log(`[AlertCron] Dynamic alert "${alert.alert_name}" not triggered (no data crossed threshold). Skipping email and not updating last_email_sent.`);
                                    continue;
                                }

                                let finalDynamicEmailData = [];
                                if (isDynamicAlert) {
                                    finalDynamicEmailData = Array.isArray(dynamicEmailData) ? dynamicEmailData : (dynamicEmailData ? [dynamicEmailData] : []);
                                } else {
                                    finalDynamicEmailData = platformData.map(p => {
                                        const tables = [];
                                        if (p.brands && p.brands.length > 0) {
                                            tables.push({
                                                tableName: 'Impacted Brands',
                                                headers: ['Brand', 'Current OSA'],
                                                rows: p.brands.map(b => [b.brand || 'Unknown', `${b.currentOsa}%`])
                                            });
                                        }
                                        if (p.skus && p.skus.length > 0) {
                                            tables.push({
                                                tableName: 'Impacted SKUs',
                                                headers: ['SKU', 'Brand', 'Current OSA'],
                                                rows: p.skus.map(s => [s.sku_name || s.sku || 'Unknown', s.brand || 'Unknown', `${s.currentOsa}%`])
                                            });
                                        }
                                        return {
                                            platformName: p.platform,
                                            tables
                                        };
                                    });
                                }

                                let finalCwStart = dateRanges.currentStart;
                                let finalCwEnd = dateRanges.currentEnd;
                                let finalL4wStart = dateRanges.prevStart;
                                let finalL4wEnd = dateRanges.prevEnd;

                                if (isDynamicAlert) {
                                    const platForDate = alertPlatforms.length > 0 ? alertPlatforms[0] : '';
                                    const tableName = alert.alert_type === 'keyword_delta_sos' ? 'rb_kw_olap' : 'rb_pdp_olap';
                                    const cwDateRange = await getCWDateRange(dbName, platForDate, tableName);
                                    if (cwDateRange && cwDateRange.cwStart) {
                                        finalCwStart = cwDateRange.cwStart;
                                        finalCwEnd = cwDateRange.cwEnd;
                                        finalL4wStart = cwDateRange.l4wStart;
                                        finalL4wEnd = cwDateRange.l4wEnd;
                                    }
                                }

                                emailHtml = generateDynamicAlertEmailHtml({
                                    logoUrl,
                                    companyName: companyDisplayName,
                                    istNow,
                                    alertName: alert.alert_name || (isDynamicAlert ? metricDetails.ruleType : 'Low OSA Alert'),
                                    severityLevel: alert.severity_level || 'Warning',
                                    currentMetricValue: isDynamicAlert ? metricDetails.calculatedOSA : (aggregateOsa.currentOsa ? `${aggregateOsa.currentOsa}%` : 'N/A'),
                                    metricDelta: isDynamicAlert ? (metricDetails.aggDelta !== undefined ? metricDetails.aggDelta : aggregateOsa.delta) : aggregateOsa.delta,
                                    operator: isDynamicAlert ? (formatOperatorSymbol(alert.conditional_operator) || '<=') : alertOpSym,
                                    threshold: threshold,
                                    platformData: finalDynamicEmailData,
                                    cwStart: finalCwStart,
                                    cwEnd: finalCwEnd,
                                    l4wStart: finalL4wStart,
                                    l4wEnd: finalL4wEnd,
                                    isDynamicAlert: isDynamicAlert,
                                });

                                const fromEmail = process.env.Alert_email || process.env.ALERT_EMAIL || 'business@trailytics.com';
                                const mailOptions = {
                                    from: `"Trailytics Alerts" <${fromEmail}>`,
                                    to: sendEmail,
                                    subject: `🚨 ALERT TRIGGERED: ${alert.alert_name} [${new Date().toLocaleTimeString()}]`,
                                    text: `Hi,\n\nAn intelligent alert rule has been triggered for your dashboard.\n\nAlert: ${alert.alert_name}\nDatabase: ${dbName}\nSeverity: ${alert.severity_level || 'Warning'}\nPlatforms: ${alert.platforms.join(', ') || 'All'}\nBrands: ${alert.brands.join(', ') || 'All'}\nCondition: ${metricDetails.conditionText}\nCurrent OSA: ${aggregateOsa.currentOsa}%\nPrevious OSA: ${aggregateOsa.previousOsa}%\n\nBest regards,\nTrailytics Team`,
                                    html: emailHtml,
                                };

                                try {
                                    const info = await transporter.sendMail(mailOptions);
                                    console.log(`[AlertCron] HTML email sent successfully to ${sendEmail}. Message ID: ${info.messageId}`);

                                    // Update last_email_sent timestamp in ClickHouse
                                    const updateQuery = `
                                        ALTER TABLE admin_master.tb_alert 
                                        UPDATE last_email_sent = parseDateTimeBestEffort('${istNow}') 
                                        WHERE id = toUUID('${alert.id}')
                                    `;
                                    await queryAdminDB(updateQuery);
                                    console.log(`[AlertCron] Saved current IST date & time to last_email_sent for alert "${alert.alert_name}" (${alert.id}): ${istNow} IST`);
                                } catch (sendErr) {
                                    console.error(`[AlertCron] Failed to send email to ${sendEmail}:`, sendErr.message);
                                }
                            } else {
                                console.log(`[AlertCron] No impacted SKUs found. Skipping email sending and not updating last_email_sent.`);
                            }
                        } else {
                            console.log(`[AlertCron] Email skipped for "${alert.alert_name}": ${emailFreqCheck.reason}`);
                        }
                    }

                    // 2. WhatsApp Alert Dispatch
                    const targetWhatsappNo = (whatsappNo || process.env.Whatsapp_Number || process.env.WHATSAPP_NUMBER || '8766258384').trim();
                    if (targetWhatsappNo) {
                        const whatsappFreqCheck = shouldSendBasedOnFrequency(alert.last_whatsapp_msg_sent, alert.alert_frequency);
                        if (whatsappFreqCheck.allowed) {
                            console.log(`[AlertCron] WhatsApp frequency check passed (${whatsappFreqCheck.reason})! Dispatching WhatsApp alert to ${targetWhatsappNo}...`);

                            const recipientName = 'there';

                            // Build richer WhatsApp summary with impacted SKU info
                            let alertSummaryLines = `🔴 ${alert.alert_name} triggered for ${companyDisplayName}`;
                            if (alert.alert_type === 'keyword_delta_sos') {
                                alertSummaryLines += `\nCurrent SOS: ${metricDetails.calculatedOSA} | Delta: ${metricDetails.aggDelta}%`;
                            } else {
                                alertSummaryLines += `\nCurrent OSA: ${aggregateOsa.currentOsa}% | Previous: ${aggregateOsa.previousOsa}% | Delta: ${aggregateOsa.delta}%`;
                            }
                            
                            if (platformData.length > 0) {
                                for (const pd of platformData) {
                                    if (pd.skus && pd.skus.length > 0) {
                                        alertSummaryLines += `\n📦 ${pd.platform} - Top impacted SKUs:`;
                                        for (const sku of pd.skus.slice(0, 3)) {
                                            alertSummaryLines += `\n  • ${sku.skuName} (OSA: ${sku.currentOsa}%)`;
                                        }
                                    }
                                }
                            }

                            const components = buildAlertTemplateComponents({
                                recipientName,
                                clientName: companyDisplayName,
                                lines: alertSummaryLines,
                                dashboardPathParam: '',
                            });
                            const fullText = buildAlertFullText({
                                recipientName,
                                clientName: companyDisplayName,
                                lines: alertSummaryLines,
                            });

                            try {
                                await sendWhatsappMessage({
                                    to: targetWhatsappNo,
                                    components,
                                    text: fullText,
                                });

                                // Update last_whatsapp_msg_sent timestamp in ClickHouse
                                const updateWaQuery = `
                                    ALTER TABLE admin_master.tb_alert 
                                    UPDATE last_whatsapp_msg_sent = parseDateTimeBestEffort('${istNow}') 
                                    WHERE id = toUUID('${alert.id}')
                                `;
                                await queryAdminDB(updateWaQuery);
                                console.log(`[AlertCron] Saved current IST date & time to last_whatsapp_msg_sent for alert "${alert.alert_name}" (${alert.id}): ${istNow} IST`);
                            } catch (waErr) {
                                console.error(`[AlertCron] Failed to send WhatsApp message to ${targetWhatsappNo}:`, waErr.message);
                            }
                        } else {
                            console.log(`[AlertCron] WhatsApp skipped for "${alert.alert_name}": ${whatsappFreqCheck.reason}`);
                        }
                    }
                }
            } catch (queryErr) {
                console.error(`[AlertCron] Failed to run alert check for "${alert.alert_name}" on ${dbName}:`, queryErr.message);
            }
        }
    } catch (err) {
        console.error('[AlertCron] Error in scheduled email alerts job:', err.message);
    }
};

/**
 * Start the background interval task running every 1 minute
 */
export const initAlertCron = () => {
    const INTERVAL_MS = 1 * 60 * 1000;

    if (cronIntervalId) {
        clearInterval(cronIntervalId);
    }

    console.log(`[AlertCron] Initializing alert scheduler (runs every 1 minute)`);
    
    cronIntervalId = setInterval(() => {
        runEmailAlertsJob().catch(err => {
            console.error('[AlertCron] Interval execution failed:', err.message);
        });
    }, INTERVAL_MS);

    // Run once immediately on start for developer verification
    runEmailAlertsJob().catch(err => {
        console.error('[AlertCron] Immediate execution failed:', err.message);
    });
};

/**
 * Stop the background interval task
 */
export const stopAlertCron = () => {
    if (cronIntervalId) {
        clearInterval(cronIntervalId);
        cronIntervalId = null;
        console.log('[AlertCron] Alert scheduler stopped');
    }
};
