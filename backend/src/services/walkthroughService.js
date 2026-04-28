
import { queryAdminDB } from '../config/adminClickhouse.js';

/**
 * Fetches active walkthrough notifications for a specific client and route.
 * 
 * page_route stores comma-separated routes like "/scheduled-reports,/sales".
 * We check if the requested route appears anywhere in that string.
 * Then we filter the steps JSON to only return the steps that match
 * the current route, so each page shows only its own step(s).
 */
export const getActiveWalkthroughs = async ({ clientDb, route }) => {
    try {
        // Normalize the route (trim leading/trailing slashes for comparison)
        const normalizedRoute = route.replace(/^\/+|\/+$/g, '');

        const query = `
            SELECT 
                id, 
                update_title, 
                notification_json, 
                page_route,
                created_on 
            FROM walkthrough_notifications 
            WHERE arrayExists(x -> lower(x) = lower('${clientDb}'), target_clients) 
            AND position(lower(page_route), lower('${normalizedRoute}')) > 0
            ORDER BY created_on DESC
            LIMIT 1
        `;

        console.log(`[WalkthroughService] Query for client=${clientDb}, route=${route}`);
        const results = await queryAdminDB(query);
        console.log(`[WalkthroughService] Found ${results.length} walkthroughs`);
        
        if (results.length > 0) {
            const walkthrough = results[0];
            const allSteps = JSON.parse(walkthrough.notification_json);

            // Filter steps: only return those whose route matches the current page
            const matchingSteps = allSteps.filter(step => {
                const stepRoute = (step.route || '').replace(/^\/+|\/+$/g, '');
                return stepRoute.toLowerCase() === normalizedRoute.toLowerCase();
            });

            console.log(`[WalkthroughService] Total steps: ${allSteps.length}, matching this route: ${matchingSteps.length}`);

            if (matchingSteps.length > 0) {
                return {
                    id: walkthrough.id,
                    title: walkthrough.update_title,
                    steps: matchingSteps,
                    createdOn: walkthrough.created_on
                };
            }
        }

        return null;
    } catch (error) {
        console.error('[WalkthroughService] getActiveWalkthroughs failed:', error.message);
        throw error;
    }
};
