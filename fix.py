import re

with open('backend/src/controllers/reportsController.js', 'r') as f:
    content = f.read()

start_idx = content.find('if (reportType === "Availability Analysis") {')
end_idx = content.find('// 3. Execute Query')

chunk = content[start_idx:end_idx]

chunk = chunk.replace('t.Product_type', 't.${catCol}')
chunk = chunk.replace("col('Product_type')", "col(catCol)")
chunk = chunk.replace("Product_type as Format", "${catCol} as Format")
chunk = chunk.replace("Product_type as Category", "${catCol} as Category")
chunk = chunk.replace("Category\\\\b/g, 'Product_type'", "Category\\\\b/g, catCol")
chunk = chunk.replace("Category\\\\b/g, \\'Product_type\\'", "Category\\\\b/g, catCol")
chunk = chunk.replace("t.Product_type", "t.${catCol}")
chunk = chunk.replace("Product_type, t.Product", "${catCol}, t.Product")
chunk = chunk.replace("Product_type, Product", "${catCol}, Product")
chunk = chunk.replace("Product_type, Location", "${catCol}, Location")
chunk = chunk.replace("Platform, Product_type", "Platform, ${catCol}")
chunk = chunk.replace("Brand, Location, Product_type", "Brand, Location, ${catCol}")
chunk = chunk.replace("match === 'Category' ? 'Product_type' :", "match === 'Category' ? catCol :")
chunk = chunk.replace("AND Product_type =", "AND ${catCol} =")

content = content[:start_idx] + chunk + content[end_idx:]

with open('backend/src/controllers/reportsController.js', 'w') as f:
    f.write(content)

print("Fixed")
