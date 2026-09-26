const fs = require('fs');
const file = 'backend/src/services/categoryPerfSummaryDataService.js';
let content = fs.readFileSync(file, 'utf8');

// Function 1: getPdpKPIsByCategory
let target1 = `export const getPdpKPIsByCategory = async (dbName, platform, brands, cwStart) => {`;
let replace1 = `export const getPdpKPIsByCategory = async (dbName, platform, brands, cwStart, isRolling = false) => {`;
content = content.replace(target1, replace1);

let target1b = `            weekly_cat AS (
                SELECT
                    \${CATEGORY_EXPR} AS cat,
                    subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS qty,
                    SUM(ifNull(toFloat64OrZero(toString(Selling_Price)), 0) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS gmv,
                    SUM((ifNull(toFloat64OrZero(toString(MRP)), 0) - ifNull(toFloat64OrZero(toString(Selling_Price)), 0)) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS disc_num,
                    SUM(ifNull(toFloat64OrZero(toString(MRP)), 0) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS disc_den,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS osa_num,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS osa_den
                FROM \\\`\${dbName}\\\`.rb_pdp_olap
                CROSS JOIN week_boundaries b
                WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                  AND DATE < b.cw_start + INTERVAL 7 DAY
                  \${platClause}
                  AND (Comp_flag = 0 OR Comp_flag IS NULL)
                  AND Category IS NOT NULL AND trim(Category) != '' AND trim(Category) != '0' AND trim(Category) != '-'
                  AND lower(trim(Category)) NOT IN ('uncategorized', 'other', 'others', 'undefined', 'null')
                  \${brandClause}
                GROUP BY cat, week_start
            ),
            cw AS (
                SELECT w.*
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = b.cw_start
            ),
            l4w AS (
                SELECT
                    w.cat,
                    avg(w.qty) AS qty,
                    avg(w.gmv) AS gmv,
                    sum(w.disc_num) AS disc_num,
                    sum(w.disc_den) AS disc_den,
                    sum(w.osa_num) AS osa_num,
                    sum(w.osa_den) AS osa_den
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start >= b.cw_start - INTERVAL 28 DAY
                  AND w.week_start < b.cw_start
                GROUP BY w.cat
            )`;
let replace1b = `            weekly_cat AS (
                SELECT
                    \${CATEGORY_EXPR} AS cat,
                    \${isRolling ? 'if(DATE >= b.cw_start, \\'cw\\', \\'l4w\\')' : 'subtractDays(DATE, toDayOfWeek(DATE) % 7)'} AS week_start,
                    SUM(ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS qty,
                    SUM(ifNull(toFloat64OrZero(toString(Selling_Price)), 0) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS gmv,
                    SUM((ifNull(toFloat64OrZero(toString(MRP)), 0) - ifNull(toFloat64OrZero(toString(Selling_Price)), 0)) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS disc_num,
                    SUM(ifNull(toFloat64OrZero(toString(MRP)), 0) * ifNull(toFloat64OrZero(toString(Qty_Sold)), 0)) AS disc_den,
                    SUM(ifNull(toFloat64OrZero(toString(neno_osa)), 0)) AS osa_num,
                    SUM(ifNull(toFloat64OrZero(toString(deno_osa)), 0)) AS osa_den
                FROM \\\`\${dbName}\\\`.rb_pdp_olap
                CROSS JOIN week_boundaries b
                WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                  AND DATE < b.cw_start + INTERVAL 7 DAY
                  \${platClause}
                  AND (Comp_flag = 0 OR Comp_flag IS NULL)
                  AND Category IS NOT NULL AND trim(Category) != '' AND trim(Category) != '0' AND trim(Category) != '-'
                  AND lower(trim(Category)) NOT IN ('uncategorized', 'other', 'others', 'undefined', 'null')
                  \${brandClause}
                GROUP BY cat, week_start
            ),
            cw AS (
                SELECT w.*
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = \${isRolling ? '\\'cw\\'' : 'b.cw_start'}
            ),
            l4w AS (
                SELECT
                    w.cat,
                    \${isRolling ? 'sum(w.qty)/4' : 'avg(w.qty)'} AS qty,
                    \${isRolling ? 'sum(w.gmv)/4' : 'avg(w.gmv)'} AS gmv,
                    sum(w.disc_num) AS disc_num,
                    sum(w.disc_den) AS disc_den,
                    sum(w.osa_num) AS osa_num,
                    sum(w.osa_den) AS osa_den
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE \${isRolling ? 'w.week_start = \\'l4w\\'' : 'w.week_start >= b.cw_start - INTERVAL 28 DAY AND w.week_start < b.cw_start'}
                GROUP BY w.cat
            )`;
content = content.replace(target1b, replace1b);

// Function 2: getAdSpendByCategory
let target2 = `export const getAdSpendByCategory = async (dbName, platform, brands, cwStart) => {`;
let replace2 = `export const getAdSpendByCategory = async (dbName, platform, brands, cwStart, isRolling = false) => {`;
content = content.replace(target2, replace2);

let target2b = `            weekly_cat AS (
                SELECT
                    \${CATEGORY_EXPR} AS cat,
                    subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                    SUM(ifNull(toFloat64OrZero(toString(Spends)), 0)) AS spend
                FROM \\\`\${dbName}\\\`.rb_kw_olap
                CROSS JOIN week_boundaries b
                WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                  AND DATE < b.cw_start + INTERVAL 7 DAY
                  \${platClause}
                GROUP BY cat, week_start
            ),
            cw AS (
                SELECT w.cat, sum(w.spend) AS spend
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = b.cw_start
                GROUP BY w.cat
            ),
            l4w AS (
                SELECT w.cat, avg(w.spend) AS spend
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start >= b.cw_start - INTERVAL 28 DAY
                  AND w.week_start < b.cw_start
                GROUP BY w.cat
            )`;
let replace2b = `            weekly_cat AS (
                SELECT
                    \${CATEGORY_EXPR} AS cat,
                    \${isRolling ? 'if(DATE >= b.cw_start, \\'cw\\', \\'l4w\\')' : 'subtractDays(DATE, toDayOfWeek(DATE) % 7)'} AS week_start,
                    SUM(ifNull(toFloat64OrZero(toString(Spends)), 0)) AS spend
                FROM \\\`\${dbName}\\\`.rb_kw_olap
                CROSS JOIN week_boundaries b
                WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                  AND DATE < b.cw_start + INTERVAL 7 DAY
                  \${platClause}
                GROUP BY cat, week_start
            ),
            cw AS (
                SELECT w.cat, sum(w.spend) AS spend
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = \${isRolling ? '\\'cw\\'' : 'b.cw_start'}
                GROUP BY w.cat
            ),
            l4w AS (
                SELECT w.cat, \${isRolling ? 'sum(w.spend)/4' : 'avg(w.spend)'} AS spend
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE \${isRolling ? 'w.week_start = \\'l4w\\'' : 'w.week_start >= b.cw_start - INTERVAL 28 DAY AND w.week_start < b.cw_start'}
                GROUP BY w.cat
            )`;
content = content.replace(target2b, replace2b);

// Function 3: getSOSByCategory
let target3 = `export const getSOSByCategory = async (dbName, platform, cwStart) => {`;
let replace3 = `export const getSOSByCategory = async (dbName, platform, cwStart, isRolling = false) => {`;
content = content.replace(target3, replace3);

let target3b = `            weekly_cat AS (
                SELECT
                    \${catExpr} AS cat,
                    subtractDays(DATE, toDayOfWeek(DATE) % 7) AS week_start,
                    sumIf(ifNull(overall, 0), flag = 1) AS sos_num,
                    sum(ifNull(overall, 0)) AS sos_den
                FROM \\\`\${dbName}\\\`.rb_kw_olap
                CROSS JOIN week_boundaries b
                WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                  AND DATE < b.cw_start + INTERVAL 7 DAY
                  \${platClause}
                GROUP BY cat, week_start
            ),
            cw AS (
                SELECT w.cat, if(sum(w.sos_den) > 0, sum(w.sos_num) / sum(w.sos_den) * 100, 0) AS sos
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = b.cw_start
                GROUP BY w.cat
            ),
            l4w AS (
                SELECT w.cat, if(sum(w.sos_den) > 0, sum(w.sos_num) / sum(w.sos_den) * 100, 0) AS sos
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start >= b.cw_start - INTERVAL 28 DAY
                  AND w.week_start < b.cw_start
                GROUP BY w.cat
            )`;
let replace3b = `            weekly_cat AS (
                SELECT
                    \${catExpr} AS cat,
                    \${isRolling ? 'if(DATE >= b.cw_start, \\'cw\\', \\'l4w\\')' : 'subtractDays(DATE, toDayOfWeek(DATE) % 7)'} AS week_start,
                    sumIf(ifNull(overall, 0), flag = 1) AS sos_num,
                    sum(ifNull(overall, 0)) AS sos_den
                FROM \\\`\${dbName}\\\`.rb_kw_olap
                CROSS JOIN week_boundaries b
                WHERE DATE >= b.cw_start - INTERVAL 28 DAY
                  AND DATE < b.cw_start + INTERVAL 7 DAY
                  \${platClause}
                GROUP BY cat, week_start
            ),
            cw AS (
                SELECT w.cat, if(sum(w.sos_den) > 0, sum(w.sos_num) / sum(w.sos_den) * 100, 0) AS sos
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE w.week_start = \${isRolling ? '\\'cw\\'' : 'b.cw_start'}
                GROUP BY w.cat
            ),
            l4w AS (
                SELECT w.cat, if(sum(w.sos_den) > 0, sum(w.sos_num) / sum(w.sos_den) * 100, 0) AS sos
                FROM weekly_cat w
                CROSS JOIN week_boundaries b
                WHERE \${isRolling ? 'w.week_start = \\'l4w\\'' : 'w.week_start >= b.cw_start - INTERVAL 28 DAY AND w.week_start < b.cw_start'}
                GROUP BY w.cat
            )`;
content = content.replace(target3b, replace3b);

let target4 = `        getPdpKPIsByCategory(dbName, platform, brands, cwStart),
        getAdSpendByCategory(dbName, platform, brands, cwStart),
        getSOSByCategory(dbName, platform, cwStart),`;
let replace4 = `        getPdpKPIsByCategory(dbName, platform, brands, cwStart, isRolling),
        getAdSpendByCategory(dbName, platform, brands, cwStart, isRolling),
        getSOSByCategory(dbName, platform, cwStart, isRolling),`;
content = content.replace(target4, replace4);

fs.writeFileSync(file, content);
