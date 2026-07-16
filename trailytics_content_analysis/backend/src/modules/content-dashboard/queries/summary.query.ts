import type { ContentDashboardQuerySchema } from '../validators/contentDashboard.validator.js';
import { escapeSqlString, buildWhereClause } from '../utils/queryHelpers.js';

// ---------------------------------------------------------------------------
// Summary Query Builder
// Returns an aggregate SQL query that counts products and averages every score
// column. All filtering is applied here too so counts/averages stay consistent
// with the product list.
// ---------------------------------------------------------------------------

export function buildSummaryQuery(params: ContentDashboardQuerySchema): string {
  const { company, platform, search } = params;

  const conditions: string[] = [];

  if (platform) {
    conditions.push(`LOWER(platform) LIKE LOWER('%${escapeSqlString(platform)}%')`);
  }

  if (search) {
    const s = escapeSqlString(search);
    conditions.push(
      `(LOWER(product_id) LIKE LOWER('%${s}%') OR LOWER(title) LIKE LOWER('%${s}%'))`
    );
  }

  const where = buildWhereClause(conditions);

  // Select only the columns we need — no SELECT *
  return `
    SELECT
      COUNT(*)                           AS total,
      ROUND(AVG(total_score), 2)         AS avg_score,
      ROUND(AVG(title_score), 2)         AS avg_title_score,
      ROUND(AVG(bullet_score), 2)        AS avg_bullet_score,
      ROUND(AVG(description_score), 2)   AS avg_description_score,
      ROUND(AVG(aplus_image_score), 2)   AS avg_aplus_score,
      ROUND(AVG(thumbnail_image_score), 2) AS avg_thumbnail_score,
      ROUND(AVG(thumbnail_video_score), 2) AS avg_video_score
    FROM \`${company}\`.rb_content_olap
    ${where}
  `.trim();
}
