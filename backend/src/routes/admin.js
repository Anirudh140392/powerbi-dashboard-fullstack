// src/routes/admin.js
import { getUsers, deleteUser, getLiveUsers, getPendingRequests, updateUserAccess, getPermissionsUsers, updateDbStatus, updateTabPermissions, getDatabases, createUser, createWalkthroughNotification } from '../controllers/adminController.js';

export default (app) => {
    // Middleware to log Admin API calls
    app.use('/api/admin', (req, res, next) => {
        console.log(`[Admin API] Called: ${req.method} ${req.originalUrl}`);
        next();
    });

    /**
     * @swagger
     * /api/admin/live-users:
     *   get:
     *     summary: Get live user statistics
     *     description: Retrieve a list of users with their calculated activity status based on last_login.
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Successful response with live user list
     */
    app.get('/api/admin/live-users', getLiveUsers);

    /**
     * @swagger
     * /api/admin/users:
     *   get:
     *     summary: Get all users with DB information
     *     description: Retrieve a list of all users from the admin_master database, joined with their assigned database names.
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Successful response with user list
     *       401:
     *         description: Unauthorized
     *       403:
     *         description: Forbidden - Admin access required
     */
    app.get('/api/admin/users', getUsers);

    /**
     * @swagger
     * /api/admin/users/{id}:
     *   delete:
     *     summary: Soft delete a user
     *     description: Updates a user's status to 'deleted'.
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: User deleted successfully
     */
    app.delete('/api/admin/users/:id', deleteUser);

    /**
     * @swagger
     * /api/admin/pending-requests:
     *   get:
     *     summary: Get all pending access requests
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: List of pending requests
     */
    app.get('/api/admin/pending-requests', getPendingRequests);

    /**
     * @swagger
     * /api/admin/users/access:
     *   patch:
     *     summary: Approve or deny a user request
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               id:
     *                 type: string
     *               status:
     *                 type: string
     *                 enum: [allow, deny]
     */
    app.patch('/api/admin/users/access', updateUserAccess);

    /**
     * @swagger
     * /api/admin/permissions/users:
     *   get:
     *     summary: Get all users with permission data
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: List of users with db_status and tab_permissions
     */
    app.get('/api/admin/permissions/users', getPermissionsUsers);

    /**
     * @swagger
     * /api/admin/permissions/db-status:
     *   patch:
     *     summary: Update a user's DB status
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               email:
     *                 type: string
     *               dbStatus:
     *                 type: boolean
     */
    app.patch('/api/admin/permissions/db-status', updateDbStatus);

    /**
     * @swagger
     * /api/admin/permissions/tab-permissions:
     *   patch:
     *     summary: Update a user's tab permissions
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               email:
     *                 type: string
     *               tabPermissions:
     *                 type: object
     */
    app.patch('/api/admin/permissions/tab-permissions', updateTabPermissions);
    /**
     * @swagger
     * /api/admin/databases:
     *   get:
     *     summary: Get all available databases
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Successful response
     */
    app.get('/api/admin/databases', getDatabases);

    /**
     * @swagger
     * /api/admin/users:
     *   post:
     *     summary: Create a new user from the admin panel
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       201:
     *         description: Successful response
     */
    app.post('/api/admin/users', createUser);

    /**
     * @swagger
     * /api/admin/walkthrough-notifications:
     *   post:
     *     summary: Create a new walkthrough notification
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       201:
     *         description: Successful response
     */
    app.post('/api/admin/walkthrough-notifications', createWalkthroughNotification);
};
