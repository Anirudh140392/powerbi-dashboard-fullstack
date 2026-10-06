# Debugging Empty Data Response

## Current Status
API returns `{success: true, data: []}` - the query is executing but returning no results.

## What I've Added

### 1. Enhanced Logging
The backend now logs:
- Full query parameters received from frontend
- Extracted filters with all values
- The complete SQL query being executed
- Filter clause and parent conditions
- Result count and sample data

### 2. Debug Endpoint
Created `/api/primary-sales/debug-products` to test with known parameters.

## Testing Steps

### Step 1: Restart Backend
```bash
cd powerbi-dashboard-fullstack/backend
npm run dev
```

### Step 2: Test Debug Endpoint
Open browser and go to:
```
http://localhost:5000/api/primary-sales/debug-products
```

Or in browser console:
```javascript
fetch('/api/primary-sales/debug-products')
  .then(r => r.json())
  .then(data => console.log('Debug test:', data));
```

**Expected Response:**
```json
{
  "success": true,
  "tests": {
    "noFilters": {
      "count": 10,
      "sample": {
        "name": "Venusia Max Lotion...",
        "val": 2334420.21,
        "unitsVal": 53577
      }
    },
    "withFY": {
      "count": 10,
      "sample": {...}
    }
  }
}
```

If this works, it means the database connection and query logic are correct.

### Step 3: Test with Specific Retailer
```
http://localhost:5000/api/primary-sales/debug-products?retailerName=nykaa e-retail limited
```

### Step 4: Check Backend Console
Look for these log entries:

```
[getPrimaryTopProducts] ========================================
[getPrimaryTopProducts] Target Column: product_description
[getPrimaryTopProducts] Filter Clause: 1=1
[getPrimaryTopProducts] Parent Conditions:  AND lower(toString(customer_name)) = lower('counfreedise retail services l')
[getPrimaryTopProducts] FULL QUERY: 
        SELECT
            toString(product_description) AS sub_name,
            COALESCE(SUM(toFloat64OrZero(toString(amount_inr))), 0) AS sales_val,
            COALESCE(SUM(toInt64OrZero(toString(quantity))), 0) AS units_val
        FROM drl.rb_primary_olap
        WHERE product_description IS NOT NULL
          AND toString(product_description) != ''
          AND toString(product_description) != '0'
          AND 1=1
          AND lower(toString(customer_name)) = lower('counfreedise retail services l')
        GROUP BY sub_name
        ORDER BY sales_val DESC
        LIMIT 10
[getPrimaryTopProducts] ========================================
[getPrimaryTopProducts] Raw rows returned: 10
```

### Step 5: Test Actual Frontend Call
Now test the actual endpoint with the parameters the frontend is sending.

In browser console (on the dashboard page):
```javascript
// Copy the actual parameters from your frontend filters
fetch('/api/primary-sales/top-products?retailerName=counfreedise retail services l&targetLevel=product&xAxis=Retailer Name&metricType=MRP&fy=FY2024-25')
  .then(r => r.json())
  .then(data => console.log('Actual API test:', data));
```

Check the backend logs to see what query is generated and what filters are applied.

## Common Issues to Check

### Issue 1: Retailer Name Mismatch
**Symptom:** Backend logs show:
```
Parent Conditions:  AND lower(toString(customer_name)) = lower('Counfreedise Retail Services L')
```

But database has:
```
counfreedise retail services l
```

**Solution:** The `lower()` function should handle this, but verify the retailer name is exact.

### Issue 2: Date Filters Too Restrictive
**Symptom:** Backend logs show:
```
Filter Clause: formatDateTime(toStartOfMonth(toDate(billing_date)), '%b-%y') = 'Aug-24' AND ...
```

But the retailer has no data for Aug-24.

**Solution:** Already applied - removed monthYear filter. Check if it's still appearing in logs.

### Issue 3: Brand Filter Applied
**Symptom:** Backend logs show:
```
Filter Clause: ... AND lower(toString(brand)) IN (lower('SomeBrand'))
```

But the retailer sells different brands.

**Solution:** Verify that brand filter is not being passed when it shouldn't be.

### Issue 4: Empty parentConditions
**Symptom:** Backend logs show:
```
Parent Conditions: 
```

(Empty string)

**Solution:** The retailerName parameter is not being passed correctly.

## What to Look For in Logs

When you click "+ Show Products", look for:

1. **Frontend Log:**
```javascript
[toggleExpand] Request params: {
  monthYear: "...",
  fy: "...",
  retailerName: "...",
  targetLevel: "product",
  xAxis: "Retailer Name"
}
```

2. **Backend Controller Log:**
```
[getPrimaryTopProductsHandler] ========== NEW REQUEST ==========
[getPrimaryTopProductsHandler] Full query params: { ... }
```

3. **Backend Service Log:**
```
[getPrimaryTopProducts] FULL QUERY: SELECT ...
[getPrimaryTopProducts] Raw rows returned: X
```

4. **If X = 0:**
```
[getPrimaryTopProducts] ⚠️  NO RESULTS RETURNED!
[getPrimaryTopProducts] Retailer/Entity: { ... }
[getPrimaryTopProducts] Filters: { ... }
```

## Next Steps

1. **Restart backend** to load new logging code
2. **Run debug endpoint test** to verify basic functionality
3. **Click "+ Show Products"** in the UI
4. **Copy and share the backend console logs** so I can see:
   - What query is being generated
   - What filters are being applied
   - Why it's returning 0 results

The logs will tell us exactly what's wrong!
