-- =====================================================
-- CHECK EXISTING DATABASE INDEXES
-- =====================================================
--
-- This script will show you what indexes already exist
-- Run this to see what we can leverage
--
-- =====================================================

-- Check indexes on rb_pdp_olap (most important table)
SHOW INDEX FROM rb_pdp_olap;

-- Check indexes on rb_kw (Share of Search)
SHOW INDEX FROM rb_kw;

-- Check indexes on rb_brand_ms (Market Share)
SHOW INDEX FROM rb_brand_ms;

-- Check indexes on rb_sku_platform (SKU data)
SHOW INDEX FROM rb_sku_platform;

-- Check indexes on rca_sku_dim (Category/Brand lookups)
SHOW INDEX FROM rca_sku_dim;

-- Check indexes on tb_blinkit_sales_data
SHOW INDEX FROM tb_blinkit_sales_data;

-- Check indexes on tb_zepto_brand_sales_analytics
SHOW INDEX FROM tb_zepto_brand_sales_analytics;

-- =====================================================
-- DETAILED INDEX INFORMATION
-- =====================================================

-- Get detailed info about all indexes
SELECT
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    NON_UNIQUE,
    INDEX_TYPE,
    CARDINALITY
FROM information_schema.STATISTICS
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN (
        'rb_pdp_olap',
        'rb_kw',
        'rb_brand_ms',
        'rb_sku_platform',
        'rca_sku_dim',
        'tb_blinkit_sales_data',
        'tb_zepto_brand_sales_analytics'
    )
ORDER BY
    TABLE_NAME,
    INDEX_NAME,
    SEQ_IN_INDEX;

-- =====================================================
-- CHECK PRIMARY KEYS
-- =====================================================

SELECT
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN (
        'rb_pdp_olap',
        'rb_kw',
        'rb_brand_ms',
        'rb_sku_platform',
        'rca_sku_dim'
    )
    AND CONSTRAINT_NAME = 'PRIMARY';

-- =====================================================
-- ANALYZE TABLE STATISTICS
-- =====================================================

-- Check if tables have been analyzed (important for optimizer)
SELECT
    TABLE_NAME,
    TABLE_ROWS,
    AVG_ROW_LENGTH,
    DATA_LENGTH,
    INDEX_LENGTH,
    UPDATE_TIME
FROM information_schema.TABLES
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN (
        'rb_pdp_olap',
        'rb_kw',
        'rb_brand_ms',
        'rb_sku_platform',
        'rca_sku_dim'
    );

-- =====================================================
-- INSTRUCTIONS
-- =====================================================
--
-- HOW TO USE:
--
-- 1. Run this script on your database:
--    mysql -h 15.207.197.27 -u your_username -p your_database_name < check_existing_indexes.sql > existing_indexes.txt
--
-- 2. Send me the output (existing_indexes.txt)
--
-- 3. I'll analyze what indexes exist and optimize queries to use them
--
-- OR
--
-- Just copy-paste each query into your database client and share the results
--
-- =====================================================