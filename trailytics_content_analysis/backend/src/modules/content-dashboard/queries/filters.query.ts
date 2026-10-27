import { getClickhouseClient } from '../utils/db.js';
import { escapeSqlString } from '../utils/queryHelpers.js';

export async function getCascadedFilters(company: string, platform?: string, category?: string, brand?: string) {
  const client = getClickhouseClient();
  const conditions = [];

  if (platform) {
    const plats = platform.split(',').map(p => `'${escapeSqlString(p.trim().toLowerCase())}'`).filter(p => p !== "''").join(',');
    if (plats) conditions.push(`LOWER(platform_name) IN (${plats})`);
  }
  
  if (category) {
    const cats = category.split(',').map(c => `'${escapeSqlString(c.trim().toLowerCase())}'`).filter(c => c !== "''").join(',');
    if (cats) conditions.push(`LOWER(brand_category) IN (${cats})`);
  }
  
  if (brand) {
    const brands = brand.split(',').map(b => `'${escapeSqlString(b.trim().toLowerCase())}'`).filter(b => b !== "''").join(',');
    if (brands) conditions.push(`LOWER(brand_name) IN (${brands})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT 
      groupArray(DISTINCT brand_category) as categories,
      groupArray(DISTINCT brand_name) as brands
    FROM \`${company}\`.rb_sku_platform
    ${where}
  `;

  const platformQuery = `
    SELECT DISTINCT platform
    FROM \`${company}\`.rb_content_olap
  `;

  const [result, platformResult] = await Promise.all([
    client.query({ query, format: 'JSONEachRow' }),
    client.query({ query: platformQuery, format: 'JSONEachRow' })
  ]);
  
  const data = await result.json();
  const platformData = await platformResult.json() as { platform: string }[];
  const platforms = platformData.map(r => r.platform).filter(Boolean);

  if (data && data.length > 0) {
    const row = data[0] as any;
    return {
      platforms,
      categories: row.categories.filter(Boolean),
      brands: row.brands.filter(Boolean),
    };
  }

  return { platforms, categories: [], brands: [] };
}

export async function searchSkus(company: string, search: string, platform?: string, category?: string, brand?: string) {
  const client = getClickhouseClient();
  const conditions = [];

  if (platform) {
    const plats = platform.split(',').map(p => `'${escapeSqlString(p.trim().toLowerCase())}'`).filter(p => p !== "''").join(',');
    if (plats) conditions.push(`LOWER(s.platform_name) IN (${plats})`);
  }
  
  if (category) {
    const cats = category.split(',').map(c => `'${escapeSqlString(c.trim().toLowerCase())}'`).filter(c => c !== "''").join(',');
    if (cats) conditions.push(`LOWER(s.brand_category) IN (${cats})`);
  }
  
  if (brand) {
    const brands = brand.split(',').map(b => `'${escapeSqlString(b.trim().toLowerCase())}'`).filter(b => b !== "''").join(',');
    if (brands) conditions.push(`LOWER(s.brand_name) IN (${brands})`);
  }
  
  if (search) {
    const sStr = escapeSqlString(search);
    conditions.push(`(LOWER(s.web_pid) LIKE LOWER('%${sStr}%') OR LOWER(s.sku_name) LIKE LOWER('%${sStr}%') OR LOWER(s.sku_title) LIKE LOWER('%${sStr}%'))`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT DISTINCT s.web_pid, s.sku_name, s.sku_title
    FROM \`${company}\`.rb_sku_platform s
    INNER JOIN \`${company}\`.rb_content_olap c ON LOWER(s.web_pid) = LOWER(c.product_id)
    ${where}
    LIMIT 100
  `;

  const result = await client.query({ query, format: 'JSONEachRow' });
  const data = await result.json() as any[];

  return data.map(r => ({
    product_id: r.web_pid,
    title: r.sku_name || r.sku_title || r.web_pid
  }));
}
