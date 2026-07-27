// src/controllers/adminController.js
import * as adminService from '../services/adminService.js';
import { clearPermissionsCache } from '../helper/permissionMiddleware.js';

/**
 * GET /api/admin/users
 * Returns list of all users with their DB names
 */
export const getUsers = async (req, res) => {
    try {
        // Optional: Check if requester is admin (already handled by middleware if added there)
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const users = await adminService.getAllUsers();

        return res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('[AdminController] getUsers failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * DELETE /api/admin/users/:id
 * Soft deletes a user
 */
export const deleteUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { id } = req.params;
        await adminService.softDeleteUser(id);

        return res.status(200).json({
            success: true,
            message: 'User soft deleted successfully'
        });
    } catch (error) {
        console.error('[AdminController] deleteUser failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * GET /api/admin/live-users
 * Returns list of users with their calculated live status (Active/Away)
 */
export const getLiveUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const users = await adminService.getLiveUsers();

        return res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('[AdminController] getLiveUsers failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * GET /api/admin/pending-requests
 * Returns list of pending access requests
 */
export const getPendingRequests = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const requests = await adminService.getPendingRequests();

        return res.status(200).json({
            success: true,
            data: requests
        });
    } catch (error) {
        console.error('[AdminController] getPendingRequests failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * PATCH /api/admin/users/access
 * Updates access status for a specific login row
 */
export const updateUserAccess = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { id, status, userName, _source } = req.body;
        
        if (!id || !status) {
            return res.status(400).json({
                success: false,
                error: 'ID and status are required'
            });
        }

        // Pass the source marker so the service knows which table to update
        await adminService.updateUserAccess(id, status, userName, _source || 'device');

        return res.status(200).json({
            success: true,
            message: `Access set to ${status}`
        });
    } catch (error) {
        console.error('[AdminController] updateUserAccess failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * GET /api/admin/permissions/users
 * Returns list of users with their permission data (db_status, tab_permissions)
 */
export const getPermissionsUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const users = await adminService.getPermissionsUsers();

        return res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('[AdminController] getPermissionsUsers failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * PATCH /api/admin/permissions/db-status
 * Updates db_status for a user
 */
export const updateDbStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { userId, email, dbStatus } = req.body;
        const targetIdentifier = userId || email;

        if (!targetIdentifier || typeof dbStatus !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'userId or email, and dbStatus (boolean) are required'
            });
        }

        await adminService.updateUserDbStatus(targetIdentifier, dbStatus);

        // Clear permissions and platforms cache so changes apply instantly
        clearPermissionsCache(email);
        adminService.clearDbPlatformsCache();

        return res.status(200).json({
            success: true,
            message: `DB status updated for ${targetIdentifier}`
        });
    } catch (error) {
        console.error('[AdminController] updateDbStatus failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * PATCH /api/admin/permissions/tab-permissions
 * Updates tab_permissions for a user
 */
export const updateTabPermissions = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { userId, email, tabPermissions } = req.body;
        const targetIdentifier = userId || email;

        if (!targetIdentifier || typeof tabPermissions !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'userId or email, and tabPermissions (object) are required'
            });
        }

        await adminService.updateUserTabPermissions(targetIdentifier, tabPermissions);

        // Clear permissions and platforms cache so changes apply instantly
        clearPermissionsCache(email);
        adminService.clearDbPlatformsCache();

        return res.status(200).json({
            success: true,
            message: `Tab permissions updated for ${targetIdentifier}`
        });
    } catch (error) {
        console.error('[AdminController] updateTabPermissions failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * GET /api/admin/databases
 * Returns list of available databases
 */
export const getDatabases = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const databases = await adminService.getDatabases();

        return res.status(200).json({
            success: true,
            data: databases
        });
    } catch (error) {
        console.error('[AdminController] getDatabases failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * PATCH /api/admin/databases/logo
 * Body: { db_id, logo_url }
 * Updates logo_url for a specific database/client
 */
export const updateDatabaseLogo = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { db_id, logo_url } = req.body;
        if (!db_id) {
            return res.status(400).json({
                success: false,
                error: 'db_id is required'
            });
        }

        await adminService.updateDatabaseLogo(db_id, logo_url || '');

        return res.status(200).json({
            success: true,
            message: 'Database logo updated successfully'
        });
    } catch (error) {
        console.error('[AdminController] updateDatabaseLogo failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * GET /api/admin/databases/insights
 * Returns the Insights.kpi config for a given database
 */
export const getDatabaseInsights = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { db_id } = req.query;
        if (!db_id) {
            return res.status(400).json({
                success: false,
                error: 'db_id is required'
            });
        }

        const insightsKpi = await adminService.getDatabaseInsights(db_id);

        return res.status(200).json({
            success: true,
            data: insightsKpi
        });
    } catch (error) {
        console.error('[AdminController] getDatabaseInsights failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * PATCH /api/admin/databases/insights
 * Updates the Insights.kpi config for a given database across all its users
 */
export const updateDatabaseInsights = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { db_id, insights } = req.body;
        if (!db_id || typeof insights !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'db_id and insights object are required'
            });
        }

        await adminService.updateDatabaseInsights(db_id, insights);

        // Clear permissions cache so changes take effect immediately
        clearPermissionsCache();

        return res.status(200).json({
            success: true,
            message: 'Database insights configuration updated successfully'
        });
    } catch (error) {
        console.error('[AdminController] updateDatabaseInsights failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * POST /api/admin/databases
 * Creates a new database in ClickHouse
 */
export const createDatabase = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { db_name } = req.body;
        if (!db_name || typeof db_name !== 'string' || !db_name.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Database Name is required'
            });
        }

        await adminService.createDatabase(db_name);

        return res.status(201).json({
            success: true,
            message: 'Database created successfully'
        });
    } catch (error) {
        console.error('[AdminController] createDatabase failed:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal Server Error'
        });
    }
};

/**
 * POST /api/admin/users
 * Creates a new user with hashed password
 */
export const createUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { email, password, role, status, db_id } = req.body;

        if (!email || !password || !role || !status || !db_id) {
            return res.status(400).json({
                success: false,
                error: 'email, password, role, status, and db_id are required'
            });
        }

        const result = await adminService.createUser({ email, password, role, status, db_id });

        return res.status(201).json({
            success: true,
            message: `User created successfully`,
            data: result
        });
    } catch (error) {
        console.error('[AdminController] createUser failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * POST /api/admin/walkthrough-notifications
 * Saves a new walkthrough notification
 */
export const createWalkthroughNotification = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { title, selectedClients, steps } = req.body;

        if (!title || !selectedClients || !Array.isArray(selectedClients) || !steps || !Array.isArray(steps)) {
            return res.status(400).json({
                success: false,
                error: 'title, selectedClients (Array), and steps (Array) are required'
            });
        }

        await adminService.saveWalkthroughNotification({ title, selectedClients, steps });

        return res.status(201).json({
            success: true,
            message: 'Walkthrough notification published successfully'
        });
    } catch (error) {
        console.error('[AdminController] createWalkthroughNotification failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

/**
 * GET /api/admin/platforms
 * Returns list of unique active platforms
 */
export const getAdminPlatforms = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required'
            });
        }

        const { dbName } = req.query;
        const platforms = await adminService.getAdminPlatforms(dbName);

        return res.status(200).json({
            success: true,
            data: platforms
        });
    } catch (error) {
        console.error('[AdminController] getAdminPlatforms failed:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
};

