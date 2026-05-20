
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function checkNotifications() {
    try {
        const query = 'SELECT * FROM walkthrough_notifications';
        const results = await queryAdminDB(query);
        console.log('--- Walkthrough Notifications ---');
        console.log(JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkNotifications();
