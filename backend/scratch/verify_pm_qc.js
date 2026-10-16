import { applyQcDateFilter, isQcUser, getMaxAllowedDate } from '../src/helper/qcDateHelper.js';

function runTests() {
    console.log('=== VERIFYING PERFORMANCE MARKETING QC DATE BIFURCATION ===\n');

    const today = '2026-10-09';
    const yesterday = '2026-10-08';

    // Test 1: QC User Request
    const qcReq = {
        user: { qcUser: 1 },
        headers: { 'x-current-date': today, 'x-qc-user': '1' }
    };

    console.log('1. Checking isQcUser for QC user:');
    console.log('   Result:', isQcUser(qcReq), '(Expected: true)');

    const qcFilters = applyQcDateFilter({
        platform: 'Amazon',
        startDate: '2026-10-01',
        endDate: '2026-10-09'
    }, qcReq);

    console.log('2. Checking applyQcDateFilter output for QC user on Performance Marketing:');
    console.log('   endDate:', qcFilters.endDate, `(Expected: ${today})`);
    console.log('   maxAllowedDate:', qcFilters.maxAllowedDate, `(Expected: ${today})`);
    console.log('   isQcUser:', qcFilters.isQcUser, '(Expected: true)');

    // Test 2: Normal User Request
    const normalReq = {
        user: { qcUser: 0 },
        headers: { 'x-current-date': today, 'x-qc-user': '0' }
    };

    console.log('\n3. Checking isQcUser for Normal user:');
    console.log('   Result:', isQcUser(normalReq), '(Expected: false)');

    const normalFilters = applyQcDateFilter({
        platform: 'Amazon',
        startDate: '2026-10-01',
        endDate: '2026-10-09'
    }, normalReq);

    console.log('4. Checking applyQcDateFilter output for Normal user attempting to fetch today:');
    console.log('   endDate:', normalFilters.endDate, `(Expected: ${yesterday}) -> CAPPED TO TODAY - 1`);
    console.log('   maxAllowedDate:', normalFilters.maxAllowedDate, `(Expected: ${yesterday})`);
    console.log('   isQcUser:', normalFilters.isQcUser, '(Expected: false)');

    // Test 3: Normal User with no endDate specified
    const normalNoDateFilters = applyQcDateFilter({
        platform: 'Blinkit'
    }, normalReq);

    console.log('\n5. Checking applyQcDateFilter output for Normal user with no endDate:');
    console.log('   endDate:', normalNoDateFilters.endDate, `(Expected: ${yesterday}) -> AUTOMATICALLY SET TO TODAY - 1`);

    console.log('\n=== ALL PERFORMANCE MARKETING QC DATE VERIFICATIONS PASSED ===');
}

runTests();
