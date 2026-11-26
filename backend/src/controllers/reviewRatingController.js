import { queryClickHouse, getCurrentDbName } from '../config/clickhouse.js';

/**
 * GET /api/review-rating/latest-date
 * Returns min and max date (review_date) from rb_review_olap (or rb_reviews_olap for Marico)
 */
export const getReviewRatingLatestDate = async (req, res) => {
    try {
        const dbName = getCurrentDbName() || '';
        const isMarico = dbName.toLowerCase().includes('marico');
        let tableName = isMarico ? 'rb_reviews_olap' : 'rb_review_olap';

        // Check if table exists
        let exists = false;
        try {
            const chk = await queryClickHouse(`EXISTS TABLE ${tableName}`);
            exists = chk && chk[0] && (chk[0].result === 1 || chk[0].result === '1');
        } catch (_) {}

        if (!exists) {
            // Check fallback without s / with s
            const altTable = isMarico ? 'rb_review_olap' : 'rb_reviews_olap';
            try {
                const chkAlt = await queryClickHouse(`EXISTS TABLE ${altTable}`);
                if (chkAlt && chkAlt[0] && (chkAlt[0].result === 1 || chkAlt[0].result === '1')) {
                    tableName = altTable;
                    exists = true;
                }
            } catch (_) {}
        }

        if (!exists) {
            return res.json({ available: false });
        }

        const dateQuery = `
            SELECT 
                formatDateTime(MIN(toDate(review_date)), '%Y-%m-%d') AS min_date,
                formatDateTime(MAX(toDate(review_date)), '%Y-%m-%d') AS max_date
            FROM ${tableName}
            WHERE review_date IS NOT NULL AND toDate(review_date) > '2000-01-01'
        `;

        const result = await queryClickHouse(dateQuery);
        if (result && result.length > 0 && result[0].max_date) {
            const minDate = result[0].min_date;
            const maxDate = result[0].max_date;

            const maxD = new Date(maxDate);
            const defaultStartD = new Date(maxD);
            defaultStartD.setDate(defaultStartD.getDate() - 30);

            const minD = new Date(minDate);
            const finalStartD = defaultStartD < minD ? minD : defaultStartD;

            return res.json({
                available: true,
                minDate,
                maxDate,
                startDate: finalStartD.toISOString().split('T')[0],
                endDate: maxDate,
                defaultStartDate: finalStartD.toISOString().split('T')[0],
                defaultEndDate: maxDate,
                tableName
            });
        }

        return res.json({ available: false });
    } catch (err) {
        console.error('[getReviewRatingLatestDate] Error:', err.message);
        return res.status(500).json({ error: err.message, available: false });
    }
};
