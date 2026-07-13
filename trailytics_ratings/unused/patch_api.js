const fs = require('fs');
let code = fs.readFileSync('server/api.cjs', 'utf8');

// 1. executive-health
let rx = /app\.get\('\/api\/ratings\/executive-health', async \(req, res\) => \{\s+try \{\s+const \{ category: filterCategory, pareto_status: filterParetoStatus, rating_bifurcation \} = req\.query;/;
code = code.replace(rx, "app.get('/api/ratings/executive-health', async (req, res) => {\n    try {\n        const { category: filterCategory, pareto_status: filterParetoStatus, rating_bifurcation, platform } = req.query;");

rx = /let ratingFilter = '';\s+const params = \[req\.companyId\];/;
code = code.replace(rx, "let ratingFilter = '';\n        let platformFilter = '';\n        let spPlatformFilter = '';\n        const params = [req.companyId];\n\n        if (platform && platform !== 'all') {\n            spPlatformFilter = \\AND ps.platform = $\\\\;\n            platformFilter = \\AND r.platform = $\\\\;\n            params.push(platform);\n        }");

rx = /AND r\.review_date >= \(CURRENT_DATE - '3 months'::interval\)/g;
code = code.replace(rx, "AND r.review_date >= (CURRENT_DATE - '3 months'::interval)\n                          \");

rx = /AND r\.review_date >= \(CURRENT_DATE - '6 months'::interval\)/g;
code = code.replace(rx, "AND r.review_date >= (CURRENT_DATE - '6 months'::interval)\n                          \");

code = code.replace(/WHERE r\.company_id = \ AND r\.web_pid = ps\.web_pid\s+AND r\.is_competitor = false\s+\) AS total_reviews/g, "WHERE r.company_id =  AND r.web_pid = ps.web_pid\n                          AND r.is_competitor = false\n                          \n                    ) AS total_reviews");

code = code.replace(/WHERE r\.company_id = \ AND r\.web_pid = ps\.web_pid\s+AND r\.is_competitor = false\s+\) AS latest_review_date/g, "WHERE r.company_id =  AND r.web_pid = ps.web_pid\n                          AND r.is_competitor = false\n                          \n                    ) AS latest_review_date");

code = code.replace(/\$\{categoryFilter\}\s+\$\{ratingFilter\}/g, "\\n                  \\n                  \");

// 2. category-health
rx = /app\.get\('\/api\/ratings\/category-health', async \(req, res\) => \{\s+try \{\s+const \{ date_from, date_to \} = req\.query;/;
code = code.replace(rx, "app.get('/api/ratings/category-health', async (req, res) => {\n    try {\n        const { date_from, date_to, platform } = req.query;");

rx = /let growthRangeFilter, recentFilter, priorFilter;/;
code = code.replace(rx, "let growthRangeFilter, recentFilter, priorFilter;\n        let platformFilter = '';\n        if (platform && platform !== 'all') {\n            platformFilter = \\AND r.platform = $\\\\;\n            sqlParams.push(platform);\n        }");

code = code.replace(/\$\{recentFilter\}\s+\$\{catFilter\}/g, "\ \ \");
code = code.replace(/\$\{priorFilter\}\s+\$\{catFilter\}/g, "\ \ \");

// 3. summary
rx = /app\.get\('\/api\/ratings\/summary', async \(req, res\) => \{\s+try \{\s+const \{\s+category,\s+pareto_status,\s+web_pid,\s+date_from,\s+date_to\s+\} = req\.query;/;
code = code.replace(rx, "app.get('/api/ratings/summary', async (req, res) => {\n    try {\n        const { platform, category, pareto_status, web_pid, date_from, date_to } = req.query;");

rx = /if \(category\) \{ extraFilters\.push\(\category = \\$\\\$\{idx\+\+\}\\); params\.push\(category\); \}/;
code = code.replace(rx, "if (platform && platform !== 'all') { extraFilters.push(\\platform = $\\\\); params.push(platform); }\n        if (category) { extraFilters.push(\\category = $\\\\); params.push(category); }");

fs.writeFileSync('server/api.cjs', code, 'utf8');
