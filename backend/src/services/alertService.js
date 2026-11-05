import crypto from 'crypto';
import { insertAdminDB, queryAdminDB } from '../config/adminClickhouse.js';
import { encrypt, decrypt } from '../utils/encryption.js';

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
 * Create a new alert in tb_alert
 * Email and WhatsApp are encrypted before storage.
 * @param {Object} data - Alert data from the form
 * @param {string} data.dbId - Dashboard db_id (from tb_database)
 * @param {string} data.sendEmail - Email address for notifications
 * @param {string} data.whatsappNo - WhatsApp number for notifications
 * @param {string} data.alertName - Custom alert name
 * @param {string} data.alertType - Alert type/preset identifier
 * @param {string[]} data.platforms - Selected platforms
 * @param {string[]} data.brands - Selected brands
 * @param {string} data.conditionalOperator - Condition operator (lt, gt, etc.)
 * @param {number} data.thresholdValue - Threshold value
 * @param {string} data.benchmarkPeriod - Benchmark comparison period
 * @param {string} data.alertFrequency - Alert frequency (Real-time, Daily, etc.)
 * @param {string} data.severityLevel - Severity level (Critical, High, etc.)
 * @returns {Object} The created alert row (with decrypted email/phone for client)
 */
export const createAlert = async (data) => {
    const {
        dbId,
        sendEmail = '',
        whatsappNo = '',
        alertName = '',
        alertType = '',
        platforms = [],
        brands = [],
        conditionalOperator = '',
        thresholdValue = 0,
        benchmarkPeriod = '',
        alertFrequency = '',
        severityLevel = '',
        scheduledDay = '',
    } = data;

    if (!dbId) {
        throw new Error('db_id is required to create an alert');
    }

    if (!alertName.trim()) {
        throw new Error('Alert name is required');
    }

    const rawDbId = String(dbId).trim();

    // Encrypt sensitive fields before storing
    const encryptedEmail = encrypt(sendEmail);
    const encryptedWhatsapp = encrypt(whatsappNo);
    const istNow = getISTDateTimeString();

    const alertId = crypto.randomUUID();
    const row = {
        id: alertId,
        db_id: rawDbId,
        send_email: encryptedEmail,
        whatsapp_no: encryptedWhatsapp,
        alert_name: alertName,
        alert_type: alertType,
        platforms: Array.isArray(platforms) ? platforms : [platforms].filter(Boolean),
        brands: Array.isArray(brands) ? brands : [brands].filter(Boolean),
        conditional_operator: conditionalOperator,
        threshold_value: parseFloat(thresholdValue) || 0,
        benchmark_period: benchmarkPeriod,
        alert_frequency: alertFrequency,
        severity_level: severityLevel,
        scheduled_day: scheduledDay,
        created_on: istNow,
        edited_on: istNow,
    };

    console.log('[AlertService] Creating alert:', alertName, '| db_id:', rawDbId, '| created_on (IST):', istNow);

    await insertAdminDB('tb_alert', [row]);

    // Fetch the most recently created alert for this db_id to return to the client
    const created = await queryAdminDB(
        `SELECT 
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
            scheduled_day,
            created_on,
            edited_on
        FROM tb_alert
        WHERE tb_alert.id = toUUID('${alertId}')
        LIMIT 1`
    );

    // Decrypt sensitive fields before returning to client
    if (created.length > 0) {
        return decryptAlertRow(created[0]);
    }

    // Fallback: return the data as sent
    return {
        ...row,
        send_email: sendEmail,
        whatsapp_no: whatsappNo,
    };
};

/**
 * Get all alerts for a specific dashboard db_id.
 * Decrypts email and WhatsApp fields before returning.
 * @param {string} dbId - Dashboard db_id
 * @returns {Array} List of alert rows with decrypted sensitive fields
 */
export const getAlertsByDbId = async (dbId) => {
    if (!dbId) {
        throw new Error('db_id is required to fetch alerts');
    }

    const rawDbId = String(dbId).trim();

    const alerts = await queryAdminDB(
        `SELECT 
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
            scheduled_day,
            created_on,
            edited_on
        FROM tb_alert
        WHERE db_id = {dbId:String}
        ORDER BY created_on DESC`,
        { dbId: rawDbId }
    );

    return alerts.map(decryptAlertRow);
};

/**
 * Delete an alert by its UUID
 * @param {string} alertId - Alert UUID
 * @param {string} dbId - Dashboard db_id (for authorization check)
 * @returns {Object} Success result
 */
export const deleteAlertById = async (alertId, dbId) => {
    if (!alertId || !dbId) {
        throw new Error('Both alert ID and db_id are required to delete an alert');
    }

    const rawDbId = String(dbId).trim();

    await queryAdminDB(
        `ALTER TABLE tb_alert DELETE WHERE id = toUUID({alertId:String}) AND db_id = {dbId:String}`,
        { alertId, dbId: rawDbId }
    );

    return { success: true, deletedId: alertId };
};

/**
 * Update an existing alert by ID in tb_alert
 */
export const updateAlertById = async (alertId, dbId, data) => {
    if (!alertId) {
        throw new Error('Alert ID is required for update');
    }
    if (!dbId) {
        throw new Error('db_id is required for update');
    }

    const {
        sendEmail = '',
        whatsappNo = '',
        alertName = '',
        alertType = '',
        platforms = [],
        brands = [],
        conditionalOperator = '',
        thresholdValue = 0,
        benchmarkPeriod = '',
        alertFrequency = '',
        severityLevel = '',
        scheduledDay = '',
    } = data;

    const encryptedEmail = encrypt(sendEmail);
    const encryptedWhatsapp = encrypt(whatsappNo);
    const istNow = getISTDateTimeString();

    const platList = (Array.isArray(platforms) ? platforms : [platforms].filter(Boolean));
    const brandList = (Array.isArray(brands) ? brands : [brands].filter(Boolean));

    const platArrayStr = platList.map(p => `'${String(p).replace(/'/g, "\\'")}'`).join(',');
    const brandArrayStr = brandList.map(b => `'${String(b).replace(/'/g, "\\'")}'`).join(',');

    const updateQuery = `
        ALTER TABLE admin_master.tb_alert
        UPDATE 
            send_email = '${encryptedEmail.replace(/'/g, "\\'")}',
            whatsapp_no = '${encryptedWhatsapp.replace(/'/g, "\\'")}',
            alert_name = '${alertName.replace(/'/g, "\\'")}',
            alert_type = '${alertType.replace(/'/g, "\\'")}',
            platforms = [${platArrayStr}],
            brands = [${brandArrayStr}],
            conditional_operator = '${conditionalOperator.replace(/'/g, "\\'")}',
            threshold_value = ${parseFloat(thresholdValue) || 0},
            benchmark_period = '${benchmarkPeriod.replace(/'/g, "\\'")}',
            alert_frequency = '${alertFrequency.replace(/'/g, "\\'")}',
            severity_level = '${severityLevel.replace(/'/g, "\\'")}',
            scheduled_day = '${scheduledDay.replace(/'/g, "\\'")}',
            edited_on = parseDateTimeBestEffort('${istNow}')
        WHERE id = toUUID('${alertId}')
    `;

    console.log('[AlertService] Updating alert ID:', alertId, '| alert_name:', alertName);
    await queryAdminDB(updateQuery);

    // Fetch the updated row to return
    const updated = await queryAdminDB(
        `SELECT 
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
            scheduled_day,
            created_on,
            edited_on
        FROM tb_alert
        WHERE tb_alert.id = toUUID('${alertId}')
        LIMIT 1`
    );

    if (updated.length > 0) {
        return {
            ...updated[0],
            send_email: updated[0].send_email ? decrypt(updated[0].send_email) : '',
            whatsapp_no: updated[0].whatsapp_no ? decrypt(updated[0].whatsapp_no) : '',
        };
    }

    return { id: alertId, success: true };
};

/**
 * Decrypt the sensitive fields (send_email, whatsapp_no) of an alert row.
 * @param {Object} row - Raw alert row from ClickHouse
 * @returns {Object} Alert row with decrypted sensitive fields
 */
const decryptAlertRow = (row) => {
    return {
        ...row,
        send_email: decrypt(row.send_email),
        whatsapp_no: decrypt(row.whatsapp_no),
    };
};
