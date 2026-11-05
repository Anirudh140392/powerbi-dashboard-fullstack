import dotenv from 'dotenv';
dotenv.config();

import { queryClickHouse } from './config/clickhouse.js';

// Test function mimicking updated case-insensitive buildLocationQueryCond
function buildLocationQueryCond(locationArr, platformVal, locationCol = 'location', platformCol = 'platform') {
    const escapeStr = (str) => str ? str.replace(/'/g, "''") : '';
    if (!locationArr || locationArr.length === 0) return '1=1';

    let platforms = [];
    if (platformVal && platformVal !== 'All') {
        platforms = Array.isArray(platformVal)
            ? platformVal.map(p => p.toLowerCase())
            : (typeof platformVal === 'string' && platformVal.includes(',')
                ? platformVal.split(',').map(p => p.trim().toLowerCase())
                : [platformVal.toLowerCase()]);
    }

    const hasAmazon = platforms.includes('amazon');
    const hasFlipkart = platforms.includes('flipkart');
    const hasNational = hasAmazon || hasFlipkart;
    const isOnlyNational = platforms.length > 0 && platforms.every(p => ['amazon', 'flipkart'].includes(p));

    const nationalLocs = ["'nation'", "'national'"].join(', ');

    if (isOnlyNational) {
        return `lower(${locationCol}) IN (${nationalLocs})`;
    } else if (hasNational) {
        const localLocs = locationArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ');
        const nationalPlats = ['amazon', 'flipkart'].map(p => `'${p}'`).join(', ');
        return `((lower(${platformCol}) IN (${nationalPlats}) AND lower(${locationCol}) IN (${nationalLocs})) OR (lower(${platformCol}) NOT IN (${nationalPlats}) AND lower(${locationCol}) IN (${localLocs})))`;
    } else {
        const localLocs = locationArr.map(l => `'${escapeStr(l.toLowerCase())}'`).join(', ');
        return `lower(${locationCol}) IN (${localLocs})`;
    }
}

async function main() {
    try {
        console.log("Testing with platform = amazon, location = Ahmedabad,Agra");
        const cond1 = buildLocationQueryCond(['Ahmedabad', 'Agra'], 'amazon', 'Location', 'Platform');
        const query1 = `SELECT count() as cnt FROM rb_pdp_olap WHERE ${cond1}`;
        console.log("Query 1:", query1);
        const res1 = await queryClickHouse(query1);
        console.log("Result 1:", res1);

        console.log("\nTesting with platform = All, location = Ahmedabad,Agra");
        const cond2 = buildLocationQueryCond(['Ahmedabad', 'Agra'], 'All', 'Location', 'Platform');
        const query2 = `SELECT count() as cnt FROM rb_pdp_olap WHERE ${cond2}`;
        console.log("Query 2:", query2);
        const res2 = await queryClickHouse(query2);
        console.log("Result 2:", res2);

        console.log("\nTesting with platform = amazon,zepto, location = Ahmedabad,Agra");
        const cond3 = buildLocationQueryCond(['Ahmedabad', 'Agra'], 'amazon,zepto', 'Location', 'Platform');
        const query3 = `SELECT count() as cnt FROM rb_pdp_olap WHERE ${cond3}`;
        console.log("Query 3:", query3);
        const res3 = await queryClickHouse(query3);
        console.log("Result 3:", res3);
    } catch (err) {
        console.error("Error executing queries:", err);
    }
    process.exit(0);
}

main();
