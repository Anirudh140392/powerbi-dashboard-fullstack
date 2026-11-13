import fs from 'fs';

const filePath = '/Users/2004yashgautamgmail.com/Documents/trailytics/trailytics_ds/powerbi-dashboard-fullstack/trailytics_ratings/backend/src/controllers/issues/issues.controller.js';
let content = fs.readFileSync(filePath, 'utf8');

const newFunc = `export const getIssuesBreakdown = async (req, res) => {
    try {
        const { category: filterCategory, pareto_status: filterParetoStatus, rating_bifurcation, platform, date_from, date_to, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category } = req.query;

        const queryParams = { companyId: String(req.companyId) };
        const extraFilters = [];

        if (is_competitor === 'true' || is_competitor === 'false') {
            extraFilters.push(\`coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}\`);
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        } else if (is_competitor !== 'all') {
            extraFilters.push(\`coalesce(r.is_competitor, 0) = 0\`);
        }

        if (sentiment_category && sentiment_category !== 'all') {
            extraFilters.push(\`ilike(r.sentiment_category, {sentimentCategory:String})\`);
            queryParams.sentimentCategory = sentiment_category;
        }

        if (platform && platform !== 'all') {
            extraFilters.push(\`ilike(r.platform, {platform:String})\`);
            queryParams.platform = platform;
        }

        if (date_from) {
            extraFilters.push(\`r.review_date >= toDate({dateFrom:String})\`);
            queryParams.dateFrom = date_from;
        }
        if (date_to) {
            extraFilters.push(\`r.review_date <= toDate({dateTo:String})\`);
            queryParams.dateTo = date_to;
        }
        if (!date_from && !date_to) {
            const pm = Math.max(1, Math.min(parseInt(period_months) || 6, 24));
            extraFilters.push(\`r.review_date >= subtractMonths(today(), \${pm})\`);
        }

        if (filterCategory) {
            extraFilters.push(\`ilike(trim(coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, ''))), {category:String})\`);
            queryParams.category = filterCategory;
        }
        if (filterParetoStatus) {
            if (filterParetoStatus === 'Non-Pareto') {
                extraFilters.push(\`(coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) NOT IN ('Pareto', 'NPD') OR coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = '')\`);
            } else {
                extraFilters.push(\`coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = {paretoStatus:String}\`);
                queryParams.paretoStatus = filterParetoStatus;
            }
        }
        if (rating_bifurcation === 'NP') {
            extraFilters.push(\`ps.rating >= 4.2\`);
        } else if (rating_bifurcation === 'Issue') {
            extraFilters.push(\`ps.rating < 4.0\`);
        } else if (rating_bifurcation === 'NI') {
            extraFilters.push(\`ps.rating >= 4.0 AND ps.rating < 4.2\`);
        }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            extraFilters.push(\`\${priceExpr} >= {priceMin:Float64}\`);
            queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            extraFilters.push(\`\${priceExpr} <= {priceMax:Float64}\`);
            queryParams.priceMax = Number(price_max);
        }

        const mappingResult = await pool.query(
            \`SELECT sentiment_subcategory, display_label, stakeholder FROM ratings.stakeholder_mappings WHERE company_id = $1\`,
            [req.companyId]
        );
        const mappingMap = {};
        mappingResult.rows.forEach(r => { mappingMap[r.sentiment_subcategory] = { label: r.display_label, stakeholder: r.stakeholder }; });

        const extraWhere = extraFilters.length > 0 ? \`AND \${extraFilters.join(' AND ')}\` : '';

        const sql = \`
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status, rating
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            )
            SELECT
                r.sentiment_subcategory AS sentiment_subcategory,
                count() AS total_count,
                countIf(r.sentiment = 'Negative') AS negative_count,
                uniqExact(r.web_pid) AS sku_count,
                round(avg(r.rating), 2) AS avg_rating
            FROM ml_reviews r
            LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
            LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
            WHERE r.company_id = {companyId:String}
              AND isNotNull(r.sentiment_subcategory) AND r.sentiment_subcategory != ''
              AND r.sentiment_subcategory != 'General_Feedback'
              \${extraWhere}
            GROUP BY r.sentiment_subcategory
            ORDER BY negative_count DESC
        \`;

        const chRes = await clickhouse.query({
            database: getTargetDb(req),
            query: sql,
            query_params: queryParams,
            format: 'JSONEachRow'
        });
        const rows = await chRes.json();
        
        const issues = rows.map(r => ({
            subcategory: r.sentiment_subcategory,
            label: mappingMap[r.sentiment_subcategory]?.label || r.sentiment_subcategory.replace(/_/g, ' '),
            stakeholder: mappingMap[r.sentiment_subcategory]?.stakeholder || null,
            negativeCount: parseInt(r.negative_count),
            totalCount: parseInt(r.total_count),
            skuCount: parseInt(r.sku_count),
            avgRating: parseFloat(r.avg_rating),
        }));

        res.json({ issues, totalIssues: issues.length });
    } catch (err) {
        console.error('Issues breakdown error:', err);
        res.status(500).json({ error: err.message });
    }
};`;

content = content.replace(/export const getIssuesBreakdown = async \(req, res\) => \{[\s\S]*?\n\};\n\n\/\/ ============================================================================/g, newFunc + '\n\n// ============================================================================');
fs.writeFileSync(filePath, content);
