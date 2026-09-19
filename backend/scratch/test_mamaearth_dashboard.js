import 'dotenv/config';
import { platformPermissionMiddleware } from '../src/helper/permissionMiddleware.js';
import { watchTowerOverview } from '../src/controllers/watchTowerController.js';
import { getAvailabilityOverview, getPlatformKpiMatrix } from '../src/controllers/availabilityAnalysisController.js';
import { dbStorage } from '../src/config/clickhouse.js';

function createMockReqRes({ user, query = {}, body = {}, originalUrl = '' }) {
    const req = {
        user,
        query,
        body,
        originalUrl
    };

    let responseData = null;
    const res = {
        json: function (data) {
            responseData = data;
            return this;
        },
        status: function (code) {
            return this;
        }
    };

    const next = () => {};

    return { req, res, next, getResponseData: () => responseData };
}

async function runTest() {
    console.log("=== DIAGNOSING MAMAERTH DASHBOARD PLATFORM FILTERING ===\n");

    const mamaearthUser = {
        email: 'mamaearth_user@example.com',
        role: 'user',
        dbName: 'mamaearth',
        tabPermissions: { platform_zepto: false } // Zepto is disabled
    };

    // We must run within dbStorage context to simulate async storage
    await dbStorage.run({ dbName: 'mamaearth' }, async () => {
        
        // 1. Test Watchtower Overview
        console.log("--- 1. Testing Watchtower Overview ---");
        const { req: req1, res: res1, next: next1, getResponseData: getData1 } = createMockReqRes({
            user: mamaearthUser,
            query: { platform: 'All' },
            originalUrl: '/api/watchtower/overview'
        });

        await platformPermissionMiddleware(req1, res1, next1);
        console.log("Request query platform after middleware:", req1.query.platform);
        
        try {
            await watchTowerOverview(req1, res1);
            const data = getData1();
            console.log("Watchtower Overview Platforms in response:", 
                data?.platformOverview ? data.platformOverview.map(p => p.platform || p.Platform || p.name || p.pf_name) : "No platformOverview"
            );
            if (JSON.stringify(data).toLowerCase().includes('zepto')) {
                console.log("⚠️ Watchtower Overview response STILL contains 'zepto' references!");
            } else {
                console.log("✅ Watchtower Overview response is clean of 'zepto'!");
            }
        } catch (e) {
            console.error("Watchtower Overview failed:", e);
        }
        console.log();

        // 2. Test Availability Overview
        console.log("--- 2. Testing Availability Overview ---");
        const { req: req2, res: res2, next: next2, getResponseData: getData2 } = createMockReqRes({
            user: mamaearthUser,
            query: { platform: 'All' },
            originalUrl: '/api/availability-analysis/absolute-osa/availability-overview'
        });

        await platformPermissionMiddleware(req2, res2, next2);
        try {
            await getAvailabilityOverview(req2, res2);
            const data = getData2();
            if (JSON.stringify(data).toLowerCase().includes('zepto')) {
                console.log("⚠️ Availability Overview response STILL contains 'zepto' references!");
            } else {
                console.log("✅ Availability Overview response is clean of 'zepto'!");
            }
        } catch (e) {
            console.error("Availability Overview failed:", e);
        }
        console.log();

        // 3. Test Platform KPI Matrix
        console.log("--- 3. Testing Platform KPI Matrix ---");
        const { req: req3, res: res3, next: next3, getResponseData: getData3 } = createMockReqRes({
            user: mamaearthUser,
            query: { platform: 'All', viewMode: 'Platform' },
            originalUrl: '/api/availability-analysis/absolute-osa/platform-kpi-matrix'
        });

        await platformPermissionMiddleware(req3, res3, next3);
        try {
            await getPlatformKpiMatrix(req3, res3);
            const data = getData3();
            if (JSON.stringify(data).toLowerCase().includes('zepto')) {
                console.log("⚠️ Platform KPI Matrix response STILL contains 'zepto' references!");
            } else {
                console.log("✅ Platform KPI Matrix response is clean of 'zepto'!");
            }
        } catch (e) {
            console.error("Platform KPI Matrix failed:", e);
        }
        console.log();
    });

    process.exit(0);
}

runTest().catch(console.error);
