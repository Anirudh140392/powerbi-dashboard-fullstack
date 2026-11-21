import { logAdminPermissionChange, readAdminLogs } from './src/helper/adminLogger.js';

console.log("Testing target_database recording in admin_log.log...");

logAdminPermissionChange({
    adminEmail: "kenil.k@trailytics.com",
    adminName: "Kenil Kavar",
    adminRole: "admin",
    targetUser: "somya.g@trailytics.com",
    targetDatabase: "boat",
    action: "UPDATE_TAB_PERMISSIONS",
    details: {
        "Business Overview": true,
        "Insights": true,
        "platform_amazon": true
    }
});

console.log("\nReading latest log entry from admin_log.log:");
const logs = readAdminLogs(1);
console.log(JSON.stringify(logs[0], null, 2));

console.log("\n✅ Test complete!");
