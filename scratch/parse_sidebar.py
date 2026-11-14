import re

with open("frontend/src/components/CommonLayout/Sidebar.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Find menuSections
menu_sec_match = re.search(r"const menuSections = ({[\s\S]*?});", content)
if menu_sec_match:
    print("=== menuSections ===")
    print(menu_sec_match.group(1))

# Find other folders or navigation items
print("\n=== All paths and labels found in Sidebar.jsx ===")
items = re.findall(r"label:\s*[\"']([^\"']+)[\"'],\s*path:\s*[\"']([^\"']+)[\"']([^}]*)", content)
for label, path, extra in items:
    print(f"- {label:<25} -> {path:<30} {extra.strip()}")

# Also check any other Navigation links like Watch Tower, Admin, DS Tester, Report Studio, Scheduled Reports
extra_links = re.findall(r"(?:navigate|Link to|path=)[\s\(]*[\"'](/[^\"']+)[\"']", content)
print("\n=== Other route paths in Sidebar.jsx ===")
print(set(extra_links))

