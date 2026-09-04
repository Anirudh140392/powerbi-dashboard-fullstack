export const getProductHealth = async (req, res) => {
    try {
        const { category, pareto_status, web_pid, date_from, date_to, platform, period_months, price_mode, price_min, price_max, is_competitor, sentiment_category } = req.query;
        const trendPeriod = Math.max(1, Math.min(parseInt(period_months) || 3, 24));
        const queryParams = { companyId: String(req.companyId) };
        const where = ['r.company_id = {companyId:String}', 'isNotNull(r.product_name)', 'isNotNull(r.review_date)'];

        if (is_competitor && is_competitor !== 'all') {
            where.push(`coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}`);
            queryParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
        } else if (is_competitor === undefined || is_competitor === '') {
            where.push(`coalesce(r.is_competitor, 0) = 0`);
        }
        if (platform && platform !== 'all') { where.push(`ilike(r.platform, {platform:String})`); queryParams.platform = platform; }
        if (category) {
            where.push(`ilike(coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')), {category:String})`);
            queryParams.category = category;
        }
        if (sentiment_category && sentiment_category !== 'all') {
            where.push(`ilike(r.sentiment_category, {sentimentCategory:String})`);
            queryParams.sentimentCategory = sentiment_category;
        }
        if (pareto_status) {
            where.push(`coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = {paretoStatus:String}`);
            queryParams.paretoStatus = pareto_status;
        }
        if (web_pid) { where.push(`r.web_pid = {webPid:String}`); queryParams.webPid = web_pid; }

        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} >= {priceMin:Float64}`);
            queryParams.priceMin = Number(price_min);
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} <= {priceMax:Float64}`);
            queryParams.priceMax = Number(price_max);
        }

        let recentPeriodFilter, priorPeriodFilter, combinedWindowFilter;
        if (date_from && date_to) {
            queryParams.dateFrom = date_from;
            queryParams.dateTo = date_to;
            const midpointExpr = `(toDate({dateFrom:String}) + toUInt32((toDate({dateTo:String}) - toDate({dateFrom:String})) / 2))`;
            recentPeriodFilter = `r.review_date >= ${midpointExpr} AND r.review_date <= toDate({dateTo:String})`;
            priorPeriodFilter = `r.review_date >= toDate({dateFrom:String}) AND r.review_date < ${midpointExpr}`;
            combinedWindowFilter = `r.review_date >= toDate({dateFrom:String}) AND r.review_date <= toDate({dateTo:String})`;
        } else {
            const recentStartExpr = `subtractMonths(today(), ${trendPeriod})`;
            const priorStartExpr = `subtractMonths(today(), ${trendPeriod * 2})`;
            recentPeriodFilter = `r.review_date >= ${recentStartExpr}`;
            priorPeriodFilter = `r.review_date >= ${priorStartExpr} AND r.review_date < ${recentStartExpr}`;
            combinedWindowFilter = `r.review_date >= ${priorStartExpr}`;
        }
        where.push(combinedWindowFilter);

        const sql = `
            WITH latest_snapshots AS (
                SELECT * FROM (
                    SELECT web_pid, platform, price_rp, price_sp, category, pareto_status
                    FROM product_snapshots
                    WHERE company_id = {companyId:String}
                    ORDER BY snapshot_date DESC, created_at DESC
                ) LIMIT 1 BY lower(platform), web_pid
            ),
            product_stats AS (
                SELECT
                    substring(r.product_name, 1, 80) AS product,
                    count() AS total,
                    countIf(r.sentiment = 'Positive') AS positive,
                    countIf(r.sentiment = 'Negative') AS negative,
                    countIf(r.sentiment = 'Neutral') AS neutral,
                    countIf(${recentPeriodFilter}) AS recent_total,
                    countIf(${recentPeriodFilter} AND r.sentiment = 'Negative') AS recent_neg,
                    countIf(${priorPeriodFilter}) AS older_total,
                    countIf(${priorPeriodFilter} AND r.sentiment = 'Negative') AS older_neg
                FROM reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
                WHERE ${where.join(' AND ')}
                GROUP BY substring(r.product_name, 1, 80)
                HAVING count() >= 10
            )
            SELECT
                product, total, positive, negative, neutral,
                recent_total, recent_neg, older_total, older_neg,
                multiIf(total > 0, toFloat64(positive) / total, 0.0) AS positive_rate,
                multiIf(total > 0, toFloat64(negative) / total, 0.0) AS negative_rate,
                round(multiIf(total > 0, (toFloat64(positive) - negative) / total * 50 + 50, 50.0), 0) AS health_score,
                multiIf(
                    recent_total > 0 AND older_total > 0 AND (toFloat64(recent_neg) / recent_total - toFloat64(older_neg) / older_total) > 0.05, 'declining',
                    recent_total > 0 AND older_total > 0 AND (toFloat64(recent_neg) / recent_total - toFloat64(older_neg) / older_total) < -0.05, 'improving',
                    'stable'
                ) AS trend
            FROM product_stats
            ORDER BY total DESC
            LIMIT 30
        `;
        const chRes = await clickhouse.query({ database: getTargetDb(req), query: sql, query_params: queryParams, format: 'JSONEachRow' });
        const rows = await chRes.json();

        // Also get monthly ratings per product (top 20 only)
        const topProducts = rows.slice(0, 20).map(r => r.product);
        let monthlyData = {};

        if (topProducts.length > 0) {
            const mParams = { companyId: String(req.companyId), topProducts };
            const mWhere = ['r.company_id = {companyId:String}', 'substring(r.product_name, 1, 80) IN {topProducts:Array(String)}', 'isNotNull(r.review_date)'];

            if (is_competitor && is_competitor !== 'all') {
                mWhere.push(`coalesce(r.is_competitor, 0) = {isCompetitor:UInt8}`);
                mParams.isCompetitor = is_competitor === 'true' ? 1 : 0;
            }
            if (category) {
                mWhere.push(`ilike(coalesce(nullIf(ps.category, ''), nullIf(r.category, ''), nullIf(mp.category, '')), {category:String})`);
                mParams.category = category;
            }
            if (pareto_status) {
                mWhere.push(`coalesce(nullIf(mp.pareto_status, ''), nullIf(ps.pareto_status, ''), nullIf(r.pareto_status, '')) = {paretoStatus:String}`);
                mParams.paretoStatus = pareto_status;
            }
            if (date_from) { mWhere.push(`r.review_date >= toDate({dateFrom:String})`); mParams.dateFrom = date_from; }
            if (date_to) { mWhere.push(`r.review_date <= toDate({dateTo:String})`); mParams.dateTo = date_to; }
            
            if (price_min !== undefined && price_min !== '') {
                const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
                mWhere.push(`${priceExpr} >= {priceMin:Float64}`);
                mParams.priceMin = Number(price_min);
            }
            if (price_max !== undefined && price_max !== '') {
                const priceExpr = price_mode === 'rp' ? 'coalesce(ps.price_rp, mp.mrp)' : 'coalesce(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
                mWhere.push(`${priceExpr} <= {priceMax:Float64}`);
                mParams.priceMax = Number(price_max);
            }

            const monthSql = `
                WITH latest_snapshots AS (
                    SELECT * FROM (
                        SELECT web_pid, platform, price_rp, price_sp, category, pareto_status
                        FROM product_snapshots
                        WHERE company_id = {companyId:String}
                        ORDER BY snapshot_date DESC, created_at DESC
                    ) LIMIT 1 BY lower(platform), web_pid
                )
                SELECT
                    substring(r.product_name, 1, 80) AS product,
                    substring(toString(r.review_date), 1, 7) AS month,
                    round(avg(r.rating), 2) AS avg_rating,
                    count() AS count
                FROM reviews r
                LEFT JOIN products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND lower(mp.platform) = lower(r.platform)
                LEFT JOIN latest_snapshots ps ON ps.web_pid = r.web_pid AND lower(ps.platform) = lower(r.platform)
                WHERE ${mWhere.join(' AND ')}
                GROUP BY product, month
                ORDER BY product, month
            `;
            const mRes = await clickhouse.query({ database: getTargetDb(req), query: monthSql, query_params: mParams, format: 'JSONEachRow' });
            const mRows = await mRes.json();
            mRows.forEach(r => {
                if (!monthlyData[r.product]) monthlyData[r.product] = [];
                monthlyData[r.product].push({
                    month: r.month,
                    avg: parseFloat(r.avg_rating),
                    count: parseInt(r.count),
                });
            });
        }

        const products = rows.map(r => ({
            product: r.product,
            healthScore: parseInt(r.health_score),
            totalMentions: parseInt(r.total),
            positiveRate: parseFloat(r.positive_rate),
            negativeRate: parseFloat(r.negative_rate),
            trend: r.trend,
            monthlyRatings: (monthlyData[r.product] || []).slice(-12),
        }));

        res.json({ products });
    } catch (err) {
        console.error('Product health error:', err);
        res.status(500).json({ error: err.message });
    }
};
