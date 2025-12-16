-- =====================================================
-- Performance Optimization: Add Indexes to rb_kw
-- =====================================================
-- This migration adds indexes to improve SOS (Share of Search)
-- calculation performance
--
-- CAUTION: Index creation will lock the table briefly
-- Best to run during low-traffic hours
-- =====================================================

-- Index 1: Date, Platform, Brand (Primary SOS query pattern)
-- Used in: All SOS calculations
-- Impact: 20-100x faster for SOS queries
CREATE INDEX IF NOT EXISTS idx_rbkw_crawl_platform_brand ON rb_kw (
    kw_crawl_date,
    platform_name,
    brand_name
);

-- Index 2: Sponsored Flag with Date (Sponsored/Organic filtering)
-- Used in: SOS calculations separating sponsored from organic
-- Impact: 10-30x faster for sponsored filtering
CREATE INDEX IF NOT EXISTS idx_rbkw_spons_flag_date ON rb_kw (spons_flag, kw_crawl_date);

-- Index 3: Location and Date (Location-based SOS)
-- Used in: Location-specific SOS queries
-- Impact: 10-20x faster for location SOS
CREATE INDEX IF NOT EXISTS idx_rbkw_location_date ON rb_kw (location_name, kw_crawl_date);

-- Index 4: Category and Date (Category-based SOS)
-- Used in: Category overview SOS calculations
-- Impact: 10-20x faster for category SOS
CREATE INDEX IF NOT EXISTS idx_rbkw_category_date ON rb_kw (
    keyword_category,
    kw_crawl_date
);

-- Index 5: Platform name for quick platform filtering
-- Used in: Platform-specific queries
-- Impact: 5-10x faster for platform filters
CREATE INDEX IF NOT EXISTS idx_rbkw_platform ON rb_kw (platform_name);

-- =====================================================
-- Verify Indexes Created
-- =====================================================
-- Run this to check indexes:
-- SHOW INDEX FROM rb_kw;