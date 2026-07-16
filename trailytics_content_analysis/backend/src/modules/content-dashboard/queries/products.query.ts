import type { ContentDashboardQuerySchema } from '../validators/contentDashboard.validator.js';
import { escapeSqlString, buildWhereClause } from '../utils/queryHelpers.js';

// ---------------------------------------------------------------------------
// Products Query Builder
// Returns a paginated, filtered, sorted list of products.
// Sorting, filtering, and pagination are all pushed into SQL.
// ---------------------------------------------------------------------------

export function buildProductsQuery(params: ContentDashboardQuerySchema): string {
  const { company, platform, search, sortBy, sortOrder, page, limit } = params;
  const offset = (page - 1) * limit;

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

  // sortBy is validated against a whitelist in the Zod schema — safe to interpolate
  const order = sortOrder.toUpperCase() as 'ASC' | 'DESC';

  // Map sortBy to actual DB column
  const sortMap: Record<string, string> = {
    score: 'total_score',
    title_score: 'title_score',
    bullet_point_score: 'bullet_score',
    description_score: 'description_score',
    aplus_score: 'aplus_image_score',
    thumbnail_score: 'thumbnail_image_score',
    video_score: 'thumbnail_video_score',
    title: 'title'
  };
  const dbSortBy = sortMap[sortBy] || 'total_score';

  // Select only required columns — no SELECT *
  return `
    SELECT
      product_id,
      title,
      total_score AS score,
      title_score,
      bullet_score AS bullet_point_score,
      description_score,
      aplus_image_score AS aplus_score,
      thumbnail_image_score AS thumbnail_score,
      thumbnail_video_score AS video_score
    FROM \`${company}\`.rb_content_olap
    ${where}
    ORDER BY ${dbSortBy} ${order}
    LIMIT ${limit} OFFSET ${offset}
  `.trim();
}
