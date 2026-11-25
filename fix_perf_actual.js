const fs = require('fs');
let code = fs.readFileSync('backend/src/services/categoryPerfSummaryDataService.js', 'utf8');

function updateQuery(code) {
    // 1. Add isRolling parameter
    code = code.replace(/export const getPdpKPIsByCategory = async \(dbName, platform, brands, cwStart\) => \{/, 
                        'export const getPdpKPIsByCategory = async (dbName, platform, brands, cwStart, isRolling = false) => {');
    
    code = code.replace(/export const getAdSpendByCategory = async \(dbName, platform, brands, cwStart\) => \{/, 
                        'export const getAdSpendByCategory = async (dbName, platform, brands, cwStart, isRolling = false) => {');
                        
    code = code.replace(/export const getSOSByCategory = async \(dbName, platform, cwStart\) => \{/, 
                        'export const getSOSByCategory = async (dbName, platform, cwStart, isRolling = false) => {');

    // 2. Pass isRolling in fetchAllPlatformCategoryKPIs
    let fetchCallsOld = `getPdpKPIsByCategory(dbName, platform, brands, cwStart),
        getAdSpendByCategory(dbName, platform, brands, cwStart),
        getSOSByCategory(dbName, platform, cwStart),`;
    let fetchCallsNew = `getPdpKPIsByCategory(dbName, platform, brands, cwStart, isRolling),
        getAdSpendByCategory(dbName, platform, brands, cwStart, isRolling),
        getSOSByCategory(dbName, platform, cwStart, isRolling),`;
    code = code.replace(fetchCallsOld, fetchCallsNew);

    // 3. Update getPdpKPIsByCategory SQL
    // Replace week_start in weekly_cat
    code = code.replace(/subtractDays\(DATE, toDayOfWeek\(DATE\) % 7\) AS week_start,(\s+SUM\(ifNull\(toFloat64OrZero\(toString\(Qty_Sold\)\), 0\)\) AS qty,)/g, 
        "${isRolling ? `if(DATE >= b.cw_start, 'cw', 'l4w')` : `subtractDays(DATE, toDayOfWeek(DATE) % 7)`} AS week_start,$1");

    // Replace cw WHERE
    code = code.replace(/WHERE w\.week_start = b\.cw_start(\s+\),)/g,
        "WHERE w.week_start = ${isRolling ? `'cw'` : `b.cw_start`}$1");

    // Replace l4w AS avg
    code = code.replace(/avg\(w\.qty\) AS qty,\s+avg\(w\.gmv\) AS gmv,/g,
        "${isRolling ? `sum(w.qty)/4` : `avg(w.qty)`} AS qty,\n                    ${isRolling ? `sum(w.gmv)/4` : `avg(w.gmv)`} AS gmv,");

    // Replace l4w WHERE
    code = code.replace(/WHERE w\.week_start >= b\.cw_start - INTERVAL 28 DAY\s+AND w\.week_start < b\.cw_start(\s+GROUP BY w\.cat)/g,
        "WHERE ${isRolling ? `w.week_start = 'l4w'` : `w.week_start >= b.cw_start - INTERVAL 28 DAY AND w.week_start < b.cw_start`}$1");

    // 4. Update getAdSpendByCategory SQL
    code = code.replace(/subtractDays\(DATE, toDayOfWeek\(DATE\) % 7\) AS week_start,(\s+SUM\(ifNull\(toFloat64OrZero\(toString\(Spends\)\), 0\)\) AS spend)/g, 
        "${isRolling ? `if(DATE >= b.cw_start, 'cw', 'l4w')` : `subtractDays(DATE, toDayOfWeek(DATE) % 7)`} AS week_start,$1");

    // Replace cw spend WHERE (already covered by generic w.week_start = b.cw_start if it was identical, but let's be careful, getAdSpend uses w.week_start = b.cw_start)
    // Wait, the generic regex for `w.week_start = b.cw_start` might have caught it. Let's see how many times it was caught by looking at output.
    
    // Replace l4w avg spend
    code = code.replace(/avg\(w\.spend\) AS spend/g, 
        "${isRolling ? `sum(w.spend)/4` : `avg(w.spend)`} AS spend");

    // 5. Update getSOSByCategory SQL
    code = code.replace(/subtractDays\(DATE, toDayOfWeek\(DATE\) % 7\) AS week_start,(\s+sumIf\(ifNull\(overall, 0\), flag = 1\) AS sos_num,)/g, 
        "${isRolling ? `if(DATE >= b.cw_start, 'cw', 'l4w')` : `subtractDays(DATE, toDayOfWeek(DATE) % 7)`} AS week_start,$1");

    // The other replaces for WHERE w.week_start = b.cw_start and l4w WHERE should have globally matched across all 3 queries because I used /g!

    return code;
}

let newCode = updateQuery(code);
fs.writeFileSync('backend/src/services/categoryPerfSummaryDataService.js', newCode);
console.log("Updated categoryPerfSummaryDataService.js successfully!");
