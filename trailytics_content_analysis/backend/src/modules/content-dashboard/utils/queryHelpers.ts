// ---------------------------------------------------------------------------
// SQL / ClickHouse query helper utilities
// ---------------------------------------------------------------------------

/**
 * Escape a string value for safe embedding inside a ClickHouse SQL string
 * literal (single-quoted). Escapes backslashes and single quotes.
 *
 * NOTE: The company/database identifier is validated by a strict regex
 * (/^[a-zA-Z0-9_-]+$/) in the validator, so it is safe to interpolate
 * directly without further escaping.
 */
export function escapeSqlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')   // escape backslashes first
    .replace(/'/g, "\\'");    // then escape single quotes
}

/**
 * Build a reusable WHERE clause string from optional filter conditions.
 * Returns an empty string if there are no conditions.
 */
export function buildWhereClause(conditions: string[]): string {
  if (conditions.length === 0) return '';
  return `WHERE ${conditions.join(' AND ')}`;
}

/**
 * Safely parse a ClickHouse numeric string result, falling back to null.
 */
export function toFloat(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

/**
 * Safely parse a ClickHouse integer string result, falling back to null.
 */
export function toInt(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}
