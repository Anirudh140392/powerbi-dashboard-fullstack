import sys, os

path = 'frontend/src/utils/FilterContext.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

helper = """// Static fallback data (used if API is unreachable)
const FALLBACK_PLATFORMS = ["Blinkit", "Zepto", "Instamart"];
const FALLBACK_CATEGORIES = ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
const FALLBACK_LOCATIONS = [];
const FALLBACK_BRANDS = [];
const FALLBACK_CHANNELS = []; // Dynamic — fetched from rca_sku_dim / rb_pdp_olap on mount

export const normalizePlatformMatch = (p, list) => {
    if (!p || !Array.isArray(list) || list.length === 0) return null;
    const clean = String(p).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return list.find(item => String(item).trim().toLowerCase().replace(/[^a-z0-9]/g, '') === clean) || null;
};"""

old_fallback = """// Static fallback data (used if API is unreachable)
const FALLBACK_PLATFORMS = ["Blinkit", "Zepto", "Instamart"];
const FALLBACK_CATEGORIES = ["Chocolates (Gifting)", "Chocolates (Non Gifting)", "GMFC"];
const FALLBACK_LOCATIONS = [];
const FALLBACK_BRANDS = [];
const FALLBACK_CHANNELS = []; // Dynamic — fetched from rca_sku_dim / rb_pdp_olap on mount"""

if old_fallback in text:
    text = text.replace(old_fallback, helper)
    print("Replaced fallback & added normalizePlatformMatch")

# Replace validation occurrences
old_v1 = "const valid = currentList.filter(p => newPlatforms.includes(p));"
new_v1 = "const valid = currentList.map(p => normalizePlatformMatch(p, newPlatforms)).filter(Boolean);"
if old_v1 in text:
    text = text.replace(old_v1, new_v1)
    print("Replaced v1")

old_v2 = "const validPlatforms = currentList.filter(p => res.data.includes(p));"
new_v2 = "const validPlatforms = currentList.map(p => normalizePlatformMatch(p, res.data)).filter(Boolean);"
if old_v2 in text:
    text = text.replace(old_v2, new_v2)
    print("Replaced v2")

old_v3 = "const valid = currentList.filter(p => res.data.includes(p));"
new_v3 = "const valid = currentList.map(p => normalizePlatformMatch(p, res.data)).filter(Boolean);"
if old_v3 in text:
    text = text.replace(old_v3, new_v3)
    print("Replaced v3")

# Also update handlePlat event listener
old_plat_listener = """        const handlePlat = (e) => {
            if (e.detail) {
                setPlatform(e.detail);
            }
        };"""
new_plat_listener = """        const handlePlat = (e) => {
            if (e.detail) {
                const matched = normalizePlatformMatch(e.detail, platforms);
                setPlatform(matched || e.detail);
            }
        };"""
if old_plat_listener in text:
    text = text.replace(old_plat_listener, new_plat_listener)
    print("Replaced handlePlat listener")

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("FilterContext.jsx updated successfully!")
