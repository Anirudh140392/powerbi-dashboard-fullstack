const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'contentAnalysisService.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace lower(...) cases
content = content.replace(/lower\(Platform\)/g, "lower(platform)");
content = content.replace(/lower\(Channel\)/g, "lower(channel)");
content = content.replace(/lower\(Category\)/g, "lower(category)");
content = content.replace(/lower\(Brand\)/g, "lower(brand)");
content = content.replace(/lower\(City\)/g, "lower(city)");

// Replace SELECT columns with AS aliases to maintain JS backward compatibility
content = content.replace(/SELECT DISTINCT Platform/g, "SELECT DISTINCT platform AS Platform");
content = content.replace(/SELECT DISTINCT Category/g, "SELECT DISTINCT category AS Category");
content = content.replace(/SELECT DISTINCT Brand/g, "SELECT DISTINCT brand AS Brand");

// Replace Where clauses
content = content.replace(/Platform !=/g, "platform !=");
content = content.replace(/Category !=/g, "category !=");
content = content.replace(/Brand !=/g, "brand !=");

// Replace Group/Order
content = content.replace(/GROUP BY Platform/g, "GROUP BY platform");
content = content.replace(/ORDER BY Platform/g, "ORDER BY platform");
content = content.replace(/ORDER BY Category/g, "ORDER BY category");
content = content.replace(/ORDER BY Brand/g, "ORDER BY brand");

// Replace general references
content = content.replace(/Platform as platform,/g, "platform as platform,");
content = content.replace(/Platform,/g, "platform AS Platform,"); // Be careful with this one, but looking at query it's only in SELECT Platform, AVG(...)
content = content.replace(/city as zone/g, "city as zone");

fs.writeFileSync(filePath, content, 'utf8');
console.log("Replaced successfully!");
