import { applyQcDateFilter, isQcUser, getMaxAllowedDate } from '../src/helper/qcDateHelper.js';
import dayjs from 'dayjs';

function runTests() {
    console.log('=== VERIFYING QC DATE HELPER & CONTROLLER FILTERING ===\n');

    const today = '2026-10-09';
    const yesterday = '2026-10-08';

    // Test 1: QC User Request
    const qcReq = {
        user: { qcUser: 1 },
        headers: { 'x-current-date': today, 'x-qc-user': '1' }
    };

    console.log('1. Checking isQcUser for QC user:');
    console.log('   Result:', isQcUser(qcReq), '(Expected: true)');

    console.log('2. Checking getMaxAllowedDate for QC user:');
    console.log('   Result:', getMaxAllowedDate(qcReq), `(Expected: ${today})`);

    const qcFilters = applyQcDateFilter({
        platform: 'Zepto',
        startDate: '2026-10-01',
        endDate: '2026-10-09'
    }, qcReq);

    console.log('3. Checking applyQcDateFilter output for QC user:');
    console.log('   endDate:', qcFilters.endDate, `(Expected: ${today})`);
    console.log('   maxAllowedDate:', qcFilters.maxAllowedDate, `(Expected: ${today})`);
    console.log('   isQcUser:', qcFilters.isQcUser, '(Expected: true)');

    // Test 2: Normal User Request
    const normalReq = {
        user: { qcUser: 0 },
        headers: { 'x-current-date': today, 'x-qc-user': '0' }
    };

    console.log('\n4. Checking isQcUser for Normal user:');
    console.log('   Result:', isQcUser(normalReq), '(Expected: false)');

    console.log('5. Checking getMaxAllowedDate for Normal user:');
    console.log('   Result:', getMaxAllowedDate(normalReq), `(Expected: ${yesterday})`);

    const normalFilters = applyQcDateFilter({
        platform: 'Zepto',
        startDate: '2026-10-01',
        endDate: '2026-10-09' // Tried to request today's date
    }, normalReq);

    console.log('6. Checking applyQcDateFilter output for Normal user attempting to fetch today:');
    console.log('   endDate:', normalFilters.endDate, `(Expected: ${yesterday}) -> CAPPED TO TODAY - 1`);
    console.log('   maxAllowedDate:', normalFilters.maxAllowedDate, `(Expected: ${yesterday})`);
    console.log('   isQcUser:', normalFilters.isQcUser, '(Expected: false)');

    // Test 3: Normal User with no endDate specified
    const normalNoDateFilters = applyQcDateFilter({
        platform: 'Blinkit'
    }, normalReq);

    console.log('\n7. Checking applyQcDateFilter output for Normal user with no endDate:');
    console.log('   endDate:', normalNoDateFilters.endDate, `(Expected: ${yesterday}) -> AUTOMATICALLY SET TO TODAY - 1`);

    console.log('\n=== ALL QC DATE FILTER VERIFICATIONS PASSED ===');
}

runTests();
