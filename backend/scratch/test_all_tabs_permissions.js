import 'dotenv/config';
import { platformPermissionMiddleware } from '../src/helper/permissionMiddleware.js';
import { watchTowerOverview } from '../src/controllers/watchTowerController.js';
import { getAvailabilityOverview, getPlatformKpiMatrix } from '../src/controllers/availabilityAnalysisController.js';
import { getInsights } from '../src/controllers/insightsController.js';
import { getVisibilityOverview, getVisibilityPlatformKpiMatrix } from '../src/controllers/visibilityAnalysisController.js';
import { getEcpComparison } from '../src/controllers/pricingAnalysisController.js';
import { getOneViewPriceGrid } from '../src/controllers/oneViewPriceGridController.js';
import { getPrioritizePO, getManageSurplus, getStockTransfer } from '../src/controllers/supplyChainController.js';
import { getMapIntellectData } from '../src/controllers/mapIntellectController.js';
import { getSalesVisibilitySignals } from '../src/controllers/salesSignalLabController.js';
import { dbStorage } from '../src/config/clickhouse.js';

function createMockReqRes({ user, query = {}, body = {}, originalUrl = '' }) {
    const req = {
        user,
        query,
        body,
        originalUrl
    };

    let responseData = null;
    let statusCode = 200;
    const res = {
        json: function (data) {
            responseData = data;
            return this;
        },
        status: function (code) {
            statusCode = code;
            return this;
        }
    };

    const next = () => {};

    return { req, res, next, getResponseData: () => responseData, getStatusCode: () => statusCode };
}

async function verifyEndpoint(name, controllerFn, mockReqRes) {
    console.log(`--- Testing Endpoint: ${name} ---`);
    const { req, res, next, getResponseData } = mockReqRes;

    // Run middleware
    await platformPermissionMiddleware(req, res, next);
    console.log(`[Middleware] Platform query param:`, req.query.platform);

    try {
        await controllerFn(req, res);
        const data = getResponseData();
        const jsonStr = JSON.stringify(data);
        
        if (!data) {
            console.log(`❌ ${name} returned no data!`);
            return false;
        }

        if (jsonStr.toLowerCase().includes('zepto')) {
            console.log(`❌ ${name} response STILL contains 'zepto' references!`);
            // Print a sample of where zepto is found
            const index = jsonStr.toLowerCase().indexOf('zepto');
            console.log(`   Sample context: ...${jsonStr.substring(Math.max(0, index - 100), Math.min(jsonStr.length, index + 100))}...`);
            return false;
        } else {
            console.log(`✅ ${name} response is clean of 'zepto'!`);
            return true;
        }
    } catch (e) {
        console.error(`❌ ${name} failed during execution:`, e.message, e.stack);
        return false;
    }
}

async function runAllTests() {
    console.log("=== COMPREHENSIVE TABS & ENDPOINTS PLATFORM FILTERING TEST ===\n");

    const mockUser = {
        email: 'mamaearth_user@example.com',
        role: 'user',
        dbName: 'mamaearth',
        tabPermissions: { platform_zepto: false } // Zepto is disabled
    };

    let totalTests = 0;
    let passedTests = 0;

    await dbStorage.run({ dbName: 'mamaearth' }, async () => {
        const testCases = [
            {
                name: '1. Watchtower Overview',
                controller: watchTowerOverview,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All' },
                    originalUrl: '/api/watchtower/overview'
                })
            },
            {
                name: '2. Availability Overview',
                controller: getAvailabilityOverview,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All' },
                    originalUrl: '/api/availability-analysis/absolute-osa/availability-overview'
                })
            },
            {
                name: '3. Availability Platform KPI Matrix',
                controller: getPlatformKpiMatrix,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All', viewMode: 'Platform' },
                    originalUrl: '/api/availability-analysis/absolute-osa/platform-kpi-matrix'
                })
            },
            {
                name: '4. Insights',
                controller: getInsights,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All' },
                    originalUrl: '/api/insights'
                })
            },
            {
                name: '5. Visibility Overview',
                controller: getVisibilityOverview,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All' },
                    originalUrl: '/api/visibility-analysis/visibility-overview'
                })
            },
            {
                name: '6. Visibility Platform KPI Matrix',
                controller: getVisibilityPlatformKpiMatrix,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All' },
                    originalUrl: '/api/visibility-analysis/platform-kpi-matrix'
                })
            },
            {
                name: '7. ECP Comparison (Pricing Analysis)',
                controller: getEcpComparison,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All' },
                    originalUrl: '/api/pricing-analysis/ecp-comparison'
                })
            },
            {
                name: '8. One View Price Grid (Pricing Analysis)',
                controller: getOneViewPriceGrid,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All', startDate: '2026-05-26', endDate: '2026-06-25' },
                    originalUrl: '/api/pricing-analysis/one-view-price-grid'
                })
            },
            {
                name: '9. Prioritize PO (Supply Chain)',
                controller: getPrioritizePO,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All' },
                    originalUrl: '/api/supply-chain/prioritize-po'
                })
            },
            {
                name: '10. Manage Surplus (Supply Chain)',
                controller: getManageSurplus,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All' },
                    originalUrl: '/api/supply-chain/manage-surplus'
                })
            },
            {
                name: '11. Stock Transfer (Supply Chain)',
                controller: getStockTransfer,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All' },
                    originalUrl: '/api/supply-chain/stock-transfer'
                })
            },
            {
                name: '12. Map Intellect (India Overview)',
                controller: getMapIntellectData,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All', metric: 'osa' },
                    originalUrl: '/api/map-intellect/data'
                })
            },
            {
                name: '13. Sales Visibility Signals',
                controller: getSalesVisibilitySignals,
                reqRes: createMockReqRes({
                    user: mockUser,
                    query: { platform: 'All', level: 'keyword', signalType: 'drainer' },
                    originalUrl: '/api/visibility-analysis/visibility-signals'
                })
            }
        ];

        for (const tc of testCases) {
            totalTests++;
            const success = await verifyEndpoint(tc.name, tc.controller, tc.reqRes);
            if (success) passedTests++;
            console.log();
        }
    });

    console.log(`=== TEST SUMMARY ===`);
    console.log(`Total tests run: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);

    process.exit(totalTests === passedTests ? 0 : 1);
}

runAllTests().catch(e => {
    console.error("Test suite crashed:", e);
    process.exit(1);
});
