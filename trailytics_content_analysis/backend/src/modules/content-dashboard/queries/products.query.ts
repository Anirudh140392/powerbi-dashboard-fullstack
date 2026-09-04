import type { ContentDashboardQuerySchema } from '../validators/contentDashboard.validator.js';
import { escapeSqlString, buildWhereClause } from '../utils/queryHelpers.js';

// ---------------------------------------------------------------------------
// Products Query Builder
// Returns a paginated, filtered, sorted list of products.
// Sorting, filtering, and pagination are all pushed into SQL.
// ---------------------------------------------------------------------------

export function buildProductsQuery(params: ContentDashboardQuerySchema): string {
  const { company, platform, search, sortBy, sortOrder, page, limit, brand, category, skus } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];

  if (platform) {
    conditions.push(`LOWER(o.platform) LIKE LOWER('%${escapeSqlString(platform)}%')`);
  }

  if (skus) {
    const skuList = skus.split(',').map(s => `'${escapeSqlString(s.trim().toLowerCase())}'`).filter(Boolean).join(',');
    if (skuList) {
      conditions.push(`LOWER(o.product_id) IN (${skuList})`);
    }
  }

  if (brand || category) {
    const subConditions: string[] = [];
    if (brand) {
      const brandList = brand.split(',').map(b => `'${escapeSqlString(b.trim().toLowerCase())}'`).filter(b => b !== "''").join(',');
      if (brandList) subConditions.push(`LOWER(brand_name) IN (${brandList})`);
    }
    if (category) {
      const catList = category.split(',').map(c => `'${escapeSqlString(c.trim().toLowerCase())}'`).filter(c => c !== "''").join(',');
      if (catList) subConditions.push(`LOWER(brand_category) IN (${catList})`);
    }
    
    if (subConditions.length > 0) {
      conditions.push(`
        LOWER(o.product_id) IN (
          SELECT LOWER(web_pid) 
          FROM \`${company}\`.rb_sku_platform 
          WHERE ${subConditions.join(' AND ')}
        )
      `);
    }
  }

  if (search) {
    const s = escapeSqlString(search);
    conditions.push(
      `(LOWER(o.product_id) LIKE LOWER('%${s}%') OR LOWER(COALESCE(s.sku_name, s.sku_title, o.title)) LIKE LOWER('%${s}%'))`
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
  const dbSortBy = sortMap[sortBy] ? (sortMap[sortBy] === 'title' ? 'title' : `o.${sortMap[sortBy]}`) : 'o.total_score';

  // Select only required columns — no SELECT *
  return `
    SELECT
      o.product_id,
      COALESCE(s.sku_name, s.sku_title, o.title) AS title,
      s.image_url,
      s.image_url_s3,
      o.total_score AS score,
      o.title_score,
      o.bullet_score AS bullet_point_score,
      o.description_score,
      o.aplus_image_score AS aplus_score,
      o.thumbnail_image_score AS thumbnail_score,
      o.thumbnail_video_score AS video_score
    FROM \`${company}\`.rb_content_olap o
    LEFT JOIN (
      SELECT
        LOWER(web_pid) AS pid,
        any(sku_name) AS sku_name,
        any(sku_title) AS sku_title,
        anyIf(image_url, image_url != '') AS image_url,
        anyIf(image_url_s3, image_url_s3 != '') AS image_url_s3
      FROM \`${company}\`.rb_sku_platform
      GROUP BY pid
    ) s ON LOWER(o.product_id) = s.pid
    ${where}
    ORDER BY ${dbSortBy} ${order}
    LIMIT ${limit} OFFSET ${offset}
  `.trim();
}
