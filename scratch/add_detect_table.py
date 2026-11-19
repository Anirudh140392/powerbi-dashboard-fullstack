with open('backend/src/services/contentAnalysisService.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Check if detectContentTable is already defined
if "const detectContentTable = async () => {" not in text:
    detect_fn = """
const detectContentTable = async () => {
    const verifyExists = await queryClickHouse("EXISTS TABLE rb_product_verify");
    if (verifyExists && verifyExists[0]?.result === 1) {
        return "rb_product_verify";
    }
    const olapExists = await queryClickHouse("EXISTS TABLE rb_content_olap");
    if (olapExists && olapExists[0]?.result === 1) {
        return "rb_content_olap";
    }
    return null;
};
"""
    # Insert after calculateOverallScore
    target = "return scores.reduce((a, b) => a + b, 0) / scores.length;\n};"
    if target in text:
        text = text.replace(target, target + "\n" + detect_fn)
        print("Added detectContentTable")
    else:
        print("Could not find insertion point for detectContentTable")

with open('backend/src/services/contentAnalysisService.js', 'w', encoding='utf-8') as f:
    f.write(text)

