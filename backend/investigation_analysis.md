# Analysis: Metrics Dropdown Investigation

## User's Screenshot Shows:
- OFFTAKE
- CATEGORY SHARE  
- CATEGORY SIZE
- WT OSA
- WT DISC
- OVERALL SOV
- IMPRESSIONS
- CLICKS
- CTR
- CVR
- ORDERS
- AD SPENDS
- ROAS

## Current System Shows (from `/api/watchtower/metrics` endpoint):
- Availability
- Conversion
- CPC
- CPM
- Inorganic Sales
- Market Share
- Offtakes
- Promo Compete
- Promo My Brand
- ROAS
- SOS
- Spend

## Investigation Results:

1. **Backend**: The `/api/watchtower/metrics` endpoint correctly returns all metric keys from the `key_metrics` table
   
2. **Frontend (SKUTable.jsx)**: Lines 34-54 correctly fetch from `/watchtower/metrics` API

3. **Frontend (PlatformOverview.jsx)**: Lines 568-594 correctly fetch from `/watchtower/metrics` API

4. **Browser Test**: Confirmed the dropdown shows database values (Availability, Conversion, CPC, etc.)

5. **Search Results**: Found references to `category_share`, `OVERALL SOV`, etc., but these are:
   - Used as DATA keys in `DataCenter.jsx` (mock data)
   - Used in other components (`CategoryTrendsDrawer.jsx`, `CategoryMetricsSection.jsx`)
   - **NOT** found as dropdown OPTIONS in the "By Skus" section

## Possible Explanations:

1. **User is seeing an old/cached version**: The browser may have cached old JavaScript bundles
2. **User is looking at a different dropdown**: Could be from "Analytics" section or "Category" section instead of "Watch Tower > By Skus"
3. **Screenshot from an old build**: Taken before recent changes

## Action Required:

Ask the user to:
1. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Confirm they're looking at "Watch Tower > By Skus > Metrics dropdown"
3. Or clarify which page/section they're actually referring to
