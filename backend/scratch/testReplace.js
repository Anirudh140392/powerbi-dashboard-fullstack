let html = '<!-- {{SUB_TABLES_HTML}} -->';
let subTablesHtml = '<td>$5 OFF</td>';
// Old way
let oldHtml = html.replace(/<!-- \{\{SUB_TABLES_HTML\}\} -->/, subTablesHtml);
// New way
let newHtml = html.replace(/<!-- \{\{SUB_TABLES_HTML\}\} -->/, () => subTablesHtml);
console.log("Old:", oldHtml);
console.log("New:", newHtml);
