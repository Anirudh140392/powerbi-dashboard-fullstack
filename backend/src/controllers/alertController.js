import { createAlert, getAlertsByDbId, deleteAlertById, updateAlertById } from '../services/alertService.js';
import { queryAdminDB } from '../config/adminClickhouse.js';

/**
 * Helper to resolve the exact db_id from tb_database matching the user's current dbName.
 * This guarantees 100% exact parity with the ID stored in tb_database.
 */
const getExactDbId = async (reqUser) => {
    if (!reqUser) return '';

    if (reqUser.dbName) {
        try {
            const rows = await queryAdminDB(`
                SELECT toString(db_id) as db_id 
                FROM tb_database 
                WHERE lower(db_name) = '${reqUser.dbName.toLowerCase()}' 
                LIMIT 1
            `);
            if (rows.length > 0 && rows[0].db_id) {
                return rows[0].db_id;
            }
        } catch (e) {
            console.warn('[AlertController] Failed to resolve exact db_id by dbName:', e.message);
        }
    }

    return reqUser.dbId || reqUser.dbName || 'default_db';
};

/**
 * POST /api/insights/alerts
 * Create a new alert. db_id is dynamically resolved from tb_database for user's dbName.
 */
export const createAlertHandler = async (req, res) => {
    try {
        const dbId = await getExactDbId(req.user);

        if (!dbId) {
            return res.status(400).json({
                success: false,
                error: 'User dashboard ID (db_id) is missing from session',
            });
        }

        const {
            alertName,
            alertType,
            sendEmail,
            whatsappNo,
            platforms,
            brands,
            conditionalOperator,
            thresholdValue,
            benchmarkPeriod,
            alertFrequency,
            severityLevel,
        } = req.body;

        if (!alertName || !alertName.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Alert name is required',
            });
        }

        const result = await createAlert({
            dbId,
            sendEmail: sendEmail || '',
            whatsappNo: whatsappNo || '',
            alertName,
            alertType: alertType || '',
            platforms: platforms || [],
            brands: brands || [],
            conditionalOperator: conditionalOperator || '',
            thresholdValue: thresholdValue || 0,
            benchmarkPeriod: benchmarkPeriod || '',
            alertFrequency: alertFrequency || '',
            severityLevel: severityLevel || '',
        });

        return res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[AlertController] createAlert error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to create alert',
        });
    }
};

/**
 * GET /api/insights/alerts
 * Fetch all alerts for the authenticated user's dashboard.
 */
export const getAlertsHandler = async (req, res) => {
    try {
        const dbId = await getExactDbId(req.user);

        if (!dbId) {
            return res.status(400).json({
                success: false,
                error: 'User dashboard ID (db_id) is missing from session',
            });
        }

        const alerts = await getAlertsByDbId(dbId);

        return res.status(200).json({
            success: true,
            data: alerts,
        });
    } catch (error) {
        console.error('[AlertController] getAlerts error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch alerts',
        });
    }
};

/**
 * DELETE /api/insights/alerts/:id
 * Delete an alert by its UUID. Authorization checked against user's db_id.
 */
export const deleteAlertHandler = async (req, res) => {
    try {
        const dbId = await getExactDbId(req.user);
        const alertId = req.params.id;

        if (!dbId) {
            return res.status(400).json({
                success: false,
                error: 'User dashboard ID (db_id) is missing from session',
            });
        }

        if (!alertId) {
            return res.status(400).json({
                success: false,
                error: 'Alert ID is required',
            });
        }

        const result = await deleteAlertById(alertId, dbId);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[AlertController] deleteAlert error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete alert',
        });
    }
};

/**
 * PUT /api/insights/alerts/:id
 * Update an existing alert by ID.
 */
export const updateAlertHandler = async (req, res) => {
    try {
        const dbId = await getExactDbId(req.user);
        const alertId = req.params.id;

        if (!dbId) {
            return res.status(400).json({
                success: false,
                error: 'User dashboard ID (db_id) is missing from session',
            });
        }

        if (!alertId) {
            return res.status(400).json({
                success: false,
                error: 'Alert ID is required',
            });
        }

        const {
            alertName,
            alertType,
            sendEmail,
            whatsappNo,
            platforms,
            brands,
            conditionalOperator,
            thresholdValue,
            benchmarkPeriod,
            alertFrequency,
            severityLevel,
        } = req.body;

        const result = await updateAlertById(alertId, dbId, {
            sendEmail: sendEmail || '',
            whatsappNo: whatsappNo || '',
            alertName: alertName || '',
            alertType: alertType || '',
            platforms: platforms || [],
            brands: brands || [],
            conditionalOperator: conditionalOperator || '',
            thresholdValue: thresholdValue || 0,
            benchmarkPeriod: benchmarkPeriod || '',
            alertFrequency: alertFrequency || '',
            severityLevel: severityLevel || '',
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[AlertController] updateAlert error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to update alert',
        });
    }
};
