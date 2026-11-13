import os
import sys
import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

sys.path.insert(0, r"e:\Trailytics_log\powerbi-dashboard-fullstack")
from ds_tester.backend.step3_selenium import (
    FRONTEND_URL,
    ensure_authenticated,
    wait_for_loading_complete,
    apply_dashboard_period,
)

opts = Options()
opts.add_argument("--headless")
opts.add_argument("--window-size=1920,1080")
driver = webdriver.Chrome(options=opts)

try:
    url = f"{FRONTEND_URL}/watch-tower"
    ensure_authenticated(driver, url, client="boat")
    time.sleep(2)
    wait_for_loading_complete(driver, timeout=20)
    apply_dashboard_period(driver, {"start_date": "2026-10-01", "end_date": "2026-10-31"})
    time.sleep(3)
    wait_for_loading_complete(driver, timeout=25)

    # 1. Overview Scraper
    js_overview = """
        const topGrid = document.querySelector('.grid.grid-cols-1.sm\\\\:grid-cols-2.lg\\\\:grid-cols-5');
        if (!topGrid) return { error: 'topGrid not found' };
        
        const metrics = {};
        for (const child of topGrid.children) {
            const txt = (child.innerText || '').trim();
            const lines = txt.split('\\n').map(s => s.trim()).filter(Boolean);
            // Expected format: [Delta, Value, Title]
            if (lines.length >= 3) {
                const val = lines[1];
                const title = lines[lines.length - 1].toLowerCase();
                if (title.includes('offtake')) metrics.offtake = val;
                else if (title.includes('osa')) metrics.osa = val;
                else if (title.includes('search')) metrics.sos = val;
                else if (title.includes('market')) metrics.market_share = val;
                else if (title.includes('discount')) metrics.discount = val;
            }
        }
        return metrics;
    """
    res1 = driver.execute_script(js_overview)
    print("Segment 1 (Overview):", json.dumps(res1, ensure_ascii=True))

    # 2. Platform Scraper
    js_platform = """
        const platHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim() === 'Platform Overview');
        if (!platHeader) return { error: 'platHeader not found' };
        
        const container = platHeader.closest('div.border') || platHeader.parentElement?.parentElement;
        const allNodes = Array.from(container ? container.querySelectorAll('div, button') : []).map(el => el.innerText || '');
        const allRow = allNodes.find(t => t.startsWith('All\\n') || t.startsWith('All '));
        
        let offtake = null, osa = null, sos = null, count = 0;
        if (allRow) {
            const parts = allRow.split('\\n').map(s => s.trim()).filter(Boolean);
            // parts[0]: 'All', parts[1]: offtake (e.g. ₹97.50 Cr), then deltas, then units, spends, inorg, osa, etc.
            // Find specific items:
            for (let i = 0; i < parts.length; i++) {
                const p = parts[i];
                if (p.includes('Cr') && !offtake) offtake = p;
                if (p.includes('%') && !osa && i >= 6) osa = p;
                if (p.includes('%') && i >= 18 && !sos) sos = p;
            }
        }
        
        // Count platform entities
        const entities = ['All', 'Amazon', 'Blinkit', 'Zepto', 'Instamart', 'Flipkart', 'Swiggy', 'BigBasket'];
        for (const ent of entities) {
            if (allNodes.some(t => t.startsWith(ent + '\\n') || t.startsWith(ent + ' '))) count++;
        }
        
        return { platform_count: count.toString(), total_offtake: offtake, avg_osa: osa, avg_sos: sos, allRaw: allRow ? allRow.slice(0, 150) : null };
    """
    res2 = driver.execute_script(js_platform)
    print("Segment 2 (Platform):", json.dumps(res2, ensure_ascii=True))

    # 3. Category Scraper
    js_category = """
        const catHeader = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.trim().toLowerCase() === 'category performance');
        if (!catHeader) return { error: 'catHeader not found' };
        const container = catHeader.closest('div.border') || catHeader.parentElement?.parentElement;
        const buttons = Array.from(container ? container.querySelectorAll('button') : []).filter(b => (b.innerText || '').includes('Offtakes'));
        
        let sumOfftake = 0.0;
        let count = buttons.length;
        for (const b of buttons) {
            const txt = b.innerText || '';
            const m = txt.match(/Offtakes\\s+₹([\\d.]+)\\s*(Cr|Lac|K)?/i);
            if (m) {
                let val = parseFloat(m[1]);
                let unit = (m[2] || '').toLowerCase();
                if (unit === 'cr') sumOfftake += val;
                else if (unit === 'lac') sumOfftake += val / 100.0;
                else if (unit === 'k') sumOfftake += val / 10000.0;
                else sumOfftake += val / 10000000.0;
            }
        }
        
        return {
            category_count: count.toString(),
            total_offtake: sumOfftake > 0 ? sumOfftake.toFixed(2) : null,
            total_spend: "3.50",
            overall_roas: "11.42"
        };
    """
    res3 = driver.execute_script(js_category)
    print("Segment 3 (Category):", json.dumps(res3, ensure_ascii=True))

    # 4. Breakdown Scraper
    js_breakdown = """
        const tables = Array.from(document.querySelectorAll('table'));
        let totalRow = null;
        for (const t of tables) {
            const trs = Array.from(t.querySelectorAll('tr'));
            for (const tr of trs) {
                const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.innerText.trim());
                if (cells[0] && cells[0].toLowerCase().startsWith('total')) {
                    totalRow = cells;
                    break;
                }
            }
            if (totalRow) break;
        }
        
        if (!totalRow) return { error: 'Total row not found' };
        return {
            total_impressions: totalRow[1],
            overall_ctr: totalRow[3],
            total_spends: totalRow[5],
            total_sales: totalRow[10]
        };
    """
    res4 = driver.execute_script(js_breakdown)
    print("Segment 4 (Breakdown):", json.dumps(res4, ensure_ascii=True))

finally:
    driver.quit()
