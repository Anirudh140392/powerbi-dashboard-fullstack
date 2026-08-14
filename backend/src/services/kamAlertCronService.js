import nodemailer from 'nodemailer';
import { queryAdminDB } from '../config/adminClickhouse.js';
// import { generateAlertEmailHtml } from '../utils/alertEmailTemplate.js';
import { generatePerfSummaryEmailHtml } from '../utils/perfSummaryEmailTemplate.js';
import { fetchAllPlatformKPIs } from './perfSummaryDataService.js';
import { getLatestDataDate, computeDateRanges, getBrandOsaByPlatform, getImpactedSkus, getAggregateOsa } from './alertDataService.js';

let cronIntervalId = null;

const getTransporter = () => {
    const fromEmail = process.env.Alert_email || process.env.ALERT_EMAIL || 'business@trailytics.com';
    const password = process.env.Alert_email_password || process.env.ALERT_EMAIL_PASSWORD || 'Marketing@!22';

    if (!fromEmail || !password) {
        console.warn('[KamAlertCron] Outlook email credentials are not set in .env');
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

const formatOperatorSymbol = (op) => {
    if (!op) return '<';
    const lowerOp = String(op).toLowerCase();
    if (lowerOp.includes('gte') || lowerOp.includes('>=')) return '>=';
    if (lowerOp.includes('greater') || lowerOp.includes('gt') || lowerOp.includes('>')) return '>';
    if (lowerOp.includes('lte') || lowerOp.includes('<=')) return '<=';
    if (lowerOp.includes('equal') || lowerOp.includes('eq') || lowerOp.includes('=')) return '=';
    return '<';
};

const getPlatformLabel = (platforms) => {
    if (Array.isArray(platforms) && platforms.length > 0) {
        const filtered = platforms.filter(p => p && p !== 'All Platforms');
        if (filtered.length > 0) {
            return filtered.join(', ');
        }
    }
    return '';
};

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

const getCurrencySymbol = (dbName) => {
    if (!dbName) return '₹';
    const lower = String(dbName).toLowerCase().trim();
    if (lower === 'hayatna') {
        return 'AED ';
    }
    return '₹';
};

const shouldSendBasedOnFrequency = (lastSentDateStr, alertFrequency) => {
    if (!lastSentDateStr || String(lastSentDateStr).includes('\\N') || String(lastSentDateStr).trim() === '' || String(lastSentDateStr).startsWith('1970')) {
        return { allowed: true, reason: 'First dispatch' };
    }

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
                reason: `Frequency is ${requiredMins} minutes. Only ${diffMins} mins passed. Waiting ${minsRemaining} more mins.`
            };
        }
    }

    if (freqLower.includes('hourly') || freqLower.includes('hour')) {
        const oneHourMs = 60 * 60 * 1000;
        if (diffMs >= oneHourMs) {
            return { allowed: true, reason: `Hourly frequency met (${diffHours} hrs passed)` };
        } else {
            const minsRemaining = Math.ceil((oneHourMs - diffMs) / (60 * 1000));
            return { allowed: false, reason: `Frequency is Hourly. Only ${diffMins} mins passed. Waiting ${minsRemaining} more mins.` };
        }
    }

    if (freqLower.includes('daily') || freqLower.includes('day')) {
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (diffMs >= oneDayMs) {
            return { allowed: true, reason: `Daily frequency met (${diffHours} hrs passed)` };
        } else {
            const hoursRemaining = ((oneDayMs - diffMs) / (60 * 60 * 1000)).toFixed(1);
            return { allowed: false, reason: `Frequency is Daily. Only ${diffHours} hrs passed. Waiting ${hoursRemaining} more hours.` };
        }
    }

    if (freqLower.includes('weekly') || freqLower.includes('week')) {
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        if (diffMs >= oneWeekMs) {
            return { allowed: true, reason: `Weekly frequency met` };
        } else {
            const daysRemaining = ((oneWeekMs - diffMs) / (24 * 60 * 60 * 1000)).toFixed(1);
            return { allowed: false, reason: `Frequency is Weekly. Only ${diffHours} hrs passed. Waiting ${daysRemaining} more days.` };
        }
    }

    return { allowed: true, reason: 'Default fallback' };
};

export const runKamAlertsJob = async () => {
    // Check if it's 4:30 PM IST (16:30)
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffsetMs);
    const hours = istNow.getHours();
    const minutes = istNow.getMinutes();

    // Trigger only exactly at 16:30. Since it runs every 1 minute, this should fire once per day.
    /* DEVELOPMENT OVERRIDE
    if (hours !== 16 || minutes !== 30) {
        return;
    }
    */

    const istNowStr = getISTDateTimeString();
    console.log(`[KamAlertCron ${istNowStr} IST] Running scheduled KAM email alerts job at 4:30 PM...`);

    const transporter = getTransporter();
    if (!transporter) {
        console.error('[KamAlertCron] Aborting job: Nodemailer transporter is not configured');
        return;
    }

    try {
        const dbList = await queryAdminDB(`
            SELECT toString(db_id) as db_id, db_name, logo_url, Internal_kam 
            FROM tb_database
        `);

        if (dbList.length === 0) {
            console.log('[KamAlertCron] No databases found.');
            return;
        }

        const alerts = await queryAdminDB(`
            SELECT 
                toString(id) as id,
                db_id,
                alert_name,
                alert_type,
                platforms,
                brands,
                conditional_operator,
                threshold_value,
                benchmark_period,
                alert_frequency,
                severity_level,
                scheduled_day
            FROM tb_alert
        `);

        // Group alerts by db_id
        const alertsByDb = {};
        alerts.forEach(a => {
            if (!alertsByDb[a.db_id]) alertsByDb[a.db_id] = [];
            alertsByDb[a.db_id].push(a);
        });

        console.log(`[KamAlertCron] Processing KAM alerts for ${dbList.length} databases...`);

        for (const db of dbList) {
            const dbId = db.db_id;
            const dbName = db.db_name;
            const logoUrl = db.logo_url || '';
            const internalKamStr = db.Internal_kam;

            if (!internalKamStr || internalKamStr.trim() === '') {
                continue; // No KAM config for this DB
            }

            let internalKam;
            try {
                internalKam = JSON.parse(internalKamStr);
            } catch (e) {
                console.error(`[KamAlertCron] Invalid JSON in Internal_kam for db_id ${dbId}:`, e.message);
                continue;
            }

            if (!internalKam.all_platforms) {
                continue;
            }

            const dbAlerts = alertsByDb[dbId] || [];
            if (dbAlerts.length === 0) {
                continue;
            }

            let isKamUpdated = false;

            for (const [platformKey, kamUsers] of Object.entries(internalKam.all_platforms)) {
                if (!Array.isArray(kamUsers) || kamUsers.length === 0) {
                    continue;
                }

                for (let i = 0; i < kamUsers.length; i++) {
                    const user = kamUsers[i];
                    const sendEmail = user.email;

                    if (!sendEmail || !sendEmail.includes('@')) {
                        continue;
                    }

                    for (const alert of dbAlerts) {
                        const alertType = (alert.alert_type || 'low_osa').toLowerCase();

                        // Currently, only send low_osa and performance_summary to KAM
                        if (alertType !== 'low_osa' && !alertType.includes('performance_summary')) {
                            continue;
                        }
                        let sentKey = `last_${alertType}_alert_mail_sent`;
                        if (alertType.includes('performance_summary')) {
                            sentKey = `last_${alertType}_mail_sent`;
                        } else if (alertType === 'promo_discount_change') {
                            sentKey = 'last_sharp_promo_alert_mail_sent';
                        }
                        const lastSentDateStr = user[sentKey];

                        // Validate Frequency
                        const emailFreqCheck = shouldSendBasedOnFrequency(lastSentDateStr, alert.alert_frequency);
                        /* DEVELOPMENT OVERRIDE
                        if (!emailFreqCheck.allowed) {
                            continue;
                        }
                        */

                        // Determine Platforms for Query
                        let alertPlatforms = [];
                        if (platformKey.toLowerCase() === 'overall') {
                            // If overall, they receive for all platforms specified in the alert config or all platforms
                            alertPlatforms = (Array.isArray(alert.platforms) && alert.platforms.length > 0)
                                ? alert.platforms.filter(p => p && p !== 'All Platforms')
                                : [];
                        } else {
                            // If specific platform, restrict it
                            alertPlatforms = [platformKey];
                        }

                        const currency = getCurrencySymbol(dbName);
                        const pdpFilterClause = buildPdpFilterClause(alertPlatforms, alert.brands);
                        const pmFilterClause = buildPmFilterClause(alertPlatforms, alert.brands);
                        const threshold = parseFloat(alert.threshold_value) || 85;

                        let isTriggered = false;
                        let emailHtml = '';
                        let subject = '';

                        try {
                            if (alertType === 'performance_summary' || alertType.includes('performance_summary')) {
                                // Weekly scheduled digest
                                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                const todayDayName = dayNames[istNow.getDay()];
                                const scheduledDay = (alert.scheduled_day || '').trim();

                                if (scheduledDay && scheduledDay.toLowerCase() !== todayDayName.toLowerCase()) {
                                    continue;
                                }

                                const fmtDate = (d) => {
                                    const y = d.getFullYear();
                                    const m = String(d.getMonth() + 1).padStart(2, '0');
                                    const dd = String(d.getDate()).padStart(2, '0');
                                    return `${y}-${m}-${dd}`;
                                };

                                const currentDateObj = new Date(istNow);
                                currentDateObj.setDate(currentDateObj.getDate() - 1);
                                const currentDate = fmtDate(currentDateObj);

                                const previousDateObj = new Date(currentDateObj);
                                previousDateObj.setDate(previousDateObj.getDate() - 7);
                                const previousDate = fmtDate(previousDateObj);

                                const msCurrentDateObj = new Date(istNow);
                                msCurrentDateObj.setDate(msCurrentDateObj.getDate() - 3);
                                const msCurrentDate = fmtDate(msCurrentDateObj);

                                const msPreviousDateObj = new Date(msCurrentDateObj);
                                msPreviousDateObj.setDate(msPreviousDateObj.getDate() - 7);
                                const msPreviousDate = fmtDate(msPreviousDateObj);

                                const platformCards = [];
                                const platformsToFetch = alertPlatforms.length > 0 ? alertPlatforms : [platformKey];

                                for (const plat of platformsToFetch) {
                                    try {
                                        const kpis = await fetchAllPlatformKPIs(
                                            dbName, plat, alert.brands,
                                            currentDate, previousDate,
                                            msCurrentDate, msPreviousDate
                                        );
                                        platformCards.push({ platform: plat, kpis });
                                    } catch (kpiErr) {
                                        console.error(`[KamAlertCron] Failed to fetch KPIs for ${plat} on ${dbName}:`, kpiErr.message);
                                    }
                                }

                                if (platformCards.length > 0) {
                                    const companyDisplayName = dbName ? (dbName.charAt(0).toUpperCase() + dbName.slice(1)) : 'Company';
                                    emailHtml = generatePerfSummaryEmailHtml({
                                        logoUrl,
                                        companyName: companyDisplayName,
                                        currentDate,
                                        previousDate,
                                        msCurrentDate,
                                        severityLevel: alert.severity_level || 'Medium',
                                        currency,
                                        platformCards,
                                    });
                                    subject = `📊 Performance Summary: ${alert.alert_name} — ${companyDisplayName}`;
                                    isTriggered = true;
                                }
                            }
                            else {
                                // Condition based alerts
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
                                }
                                else if (alertType === 'low_osa_ads' || alertType.includes('ads')) {
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
                                }
                                else if (alertType === 'promo_discount_change' || alertType.includes('promo') || alertType.includes('discount')) {
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
                                }
                                else if (alertType === 'category_health' || alertType.includes('health')) {
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
                                    const discount = parseFloat(pdpStats[0]?.avg_discount) || 0;

                                    isTriggered = osa < threshold || discount > threshold;
                                }
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
                                }

                                if (isTriggered) {
                                    const companyDisplayName = dbName ? (dbName.charAt(0).toUpperCase() + dbName.slice(1)) : 'Company';
                                    const latestDateStr = await getLatestDataDate(dbName);
                                    const dateRanges = computeDateRanges(alert.benchmark_period, latestDateStr);
                                    const alertOpSym = formatOperatorSymbol(alert.conditional_operator);

                                    let aggregateOsa = { currentOsa: 0, previousOsa: 0, delta: 0 };
                                    try {
                                        aggregateOsa = await getAggregateOsa(
                                            dbName, alertPlatforms, alert.brands,
                                            dateRanges.currentStart, dateRanges.currentEnd,
                                            dateRanges.prevStart, dateRanges.prevEnd
                                        );
                                    } catch (aggErr) {
                                        console.warn(`[KamAlertCron] Could not fetch aggregate OSA for "${alert.alert_name}":`, aggErr.message);
                                    }

                                    const platformData = [];
                                    const platformsToFetch = alertPlatforms.length > 0 ? alertPlatforms : [platformKey];
                                    for (const plat of platformsToFetch) {
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
                                            }
                                        } catch (pdErr) {
                                            console.warn(`[KamAlertCron] Could not fetch platform data for ${plat} on ${dbName}:`, pdErr.message);
                                        }
                                        platformData.push({
                                            platform: plat || 'All Platforms',
                                            brands,
                                            skus,
                                        });
                                    }

                                    const totalImpactedSkus = platformData.reduce((sum, pd) => sum + (pd.skus ? pd.skus.length : 0), 0);

                                    if (totalImpactedSkus > 0) {
                                        const finalDynamicEmailData = platformData.map(p => {
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

                                        emailHtml = generateDynamicAlertEmailHtml({
                                            logoUrl,
                                            companyName: companyDisplayName,
                                            istNow: istNowStr,
                                            alertName: alert.alert_name || 'Low OSA Alert',
                                            severityLevel: alert.severity_level || 'Warning',
                                            currentMetricValue: aggregateOsa.currentOsa ? `${aggregateOsa.currentOsa}%` : 'N/A',
                                            metricDelta: aggregateOsa.delta,
                                            operator: alertOpSym,
                                            threshold: threshold,
                                            platformData: finalDynamicEmailData,
                                        });
                                        subject = `🚨 ALERT TRIGGERED: ${alert.alert_name}`;
                                    } else {
                                        // Triggered but no impacted SKUs, only update the date
                                        isKamUpdated = true;
                                        user[sentKey] = istNowStr;
                                        isTriggered = false; // Prevent sending email
                                    }
                                }
                            }

                            if (isTriggered && emailHtml && subject) {
                                const fromEmail = process.env.Alert_email || process.env.ALERT_EMAIL || 'business@trailytics.com';
                                const mailOptions = {
                                    from: `"Trailytics KAM Alerts" <${fromEmail}>`,
                                    to: sendEmail,
                                    subject: subject,
                                    html: emailHtml,
                                };

                                try {
                                    const info = await transporter.sendMail(mailOptions);
                                    console.log(`[KamAlertCron] HTML KAM email sent successfully to ${sendEmail}. Message ID: ${info.messageId}`);

                                    // Update the sent key
                                    user[sentKey] = istNowStr;
                                    isKamUpdated = true;
                                } catch (sendErr) {
                                    console.error(`[KamAlertCron] Failed to send KAM email to ${sendEmail}:`, sendErr.message);
                                }
                            }
                        } catch (queryErr) {
                            console.error(`[KamAlertCron] Failed to run KAM alert check for "${alert.alert_name}" on ${dbName}:`, queryErr.message);
                        }
                    }
                }
            }

            if (isKamUpdated) {
                try {
                    const updatedKamStr = JSON.stringify(internalKam);
                    const updateQuery = `
                        ALTER TABLE admin_master.tb_database
                        UPDATE Internal_kam = '${updatedKamStr.replace(/'/g, "\\'")}'
                        WHERE db_id = ${dbId}
                        SETTINGS mutations_sync = 1
                    `;
                    await queryAdminDB(updateQuery);
                    console.log(`[KamAlertCron] Successfully updated Internal_kam for db_id ${dbId}`);
                } catch (updateErr) {
                    console.error(`[KamAlertCron] Failed to update Internal_kam for db_id ${dbId}:`, updateErr.message);
                }
            }
        }
    } catch (err) {
        console.error('[KamAlertCron] Error in scheduled KAM email alerts job:', err.message);
    }
};

export const initKamAlertCron = () => {
    const INTERVAL_MS = 1 * 60 * 1000;

    if (cronIntervalId) {
        clearInterval(cronIntervalId);
    }

    console.log(`[KamAlertCron] Initializing KAM alert scheduler (runs every 1 minute)`);
    
    cronIntervalId = setInterval(() => {
        runKamAlertsJob().catch(err => {
            console.error('[KamAlertCron] Interval execution failed:', err.message);
        });
    }, INTERVAL_MS);

    // DEVELOPMENT OVERRIDE: Run once immediately on start for developer verification
    runKamAlertsJob().catch(err => {
        console.error('[KamAlertCron] Immediate execution failed:', err.message);
    });
};

export const stopKamAlertCron = () => {
    if (cronIntervalId) {
        clearInterval(cronIntervalId);
        cronIntervalId = null;
        console.log('[KamAlertCron] KAM Alert scheduler stopped');
    }
};
