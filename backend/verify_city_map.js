import mapIntellectService from './src/services/mapIntellectService.js';

async function verify() {
    process.env.CLICKHOUSE_DB = 'mars';
    console.log('--- Verifying City Mapping Fix for mars ---');

    // Test Market Share only first
    console.log('\n1. Testing Market Share (metric=marketshare)');
    const msFilters = { platform: 'All', months: 1, metric: 'marketshare' };
    const msData = await mapIntellectService.getMapIntellectData(msFilters);

    const msCities = msData.cities.map(c => c.name);
    console.log('MS Cities:', msCities);

    const hasBengaluru = msCities.includes('Bengaluru');
    const hasGurugram = msCities.includes('Gurugram');
    const hasBangalore = msCities.includes('Bangalore');
    const hasGurgaon = msCities.includes('Gurgaon');

    console.log('Contains Bengaluru:', hasBengaluru);
    console.log('Contains Gurugram:', hasGurugram);
    console.log('Contains Bangalore:', hasBangalore);
    console.log('Contains Gurgaon:', hasGurgaon);

    // Test combined data
    console.log('\n2. Testing Combined Data (metric=all)');
    const allFilters = { platform: 'All', months: 1, metric: 'all' };
    const allData = await mapIntellectService.getMapIntellectData(allFilters);

    const bengaluru = allData.cities.find(c => c.name === 'Bengaluru');
    const gurugram = allData.cities.find(c => c.name === 'Gurugram');

    if (bengaluru) {
        console.log('Bengaluru:', {
            sales: bengaluru.sales,
            marketShare: bengaluru.marketShare
        });
    }
    if (gurugram) {
        console.log('Gurugram:', {
            sales: gurugram.sales,
            marketShare: gurugram.marketShare
        });
    }
}

verify();
