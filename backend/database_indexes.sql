-- =====================================================
-- DATABASE INDEX OPTIMIZATION FOR TRAILYTICS DASHBOARD
-- =====================================================
--
-- Purpose: Create indexes to dramatically improve query performance
-- Impact: Expected 50-100x performance improvement
-- Estimated Execution Time: 10-30 minutes depending on table sizes
--
-- IMPORTANT: Run this during off-peak hours
-- IMPORTANT: Monitor disk space - indexes require additional storage
--
-- =====================================================

-- Set optimal settings for index creation
SET SESSION sort_buffer_size = 256 * 1024 * 1024;
-- 256MB
SET SESSION read_rnd_buffer_size = 8 * 1024 * 1024;
-- 8MB

-- =====================================================
-- TABLE: rb_pdp_olap (Highest Priority - Most Queried)
-- =====================================================
-- This table is queried 50+ times per dashboard load

-- Individual column indexes for simple queries
CREATE INDEX idx_pdp_date ON rb_pdp_olap (DATE) COMMENT 'Date filter - used in 90% of queries';

CREATE INDEX idx_pdp_platform ON rb_pdp_olap (Platform) COMMENT 'Platform filter - frequently used';

CREATE INDEX idx_pdp_brand ON rb_pdp_olap (Brand) COMMENT 'Brand filter - frequently used';

CREATE INDEX idx_pdp_location ON rb_pdp_olap (Location) COMMENT 'Location filter';

CREATE INDEX idx_pdp_category ON rb_pdp_olap (Category) COMMENT 'Category filter';

CREATE INDEX idx_pdp_web_pid ON rb_pdp_olap (Web_Pid) COMMENT 'Product ID - for SKU joins';

CREATE INDEX idx_pdp_comp_flag ON rb_pdp_olap (Comp_flag) COMMENT 'Competitor flag - for promo metrics';

-- Composite indexes for common filter combinations (ORDER MATTERS!)
-- Most selective columns first for optimal performance

CREATE INDEX idx_pdp_date_platform_brand ON rb_pdp_olap (DATE, Platform, Brand) COMMENT 'Common filter combo - date + platform + brand';

CREATE INDEX idx_pdp_date_platform_location ON rb_pdp_olap (DATE, Platform, Location) COMMENT 'Platform overview by location';

CREATE INDEX idx_pdp_date_brand_category ON rb_pdp_olap (DATE, Brand, Category) COMMENT 'Brand analysis by category';

CREATE INDEX idx_pdp_date_platform_category ON rb_pdp_olap (DATE, Platform, Category) COMMENT 'Platform category analysis';

-- Covering index for common aggregations (includes all frequently selected columns)
-- This allows MySQL to satisfy queries entirely from the index
CREATE INDEX idx_pdp_covering_sales ON rb_pdp_olap (
    DATE,
    Platform,
    Brand,
    Location,
    Category,
    Sales,
    Ad_Spend,
    Ad_sales
) COMMENT 'Covering index for sales aggregations';

CREATE INDEX idx_pdp_covering_ads ON rb_pdp_olap (
    DATE,
    Platform,
    Brand,
    Ad_Orders,
    Ad_Clicks,
    Ad_Impressions,
    Ad_Spend,
    Ad_sales
) COMMENT 'Covering index for ad metrics';

CREATE INDEX idx_pdp_covering_availability ON rb_pdp_olap (
    DATE,
    Platform,
    Brand,
    Location,
    Category,
    neno_osa,
    deno_osa
) COMMENT 'Covering index for availability calculations';

CREATE INDEX idx_pdp_covering_promo ON rb_pdp_olap (
    DATE,
    Platform,
    Brand,
    Comp_flag,
    MRP,
    Selling_Price
) COMMENT 'Covering index for promo depth calculations';

-- =====================================================
-- TABLE: rb_kw (Share of Search Queries)
-- =====================================================
-- Used for SOS calculations - 20+ queries per load

CREATE INDEX idx_kw_date ON rb_kw (kw_crawl_date) COMMENT 'Date filter for keyword data';

CREATE INDEX idx_kw_platform ON rb_kw (platform_name) COMMENT 'Platform filter';

CREATE INDEX idx_kw_brand ON rb_kw (brand_name) COMMENT 'Brand filter';

CREATE INDEX idx_kw_category ON rb_kw (keyword_category) COMMENT 'Category filter';

-- Composite indexes
CREATE INDEX idx_kw_date_platform_brand ON rb_kw (
    kw_crawl_date,
    platform_name,
    brand_name
) COMMENT 'SOS calculation - date + platform + brand';

CREATE INDEX idx_kw_date_platform_category ON rb_kw (
    kw_crawl_date,
    platform_name,
    keyword_category
) COMMENT 'SOS by category';

CREATE INDEX idx_kw_date_location ON rb_kw (kw_crawl_date, location_name) COMMENT 'SOS by location';

-- Covering index for count queries
CREATE INDEX idx_kw_covering_count ON rb_kw (
    kw_crawl_date,
    platform_name,
    brand_name,
    keyword_category,
    location_name
) COMMENT 'Covering index for SOS count queries';

-- =====================================================
-- TABLE: rb_brand_ms (Market Share Queries)
-- =====================================================
-- Used for market share metrics - 15+ queries per load

CREATE INDEX idx_ms_date ON rb_brand_ms (created_on) COMMENT 'Date filter for market share';

CREATE INDEX idx_ms_platform ON rb_brand_ms (Platform) COMMENT 'Platform filter';

CREATE INDEX idx_ms_brand ON rb_brand_ms (brand) COMMENT 'Brand filter';

CREATE INDEX idx_ms_category ON rb_brand_ms (category) COMMENT 'Category filter';

-- Composite indexes
CREATE INDEX idx_ms_date_platform_brand ON rb_brand_ms (created_on, Platform, brand) COMMENT 'Market share by platform and brand';

CREATE INDEX idx_ms_date_platform_category ON rb_brand_ms (
    created_on,
    Platform,
    category
) COMMENT 'Market share by platform and category';

-- Covering index for average calculations
CREATE INDEX idx_ms_covering ON rb_brand_ms (
    created_on,
    Platform,
    brand,
    category,
    Location,
    market_share
) COMMENT 'Covering index for market share aggregations';

-- =====================================================
-- TABLE: rb_sku_platform (SKU Lookups)
-- =====================================================

CREATE INDEX idx_sku_web_pid ON rb_sku_platform (web_pid) COMMENT 'Product ID - for joins with rb_pdp_olap';

CREATE INDEX idx_sku_brand ON rb_sku_platform (brand_name) COMMENT 'Brand filter for SKU lookup';

CREATE INDEX idx_sku_name ON rb_sku_platform (sku_name) COMMENT 'SKU name for display';

CREATE INDEX idx_sku_covering ON rb_sku_platform (web_pid, sku_name, brand_name) COMMENT 'Covering index for SKU joins';

-- =====================================================
-- TABLE: rca_sku_dim (Category/Brand/Platform Lookups)
-- =====================================================
-- Used for dropdowns and filters

CREATE INDEX idx_sku_dim_category ON rca_sku_dim (category) COMMENT 'Category lookup';

CREATE INDEX idx_sku_dim_brand ON rca_sku_dim (brand) COMMENT 'Brand lookup';

CREATE INDEX idx_sku_dim_platform ON rca_sku_dim (platform) COMMENT 'Platform lookup';

CREATE INDEX idx_sku_dim_covering ON rca_sku_dim (platform, category, brand) COMMENT 'Covering index for filter dropdowns';

-- =====================================================
-- TABLE: tb_blinkit_sales_data (Blinkit-specific queries)
-- =====================================================

CREATE INDEX idx_blinkit_date ON tb_blinkit_sales_data (date) COMMENT 'Date filter';

CREATE INDEX idx_blinkit_brand ON tb_blinkit_sales_data (brand) COMMENT 'Brand filter';

CREATE INDEX idx_blinkit_category ON tb_blinkit_sales_data (category) COMMENT 'Category filter';

CREATE INDEX idx_blinkit_date_brand ON tb_blinkit_sales_data (date, brand) COMMENT 'Blinkit brand analysis';

-- =====================================================
-- TABLE: tb_zepto_brand_sales_analytics (Zepto-specific)
-- =====================================================

CREATE INDEX idx_zepto_date ON tb_zepto_brand_sales_analytics (date) COMMENT 'Date filter';

CREATE INDEX idx_zepto_brand ON tb_zepto_brand_sales_analytics (brand) COMMENT 'Brand filter';

CREATE INDEX idx_zepto_date_brand ON tb_zepto_brand_sales_analytics (date, brand) COMMENT 'Zepto brand analysis';

-- =====================================================
-- ANALYZE TABLES
-- =====================================================
-- Update table statistics for query optimizer

ANALYZE TABLE rb_pdp_olap;

ANALYZE TABLE rb_kw;

ANALYZE TABLE rb_brand_ms;

ANALYZE TABLE rb_sku_platform;

ANALYZE TABLE rca_sku_dim;

ANALYZE TABLE tb_blinkit_sales_data;

ANALYZE TABLE tb_zepto_brand_sales_analytics;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify indexes are created and being used

-- Check all indexes on rb_pdp_olap
SHOW INDEX FROM rb_pdp_olap;

-- Example query with EXPLAIN to see index usage
EXPLAIN
SELECT SUM(Sales) as total_sales, SUM(Ad_Spend) as total_spend
FROM rb_pdp_olap
WHERE
    DATE BETWEEN '2024-01-01' AND '2024-12-31'
    AND Platform = 'Blinkit'
    AND Brand LIKE '%Amul%';

-- Check index sizes
SELECT TABLE_NAME, INDEX_NAME, ROUND(
        SUM(
            stat_value * @@innodb_page_size
        ) / 1024 / 1024, 2
    ) as 'Size_MB'
FROM mysql.innodb_index_stats
WHERE
    TABLE_NAME IN (
        'rb_pdp_olap',
        'rb_kw',
        'rb_brand_ms',
        'rb_sku_platform',
        'rca_sku_dim'
    )
GROUP BY
    TABLE_NAME,
    INDEX_NAME
ORDER BY TABLE_NAME, Size_MB DESC;

-- =====================================================
-- MAINTENANCE NOTES
-- =====================================================
--
-- 1. Index Maintenance:
--    - Indexes are automatically maintained by MySQL
--    - Consider OPTIMIZE TABLE quarterly for heavily updated tables
--
-- 2. Monitoring:
--    - Use EXPLAIN to verify queries are using indexes
--    - Monitor slow query log for missed optimizations
--
-- 3. Index Removal (if needed):
--    DROP INDEX index_name ON table_name;
--
-- 4. Impact on INSERTS/UPDATES:
--    - Indexes will slightly slow write operations
--    - For read-heavy workload (dashboards), this is acceptable
--    - Monitor INSERT performance if bulk loading data
--
-- =====================================================
-- EXPECTED PERFORMANCE IMPROVEMENTS
-- =====================================================
--
-- Before Indexes:
-- - Average query: 2-5 seconds (full table scan)
-- - Dashboard load: 7-10 minutes
--
-- After Indexes:
-- - Average query: 50-200ms (index lookup)
-- - Dashboard load: <10 seconds
--
-- Improvement: 50-100x faster!
--
-- =====================================================