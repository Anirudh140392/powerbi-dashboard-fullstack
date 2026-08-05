// src/services/alertCronService.js
// Background task to send email alerts every 1 minute
import nodemailer from 'nodemailer';
import { queryAdminDB } from '../config/adminClickhouse.js';
import { decrypt } from '../utils/encryption.js';
import { generateAlertEmailHtml } from '../utils/alertEmailTemplate.js';
import { buildAlertTemplateComponents, buildAlertFullText } from '../utils/whatsappTemplate.js';
import { sendWhatsappMessage } from './whatsappService.js';
import { getCompanyLogo, computeDateRanges, getBrandOsaByPlatform, getImpactedSkus, getAggregateOsa } from './alertDataService.js';

let cronIntervalId = null;

/**
 * Initialize nodemailer transport with Outlook credentials from .env
 */
const getTransporter = () => {
    const fromEmail = process.env.Alert_email || process.env.ALERT_EMAIL || 'business@trailytics.com';
    const password = process.env.Alert_email_password || process.env.ALERT_EMAIL_PASSWORD || 'Marketing@!22';

    if (!fromEmail || !password) {
        console.warn('[AlertCron] Outlook email credentials are not set in .env');
        return null;
    }

    return nodemailer.createTransport({
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false, // TLS upgrades
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

        // 2. Fetch all configured alerts with last_email_sent and alert_frequency
        const alerts = await queryAdminDB(`
            SELECT 
                toString(id) as id,
                db_id,
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
            const pdpFilterClause = buildPdpFilterClause(alert.platforms, alert.brands);
            const pmFilterClause = buildPmFilterClause(alert.platforms, alert.brands);
            const threshold = parseFloat(alert.threshold_value) || 85;
            const alertType = (alert.alert_type || 'low_osa').toLowerCase();

            let isTriggered = false;
            let metricDetails = {};

            try {
                // Rule 1: Low OSA Alert (low_osa)
                if (alertType === 'low_osa') {
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
                    const dateRanges = computeDateRanges(alert.benchmark_period);
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
                                    dateRanges.prevStart, dateRanges.prevEnd
                                );
                                skus = await getImpactedSkus(
                                    dbName, plat, alert.brands,
                                    dateRanges.currentStart, dateRanges.currentEnd,
                                    dateRanges.prevStart, dateRanges.prevEnd,
                                    5
                                );
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
                            console.log(`[AlertCron] Email frequency check passed (${emailFreqCheck.reason})! Sending HTML alert email to ${sendEmail}...`);

                            const emailHtml = generateAlertEmailHtml({
                                logoUrl,
                                companyName: companyDisplayName,
                                istNow,
                                alertName: alert.alert_name || 'Low OSA Alert',
                                severityLevel: alert.severity_level || 'Warning',
                                thresholdValue: threshold,
                                conditionalOperator: alertOpSym,
                                aggregateOsa,
                                platformData,
                            });

                            const fromEmail = process.env.Alert_email || process.env.ALERT_EMAIL || 'business@trailytics.com';
                            const mailOptions = {
                                from: `"Trailytics Alerts" <${fromEmail}>`,
                                to: sendEmail,
                                subject: `🚨 ALERT TRIGGERED: ${alert.alert_name}`,
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
                            alertSummaryLines += `\nCurrent OSA: ${aggregateOsa.currentOsa}% | Previous: ${aggregateOsa.previousOsa}% | Delta: ${aggregateOsa.delta}%`;
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
