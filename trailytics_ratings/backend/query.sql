SELECT 
    substring(product_name, 1, 80) AS product,
    count() AS total,
    countIf(review_date >= subtractMonths(today(), 6)) AS recent_total,
    countIf(review_date >= subtractMonths(today(), 12) AND review_date < subtractMonths(today(), 6)) AS older_total
FROM drl.rb_review_olap
GROUP BY product
ORDER BY total DESC
LIMIT 10;
