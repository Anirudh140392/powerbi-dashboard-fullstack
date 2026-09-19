import pool from '../../config/db.js';

export const getNotifications = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const onlyUnread = req.query.unread === 'true' || req.query.unread === '1';
        const { rows } = await pool.query(`
            SELECT id, kind, title, body, payload, link_url, read_at, dismissed_at, created_at
            FROM ratings.notifications
            WHERE user_id = $1 AND dismissed_at IS NULL
              ${onlyUnread ? 'AND read_at IS NULL' : ''}
            ORDER BY created_at DESC LIMIT $2
        `, [req.authUser.id, limit]);
        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*) AS n FROM ratings.notifications
             WHERE user_id = $1 AND read_at IS NULL AND dismissed_at IS NULL`,
            [req.authUser.id]
        );
        return res.json({
            notifications: rows,
            unreadCount: Number(countRows[0]?.n || 0),
        });
    } catch (err) {
        console.error('[notifications] list failed:', err);
        res.status(500).json({ error: err.message });
    }
};

export const markNotificationRead = async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            `UPDATE ratings.notifications SET read_at = NOW()
             WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
            [req.params.id, req.authUser.id]
        );
        return res.json({ updated: rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const markAllNotificationsRead = async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            `UPDATE ratings.notifications SET read_at = NOW()
             WHERE user_id = $1 AND read_at IS NULL`,
            [req.authUser.id]
        );
        return res.json({ updated: rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const dismissNotification = async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            `UPDATE ratings.notifications SET dismissed_at = NOW()
             WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL`,
            [req.params.id, req.authUser.id]
        );
        return res.json({ updated: rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/auth/users — super_admin only ────────────────────────────────
// Powers the Rules → Users admin panel. Returns enough state to render the
// MFA reset button per row.

