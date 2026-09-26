import { queryAdminDB } from './src/config/adminClickhouse.js';
import { fetchAllPlatformCategoryKPIs, getCWDateRange } from './src/services/categoryPerfSummaryDataService.js';
import { generateCategoryPerfSummaryEmailHtml } from './src/utils/categoryPerfSummaryEmailTemplate.js';
import { sendEmailToUser } from './src/services/emailService.js';
import { decrypt } from './src/utils/cryptoUtils.js';

(async () => {
    try {
        const rows = await queryAdminDB("SELECT * FROM admin_master.tb_alert WHERE alert_type = 'category_perf_summary' ORDER BY created_on DESC LIMIT 1");
        if (rows.length === 0) return console.log("No alert found.");
        const alert = rows[0];
        console.log("Alert found:", alert.alert_name);

        const dbList = await queryAdminDB('SELECT toString(db_id) as db_id, db_name, logo_url FROM tb_database');
        const dbMap = new Map();
        dbList.forEach(db => { if (db.db_id) dbMap.set(String(db.db_id), db.db_name); });
        
        const dbName = dbMap.get(String(alert.db_id));
        console.log("DB Name:", dbName);
        
        if (!dbName) return console.log("DB not found");

        const sendEmail = alert.send_email ? decrypt(alert.send_email) : '';
        console.log("Send email:", sendEmail);

        const alertPlatforms = (Array.isArray(alert.platforms) && alert.platforms.length > 0)
            ? alert.platforms.filter(p => p && p !== 'All Platforms')
            : [];
            
        console.log("Alert platforms:", alertPlatforms);

        const companyName = dbName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const dateRange = await getCWDateRange(dbName, alertPlatforms[0]);
        console.log("Date range:", dateRange);

        const allKPIs = [];
        for (const platform of alertPlatforms) {
            console.log("Fetching for:", platform);
            const kpis = await fetchAllPlatformCategoryKPIs(dbName, platform, alert.brands || [], dateRange.cwStart, dateRange.cwEnd, dateRange.l4wStart, dateRange.l4wEnd);
            allKPIs.push({ platform, kpis });
        }
        
        console.log("All KPIs fetched.");
        const emailHtml = generateCategoryPerfSummaryEmailHtml({
            logoUrl: 'https://cdn.iconscout.com/icon/free/png-256/free-test-14-433010.png',
            companyName,
            cwStart: dateRange.cwStartDisplay,
            cwEnd: dateRange.cwEndDisplay,
            l4wStart: dateRange.l4wStartDisplay,
            l4wEnd: dateRange.l4wEndDisplay,
            platformsData: allKPIs
        });
        console.log("Email HTML generated length:", emailHtml.length);
        console.log("Simulating send...");
        await sendEmailToUser(sendEmail, "Trailytics | Weekly Snapshot", emailHtml);
        console.log("Done");
    } catch(e) {
        console.error("ERROR:", e);
    }
    process.exit(0);
})();
