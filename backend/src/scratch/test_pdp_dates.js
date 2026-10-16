import { queryClickHouse, dbStorage } from '../config/clickhouse.js';
import { getTableColumns } from '../utils/schemaHelper.js';
import dayjs from 'dayjs';

async function testPdpFilters() {
    await dbStorage.run('emami', async () => {
        const pdpTable = 'emami.rb_pdp';
        const dateCol = 'created_on';

        const dateQuery = `SELECT DISTINCT toDate(${dateCol}) as DateStr FROM ${pdpTable} WHERE ${dateCol} IS NOT NULL ORDER BY DateStr DESC`;
        const datesRes = await queryClickHouse(dateQuery);
        console.log("datesRes count:", datesRes.length);

        const getColVal = (row) => row ? Object.values(row)[0] : null;
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            return dayjs(dateStr).format('YYYY-MM-DD');
        };

        const dates = [...new Set(datesRes.map(getColVal).filter(Boolean).map(formatDate))];
        console.log("Total dates count:", dates.length);
        console.log("dates[0] (latest):", dates[0]);
        console.log("dates[dates.length - 1] (earliest):", dates[dates.length - 1]);
        console.log("dates array slice (last 10):", dates.slice(-10));
    });
}

testPdpFilters();
