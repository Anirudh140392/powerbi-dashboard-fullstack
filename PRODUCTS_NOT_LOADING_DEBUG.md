# Debugging: Products Not Loading in Gainers & Drainers

## Issue Description
When clicking "+ Show Products" in the Gainers & Drainers section for retailers like "Counfreedise Retail Services L", it shows "No products found" even though products should exist.

## What I've Done

### 1. Verified Database Has Products ✅
Created and ran `backend/test_products_query.js` which confirmed:
- Retailer "counfreedise retail services l" exists in the database
- It has 10+ products with sales data
- Products are returned successfully even with date filters (FY2024-25, Jun-24, etc.)

### 2. Added Comprehensive Logging 🔍

#### Backend Logging (primarySalesController.js)
Added detailed logging to track:
- Full query parameters received from frontend
- Extracted filters
- Entity name, xAxis, targetLevel, retailerName
- Result count returned

#### Backend Service Logging (primarySalesService.js)
Added logging to show:
- The actual SQL query being executed
- All parameters passed to the function
- Raw rows returned from ClickHouse
- Processed results after capitalization

#### Frontend Logging (PrimaryPlanVsAchieved.jsx)
Added logging to track:
- What entityName, rawName, and parentName are being used
- The exact request parameters being sent to the API
- The response received from the API
- Success/failure status and product count

## How to Debug

### Step 1: Open Browser Console
1. Open the Power BI Dashboard in your browser
2. Press F12 to open Developer Tools
3. Go to the "Console" tab

### Step 2: Reproduce the Issue
1. Navigate to the Primary Sales > Gainers & Drainers section
2. Click "+ Show Products" on "Counfreedise Retail Services L"
3. Watch the console for log messages

### Step 3: Check Backend Logs
If you have access to the backend server logs (running `npm run dev` in the backend directory), check for:
```
[getPrimaryTopProductsHandler] Full query params: { ... }
[getPrimaryTopProductsHandler] Extracted filters: { ... }
[getPrimaryTopProducts] Query: SELECT ...
[getPrimaryTopProducts] Raw rows returned: X
```

## Common Issues to Look For

### 1. Filter Mismatch
Check if the filters being passed are too restrictive:
- **monthYear**: Is it filtering to a specific month where this retailer has no data?
- **fy**: Is the fiscal year filter excluding this retailer's data?
- **brand**: Is a brand filter applied that doesn't match this retailer's products?

**Expected in logs:**
```javascript
[toggleExpand] Request params: {
  monthYear: "Jun-24",  // ← Check if this month has data
  fy: "FY2024-25",      // ← Check if this FY has data
  brand: "All",         // ← Should be "All" or match retailer's brands
  retailerName: "counfreedise retail services l",
  xAxis: "Retailer Name",
  metricType: "MRP",
  targetLevel: "product"
}
```

### 2. Name Casing Issue
Check if the retailer name is being passed correctly:
- Database value: `"counfreedise retail services l"` (all lowercase)
- Display value: `"Counfreedise Retail Services L"` (capitalized)
- The code should use `rawName` which preserves original casing

**Expected in logs:**
```javascript
[toggleExpand] Expanding: {
  rawName: "counfreedise retail services l",  // ← Should match DB exactly
  parentName: "counfreedise retail services l" // ← Used in query
}
```

### 3. API Response Issue
Check if the API is returning data but the frontend isn't handling it:

**Expected in logs:**
```javascript
[toggleExpand] Response: {
  success: true,
  data: [ { name: "...", val: 123, ... }, ... ]
}
[toggleExpand] Success! Products count: 10
```

**If you see:**
```javascript
[toggleExpand] Response: { success: false, ... }
```
or
```javascript
[toggleExpand] No success flag or empty response
```
Then the issue is on the backend.

### 4. Empty Result from Database
If backend logs show:
```
[getPrimaryTopProducts] Raw rows returned: 0 []
```

Then the issue is with the SQL query itself. Check:
- The full query in the logs
- Compare it with the test query that worked
- Look for differences in filters or conditions

## Quick Fixes to Try

### Fix 1: Remove Date Filters Temporarily
If the issue is date-related, you can test by temporarily commenting out date filters in the frontend request:

In `PrimaryPlanVsAchieved.jsx`, line ~286:
```javascript
const requestParams = {
  ...filters,
  // monthYear: undefined,  // Uncomment to test without date filter
  // fy: undefined,         // Uncomment to test without FY filter
  xAxis: currentXAxis,
  metricType,
  entityName: parentName,
  targetLevel: "product",
  retailerName: parentName,
};
```

### Fix 2: Use rawName Consistently
Ensure `rawName` is always used. Check the data structure:

In the browser console, when on the Gainers & Drainers section:
```javascript
// In the console, inspect the gainer/drainer objects
console.log('Check data structure:', dynamicGainers);
```

Look for whether `rawName` property exists and matches the database value.

### Fix 3: Verify API Endpoint
Test the API directly using the browser console:
```javascript
fetch('/api/primary-sales/top-products?retailerName=counfreedise retail services l&targetLevel=product&xAxis=Retailer Name&metricType=MRP')
  .then(r => r.json())
  .then(data => console.log('Direct API test:', data));
```

## Test Query Script
Location: `backend/test_products_query.js`

Run it to verify database connectivity and data:
```bash
cd powerbi-dashboard-fullstack/backend
node test_products_query.js
```

This confirms whether the issue is in:
- ✅ Database (data exists - verified)
- ❓ Backend query construction (needs checking with logs)
- ❓ Frontend API call (needs checking with logs)
- ❓ Frontend response handling (needs checking with logs)

## Next Steps

1. **Check the console logs** when clicking "+ Show Products"
2. **Share the log output** with details of what parameters are being sent and received
3. **Compare with the working test query** to identify the difference
4. **Check if other retailers have the same issue** (like "Nykaa E-retail Limited")

Once you provide the log output, I can pinpoint the exact issue and provide a targeted fix.
