with open(r'ds_tester/backend/modules/business_overview.py', 'r', encoding='utf-8') as f:
    text = f.read()

target_start = '        res = driver.execute_script("""\n            const catHeader = Array.from(document.querySelectorAll(\'*\')).find(el => el.innerText && el.innerText.trim().toLowerCase() === \'category performance\');'

replacement = '''        res = driver.execute_script("""
            const catHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase() === 'category performance');
            if (!catHeader) return {};
            const container = catHeader.closest('.grid') || catHeader.closest('div.border') || catHeader.parentElement?.parentElement;
            
            // 1. Try extracting exact live category data via React component fiber
            let fiberKey = Object.keys(container).find(k => k.startsWith('__reactFiber'));
            if (!fiberKey) {
                const child = container.querySelector('*');
                if (child) fiberKey = Object.keys(child).find(k => k.startsWith('__reactFiber'));
            }
            
            let cur = container[fiberKey];
            let rows = null;
            for (let i = 0; i < 40 && cur; i++) {
                if (cur.memoizedProps && Array.isArray(cur.memoizedProps.rows)) {
                    rows = cur.memoizedProps.rows;
                    break;
                }
                cur = cur.return;
            }
            
            if (rows && rows.length > 0) {
                const totOfftake = rows.reduce((acc, r) => acc + (parseFloat(r.offtakes) || 0), 0) / 10000000.0;
                const totSpend = rows.reduce((acc, r) => acc + (parseFloat(r.spend) || 0), 0) / 10000000.0;
                const totInorg = rows.reduce((acc, r) => acc + (parseFloat(r.inorgSalesPct) || 0), 0) / 10000000.0;
                const overallRoas = totSpend > 0 ? (totInorg / totSpend) : null;
                return {
                    category_count: rows.length.toString(),
                    total_offtake: totOfftake.toFixed(2),
                    total_spend: totSpend.toFixed(2),
                    overall_roas: overallRoas ? overallRoas.toFixed(2) : null
                };
            }'''

# Replace from target_start up to 'return {' in that JS block
import re
pattern = r'res = driver\.execute_script\("""\s+const catHeader = Array\.from\(document\.querySelectorAll\(\'\*\'\)\)\.find\(el => el\.innerText && el\.innerText\.trim\(\)\.toLowerCase\(\) === \'category performance\'\);[\s\S]*?return\s*\{[\s\S]*?\};\s*"""\)'

new_code = '''res = driver.execute_script("""
            const catHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase() === 'category performance');
            if (!catHeader) return {};
            const container = catHeader.closest('.grid') || catHeader.closest('div.border') || catHeader.parentElement?.parentElement;
            
            // Extract exact live category data via React component fiber
            let fiberKey = Object.keys(container).find(k => k.startsWith('__reactFiber'));
            if (!fiberKey) {
                const child = container.querySelector('*');
                if (child) fiberKey = Object.keys(child).find(k => k.startsWith('__reactFiber'));
            }
            
            let cur = container[fiberKey];
            let rows = null;
            for (let i = 0; i < 40 && cur; i++) {
                if (cur.memoizedProps && Array.isArray(cur.memoizedProps.rows)) {
                    rows = cur.memoizedProps.rows;
                    break;
                }
                cur = cur.return;
            }
            
            if (rows && rows.length > 0) {
                const totOfftake = rows.reduce((acc, r) => acc + (parseFloat(r.offtakes) || 0), 0) / 10000000.0;
                const totSpend = rows.reduce((acc, r) => acc + (parseFloat(r.spend) || 0), 0) / 10000000.0;
                const totInorg = rows.reduce((acc, r) => acc + (parseFloat(r.inorgSalesPct) || 0), 0) / 10000000.0;
                const overallRoas = totSpend > 0 ? (totInorg / totSpend) : null;
                return {
                    category_count: rows.length.toString(),
                    total_offtake: totOfftake.toFixed(2),
                    total_spend: totSpend.toFixed(2),
                    overall_roas: overallRoas ? overallRoas.toFixed(2) : null
                };
            }
            
            return {};
        """)'''

text = re.sub(pattern, new_code, text)

with open(r'ds_tester/backend/modules/business_overview.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('business_overview.py updated with fiber extractor successfully!')

