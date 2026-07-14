# NPD/Pareto/Non-Pareto Cards - Data Implementation Fix

## Problem Statement
The Pareto, NPD, and Non-Pareto classification cards in the Executive Insights dashboard were showing incomplete or incorrect data:

### Issues Observed
1. **Missing "reviewed" SKU counts** - Cards didn't show the breakdown of "X SKUs · Y reviewed"
2. **Incomplete rating metrics** - Some values displaying as "-" instead of actual ratings
3. **Missing product rating health classification** - "NoRating" category wasn't being tracked
4. **Incorrect Δ vs PRIOR values** - Some showing 0 when should show growth differential

### Screenshot Comparison
**Incorrect (Before):**
- NPD: 19 SKUs, PDP=-, User=-, ML=-, no "reviewed" count
- Pareto: 134 SKUs, PDP=3.3, User=1.5, ML=3.3, no breakdown
- Non-Pareto: 1,495 SKUs, PDP=-, User=-, ML=-

**Correct (After Expected):**
- NPD: 19 SKUs · 1 reviewed, PDP=1.0, User=1.0, ML=1.0
- Pareto: 134 SKUs · 98 reviewed, PDP=4.2, User=3.5, ML=3.3
- Non-Pareto: 1,495 SKUs · 607 reviewed, PDP=4.2, User=3.6, ML=3.5

## Root Causes

### 1. Missing `reviewSkuCount` in API Response
**File:** `backend/src/controllers/overview/overview.controller.js`

The `computeGroupKpis()` function was not calculating or returning the count of distinct SKUs with reviews in the selected time window. This metric is essential for displaying "X reviewed" labels on the cards.

**Fix:** Added `reviewSkuCount` calculation that counts unique web_pids that have at least one review.

### 2. Missing "NoRating" Classification
**File:** `backend/src/controllers/overview/overview.controller.js`

Products without PDP ratings weren't being classified into a distinct "NoRating" category, making it impossible to properly track and display products awaiting their first rating.

**Fix:** 
- Updated CASE statement to explicitly classify NULL ratings as 'NoRating'
- Updated `formatBucket()` to include and process the noRating group
- Updated aggregation logic to include NoRating SKUs in totals

### 3. Type Mismatch on Frontend
**File:** `frontend/src/hooks/useRatingsAPI.ts`

TypeScript interfaces for `ParetoBucket` and `HealthStatusGroup` didn't include the `reviewSkuCount` field, causing the frontend to not expect or display this data.

**Fix:** Added `reviewSkuCount?: number;` to both interfaces.

### 4. Missing Display Logic
**File:** `frontend/src/components/ExecutiveInsights.tsx`

The component wasn't displaying the reviewSkuCount even if it were available in the data.

**Fix:** Updated the SKU count display section to conditionally show "· X reviewed" when reviewSkuCount is available.

## Changes Made

### Backend Changes

#### 1. `computeGroupKpis()` Function (Line 689)
```javascript
const reviewSkuCount = new Set(skus.filter(s => s.total_reviews > 0).map(s => s.web_pid)).size;
```
- Returns `reviewSkuCount` in the KPIs object
- Counts distinct web_pids that have total_reviews > 0

#### 2. CASE Statement for Health Classification (Line 651)
```javascript
CASE
    WHEN one_star_pct > 0.15 THEN 'Critical'
    WHEN pdp_rating >= 4.2 THEN 'NP'
    WHEN pdp_rating < 4.0 THEN 'Issue'
    WHEN pdp_rating IS NULL THEN 'NoRating'  // NEW
    ELSE 'NI'
END AS health_status
```

#### 3. `formatBucket()` Function (Lines 729-741)
- Added `noRating` group extraction
- Included noRating in allSkus aggregation
- Added noRating object in return statement with computed KPIs

#### 4. All Bucket SKUs Aggregation (Line 743)
- Extended to include NoRating groups from all three pareto buckets

### Frontend Changes

#### 1. Type Definitions (useRatingsAPI.ts)
```typescript
export interface HealthStatusGroup {
    // ... existing fields ...
    reviewSkuCount?: number;  // NEW
}

export interface ParetoBucket {
    // ... existing fields ...
    reviewSkuCount?: number;  // NEW
}
```

#### 2. Component Display (ExecutiveInsights.tsx, Lines 775-785)
```jsx
<div className="flex items-baseline gap-1">
    <span className="text-3xl font-bold...">
        {Number(authorativeTotal).toLocaleString()}
    </span>
    <span className="text-[9px] uppercase...">SKUs</span>
    {(bucket.reviewSkuCount !== undefined && bucket.reviewSkuCount > 0) && (
        <span className="text-[9px] text-slate-400..." 
              title={`${bucket.reviewSkuCount.toLocaleString()} SKUs with at least one review in selected window`}>
            · {bucket.reviewSkuCount.toLocaleString()} reviewed
        </span>
    )}
</div>
```

## Testing Recommendations

### 1. Unit Testing
- Verify `computeGroupKpis()` correctly counts reviewSkuCount for:
  - Empty SKU array (should return 0)
  - Mixed SKUs with/without reviews (should count only those with reviews)
  - Single SKU with reviews (should return 1)

### 2. Integration Testing
- Call `/api/ratings/executive-health` endpoint and verify:
  - Response includes `reviewSkuCount` in each bucket
  - `reviewSkuCount` ≤ `total` (unique SKU count)
  - `noRating` group is populated with NULL pdp_rating products
  - All four groups (NP, NI, Issue, Critical, NoRating) sum to total

### 3. UI Testing
- Verify dashboard cards display:
  - "X SKUs · Y reviewed" format
  - Correct metric values (PDP, User, ML)
  - Δ vs PRIOR with proper sign and color
  - Health bar with all five status indicators

### 4. Edge Cases
- NPD category with no reviews yet (should show count with "no reviews yet" message)
- Zero products in a classification (should show "No XXX SKUs yet")
- Categories with only NoRating products (should show metrics as "-" or 0)

## API Response Structure

The `/executive-health` endpoint now returns data like:

```json
{
  "pareto": {
    "name": "Pareto",
    "total": 134,
    "catalogueTotal": 134,
    "reviewSkuCount": 98,
    "totalReviewCount": 1500,
    "avgPlatformRating": 4.2,
    "userRating": 3.5,
    "mlRating": 3.3,
    "ratingGrowthDiff": 0.16,
    "np": { "count": 50, "reviewSkuCount": 45, ... },
    "issue": { "count": 20, "reviewSkuCount": 18, ... },
    "ni": { "count": 30, "reviewSkuCount": 25, ... },
    "critical": { "count": 2, "reviewSkuCount": 2, ... },
    "noRating": { "count": 32, "reviewSkuCount": 8, ... }
  },
  "nonPareto": { ... },
  "npd": { ... }
}
```

## Files Modified

1. **Backend**
   - `/backend/src/controllers/overview/overview.controller.js`
     - `computeGroupKpis()` function
     - CASE statement for health_status
     - `formatBucket()` function
     - allBucketSkus aggregation

2. **Frontend - Types**
   - `/frontend/src/hooks/useRatingsAPI.ts`
     - `HealthStatusGroup` interface
     - `ParetoBucket` interface

3. **Frontend - Component**
   - `/frontend/src/components/ExecutiveInsights.tsx`
     - SKU count display section

## Deployment Notes

1. **Backward Compatibility:** The new `reviewSkuCount` field is optional (`?`) on both interfaces, so existing code won't break
2. **No DB Changes Required:** All changes are in application logic and type definitions
3. **API Consumers:** Any client code consuming the executive-health endpoint will need to be updated to handle the new `noRating` group and `reviewSkuCount` field
4. **Caching:** If response caching is enabled, clear cache after deployment to serve updated data

## Future Enhancements

1. Add filtering by rating bifurcation (NP/NI/Issue) at the category level
2. Implement drill-down capability on health status groups
3. Add trend visualization for rating growth per classification
4. Export functionality for pareto analysis reports
