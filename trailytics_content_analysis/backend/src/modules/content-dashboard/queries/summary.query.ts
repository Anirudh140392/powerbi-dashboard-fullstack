import type { ContentDashboardQuerySchema } from '../validators/contentDashboard.validator.js';
import { escapeSqlString, buildWhereClause, buildTotalScoreExpr } from '../utils/queryHelpers.js';

// ---------------------------------------------------------------------------
// Summary Query Builder
// Returns an aggregate SQL query that counts products and averages every score
// column. All filtering is applied here too so counts/averages stay consistent
// with the product list.
// ---------------------------------------------------------------------------

export function buildSummaryQuery(params: ContentDashboardQuerySchema): string {
  const { company, platform, search, brand, category, skus } = params;

  const conditions: string[] = [];

  if (platform) {
    const platList = platform.split(',').map(p => `'${escapeSqlString(p.trim().toLowerCase())}'`).filter(Boolean).join(',');
    if (platList) {
      conditions.push(`LOWER(platform) IN (${platList})`);
    }
  }

  if (skus) {
    const skuList = skus.split(',').map(s => `'${escapeSqlString(s.trim().toLowerCase())}'`).filter(Boolean).join(',');
    if (skuList) {
      conditions.push(`LOWER(product_id) IN (${skuList})`);
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
        product_id IN (
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
      `(LOWER(product_id) LIKE LOWER('%${s}%') OR LOWER(title) LIKE LOWER('%${s}%'))`
    );
  }

  const where = buildWhereClause(conditions);

  // Select only the columns we need — no SELECT *
  return `
    SELECT
      COUNT(*)                           AS total,
      ROUND(AVG(${buildTotalScoreExpr()}), 2) AS avg_score,
      ROUND(AVG(COALESCE(title_score, 0)), 2)         AS avg_title_score,
      ROUND(AVG(COALESCE(bullet_score, 0)), 2)        AS avg_bullet_score,
      ROUND(AVG(COALESCE(description_score, 0)), 2)   AS avg_description_score,
      ROUND(AVG(COALESCE(aplus_image_score, 0)), 2)   AS avg_aplus_score,
      ROUND(AVG(COALESCE(thumbnail_image_score, 0)), 2) AS avg_thumbnail_score,
      ROUND(AVG(COALESCE(thumbnail_video_score, 0)), 2) AS avg_video_score
    FROM \`${company}\`.rb_content_olap
    ${where}
  `.trim();
}
