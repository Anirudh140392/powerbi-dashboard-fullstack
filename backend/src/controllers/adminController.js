// src/controllers/adminController.js
import * as adminService from '../services/adminService.js';

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
