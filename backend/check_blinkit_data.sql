-- Direct SQL query to check Blinkit data in rb_pdp_olap table

-- 1. Check if Blinkit exists and count records
SELECT
    Platform,
    COUNT(*) as record_count,
    MIN(DATE) as min_date,
    MAX(DATE) as max_date,
    SUM(Sales) as total_sales
FROM rb_pdp_olap
WHERE
    LOWER(Platform) = 'blinkit'
GROUP BY
    Platform;

-- 2. Check for Blinkit in the specific date range
SELECT
    Platform,
    COUNT(*) as record_count,
    MIN(DATE) as min_date,
    MAX(DATE) as max_date,
    SUM(Sales) as total_sales
FROM rb_pdp_olap
WHERE
    LOWER(Platform) = 'blinkit'
    AND DATE BETWEEN '2025-10-01' AND '2025-12-10'
GROUP BY
    Platform;

-- 3. Check monthly breakdown for Blinkit
SELECT
    DATE_FORMAT(DATE, '%Y-%m') as month,
    COUNT(*) as record_count,
    SUM(Sales) as total_sales
FROM rb_pdp_olap
WHERE
    LOWER(Platform) = 'blinkit'
    AND DATE BETWEEN '2025-10-01' AND '2025-12-10'
GROUP BY
    DATE_FORMAT(DATE, '%Y-%m')
ORDER BY month;

-- 4. Check all available platforms
SELECT
    Platform,
    COUNT(*) as record_count,
    SUM(Sales) as total_sales
FROM rb_pdp_olap
GROUP BY
    Platform
ORDER BY total_sales DESC;

-- 5. Check sample Blinkit records
SELECT
    DATE,
    Brand,
    Platform,
    Location,
    Sales,
    Product
FROM rb_pdp_olap
WHERE
    LOWER(Platform) = 'blinkit'
    AND DATE BETWEEN '2025-10-01' AND '2025-12-10'
LIMIT 10;