
import { saveWalkthroughNotification } from './src/services/adminService.js';
import { queryAdminDB } from './src/config/adminClickhouse.js';

async function verify() {
    try {
        console.log("Testing saveWalkthroughNotification service...");
        const testData = {
            title: "Test Walkthrough " + new Date().toISOString(),
            selectedClients: ["boat", "mars"],
            steps: [
                {
                    heading: "Welcome",
                    description: "Test description",
                    image_url: "http://example.com/img.png",
                    route: "/dashboard"
                }
            ]
        };

        const result = await saveWalkthroughNotification(testData);
        console.log("Service Result:", result);

        console.log("Checking database for the new entry...");
        const dbResult = await queryAdminDB(`SELECT * FROM walkthrough_notifications WHERE update_title = '${testData.title}'`);
        console.log("Database Entry:", JSON.stringify(dbResult, null, 2));

        if (dbResult.length > 0) {
            console.log("✅ Verification successful! Data inserted correctly.");
        } else {
            console.log("❌ Verification failed! Data not found in database.");
        }
    } catch (err) {
        console.error("❌ Verification failed with error:", err.message);
    }
}

verify();
