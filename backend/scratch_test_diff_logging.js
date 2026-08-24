import { logAdminPermissionChange, readAdminLogs } from './src/helper/adminLogger.js';

console.log("Testing diff-only permission logging in admin_log.log...");

// Simulate updating ONLY one permission ("Insights": false)
const changedPermissionOnly = {
    "Insights": false
};

logAdminPermissionChange({
    adminEmail: "kenil.k@trailytics.com",
    adminName: "Kenil Kavar",
    adminRole: "admin",
    targetUser: "somya.g@trailytics.com",
    targetDatabase: "boat",
    action: "UPDATE_TAB_PERMISSIONS",
    details: changedPermissionOnly
});

console.log("\nReading latest log entry from admin_log.log:");
const logs = readAdminLogs(1);
console.log(JSON.stringify(logs[0], null, 2));

console.log("\n✅ Diff test complete!");
