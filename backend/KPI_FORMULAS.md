# All 13 KPI Calculation Formulas - Detailed Reference

## 📊 Complete KPI List with Column-Level Details

---

## 1. Offtakes (Sales)

### Formula
```sql
Offtakes = SUM(rb_pdp_olap.Sales)
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Column** | `Sales` |
| **Aggregation** | SUM |
| **Data Type** | Numeric/Decimal |

### SQL Example
```sql
SELECT SUM(Sales) as Offtakes
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31'
  AND Platform = 'Zepto'
  AND Brand = 'Cinthol';
```

### Interpretation
Total revenue generated from all sales transactions.

---

## 2. Spend (Advertising Spend)

### Formula
```sql
Spend = SUM(rb_pdp_olap.Ad_Spend)
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Column** | `Ad_Spend` |
| **Aggregation** | SUM |
| **Data Type** | Numeric/Decimal |

### SQL Example
```sql
SELECT SUM(Ad_Spend) as Total_Spend
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31';
```

### Interpretation
Total money spent on advertising campaigns.

---

## 3. ROAS (Return on Ad Spend)

### Formula
```sql
ROAS = SUM(rb_pdp_olap.Ad_sales) / SUM(rb_pdp_olap.Ad_Spend)
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Numerator Column** | `Ad_sales` |
| **Denominator Column** | `Ad_Spend` |
| **Aggregation** | SUM for both |
| **Data Type** | Numeric/Decimal |
| **Result Format** | Ratio (e.g., 3.5x) |

### SQL Example
```sql
SELECT 
  SUM(Ad_sales) / NULLIF(SUM(Ad_Spend), 0) as ROAS
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31';
```

### Interpretation
For every ₹1 spent on ads, how many ₹ of revenue generated.  
Higher is better. ROAS of 4.0x = ₹4 revenue per ₹1 spent.

---

## 4. Inorganic Sales %

### Formula
```sql
Inorganic Sales % = (SUM(rb_pdp_olap.Ad_sales) / SUM(rb_pdp_olap.Sales)) × 100
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Numerator Column** | `Ad_sales` |
| **Denominator Column** | `Sales` |
| **Aggregation** | SUM for both |
| **Data Type** | Numeric/Decimal |
| **Result Format** | Percentage |

### SQL Example
```sql
SELECT 
  (SUM(Ad_sales) / NULLIF(SUM(Sales), 0)) * 100 as Inorganic_Sales_Pct
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31';
```

### Interpretation
What % of total sales came from advertising vs organic.  
Higher % = more dependent on paid ads.

---

## 5. Conversion % (Click-Through Rate)

### Formula
```sql
Conversion % = (SUM(rb_pdp_olap.Ad_Orders) / SUM(rb_pdp_olap.Ad_Clicks)) × 100
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Numerator Column** | `Ad_Orders` |
| **Denominator Column** | `Ad_Clicks` |
| **Aggregation** | SUM for both |
| **Data Type** | Numeric/Integer |
| **Result Format** | Percentage |

### SQL Example
```sql
SELECT 
  (SUM(Ad_Orders) / NULLIF(SUM(Ad_Clicks), 0)) * 100 as Conversion_Rate
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31';
```

### Interpretation
What % of people who clicked on ads actually made a purchase.  
Higher % = better ad targeting and product appeal.

---

## 6. Availability %

### Formula
```sql
Availability % = (SUM(rb_pdp_olap.neno_osa) / SUM(rb_pdp_olap.deno_osa)) × 100
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Numerator Column** | `neno_osa` (On-Shelf Availability Numerator) |
| **Denominator Column** | `deno_osa` (On-Shelf Availability Denominator) |
| **Aggregation** | SUM for both |
| **Data Type** | Numeric/Integer |
| **Result Format** | Percentage |

### SQL Example
```sql
SELECT 
  (SUM(neno_osa) / NULLIF(SUM(deno_osa), 0)) * 100 as Availability_Pct
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31';
```

### Interpretation
What % of time product was available on shelf.  
Higher % = better stock management.

---

## 7. Share of Search (SOS)

### Formula
```sql
SOS = (COUNT(rb_kw WHERE brand_name = 'Brand X') / COUNT(rb_kw)) × 100
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_kw` |
| **Key Columns** | `brand_name`, `kw_crawl_date` |
| **Filter Columns** | `platform_name`, `location_name`, `keyword_category`, `spons_flag` |
| **Aggregation** | COUNT (rows) |
| **Data Type** | Integer count |
| **Result Format** | Percentage |

### Important Notes
- **Includes BOTH**: `spons_flag = 0` (organic) AND `spons_flag = 1` (sponsored)
- Counts ALL keyword appearances for the brand

### SQL Example
```sql
-- Numerator: Brand keyword count
SELECT COUNT(*) as Brand_Count
FROM rb_kw
WHERE brand_name = 'Cinthol'
  AND kw_crawl_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND LOWER(platform_name) = 'zepto';

-- Denominator: All brands keyword count
SELECT COUNT(*) as Total_Count
FROM rb_kw
WHERE kw_crawl_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND LOWER(platform_name) = 'zepto';

-- Final SOS
SELECT (Brand_Count / Total_Count) * 100 as SOS;
```

### Interpretation
What % of total keyword search visibility belongs to your brand.  
Higher % = stronger search presence.

---

## 8. Market Share

### Formula
```sql
Market Share = AVG(rb_brand_ms.market_share)
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_brand_ms` |
| **Column** | `market_share` |
| **Aggregation** | AVG |
| **Filter Columns** | `brand`, `Location`, `Platform`, `category`, `created_on` |
| **Data Type** | DECIMAL |
| **Result Format** | Percentage |

### SQL Example
```sql
SELECT AVG(market_share) as Market_Share
FROM rb_brand_ms
WHERE created_on BETWEEN '2025-01-01' AND '2025-01-31'
  AND Platform = 'Zepto'
  AND brand = 'Cinthol'
  AND Location = 'Mumbai';
```

### Interpretation
Average market share percentage for the brand based on selected filters.  
Higher % = stronger market position.

### Implementation Status
✅ **IMPLEMENTED** - Used across all Watch Tower dashboards:
- Main Summary Dashboard
- Platform Overview Tab
- Month Overview Tab
- Category Overview Tab
- Brands Overview Tab

All user filters (brand, location, platform, category, date range) are properly applied.

---

## 9. Promo My Brand %

### Formula
```sql
Promo My Brand = AVG((CAST(MRP AS DECIMAL) - CAST(Selling_Price AS DECIMAL)) / CAST(MRP AS DECIMAL)) × 100
WHERE Comp_flag = 0
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Numerator Columns** | `MRP - Selling_Price` |
| **Denominator Column** | `MRP` |
| **Filter Column** | `Comp_flag = 0` (own brand) |
| **Aggregation** | AVG |
| **Data Type** | String (requires CAST to DECIMAL) |
| **Result Format** | Percentage |

### SQL Example
```sql
SELECT 
  AVG(
    CASE 
      WHEN Comp_flag = 0 AND CAST(MRP AS DECIMAL) > 0 
      THEN ((CAST(MRP AS DECIMAL) - CAST(Selling_Price AS DECIMAL)) / CAST(MRP AS DECIMAL)) * 100
      ELSE 0 
    END
  ) as Promo_My_Brand
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31';
```

### Interpretation
Average discount depth for YOUR brand's products.  
Higher % = deeper discounts offered.

---

## 10. Promo Compete %

### Formula
```sql
Promo Compete = AVG((CAST(MRP AS DECIMAL) - CAST(Selling_Price AS DECIMAL)) / CAST(MRP AS DECIMAL)) × 100
WHERE Comp_flag = 1
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Numerator Columns** | `MRP - Selling_Price` |
| **Denominator Column** | `MRP` |
| **Filter Column** | `Comp_flag = 1` (competitors) |
| **Aggregation** | AVG |
| **Data Type** | String (requires CAST to DECIMAL) |
| **Result Format** | Percentage |

### SQL Example
```sql
SELECT 
  AVG(
    CASE 
      WHEN Comp_flag = 1 AND CAST(MRP AS DECIMAL) > 0 
      THEN ((CAST(MRP AS DECIMAL) - CAST(Selling_Price AS DECIMAL)) / CAST(MRP AS DECIMAL)) * 100
      ELSE 0 
    END
  ) as Promo_Compete
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31';
```

### Interpretation
Average discount depth for COMPETITOR products.  
Compare with Promo My Brand to see competitive positioning.

---

## 11. CPM (Cost Per Mille)

### Formula
```sql
CPM = (SUM(rb_pdp_olap.Ad_Spend) / SUM(rb_pdp_olap.Ad_Impressions)) × 1000
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Numerator Column** | `Ad_Spend` |
| **Denominator Column** | `Ad_Impressions` |
| **Aggregation** | SUM for both |
| **Multiplier** | 1000 |
| **Data Type** | Numeric/Decimal |
| **Result Format** | Currency (₹) |

### SQL Example
```sql
SELECT 
  (SUM(Ad_Spend) / NULLIF(SUM(Ad_Impressions), 0)) * 1000 as CPM
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31';
```

### Interpretation
Cost to achieve 1000 ad impressions.  
Lower CPM = more cost-efficient ad delivery.

---

## 12. CPC (Cost Per Click)

### Formula
```sql
CPC = SUM(rb_pdp_olap.Ad_Spend) / SUM(rb_pdp_olap.Ad_Clicks)
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Numerator Column** | `Ad_Spend` |
| **Denominator Column** | `Ad_Clicks` |
| **Aggregation** | SUM for both |
| **Data Type** | Numeric/Decimal |
| **Result Format** | Currency (₹) |

### SQL Example
```sql
SELECT 
  SUM(Ad_Spend) / NULLIF(SUM(Ad_Clicks), 0) as CPC
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31';
```

### Interpretation
Average cost paid per click on ads.  
Lower CPC = better ad efficiency.

---

## 13. BMI/Sales Ratio

### Formula
```sql
BMI/Sales Ratio = (SUM(rb_pdp_olap.Ad_Spend) / SUM(rb_pdp_olap.Sales)) × 100
```

### Database Details
| Component | Value |
|-----------|-------|
| **Table** | `rb_pdp_olap` |
| **Numerator Column** | `Ad_Spend` |
| **Denominator Column** | `Sales` |
| **Aggregation** | SUM for both |
| **Data Type** | Numeric/Decimal |
| **Result Format** | Percentage |

### SQL Example
```sql
SELECT 
  (SUM(Ad_Spend) / NULLIF(SUM(Sales), 0)) * 100 as BMI_Sales_Ratio
FROM rb_pdp_olap
WHERE DATE BETWEEN '2025-01-01' AND '2025-01-31';
```

### Interpretation
What % of sales revenue is spent on advertising.  
Lower % = more efficient marketing spend.

---

## 📋 Quick Reference Table

| # | KPI Name | Table | Key Columns | Formula Type |
|---|----------|-------|-------------|--------------|
| 1 | Offtakes | rb_pdp_olap | Sales | SUM |
| 2 | Spend | rb_pdp_olap | Ad_Spend | SUM |
| 3 | ROAS | rb_pdp_olap | Ad_sales, Ad_Spend | Ratio |
| 4 | Inorganic Sales % | rb_pdp_olap | Ad_sales, Sales | Percentage |
| 5 | Conversion % | rb_pdp_olap | Ad_Orders, Ad_Clicks | Percentage |
| 6 | Availability % | rb_pdp_olap | neno_osa, deno_osa | Percentage |
| 7 | Share of Search | rb_kw | brand_name, kw_crawl_date | Count Ratio |
| 8 | Market Share | rb_brand_ms | market_share | AVG |
| 9 | Promo My Brand | rb_pdp_olap | MRP, Selling_Price, Comp_flag | AVG % |
| 10 | Promo Compete | rb_pdp_olap | MRP, Selling_Price, Comp_flag | AVG % |
| 11 | CPM | rb_pdp_olap | Ad_Spend, Ad_Impressions | Cost/1000 |
| 12 | CPC | rb_pdp_olap | Ad_Spend, Ad_Clicks | Average Cost |
| 13 | BMI/Sales Ratio | rb_pdp_olap | Ad_Spend, Sales | Percentage |

---

## 🗃️ Database Schema Reference

### Table: `rb_pdp_olap`
```sql
Columns Used:
- Sales              (DECIMAL)    - Total sales
- Ad_sales           (DECIMAL)    - Advertising-driven sales
- Ad_Spend           (DECIMAL)    - Ad expenditure
- Ad_Orders          (INTEGER)    - Orders from ads
- Ad_Clicks          (INTEGER)    - Ad clicks
- Ad_Impressions     (INTEGER)    - Ad impressions
- neno_osa           (INTEGER)    - Availability numerator
- deno_osa           (INTEGER)    - Availability denominator
- MRP                (STRING)     - Maximum Retail Price
- Selling_Price      (STRING)     - Actual selling price
- Comp_flag          (INTEGER)    - 0=own brand, 1=competitor
- DATE               (DATE)       - Transaction date
- Platform           (STRING)     - Platform name
- Location           (STRING)     - City/location
- Brand              (STRING)     - Brand name
- Category           (STRING)     - Product category
```

### Table: `rb_kw`
```sql
Columns Used:
- brand_name         (STRING)     - Brand name
- kw_crawl_date      (DATE)       - Date of keyword capture
- platform_name      (STRING)     - Platform name
- location_name      (STRING)     - Location
- keyword_category   (STRING)     - Keyword category
- spons_flag         (INTEGER)    - 0=organic, 1=sponsored
```

### Table: `rb_brand_ms`
```sql
Columns Used:
- market_share       (DECIMAL)    - Market share percentage
- brand              (STRING)     - Brand name
- category           (STRING)     - Product category
- Location           (STRING)     - City/location
- Platform           (STRING)     - Platform name
- created_on         (DATE)       - Data creation date
- WEEK               (BIGINT)     - Week number (alternative date filter)
- sales              (DECIMAL)    - Sales amount
- sub_category       (STRING)     - Product sub-category
```

---

**Last Updated:** 2025-12-22  
**System:** Trailytics Watch Tower  
**Version:** 1.0
