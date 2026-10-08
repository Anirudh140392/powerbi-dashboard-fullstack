import express from 'express';
import { 
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification
} from '../../controllers/notifications/notifications.controller.js';

const router = express.Router();

router.get('/', getNotifications);
router.post('/:id/read', markNotificationRead);
router.post('/mark-all-read', markAllNotificationsRead);
router.post('/:id/dismiss', dismissNotification);

export default router;
