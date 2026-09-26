import pool from '../../config/db.js';

export const exportDataLake = async (req, res) => {
    try {
        const {
            filterBlankCategory,
            filterBlankSentiment,
            filterCompetitor,
            searchQuery,
            price_mode,
            price_min,
            price_max,
            platform,
            category
        } = req.query;

        let where = ['r.company_id = $1'];
        let params = [req.companyId];
        let idx = 2;

        if (filterBlankCategory === 'true') {
            where.push(`(TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) IS NULL OR TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) ILIKE '%Uncategorized%')`);
        }
        if (filterBlankSentiment === 'true') {
            where.push(`(r.sentiment_subcategory IS NULL OR r.sentiment_subcategory = '')`);
        }
        if (filterCompetitor === 'true') {
            where.push(`r.is_competitor = true`);
        }
        if (searchQuery) {
            where.push(`(r.review_text ILIKE $${idx} OR r.product_name ILIKE $${idx} OR r.web_pid ILIKE $${idx} OR r.brand ILIKE $${idx})`);
            params.push(`%${searchQuery}%`);
            idx++;
        }
        if (platform && platform !== 'all') {
            where.push(`r.platform ILIKE $${idx}`);
            params.push(platform);
            idx++;
        }
        if (category) {
            where.push(`TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) ILIKE $${idx}`);
            params.push(category);
            idx++;
        }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} >= $${idx}`);
            params.push(Number(price_min));
            idx++;
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} <= $${idx}`);
            params.push(Number(price_max));
            idx++;
        }

        const sql = `
            WITH latest_snapshots AS (
                SELECT DISTINCT ON (company_id, LOWER(platform), web_pid) *
                FROM ratings.product_snapshots
                WHERE company_id = $1
                ORDER BY company_id, LOWER(platform), web_pid, snapshot_date DESC, created_at DESC NULLS LAST
            )
            SELECT 
                r.web_pid as "ID",
                COALESCE(ps.product_name, r.product_name) as "Description",
                COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, '')) as "Product Category",
                r.platform as "Platform",
                r.id as "Review ID",
                r.review_text as "Review Text",
                r.rating as "Review Rating",
                r.ml_inferred_rating as "AI Imputed Rating",
                COALESCE(ps.rating, r.pdp_rating) as "PDP Rating",
                COALESCE(ps.rating_count, r.pdp_rating_count) as "Global Rating Count",
                COALESCE((ps.star_distribution->>'1'), (r.star_distribution->>'1')) as "1 Star Count",
                COALESCE((ps.star_distribution->>'2'), (r.star_distribution->>'2')) as "2 Star Count",
                COALESCE((ps.star_distribution->>'3'), (r.star_distribution->>'3')) as "3 Star Count",
                COALESCE((ps.star_distribution->>'4'), (r.star_distribution->>'4')) as "4 Star Count",
                COALESCE((ps.star_distribution->>'5'), (r.star_distribution->>'5')) as "5 Star Count",
                r.review_date as "Review Date",
                r.sentiment as "Sentiment Category",
                mp.subcategory as "Subcategory L1",
                r.brand as "Brand",
                r.is_competitor as "Is Competitor"
            FROM ratings.reviews r
            LEFT JOIN latest_snapshots ps ON ps.company_id = r.company_id AND ps.web_pid = r.web_pid AND LOWER(ps.platform) = LOWER(r.platform)
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
            WHERE ${where.join(' AND ')}
            ORDER BY r.review_date DESC NULLS LAST
            LIMIT $${idx++} OFFSET $${idx++}
        `;
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="datalake_export_${Date.now()}.csv"`);
        
        const headers = [
            'ID', 'Description', 'Product Category', 'Platform', 'Review ID', 'Review Text', 
            'Review Rating', 'AI Imputed Rating', 'PDP Rating', 'Global Rating Count', 
            '1 Star Count', '2 Star Count', '3 Star Count', '4 Star Count', '5 Star Count', 
            'Review Date', 'Sentiment Category', 'Subcategory L1', 'Brand', 'Is Competitor'
        ];
        res.write(headers.join(',') + '\n');

        const limit = 20000;
        let offset = 0;
        let keepFetching = true;

        while (keepFetching) {
            const batchParams = [...params, limit, offset];
            const { rows } = await pool.query(sql, batchParams);
            
            if (rows.length === 0) {
                keepFetching = false;
                break;
            }
            
            let chunk = '';
            for (const row of rows) {
                const rowData = headers.map(h => {
                    const val = row[h];
                    if (val === null || val === undefined) return '';
                    return `"${String(val).replace(/"/g, '""')}"`;
                });
                chunk += rowData.join(',') + '\n';
            }
            res.write(chunk);
            offset += limit;
        }
        res.end();
    } catch (err) {
        console.error('Data Lake export error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
        else res.end();
    }
};

// 1. Fetch Paginated Raw Data (With Filters for "Blank" / "Uncategorized")

export const getDataLakeReviews = async (req, res) => {
    try {
        const {
            limit: queryLimit,
            offset: queryOffset,
            filterBlankCategory,
            filterBlankSentiment,
            filterCompetitor,
            searchQuery,
            price_mode,
            price_min,
            price_max,
            platform,
            category,
            date_from,
            date_to
        } = req.query;

        let where = ['r.company_id = $1'];
        let params = [req.companyId];
        let idx = 2;

        if (filterBlankCategory === 'true') {
            where.push(`(TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) IS NULL OR TRIM(COALESCE(NULLIF(ps.category, ''), NULLIF(mp.category, ''), NULLIF(r.category, ''))) ILIKE '%Uncategorized%')`);
        }
        if (filterBlankSentiment === 'true') {
            where.push(`(r.sentiment_subcategory IS NULL OR r.sentiment_subcategory = '')`);
        }
        if (filterCompetitor === 'true') {
            where.push(`r.is_competitor = true`);
        }
        if (searchQuery) {
            where.push(`(r.review_text ILIKE $${idx} OR r.product_name ILIKE $${idx} OR r.web_pid ILIKE $${idx} OR r.brand ILIKE $${idx})`);
            params.push(`%${searchQuery}%`);
            idx++;
        }
        if (platform && platform !== 'all') {
            where.push(`r.platform ILIKE $${idx}`);
            params.push(platform);
            idx++;
        }
        if (category) {
            where.push(`COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE $${idx}`);
            params.push(category);
            idx++;
        }
        if (date_from) {
            where.push(`r.review_date >= $${idx}`);
            params.push(date_from);
            idx++;
        }
        if (date_to) {
            where.push(`r.review_date <= $${idx}`);
            params.push(date_to);
            idx++;
        }
        if (price_min !== undefined && price_min !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} >= $${idx}`);
            params.push(Number(price_min));
            idx++;
        }
        if (price_max !== undefined && price_max !== '') {
            const priceExpr = price_mode === 'rp'
                ? 'COALESCE(ps.price_rp, mp.mrp)'
                : 'COALESCE(ps.price_sp, mp.selling_price, mp.mop, ps.price_rp, mp.mrp)';
            where.push(`${priceExpr} <= $${idx}`);
            params.push(Number(price_max));
            idx++;
        }

        const limit = parseInt(queryLimit) || 100;
        const offset = parseInt(queryOffset) || 0;

        const sql = `
            SELECT r.*,
                   COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) as derived_category
            FROM ratings.reviews r
            LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
            LEFT JOIN LATERAL (
                SELECT ps2.price_rp, ps2.price_sp, ps2.category
                FROM ratings.product_snapshots ps2
                WHERE ps2.company_id = r.company_id AND ps2.web_pid = r.web_pid
                ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
                LIMIT 1
            ) ps ON true
            WHERE ${where.join(' AND ')}
            ORDER BY r.review_date DESC NULLS LAST
            LIMIT $${idx++} OFFSET $${idx++}
        `;
        params.push(limit, offset);

        const { rows } = await pool.query(sql, params);

        const countSql = `
            SELECT 
                count(*) as total,
                avg(r.rating) as avg_rating,
                count(DISTINCT COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, ''))) as unique_categories,
                sum(CASE WHEN COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) IS NULL OR COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) = '' OR COALESCE(NULLIF(ps.category, ''), NULLIF(r.category, ''), NULLIF(mp.category, '')) ILIKE '%Uncategorized%' THEN 1 ELSE 0 END) as blank_categories,
                sum(CASE WHEN r.sentiment_subcategory IS NULL OR r.sentiment_subcategory = '' THEN 1 ELSE 0 END) as blank_sentiments
            FROM ratings.reviews r
              LEFT JOIN masters.products mp ON mp.company_id = r.company_id AND mp.product_external_id = r.web_pid AND LOWER(mp.platform) = LOWER(r.platform)
              LEFT JOIN LATERAL (
                  SELECT ps2.price_rp, ps2.price_sp, ps2.category, ps2.pareto_status, ps2.rating
                  FROM ratings.product_snapshots ps2
                  WHERE ps2.company_id = r.company_id AND ps2.web_pid = r.web_pid
                  ORDER BY ps2.snapshot_date DESC, ps2.created_at DESC NULLS LAST
                  LIMIT 1
            ) ps ON true
            WHERE ${where.join(' AND ')}
        `;
        const countParams = params.slice(0, params.length - 2);
        const { rows: countRows } = await pool.query(countSql, countParams);

        res.json({
            data: rows,
            total: parseInt(countRows[0].total) || 0,
            metrics: {
                avgRating: parseFloat(countRows[0].avg_rating) || 0,
                uniqueCategories: parseInt(countRows[0].unique_categories) || 0,
                blankCategories: parseInt(countRows[0].blank_categories) || 0,
                blankSentiments: parseInt(countRows[0].blank_sentiments) || 0
            },
            limit,
            offset,
        });
    } catch (err) {
        console.error('Data Lake read error:', err);
        res.status(500).json({ error: err.message });
    }
};

// 2. Edit a single row directly

export const editDataLakeReview = async (req, res) => {
    try {
        const { id, category, sentiment, specific_issue, material, wattage } = req.body;
        if (!id) return res.status(400).json({ error: 'id is required' });

        // Manual user edit — stamp the source so the next sync/ML run won't clobber it.
        await pool.query(`
            UPDATE ratings.reviews
            SET
                category              = $1,
                category_source       = CASE WHEN $1 IS DISTINCT FROM category THEN 'user' ELSE category_source END,
                sentiment             = $2,
                sentiment_source      = CASE WHEN $2 IS DISTINCT FROM sentiment THEN 'user' ELSE sentiment_source END,
                specific_issue        = $3,
                specific_issue_source = CASE WHEN $3 IS DISTINCT FROM specific_issue THEN 'user' ELSE specific_issue_source END,
                material              = $4,
                wattage               = $5,
                updated_at            = NOW()
            WHERE id = $6 AND company_id = $7
        `, [category, sentiment, specific_issue, material, wattage, id, req.companyId]);

        res.json({ success: true, message: 'Row updated.' });
    } catch (err) {
        console.error('Data Lake edit error:', err);
        res.status(500).json({ error: err.message });
    }
};

// 3. Bulk Delete rows

export const bulkDeleteDataLakeReviews = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Array of ids required' });
        }

        const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
        await pool.query(`DELETE FROM ratings.reviews WHERE company_id = $1 AND id IN (${placeholders})`, [req.companyId, ...ids]);
        
        res.json({ success: true, message: `Deleted ${ids.length} rows.` });
    } catch (err) {
        console.error('Data Lake delete error:', err);
        res.status(500).json({ error: err.message });
    }
};

// 4. Trigger ML Bulk Process against Specific IDs (Inline for Vercel Serverless)

