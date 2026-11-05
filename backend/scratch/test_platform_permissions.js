import 'dotenv/config';
import { filterPlatformsResponse, platformPermissionMiddleware } from '../src/helper/permissionMiddleware.js';
import { getAdminPlatforms } from '../src/services/adminService.js';

function createMockReqRes({ user, query = {}, body = {} }) {
    const req = {
        user,
        query,
        body
    };

    let responseData = null;
    const res = {
        json: function (data) {
            responseData = data;
            return this;
        }
    };

    const next = () => {};

    return { req, res, next, getResponseData: () => responseData };
}

async function runTests() {
    console.log("=== RUNNING DATABASE-SPECIFIC PLATFORM ACCESS TESTS ===\n");

    // Test 1: getAdminPlatforms for Mars database
    console.log("Test 1: Fetch platforms for 'mars' database");
    const marsPlats = await getAdminPlatforms('mars');
    console.log("Mars Platforms:", marsPlats);
    if (marsPlats.includes('amazon') && marsPlats.includes('blinkit') && marsPlats.length === 7) {
        console.log("✅ Test 1 Passed");
    } else {
        console.error("❌ Test 1 Failed");
    }
    console.log();

    // Test 2: getAdminPlatforms for Mamaearth database
    console.log("Test 2: Fetch platforms for 'mamaearth' database");
    const mamaPlats = await getAdminPlatforms('mamaearth');
    console.log("Mamaearth Platforms:", mamaPlats);
    if (mamaPlats.includes('blinkit') && mamaPlats.includes('flipkart') && mamaPlats.includes('zepto') && mamaPlats.length === 3) {
        console.log("✅ Test 2 Passed");
    } else {
        console.error("❌ Test 2 Failed");
    }
    console.log();

    // Test 3: Middleware request query filtering on "All" for mamaearth user with "blinkit" disabled
    console.log("Test 3: Middleware filters 'All' query to 'flipkart,zepto' for mamaearth user with disabled 'blinkit'");
    const mamaearthUser = {
        email: 'mamaearth_user@example.com',
        role: 'user',
        dbName: 'mamaearth',
        tabPermissions: { platform_blinkit: false }
    };
    const { req: req3, res: res3, next: next3 } = createMockReqRes({
        user: mamaearthUser,
        query: { platform: 'All' }
    });

    await platformPermissionMiddleware(req3, res3, next3);
    console.log("Filtered Query platform:", req3.query.platform);
    if (req3.query.platform === 'flipkart,zepto') {
        console.log("✅ Test 3 Passed");
    } else {
        console.error("❌ Test 3 Failed");
    }
    console.log();

    // Test 5: Middleware request query filtering on "All" for mamaearth admin user with "blinkit" disabled
    console.log("Test 5: Middleware filters 'All' query to 'flipkart,zepto' for mamaearth admin with disabled 'blinkit'");
    const mamaearthAdmin = {
        email: 'mamaearth_admin@example.com',
        role: 'admin',
        dbName: 'mamaearth',
        tabPermissions: { platform_blinkit: false }
    };
    const { req: req5, res: res5, next: next5 } = createMockReqRes({
        user: mamaearthAdmin,
        query: { platform: 'All' }
    });

    await platformPermissionMiddleware(req5, res5, next5);
    console.log("Filtered Query platform (Admin):", req5.query.platform);
    if (req5.query.platform === 'flipkart,zepto') {
        console.log("✅ Test 5 Passed");
    } else {
        console.error("❌ Test 5 Failed");
    }
    console.log();

    // Test 4: Middleware response body filtering for custom object keys
    console.log("Test 4: Response JSON object keys matching disabled platforms are filtered out");
    const { req: req4, res: res4, next: next4, getResponseData: getResponseData4 } = createMockReqRes({
        user: mamaearthUser,
        query: {}
    });

    await platformPermissionMiddleware(req4, res4, next4);
    res4.json({
        success: true,
        blinkit: { sales: 500, orders: 10 },
        zepto: { sales: 200, orders: 5 }
    });

    const responseData = getResponseData4();
    console.log("Response Data keys:", Object.keys(responseData));
    if (responseData.zepto && !responseData.blinkit) {
        console.log("✅ Test 4 Passed");
    } else {
        console.error("❌ Test 4 Failed");
    }
    console.log();

    // Test 6: Middleware response body filtering for custom object keys for admin user
    console.log("Test 6: Response JSON object keys matching disabled platforms are filtered out for admin users");
    const { req: req6, res: res6, next: next6, getResponseData: getResponseData6 } = createMockReqRes({
        user: mamaearthAdmin,
        query: {}
    });

    await platformPermissionMiddleware(req6, res6, next6);
    res6.json({
        success: true,
        blinkit: { sales: 500, orders: 10 },
        zepto: { sales: 200, orders: 5 }
    });

    const responseDataAdmin = getResponseData6();
    console.log("Response Data keys (Admin):", Object.keys(responseDataAdmin));
    if (responseDataAdmin.zepto && !responseDataAdmin.blinkit) {
        console.log("✅ Test 6 Passed");
    } else {
        console.error("❌ Test 6 Failed");
    }
    console.log();

    // Test 7: Admin endpoint bypass
    console.log("Test 7: Admin endpoint bypasses query filtering");
    const { req: req7, res: res7, next: next7 } = createMockReqRes({
        user: mamaearthAdmin,
        query: { platform: 'All' }
    });
    req7.originalUrl = '/api/admin/platforms';

    await platformPermissionMiddleware(req7, res7, next7);
    console.log("Query platform for admin URL (should remain 'All'):", req7.query.platform);
    if (req7.query.platform === 'All') {
        console.log("✅ Test 7 Passed");
    } else {
        console.error("❌ Test 7 Failed");
    }
    console.log();

    // Test 8: Force-injection when platform parameter is completely missing
    console.log("Test 8: Middleware injects platform query when completely omitted");
    const { req: req8, res: res8, next: next8 } = createMockReqRes({
        user: mamaearthUser,
        query: {} // no platform parameter passed at all
    });

    await platformPermissionMiddleware(req8, res8, next8);
    console.log("Query platform (should be injected with 'flipkart,zepto'):", req8.query.platform);
    if (req8.query.platform === 'flipkart,zepto') {
        console.log("✅ Test 8 Passed");
    } else {
        console.error("❌ Test 8 Failed");
    }
    console.log();

    console.log("=== TESTS COMPLETED ===");
}

runTests().catch(err => console.error("Test execution failed:", err));
