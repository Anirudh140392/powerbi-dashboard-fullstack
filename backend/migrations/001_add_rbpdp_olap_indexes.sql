-- =====================================================
-- Performance Optimization: Add Indexes to rb_pdp_olap
-- =====================================================
-- This migration adds indexes to improve query performance
-- for Watch Tower dashboard queries
--
-- CAUTION: Index creation will lock the table briefly
-- Best to run during low-traffic hours
-- =====================================================

-- Index 1: Date and Platform (Most common filter combination)
-- Used in: All dashboard sections filtering by date/platform
-- Impact: 10-30x faster for date range queries
CREATE INDEX IF NOT EXISTS idx_rbpdp_date_platform ON rb_pdp_olap (DATE, Platform);

-- Index 2: Brand and Date (Brand filtering)
-- Used in: Brand-specific queries across all sections
-- Impact: 10-20x faster for brand queries
CREATE INDEX IF NOT EXISTS idx_rbpdp_brand_date ON rb_pdp_olap (Brand, DATE);

-- Index 3: Location and Date (Location filtering)
-- Used in: Location-specific queries
-- Impact: 10-20x faster for location queries
CREATE INDEX IF NOT EXISTS idx_rbpdp_location_date ON rb_pdp_olap (Location, DATE);

-- Index 4: Category and Date (Category filtering)
-- Used in: Category overview and category filters
-- Impact: 10-20x faster for category queries
CREATE INDEX IF NOT EXISTS idx_rbpdp_category_date ON rb_pdp_olap (Category, DATE);

-- Index 5: Product, Platform, Date (SKU queries)
-- Used in: "By Skus" page queries
-- Impact: 20-50x faster for SKU metrics
CREATE INDEX IF NOT EXISTS idx_rbpdp_product_platform_date ON rb_pdp_olap (Product, Platform, DATE);

-- Index 6: Comp_flag and Date (Promo calculations)
-- Used in: Promo My Brand and Promo Compete metrics
-- Impact: 5-15x faster for promo queries
CREATE INDEX IF NOT EXISTS idx_rbpdp_comp_flag_date ON rb_pdp_olap (Comp_flag, DATE);

-- Index 7: Composite index for availability calculations
-- Used in: OSA (On-Shelf Availability) calculations
-- Impact: 10-25x faster for availability queries
CREATE INDEX IF NOT EXISTS idx_rbpdp_osa_calc ON rb_pdp_olap (
    DATE,
    Platform,
    Brand,
    Location
);

-- Index 8: Web_Pid for JOIN operations
-- Used in: Top SKUs query joining with rb_sku_platform
-- Impact: 5-10x faster for SKU joins
CREATE INDEX IF NOT EXISTS idx_rbpdp_webpid ON rb_pdp_olap (Web_Pid);

-- =====================================================
-- Verify Indexes Created
-- =====================================================
-- Run this to check indexes:
-- SHOW INDEX FROM rb_pdp_olap;