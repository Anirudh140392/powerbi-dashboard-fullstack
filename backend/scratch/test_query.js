import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryAdminDB } from '../src/config/adminClickhouse.js';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
dayjs.extend(isoWeek);

const generateTimeBuckets = (startDate, endDate, timeStep) => {
    const buckets = [];
    let current = startDate.clone().startOf('day');
    const end = endDate.clone().endOf('day');

    while (current.isBefore(end) || current.isSame(end, 'day')) {
        let label;
        let groupKey;

        if (timeStep === 'Monthly') {
            label = current.format("DD MMM'YY");
            groupKey = current.format('YYYY-MM-01');
            current = current.add(1, 'month');
        } else if (timeStep === 'Weekly') {
            label = current.format("DD MMM'YY");
            const year = current.isoWeekYear();
            const week = current.isoWeek();
            groupKey = year * 100 + week;
            current = current.add(1, 'week');
        } else { // Daily
            label = current.format("DD MMM'YY");
            groupKey = current.format('YYYY-MM-DD');
            current = current.add(1, 'day');
        }

        buckets.push({
            label,
            groupKey,
            date: current.clone().subtract(1, timeStep === 'Daily' ? 'day' : timeStep === 'Weekly' ? 'week' : 'month').toDate()
        });
    }

    if (buckets.length > 0) {
        const lastBucket = buckets[buckets.length - 1];
        let endGroupKey;
        let endLabel;

        if (timeStep === 'Monthly') {
            endGroupKey = endDate.format('YYYY-MM-01');
            endLabel = endDate.format("DD MMM'YY");
        } else if (timeStep === 'Weekly') {
            const year = endDate.isoWeekYear();
            const week = endDate.isoWeek();
            endGroupKey = year * 100 + week;
            endLabel = endDate.format("DD MMM'YY");
        } else {
            endGroupKey = endDate.format('YYYY-MM-DD');
            endLabel = endDate.format("DD MMM'YY");
        }

        if (String(lastBucket.groupKey) !== String(endGroupKey)) {
            buckets.push({
                label: endLabel,
                groupKey: endGroupKey,
                date: endDate.toDate()
            });
        }
    }

    return buckets;
};

async function run() {
    try {
        const startDate = dayjs('2026-05-18');
        const endDate = dayjs('2026-06-18');

        // WEEKLY
        console.log("=== WEEKLY TEST ===");
        const weeklyBuckets = generateTimeBuckets(startDate, endDate, 'Weekly');
        console.log("Weekly buckets:", weeklyBuckets.map(b => ({ label: b.label, groupKey: b.groupKey })));

        const weeklyQuery = `
            SELECT 
                toYearWeek(toDate(DATE), 1) as date_group,
                count() as row_count
            FROM boat.rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2026-05-18' AND '2026-06-18'
              AND Brand = 'boat'
            GROUP BY date_group
            ORDER BY date_group ASC
        `;
        const weeklyResults = await queryAdminDB(weeklyQuery);
        console.log("Weekly query results:", weeklyResults);

        // Check matching
        weeklyResults.forEach(r => {
            const bucketIndex = weeklyBuckets.findIndex(b => String(b.groupKey) === String(r.date_group));
            console.log(`date_group: ${r.date_group} | matched bucket index: ${bucketIndex} | bucket label: ${bucketIndex !== -1 ? weeklyBuckets[bucketIndex].label : 'NONE'}`);
        });

        // MONTHLY
        console.log("\n=== MONTHLY TEST ===");
        const monthlyBuckets = generateTimeBuckets(startDate, endDate, 'Monthly');
        console.log("Monthly buckets:", monthlyBuckets.map(b => ({ label: b.label, groupKey: b.groupKey })));

        const monthlyQuery = `
            SELECT 
                formatDateTime(toDate(DATE), '%Y-%m-01') as date_group,
                count() as row_count
            FROM boat.rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2026-05-18' AND '2026-06-18'
              AND Brand = 'boat'
            GROUP BY date_group
            ORDER BY date_group ASC
        `;
        const monthlyResults = await queryAdminDB(monthlyQuery);
        console.log("Monthly query results:", monthlyResults);

        // Check matching
        monthlyResults.forEach(r => {
            const bucketIndex = monthlyBuckets.findIndex(b => String(b.groupKey) === String(r.date_group));
            console.log(`date_group: ${r.date_group} | matched bucket index: ${bucketIndex} | bucket label: ${bucketIndex !== -1 ? monthlyBuckets[bucketIndex].label : 'NONE'}`);
        });

    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}
run();

