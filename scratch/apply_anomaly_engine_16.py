# -*- coding: utf-8 -*-
import os

engine_path = os.path.join("ds_tester", "backend", "anomaly_engine.py")
with open(engine_path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Add baselines for remaining metrics before '# Units Sold / Quantity'
target1 = """        # Units Sold / Quantity
        if "qty" in k_lower or "unit" in k_lower:"""

replacement1 = """        # Weighted OSA (%)
        if "wt_osa" in k_lower or "weighted_osa" in k_lower or "weighted osa" in k_lower:
            q = f\"\"\"
            SELECT ROUND(SUM(neno_osa * Sales) * 100.0 / nullIf(SUM(deno_osa * Sales), 0), 2)
            FROM {client}.rb_pdp_olap
            WHERE {date_clause} AND Comp_flag = 0 {plat_cond}
            \"\"\"
            try:
                rows = execute_select_query(q)
                if rows and rows[0] and rows[0][0] is not None:
                    return float(rows[0][0])
            except Exception as e:
                logger.error(f"Error fetching WT OSA baseline for {client} {platform}: {e}")
            return None

        # Return on Ad Spend (ROAS)
        if "roas" in k_lower:
            q = f\"\"\"
            SELECT ROUND(SUM(Sales) / nullIf(SUM(Ad_Spend), 0), 2)
            FROM {client}.rb_pdp_olap
            WHERE {date_clause} AND Comp_flag = 0 {plat_cond}
            \"\"\"
            try:
                rows = execute_select_query(q)
                if rows and rows[0] and rows[0][0] is not None:
                    return float(rows[0][0])
            except Exception as e:
                logger.error(f"Error fetching ROAS baseline for {client} {platform}: {e}")
            return None

        # Listing Coverage %
        if "listing" in k_lower:
            q = f\"\"\"
            SELECT ROUND(countDistinctIf(SKU_Code, neno_osa > 0) * 100.0 / nullIf(countDistinct(SKU_Code), 0), 2)
            FROM {client}.rb_pdp_olap
            WHERE {date_clause} AND Comp_flag = 0 {plat_cond}
            \"\"\"
            try:
                rows = execute_select_query(q)
                if rows and rows[0] and rows[0][0] is not None:
                    return float(rows[0][0])
            except Exception as e:
                logger.error(f"Error fetching Listing baseline for {client} {platform}: {e}")
            return None

        # Inorganic Sales / Ad Sales
        if "inorganic" in k_lower:
            q = f\"\"\"
            SELECT ROUND(SUM(toFloat64OrZero(toString(Ad_sales))) / 30.0, 2)
            FROM {client}.rb_pdp_olap
            WHERE {date_clause} AND Comp_flag = 0 {plat_cond}
            \"\"\"
            try:
                rows = execute_select_query(q)
                if rows and rows[0] and rows[0][0] is not None:
                    return float(rows[0][0])
            except Exception as e:
                logger.error(f"Error fetching Inorganic Sales baseline for {client} {platform}: {e}")
            return None

        # Units Sold / Quantity
        if "qty" in k_lower or "unit" in k_lower:"""

assert target1 in text, "target1 not found in anomaly_engine.py"
text = text.replace(target1, replacement1, 1)

# 2. Update evaluate_verified_run canonical_metric mappings
target2 = """            # Anomaly Decision Gate (Strict 10% maximum threshold constraint)
            if abs_dev >= ANOMALY_THRESHOLD_PCT:
                if "osa" in kpi_key or "on shelf availability" in kpi_label.lower():
                    canonical_metric = "osa"
                elif "asp" in kpi_key or "price" in kpi_key or "sp" in kpi_key:
                    canonical_metric = "asp_ppu"
                elif "discount" in kpi_key or "discount" in kpi_label.lower():
                    canonical_metric = "discount"
                elif "spend" in kpi_key:
                    canonical_metric = "ad_spend"
                elif "qty" in kpi_key or "unit" in kpi_key:
                    canonical_metric = "qty_sold"
                elif any(w in kpi_key.lower() or w in kpi_label.lower() for w in ["sos", "sov", "visibility", "organic", "sponsored"]):
                    canonical_metric = "media_visibility"
                else:
                    canonical_metric = "offtakes" """

if target2 not in text:
    target2 = """            # Anomaly Decision Gate (Strict 10% maximum threshold constraint)
            if abs_dev >= ANOMALY_THRESHOLD_PCT:
                if "osa" in kpi_key or "on shelf availability" in kpi_label.lower():
                    canonical_metric = "osa"
                elif "asp" in kpi_key or "price" in kpi_key or "sp" in kpi_key:
                    canonical_metric = "asp_ppu"
                elif "discount" in kpi_key or "discount" in kpi_label.lower():
                    canonical_metric = "discount"
                elif "spend" in kpi_key:
                    canonical_metric = "ad_spend"
                elif "qty" in kpi_key or "unit" in kpi_key:
                    canonical_metric = "qty_sold"
                elif any(w in kpi_key.lower() or w in kpi_label.lower() for w in ["sos", "sov", "visibility", "organic", "sponsored"]):
                    canonical_metric = "media_visibility"
                else:
                    canonical_metric = "offtakes" """

# Let's check with rstrip
lines = text.splitlines(True)
idx = -1
for i, l in enumerate(lines):
    if "if abs_dev >= ANOMALY_THRESHOLD_PCT:" in l:
        idx = i
        break

assert idx >= 0, "Could not find abs_dev >= ANOMALY_THRESHOLD_PCT"
# Find where decomp = self.decompose_hierarchical_variance is
idx_decomp = -1
for i in range(idx, idx + 30):
    if "decomp = self.decompose_hierarchical_variance" in lines[i]:
        idx_decomp = i
        break

assert idx_decomp >= 0, "Could not find decomp = self.decompose_hierarchical_variance"

new_canonical_block = [
    "            # Anomaly Decision Gate (Strict 10% maximum threshold constraint)\n",
    "            if abs_dev >= ANOMALY_THRESHOLD_PCT:\n",
    "                if \"wt_osa\" in kpi_key or \"weighted_osa\" in kpi_key or \"weighted osa\" in kpi_label.lower():\n",
    "                    canonical_metric = \"wt_osa\"\n",
    "                elif \"osa\" in kpi_key or \"on shelf availability\" in kpi_label.lower():\n",
    "                    canonical_metric = \"osa\"\n",
    "                elif \"discount\" in kpi_key or \"discount\" in kpi_label.lower():\n",
    "                    canonical_metric = \"discount\"\n",
    "                elif \"roas\" in kpi_key or \"roas\" in kpi_label.lower():\n",
    "                    canonical_metric = \"roas\"\n",
    "                elif \"inorganic\" in kpi_key or \"inorganic\" in kpi_label.lower():\n",
    "                    canonical_metric = \"inorganic_sale\"\n",
    "                elif \"spend\" in kpi_key:\n",
    "                    canonical_metric = \"ad_spend\"\n",
    "                elif \"qty\" in kpi_key or \"unit\" in kpi_key:\n",
    "                    canonical_metric = \"qty_sold\"\n",
    "                elif \"asp\" in kpi_key or \"selling price\" in kpi_label.lower() or \"price\" in kpi_key or \"sp\" in kpi_key:\n",
    "                    canonical_metric = \"asp_ppu\"\n",
    "                elif \"listing\" in kpi_key or \"listing\" in kpi_label.lower():\n",
    "                    canonical_metric = \"listing_percent\"\n",
    "                elif \"market_share\" in kpi_key or \"mkt_share\" in kpi_key or \"market share\" in kpi_label.lower():\n",
    "                    canonical_metric = \"market_share\"\n",
    "                elif \"cat_size\" in kpi_key or \"category size\" in kpi_label.lower():\n",
    "                    canonical_metric = \"cat_size\"\n",
    "                elif \"conversion\" in kpi_key or \"conversion\" in kpi_label.lower():\n",
    "                    canonical_metric = \"conversion\"\n",
    "                elif \"ad_sos\" in kpi_key or \"sponsored\" in kpi_label.lower() or \"ad sos\" in kpi_label.lower():\n",
    "                    canonical_metric = \"ad_sos\"\n",
    "                elif \"organic_sos\" in kpi_key or \"organic sos\" in kpi_label.lower():\n",
    "                    canonical_metric = \"organic_sos\"\n",
    "                elif any(w in kpi_key.lower() or w in kpi_label.lower() for w in [\"sos\", \"sov\", \"visibility\", \"share of search\", \"share of voice\"]):\n",
    "                    canonical_metric = \"sos\"\n",
    "                else:\n",
    "                    canonical_metric = \"offtakes\"\n",
    "\n"
]

lines = lines[:idx] + new_canonical_block + lines[idx_decomp:]
text = "".join(lines)

with open(engine_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Baseline and canonical metric mapping applied successfully.")
