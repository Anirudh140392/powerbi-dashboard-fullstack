// src/routes/admin.js
import { getUsers, deleteUser, getLiveUsers } from '../controllers/adminController.js';

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
};
