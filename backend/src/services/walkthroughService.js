
import { queryAdminDB } from '../config/adminClickhouse.js';

/**
 * Fetches active walkthrough notifications for a specific client and route.
 * 
 * Visibility logic:
 *   1. Look up the user's last_login from tb_user.
 *   2. Return ALL walkthrough_notifications whose created_on > last_login
 *      AND whose target_clients include this user's clientDb
 *      AND whose page_route contains the requested route.
 *   3. Filter steps to only those matching the current route.
 *
 * The frontend queues them and, once ALL are dismissed, calls
 * POST /api/walkthroughs/acknowledge to bump last_login.
 */
export const getActiveWalkthroughs = async ({ clientDb, route, userName }) => {
    try {
        // Normalize the route (trim leading/trailing slashes for comparison)
        const normalizedRoute = route.replace(/^\/+|\/+$/g, '');

        // 1. Get the user's last_login and ip from tb_user
        const userRows = await queryAdminDB(
            `SELECT ip, last_login
             FROM tb_user
             WHERE user_name = {userName:String} AND status = 'active'
             ORDER BY last_login DESC LIMIT 1`,
            { userName }
        );

        let dateFilter = '';
        if (userRows.length > 0 && userRows[0].last_login) {
            // Use the raw exact string from ClickHouse to guarantee Date AND Time are perfectly matched
            // without JavaScript shifting the timezone.
            const lastLoginStr = userRows[0].last_login;
            dateFilter = `AND created_on > '${lastLoginStr}'`;
        }

        console.log(`[WalkthroughService] User=${userName}, lastLogin=${userRows.length > 0 ? userRows[0].last_login : null}, route=${route}, client=${clientDb}`);

        const query = `
            SELECT 
                id, 
                update_title, 
                notification_json, 
                page_route,
                created_on 
            FROM walkthrough_notifications 
            WHERE arrayExists(x -> lower(x) = lower('${clientDb}'), target_clients) 
            AND (
                position(lower(page_route), lower('${normalizedRoute}')) > 0
                OR position(lower(page_route), 'dashboard') > 0
            )
            ${dateFilter}
            ORDER BY created_on ASC
        `;

        console.log(`[WalkthroughService] Query for client=${clientDb}, route=${route}`);
        const results = await queryAdminDB(query);
        console.log(`[WalkthroughService] Found ${results.length} walkthroughs newer than last_login`);

        // 3. For each walkthrough, filter steps to only those matching the current route
        const walkthroughs = [];
        for (const walkthrough of results) {
            const allSteps = JSON.parse(walkthrough.notification_json);

            const matchingSteps = allSteps.filter(step => {
                const stepRoute = (step.route || '').replace(/^\/+|\/+$/g, '').toLowerCase();
                // Treat 'dashboard' (or empty) as the global default that appears anywhere
                const isGlobal = stepRoute === 'dashboard' || stepRoute === '';
                return isGlobal || stepRoute === normalizedRoute.toLowerCase();
            });

            if (matchingSteps.length > 0) {
                walkthroughs.push({
                    id: walkthrough.id,
                    title: walkthrough.update_title,
                    steps: matchingSteps,
                    createdOn: walkthrough.created_on
                });
            }
        }

        console.log(`[WalkthroughService] Returning ${walkthroughs.length} walkthroughs with matching steps`);
        return walkthroughs;
    } catch (error) {
        console.error('[WalkthroughService] getActiveWalkthroughs failed:', error.message);
        throw error;
    }
};

/**
 * Acknowledge all seen walkthroughs by updating the user's last_login to now().
 * This ensures already-seen notifications won't be shown again.
 */
export const acknowledgeWalkthroughs = async ({ userName }) => {
    try {
        const now = new Date().toISOString().replace('T', ' ').split('.')[0];

        // 1. Find the latest IP for this user
        const userRows = await queryAdminDB(
            `SELECT ip FROM tb_user 
             WHERE user_name = {userName:String} AND status = 'active' 
             ORDER BY last_login DESC LIMIT 1`,
            { userName }
        );

        if (userRows.length > 0) {
            const ip = userRows[0].ip;
            const query = `
                ALTER TABLE tb_user 
                UPDATE last_login = '${now}' 
                WHERE user_name = '${userName}' AND ip = '${ip}'
            `;

            console.log(`[WalkthroughService] Acknowledging walkthroughs for user=${userName}, ip=${ip}, setting last_login=${now}`);
            await queryAdminDB(query);
        }

        return { success: true };
    } catch (error) {
        console.error('[WalkthroughService] acknowledgeWalkthroughs failed:', error.message);
        throw error;
    }
};
