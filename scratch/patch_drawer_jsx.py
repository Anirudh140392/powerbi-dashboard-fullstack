# -*- coding: utf-8 -*-
import os

drawer_path = os.path.join("ds_tester", "frontend", "KpiAnomalyChartDrawer.jsx")
with open(drawer_path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Replace resolveMetricKey
old_resolve = """  const resolveMetricKey = (key) => {
    if (!key) return "offtakes";
    const k = key.toLowerCase();
    if (k.includes("osa")) return "osa";
    if (k.includes("offtake") || k.includes("sale")) return "offtakes";
    if (k.includes("qty") || k.includes("unit")) return "qty_sold";
    if (k.includes("spend")) return "ad_spend";
    if (k.includes("price") || k.includes("sp") || k.includes("asp")) return "asp_ppu";
    return "offtakes";
  };"""

new_resolve = """  const resolveMetricKey = (key) => {
    if (!key) return anomalyData?.metric || "offtakes";
    const k = key.toLowerCase();
    if (k.includes("discount")) return "discount";
    if (k.includes("wt_osa") || k.includes("weighted_osa") || k.includes("weighted osa")) return "wt_osa";
    if (k.includes("ad_sos") || k.includes("ad sos") || k.includes("sponsored")) return "ad_sos";
    if (k.includes("organic_sos") || k.includes("organic sos")) return "organic_sos";
    if (k.includes("overall_sov") || k.includes("overall sov") || k.includes("sov")) return "overall_sov";
    if (k.includes("sos") || k.includes("search")) return "sos";
    if (k.includes("osa") || k.includes("availability")) return "osa";
    if (k.includes("roas")) return "roas";
    if (k.includes("listing")) return "listing_percent";
    if (k.includes("conversion")) return "conversion";
    if (k.includes("mkt_share") || k.includes("market_share") || k.includes("market share")) return "market_share";
    if (k.includes("cat_size") || k.includes("category size") || k.includes("category_size")) return "cat_size";
    if (k.includes("inorganic")) return "inorganic_sale";
    if (k.includes("spend")) return "ad_spend";
    if (k.includes("qty") || k.includes("unit")) return "qty_sold";
    if (k.includes("price") || k.includes("sp") || k.includes("asp") || k.includes("ppu")) return "asp_ppu";
    if (k.includes("offtake") || k.includes("sale") || k.includes("revenue")) return "offtakes";
    return anomalyData?.metric || "offtakes";
  };

  const getMetricHeaderLabel = () => {
    switch (metric) {
      case "discount": return "Average Discount (%)";
      case "wt_osa": return "Weighted OSA (%)";
      case "osa": return "On-Shelf Availability (%)";
      case "ad_sos": return "Ad / Sponsored SOS (%)";
      case "organic_sos": return "Organic SOS (%)";
      case "overall_sov": return "Overall SOV (%)";
      case "sos": return "Share of Search (%)";
      case "roas": return "ROAS (x)";
      case "listing_percent": return "Listing Coverage (%)";
      case "conversion": return "Conversion Rate (%)";
      case "market_share": return "Market Share (%)";
      case "cat_size": return "Category Size (₹)";
      case "inorganic_sale": return "Inorganic Sales (₹)";
      case "ad_spend": return "Ad Spend (₹)";
      case "qty_sold": return "Units Sold";
      case "asp_ppu": return "Average Selling Price (₹)";
      default: return "Sales Contribution";
    }
  };

  const getRowMetricVal = (row) => {
    if (!row) return 0;
    if (metric === "discount") return row.discount ?? row.value;
    if (metric === "osa") return row.osa ?? row.value;
    if (metric === "wt_osa") return row.wt_osa ?? row.osa ?? row.value;
    if (metric === "sos") return row.sos ?? row.value;
    if (metric === "ad_sos") return row.ad_sos ?? row.value;
    if (metric === "organic_sos") return row.organic_sos ?? row.value;
    if (metric === "roas") return row.roas ?? row.value;
    if (metric === "qty_sold") return row.qty ?? row.value;
    if (metric === "asp_ppu") return row.asp ?? row.value;
    if (metric === "ad_spend") return row.spend ?? row.value;
    if (metric === "inorganic_sale") return row.inorg_sales ?? row.value;
    return row.value !== undefined && row.value !== null ? row.value : row.sales;
  };"""

assert old_resolve in text, "old_resolve not found"
text = text.replace(old_resolve, new_resolve, 1)

# 2. Replace formatNumber
old_fmt = """  const formatNumber = (val) => {
    if (val === null || val === undefined) return "—";
    const num = Number(val);
    if (isNaN(num)) return val;
    if (metric === "osa") return `${num.toFixed(1)}%`;
    if (metric === "offtakes" || metric === "ad_spend" || metric === "asp_ppu") {
      if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
      if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
      return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;
    }
    return num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  };"""

new_fmt = """  const formatNumber = (val, metricOverride) => {
    if (val === null || val === undefined) return "—";
    const num = Number(val);
    if (isNaN(num)) return val;
    const m = metricOverride || metric;
    if (
      m === "discount" ||
      m === "osa" ||
      m === "wt_osa" ||
      m === "sos" ||
      m === "ad_sos" ||
      m === "organic_sos" ||
      m === "overall_sov" ||
      m === "listing_percent" ||
      m === "market_share" ||
      m === "conversion"
    ) {
      return `${num.toFixed(1)}%`;
    }
    if (m === "roas") {
      return `${num.toFixed(2)}x`;
    }
    if (m === "asp_ppu") {
      return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
    }
    if (m === "qty_sold") {
      if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M units`;
      if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}k units`;
      return `${Math.round(num).toLocaleString("en-IN")} units`;
    }
    if (m === "offtakes" || m === "ad_spend" || m === "inorganic_sale" || m === "cat_size") {
      if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
      if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
      return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;
    }
    return num.toLocaleString("en-IN", { maximumFractionDigits: 1 });
  };"""

assert old_fmt in text, "old_fmt not found"
text = text.replace(old_fmt, new_fmt, 1)

# 3. Enhance generateExecutiveStory
old_story = """    if (metric === "osa" || (metric === "offtakes" && verifiedDevPct < -10)) {"""
new_story = """    if (metric === "discount") {
      return (
        <span>
          <strong>{clientName}</strong> Average Discount on <strong>{platformName}</strong> {dir} by{" "}
          <strong style={{ color: "#dc2626" }}>{devAbs}%</strong> vs. the 30-day baseline of{" "}
          <strong>{formatNumber(verifiedBaseline, "discount")}</strong>, breaching the 10% maximum tolerance boundary.
          {topCity?.name && (
            <span>
              {" "}The promotional discount shift is concentrated in <strong>{locationName}</strong> on <strong>{platformName}</strong>
              {topCity.discount !== undefined && (
                <span> (where average discount is <strong style={{ color: isAnomaly ? "#dc2626" : "#16a34a" }}>{topCity.discount}%</strong>)</span>
              )}.
            </span>
          )}
          {topSku?.product && (
            <span> Primary SKU margin impact on <em>"{skuName}"</em> {skuPid ? `(${skuPid})` : ""} across distribution hubs.</span>
          )}
        </span>
      );
    }

    if (metric === "sos" || metric === "ad_sos" || metric === "organic_sos" || metric === "overall_sov") {
      return (
        <span>
          <strong>{clientName}</strong> {kpiLabel || "Share of Search (SOS)"} on <strong>{platformName}</strong> {dir} by{" "}
          <strong style={{ color: "#dc2626" }}>{devAbs}%</strong> vs. the 30-day baseline of{" "}
          <strong>{formatNumber(verifiedBaseline, metric)}</strong>, breaching the 10% tolerance boundary.
          {topCity?.name && (
            <span>
              {" "}Visibility variation is concentrated in <strong>{locationName}</strong> on <strong>{platformName}</strong>.
            </span>
          )}
          {topSku?.product && (
            <span> Primary impacted listing: <em>"{skuName}"</em> {skuPid ? `(${skuPid})` : ""} in search results.</span>
          )}
        </span>
      );
    }

    if (metric === "osa" || metric === "wt_osa" || (metric === "offtakes" && verifiedDevPct < -10)) {"""

assert old_story in text, "old_story not found"
text = text.replace(old_story, new_story, 1)

# 4. Update Level 1 table
old_l1 = """                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Platform</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Sales Contribution</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Share (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>OSA (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level1_platforms || []).map((p) => {
                        const isTargetAnomaly = detectedPlatform && (p.raw_name?.toLowerCase() === detectedPlatform.toLowerCase() || p.name?.toLowerCase().includes(detectedPlatform.toLowerCase()));
                        const isBreach = p.osa < 70;
                        return (
                          <TableRow key={p.name} sx={{ bgcolor: isTargetAnomaly ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isTargetAnomaly ? "#dc2626" : "#2563eb", fontWeight: 800, textTransform: "capitalize" }}>
                              {formatPlatform(p.name)}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace" }}>
                              {formatNumber(p.value)}
                            </TableCell>
                            <TableCell sx={{ color: "#475569" }}>{p.share_pct}%</TableCell>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                              {p.osa}%
                            </TableCell>
                            <TableCell>
                              {isTargetAnomaly ? (
                                <Chip label="ANOMALY DETECTED (TARGET)" size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : isBreach ? (
                                <Chip label={`ANOMALY DETECTED: LOW OSA (${p.osa}%)`} size="small" sx={{ bgcolor: "#fef2f2", color: "#b91c1c", fontWeight: 700, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}"""

new_l1 = """                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Platform</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>{getMetricHeaderLabel()}</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Sales Contribution</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Share (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level1_platforms || []).map((p) => {
                        const isTargetAnomaly = detectedPlatform && (p.raw_name?.toLowerCase() === detectedPlatform.toLowerCase() || p.name?.toLowerCase().includes(detectedPlatform.toLowerCase()));
                        const isBreach = p.is_breach !== undefined ? p.is_breach : (p.osa < 70);
                        const rowMetric = getRowMetricVal(p);
                        return (
                          <TableRow key={p.name} sx={{ bgcolor: isTargetAnomaly || isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isTargetAnomaly ? "#dc2626" : "#2563eb", fontWeight: 800, textTransform: "capitalize" }}>
                              {formatPlatform(p.name)}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: 700 }}>
                              {formatNumber(rowMetric, metric)}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace" }}>
                              {formatNumber(p.sales, "offtakes")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569" }}>{p.share_pct}%</TableCell>
                            <TableCell>
                              {isTargetAnomaly ? (
                                <Chip label="ANOMALY DETECTED (TARGET)" size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : p.status_label ? (
                                <Chip label={p.status_label} size="small" sx={{ bgcolor: isBreach ? "#fef2f2" : "#f0fdf4", color: isBreach ? "#b91c1c" : "#16a34a", fontWeight: 700, fontSize: "10px" }} />
                              ) : isBreach ? (
                                <Chip label={`ANOMALY DETECTED: (${p.osa}%)`} size="small" sx={{ bgcolor: "#fef2f2", color: "#b91c1c", fontWeight: 700, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}"""

assert old_l1 in text, "old_l1 not found"
text = text.replace(old_l1, new_l1, 1)

# 5. Update Level 2 table
old_l2 = """                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>City / Location</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Sales</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Share (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>City OSA (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level2_cities || []).map((c) => {
                        const isBreach = c.osa < 70;
                        return (
                          <TableRow key={c.name} sx={{ bgcolor: isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#0f172a", fontWeight: 700, textTransform: "capitalize" }}>
                              {formatLocation(c.name)}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace" }}>
                              {formatNumber(c.value)}
                            </TableCell>
                            <TableCell sx={{ color: "#475569" }}>{c.share_pct}%</TableCell>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                              {c.osa}%
                            </TableCell>
                            <TableCell>
                              {isBreach ? (
                                <Chip label={`ANOMALY DETECTED: LOW OSA (${c.osa}%)`} size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}"""

new_l2 = """                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>City / Location</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>{getMetricHeaderLabel()}</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Sales</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Share (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level2_cities || []).map((c) => {
                        const isBreach = c.is_breach !== undefined ? c.is_breach : (c.osa < 70);
                        const rowMetric = getRowMetricVal(c);
                        return (
                          <TableRow key={c.name} sx={{ bgcolor: isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#0f172a", fontWeight: 700, textTransform: "capitalize" }}>
                              {formatLocation(c.name)}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: 700 }}>
                              {formatNumber(rowMetric, metric)}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace" }}>
                              {formatNumber(c.sales, "offtakes")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569" }}>{c.share_pct}%</TableCell>
                            <TableCell>
                              {c.status_label ? (
                                <Chip label={c.status_label} size="small" sx={{ bgcolor: isBreach ? "#fee2e2" : "#f0fdf4", color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 800, fontSize: "10px" }} />
                              ) : isBreach ? (
                                <Chip label={`ANOMALY DETECTED: (${c.osa}%)`} size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}"""

assert old_l2 in text, "old_l2 not found"
text = text.replace(old_l2, new_l2, 1)

# 6. Update Level 3 table
old_l3 = """                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Brand</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Classification</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Sales</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level3_brands || []).map((b) => (
                        <TableRow key={b.name}>
                          <TableCell sx={{ color: "#0f172a", fontWeight: 700 }}>{b.name}</TableCell>
                          <TableCell>
                            <Chip
                              label={b.type}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: "10px",
                                bgcolor: b.type === "Own Brand" ? "#dbeafe" : "#f1f5f9",
                                color: b.type === "Own Brand" ? "#1e40af" : "#475569",
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: "#0f172a", fontFamily: "monospace" }}>
                            {formatNumber(b.value)}
                          </TableCell>
                          <TableCell>
                            {b.type === "Own Brand" ? (
                              <Chip label="OWN BRAND DRIVER" size="small" sx={{ bgcolor: "#dbeafe", color: "#1e40af", fontWeight: 800, fontSize: "10px" }} />
                            ) : (
                              <Chip label="BENCHMARK COMPETITOR" size="small" sx={{ bgcolor: "#f1f5f9", color: "#64748b", fontWeight: 600, fontSize: "10px" }} />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}"""

new_l3 = """                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Brand</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Classification</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>{getMetricHeaderLabel()}</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Portfolio Sales</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level3_brands || []).map((b) => {
                        const rowMetric = getRowMetricVal(b);
                        return (
                          <TableRow key={b.name}>
                            <TableCell sx={{ color: "#0f172a", fontWeight: 700 }}>{b.name}</TableCell>
                            <TableCell>
                              <Chip
                                label={b.type}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "10px",
                                  bgcolor: b.type === "Own Brand" ? "#dbeafe" : "#f1f5f9",
                                  color: b.type === "Own Brand" ? "#1e40af" : "#475569",
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: 700 }}>
                              {formatNumber(rowMetric, metric)}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace" }}>
                              {formatNumber(b.sales, "offtakes")}
                            </TableCell>
                            <TableCell>
                              {b.is_breach ? (
                                <Chip label="ANOMALY DETECTED" size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : b.type === "Own Brand" ? (
                                <Chip label="OWN BRAND DRIVER" size="small" sx={{ bgcolor: "#dbeafe", color: "#1e40af", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="BENCHMARK COMPETITOR" size="small" sx={{ bgcolor: "#f1f5f9", color: "#64748b", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}"""

assert old_l3 in text, "old_l3 not found"
text = text.replace(old_l3, new_l3, 1)

# 7. Update Level 4 table
old_l4 = """                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Category</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Sales</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Category OSA (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level4_categories || []).map((cat) => {
                        const isBreach = cat.osa < 70;
                        return (
                          <TableRow key={cat.name} sx={{ bgcolor: isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#0f172a", fontWeight: 700 }}>{formatCategory(cat.name)}</TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace" }}>
                              {formatNumber(cat.value)}
                            </TableCell>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                              {cat.osa}%
                            </TableCell>
                            <TableCell>
                              {isBreach ? (
                                <Chip label={`ANOMALY DETECTED: LOW OSA (${cat.osa}%)`} size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}"""

new_l4 = """                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Category</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>{getMetricHeaderLabel()}</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Category Sales</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>OSA (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level4_categories || []).map((cat) => {
                        const isBreach = cat.is_breach !== undefined ? cat.is_breach : (cat.osa < 70);
                        const rowMetric = getRowMetricVal(cat);
                        return (
                          <TableRow key={cat.name} sx={{ bgcolor: isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#0f172a", fontWeight: 700 }}>{formatCategory(cat.name)}</TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: 700 }}>
                              {formatNumber(rowMetric, metric)}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace" }}>
                              {formatNumber(cat.sales, "offtakes")}
                            </TableCell>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                              {cat.osa}%
                            </TableCell>
                            <TableCell>
                              {cat.status_label ? (
                                <Chip label={cat.status_label} size="small" sx={{ bgcolor: isBreach ? "#fee2e2" : "#f0fdf4", color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 800, fontSize: "10px" }} />
                              ) : isBreach ? (
                                <Chip label={`ANOMALY DETECTED: (${cat.osa}%)`} size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}"""

assert old_l4 in text, "old_l4 not found"
text = text.replace(old_l4, new_l4, 1)

# 8. Update Level 5 table
old_l5 = """                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Product / SKU</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Web_Pid</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Platform</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Sales</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>SKU OSA</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level5_skus || []).map((sku) => {
                        const isBreach = sku.osa < 70;
                        return (
                          <TableRow key={sku.pid} sx={{ bgcolor: isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#0f172a", fontWeight: 700, fontSize: "12px" }}>
                              {sku.product}
                            </TableCell>
                            <TableCell sx={{ color: "#64748b", fontFamily: "monospace", fontSize: "11px" }}>
                              {sku.pid}
                            </TableCell>
                            <TableCell sx={{ color: "#2563eb", textTransform: "capitalize", fontSize: "11px" }}>
                              {formatPlatform(sku.platform)}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace" }}>
                              {formatNumber(sku.sales)}
                            </TableCell>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                              {sku.osa}%
                            </TableCell>
                            <TableCell>
                              {isBreach ? (
                                <Chip label={`ANOMALY DETECTED: STOCKOUT (${sku.osa}%)`} size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}"""

new_l5 = """                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Product / SKU</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Web_Pid</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Platform</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>{getMetricHeaderLabel()}</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>SKU Sales</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level5_skus || []).map((sku) => {
                        const isBreach = sku.is_breach !== undefined ? sku.is_breach : (sku.osa < 70);
                        const rowMetric = getRowMetricVal(sku);
                        return (
                          <TableRow key={sku.pid} sx={{ bgcolor: isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#0f172a", fontWeight: 700, fontSize: "12px" }}>
                              {sku.product}
                            </TableCell>
                            <TableCell sx={{ color: "#64748b", fontFamily: "monospace", fontSize: "11px" }}>
                              {sku.pid}
                            </TableCell>
                            <TableCell sx={{ color: "#2563eb", textTransform: "capitalize", fontSize: "11px" }}>
                              {formatPlatform(sku.platform)}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: 700 }}>
                              {formatNumber(rowMetric, metric)}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace" }}>
                              {formatNumber(sku.sales, "offtakes")}
                            </TableCell>
                            <TableCell>
                              {sku.status_label ? (
                                <Chip label={sku.status_label} size="small" sx={{ bgcolor: isBreach ? "#fee2e2" : "#f0fdf4", color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 800, fontSize: "10px" }} />
                              ) : isBreach ? (
                                <Chip label={`ANOMALY DETECTED: (${sku.osa}%)`} size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}"""

assert old_l5 in text, "old_l5 not found"
text = text.replace(old_l5, new_l5, 1)

with open(drawer_path, "w", encoding="utf-8") as f:
    f.write(text)

print("KpiAnomalyChartDrawer.jsx patched successfully.")
