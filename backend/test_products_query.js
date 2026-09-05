/**
 * Debug script to test why products aren't returning for retailers
 * Run with: node test_products_query.js
 * 
 * This script tests product queries for a specific retailer to verify:
 * 1. The retailer exists in the database
 * 2. Products are returned without filters
 * 3. Products are returned with typical date filters (FY, monthYear)
 * 4. What months are available for the retailer
 */

import 'dotenv/config';
import { createClient } from '@clickhouse/client';

const client = createClient({
    url: process.env.CLICKHOUSE_URL,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DB || 'drl',
});

// Change this to test different retailers
const RETAILER_SEARCH_TERM = 'counfreedise';

async function testQuery() {
    const dbName = process.env.CLICKHOUSE_DB || 'drl';
    const table = `${dbName}.rb_primary_olap`;
    
    // Test 1: Check if the retailer exists
    console.log(`\n=== Test 1: Finding retailer names matching "${RETAILER_SEARCH_TERM}" ===`);
    const retailerQuery = `
        SELECT DISTINCT toString(customer_name) as name
        FROM ${table}
        WHERE lower(toString(customer_name)) LIKE '%${RETAILER_SEARCH_TERM.toLowerCase()}%'
        LIMIT 10
    `;
    console.log('Query:', retailerQuery);
    const result = await client.query({ query: retailerQuery, format: 'JSONEachRow' });
    const retailers = await result.json();
    console.log('Found retailers:', retailers);
    
    if (retailers.length === 0) {
        console.log('\n❌ No retailers found matching "counfreedise"');
        return;
    }
    
    const exactRetailerName = retailers[0].name;
    console.log('\n✅ Using exact retailer name:', exactRetailerName);
    
    // Test 2: Check products WITHOUT date filters
    console.log('\n=== Test 2: Finding products WITHOUT date filters ===');
    const productsQuery = `
        SELECT
            toString(product_description) AS product_name,
            COALESCE(SUM(toFloat64OrZero(toString(amount_inr))), 0) AS sales_val,
            COALESCE(SUM(toInt64OrZero(toString(quantity))), 0) AS units_val,
            COUNT(*) as row_count
        FROM ${table}
        WHERE product_description IS NOT NULL
          AND toString(product_description) != ''
          AND toString(product_description) != '0'
          AND lower(toString(customer_name)) = lower('${exactRetailerName}')
        GROUP BY product_name
        ORDER BY sales_val DESC
        LIMIT 10
    `;
    console.log('Query:', productsQuery);
    const prodResult = await client.query({ query: productsQuery, format: 'JSONEachRow' });
    const products = await prodResult.json();
    console.log('Found products:', products.length, 'products');
    if (products.length > 0) {
        console.log('Sample:', products[0]);
    }
    
    // Test 3: Check products WITH typical FY filter (FY2024-25)
    console.log('\n=== Test 3: Finding products WITH FY2024-25 filter ===');
    const productsQueryFY = `
        SELECT
            toString(product_description) AS product_name,
            COALESCE(SUM(toFloat64OrZero(toString(amount_inr))), 0) AS sales_val,
            COALESCE(SUM(toInt64OrZero(toString(quantity))), 0) AS units_val,
            COUNT(*) as row_count
        FROM ${table}
        WHERE product_description IS NOT NULL
          AND toString(product_description) != ''
          AND toString(product_description) != '0'
          AND lower(toString(customer_name)) = lower('${exactRetailerName}')
          AND (toDate(billing_date) >= toDate('2024-04-01') AND toDate(billing_date) <= toDate('2025-03-31'))
        GROUP BY product_name
        ORDER BY sales_val DESC
        LIMIT 10
    `;
    console.log('Query snippet:', productsQueryFY.substring(0, 200) + '...');
    const prodResultFY = await client.query({ query: productsQueryFY, format: 'JSONEachRow' });
    const productsFY = await prodResultFY.json();
    console.log('Found products:', productsFY.length, 'products');
    if (productsFY.length > 0) {
        console.log('Sample:', productsFY[0]);
    }
    
    // Test 4: Check what happens with monthYear filter
    console.log('\n=== Test 4: Finding products WITH monthYear filter (Jun-24, Jul-24, Aug-24) ===');
    const productsQueryMY = `
        SELECT
            toString(product_description) AS product_name,
            COALESCE(SUM(toFloat64OrZero(toString(amount_inr))), 0) AS sales_val,
            COALESCE(SUM(toInt64OrZero(toString(quantity))), 0) AS units_val,
            COUNT(*) as row_count
        FROM ${table}
        WHERE product_description IS NOT NULL
          AND toString(product_description) != ''
          AND toString(product_description) != '0'
          AND lower(toString(customer_name)) = lower('${exactRetailerName}')
          AND formatDateTime(toStartOfMonth(toDate(billing_date)), '%b-%y') IN ('Jun-24', 'Jul-24', 'Aug-24')
        GROUP BY product_name
        ORDER BY sales_val DESC
        LIMIT 10
    `;
    console.log('Query snippet:', productsQueryMY.substring(0, 200) + '...');
    const prodResultMY = await client.query({ query: productsQueryMY, format: 'JSONEachRow' });
    const productsMY = await prodResultMY.json();
    console.log('Found products:', productsMY.length, 'products');
    if (productsMY.length > 0) {
        console.log('Sample:', productsMY[0]);
    } else {
        console.log('❌ No products found with Jun-24,Jul-24,Aug-24 filter');
        
        // Check what months are available
        console.log('\n=== Test 4b: What months are available for this retailer? ===');
        const monthsQuery = `
            SELECT DISTINCT formatDateTime(toStartOfMonth(toDate(billing_date)), '%b-%y') as month_year
            FROM ${table}
            WHERE lower(toString(customer_name)) = lower('${exactRetailerName}')
            ORDER BY toStartOfMonth(toDate(billing_date)) DESC
            LIMIT 20
        `;
        const monthsResult = await client.query({ query: monthsQuery, format: 'JSONEachRow' });
        const months = await monthsResult.json();
        console.log('Available months:', months.map(m => m.month_year).join(', '));
    }
    
    if (products.length === 0) {
        console.log('\n❌ No products found for this retailer');
    } else {
        console.log('\n✅ Products found successfully!');
    }
    
    await client.close();
}

testQuery().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
