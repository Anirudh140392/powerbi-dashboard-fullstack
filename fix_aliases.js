import { readFileSync, writeFileSync } from 'fs';

const file = '/Users/2004yashgautamgmail.com/Documents/trailytics/trailytics_ds/powerbi-dashboard-fullstack/trailytics_ratings/backend/src/controllers/reviews/reviews.controller.js';
let content = readFileSync(file, 'utf8');

// The SQL to replace:
const oldSql = `            SELECT
                toString(r.id) as id, r.platform, r.web_pid, r.product_name, r.brand,
                r.rating, r.ml_inferred_rating, r.review_title, r.review_text, r.review_date,
                r.is_verified_purchase, coalesce(ps.rating, r.pdp_rating) as pdp_rating, coalesce(ps.rating_count, r.pdp_rating_count) as pdp_rating_count,
                r.sentiment, r.sentiment_category, r.sentiment_subcategory,
                r.sentiment_score, r.quality_score, r.specific_issue,`;

const newSql = `            SELECT
                toString(r.id) as id, r.platform AS platform, r.web_pid AS web_pid, r.product_name AS product_name, r.brand AS brand,
                r.rating AS rating, r.ml_inferred_rating AS ml_inferred_rating, r.review_title AS review_title, r.review_text AS review_text, r.review_date AS review_date,
                r.is_verified_purchase AS is_verified_purchase, coalesce(ps.rating, r.pdp_rating) as pdp_rating, coalesce(ps.rating_count, r.pdp_rating_count) as pdp_rating_count,
                r.sentiment AS sentiment, r.sentiment_category AS sentiment_category, r.sentiment_subcategory AS sentiment_subcategory,
                r.sentiment_score AS sentiment_score, r.quality_score AS quality_score, r.specific_issue AS specific_issue,`;

content = content.replace(oldSql, newSql);

const oldSql2 = `coalesce(nullIf(mp.wattage, ''), nullIf(r.wattage, '')) as wattage,
                r.is_competitor, coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) as pareto_status,`;

const newSql2 = `coalesce(nullIf(mp.wattage, ''), nullIf(r.wattage, '')) as wattage,
                r.is_competitor AS is_competitor, coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) as pareto_status,`;

content = content.replace(oldSql2, newSql2);

writeFileSync(file, content);
console.log('Fixed aliases!');
