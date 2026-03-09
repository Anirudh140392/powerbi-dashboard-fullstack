#!/usr/bin/env node
/**
 * Performance Test Script for Backend Query Optimization
 * 
 * This script tests various endpoints to measure query performance improvements
 * Run: node test-query-performance.js
 */

import 'dotenv/config';
import { connectDB } from './src/config/db.js';
import redisClient from './src/config/redis.js';
import watchTowerService from './src/services/watchTowerService.js';
import skuMetricsService from './src/services/skuMetricsService.js';
import availabilityService from './src/services/availabilityService.js';

// Test configuration
const TESTS = [
    {
        name: 'WatchTower - Full Dashboard Load',
        fn: () => watchTowerService.getSummaryMetrics({
            platform: 'Zepto',
            brand: 'Cinthol',
            location: 'All',
            startDate: '2024-12-01',
            endDate: '2024-12-23'
        })
    },
    {
        name: 'WatchTower - All Platforms',
        fn: () => watchTowerService.getPlatforms()
    },
    {
        name: 'WatchTower - Get Brands',
        fn: () => watchTowerService.getBrands('Zepto')
    },
    {
        name: 'SKU Metrics - Offtakes',
        fn: () => skuMetricsService.getSkuMetrics('offtakes', {
            platform: 'Zepto',
            brand: 'Cinthol',
            dateFrom: '2024-12-01',
            dateTo: '2024-12-23'
        })
    },
    {
        name: 'Availability - Assortment Count',
        fn: () => availabilityService.getAssortment({
            platform: 'Zepto',
            brand: 'Cinthol',
            location: 'All',
            endDate: '2024-12-23'
        })
    }
];

// Utility function to measure execution time
async function measureTime(name, fn) {
    const startTime = Date.now();
    try {
        await fn();
        const endTime = Date.now();
        const duration = endTime - startTime;
        return { name, duration, success: true };
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        return { name, duration, success: false, error: error.message };
    }
}

async function runTests() {
    console.log('🚀 Backend Query Performance Testing');
    console.log('='.repeat(60));

    // Connect to DB and Redis
    try {
        await connectDB();
        console.log('✅ Database connected');
        await redisClient.connect();
        console.log('✅ Redis connected\n');
    } catch (error) {
        console.error('❌ Failed to connect:', error.message);
        process.exit(1);
    }

    // Clear cache for accurate first-run testing
    console.log('🧹 Clearing cache for fresh test...\n');
    try {
        const client = redisClient.getClient();
        await client.flushDb();
    } catch (error) {
        console.warn('⚠️  Could not clear cache:', error.message);
    }

    console.log('📊 Running tests (FIRST RUN - no cache):\n');
    const firstRunResults = [];
    for (const test of TESTS) {
        const result = await measureTime(test.name, test.fn);
        firstRunResults.push(result);

        if (result.success) {
            console.log(`  ✅ ${result.name}: ${result.duration}ms`);
        } else {
            console.log(`  ❌ ${result.name}: ${result.duration}ms (ERROR: ${result.error})`);
        }
    }

    console.log('\n📊 Running tests (SECOND RUN - with cache):\n');
    const secondRunResults = [];
    for (const test of TESTS) {
        const result = await measureTime(test.name, test.fn);
        secondRunResults.push(result);

        if (result.success) {
            console.log(`  ✅ ${result.name}: ${result.duration}ms`);
        } else {
            console.log(`  ❌ ${result.name}: ${result.duration}ms (ERROR: ${result.error})`);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Performance Summary:');
    console.log('='.repeat(60));

    const table = [];
    for (let i = 0; i < TESTS.length; i++) {
        const first = firstRunResults[i];
        const second = secondRunResults[i];
        const improvement = first.duration - second.duration;
        const improvementPct = ((improvement / first.duration) * 100).toFixed(1);

        table.push({
            Test: first.name,
            'First Run': `${first.duration}ms`,
            'Cached Run': `${second.duration}ms`,
            'Improvement': `${improvement}ms (${improvementPct}%)`
        });
    }

    console.table(table);

    // Overall stats
    const totalFirstRun = firstRunResults.reduce((sum, r) => sum + r.duration, 0);
    const totalSecondRun = secondRunResults.reduce((sum, r) => sum + r.duration, 0);
    const totalImprovement = totalFirstRun - totalSecondRun;
    const totalImprovementPct = ((totalImprovement / totalFirstRun) * 100).toFixed(1);

    console.log('\n🎯 Overall Results:');
    console.log(`   Total First Run:  ${totalFirstRun}ms`);
    console.log(`   Total Cached Run: ${totalSecondRun}ms`);
    console.log(`   Total Improvement: ${totalImprovement}ms (${totalImprovementPct}%)`);

    // Expected targets
    console.log('\n🎯 Performance Targets:');
    console.log('   Target: <10 seconds for full dashboard (with indexes)');
    console.log('   Target: <2 seconds for cached responses');
    console.log('   Target: <500ms per individual query (with indexes)');

    const fullDashboardTest = firstRunResults[0];
    if (fullDashboardTest.success) {
        if (fullDashboardTest.duration < 10000) {
            console.log(`   ✅ Full dashboard: ${fullDashboardTest.duration}ms (EXCELLENT!)`);
        } else if (fullDashboardTest.duration < 60000) {
            console.log(`   ⚠️  Full dashboard: ${fullDashboardTest.duration}ms (Good, but indexes needed for <10s)`);
        } else {
            console.log(`   ❌ Full dashboard: ${fullDashboardTest.duration}ms (Indexes critically needed)`);
        }
    }

    // Close connections
    process.exit(0);
}

// Run the tests
runTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
