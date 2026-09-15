import { logAdminPermissionChange, readAdminLogs } from './src/helper/adminLogger.js';

console.log("Testing logAdminPermissionChange...");

logAdminPermissionChange({
    adminEmail: "admin@trailytics.com",
    adminName: "Test Admin",
    adminRole: "admin",
    targetUser: "kenil.k@trailytics.com",
    action: "UPDATE_TAB_PERMISSIONS",
    details: {
        "Business Overview": true,
        "Insights": false,
        "platform_amazon": true
    }
});

console.log("\nReading log entries from admin_log.log:");
const logs = readAdminLogs(10);
console.log(JSON.stringify(logs, null, 2));

console.log("\n✅ Scratch test complete!");
