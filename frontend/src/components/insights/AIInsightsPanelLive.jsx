/**
 * AIInsightsPanelLive.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * DROP-IN REPLACEMENT for the static AIInsightsPanel in Insights.jsx.
 *
 * What changed:
 *  - Calls the real Claude API (claude-sonnet-4-20250514) on every signal open.
 *  - Passes the signal type, client name, and the actual evidence rows as JSON.
 *  - Claude returns 4 bullet segments as structured JSON (label + text).
 *  - Falls back to the original static buildAISegments() if the API call fails.
 *  - Priority colors are inferred from segment position (not Claude's output)
 *    so the visual design stays 100% unchanged.
 *
 * HOW TO USE:
 *  1. Copy this file into your project (e.g. src/components/insights/).
 *  2. In Insights.jsx, replace:
 *       import { AIInsightsPanel } from ...   (or wherever it's defined)
 *     with:
 *       import AIInsightsPanelLive from "@/components/insights/AIInsightsPanelLive";
 *  3. Replace every <AIInsightsPanel ...> with <AIInsightsPanelLive ...>.
 *  4. The component accepts the EXACT same props: { insight, onClose }.
 *
 * ENVIRONMENT:
 *  The Anthropic API key is injected by the platform (no key in code).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BrainCircuit, Loader2, Sparkles, RefreshCw } from "lucide-react";

// ─── Helpers (copied from Insights.jsx so this file is self-contained) ────────

const formatINRCompact = (n) => {
    if (typeof n !== "number") return "N/A";
    const abs = Math.abs(n);
    if (abs >= 1e7) return `₹${(n / 1e7).toFixed(1)} Cr`;
    if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)} lac`;
    if (abs >= 1e3) return `₹${(n / 1e3).toFixed(0)} K`;
    return `₹${n.toFixed(0)}`;
};

const safePct = (v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "-");

/**
 * Render **bold** markdown-style markers as <strong> tags.
 */
const renderBoldText = (text) => {
    if (!text) return null;
    const parts = String(text).split(/(\*\*[^*]+\*\*)/);
    return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return (
                <strong key={i} style={{ color: "#0f172a", fontWeight: 700 }}>
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return <span key={i}>{part}</span>;
    });
};

// Priority order → visual colour mapping (positional, not Claude-driven)
const PRIORITY_ORDER = ["high", "focus", "good", "neutral"];
const priorityColors = {
    high:    "#ef4444",
    focus:   "#3b82f6",
    good:    "#10b981",
    neutral: "#94a3b8",
};

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the system + user prompt that is sent to Claude.
 * The evidence array is trimmed to the 10 most impactful rows so we don't
 * blow the token budget; all monetary figures are pre-formatted for clarity.
 */
const buildPrompt = (insight) => {
    const clientName = insight.brandName || "the client";
    const moduleType = insight.type;
    const impactStr  = formatINRCompact(insight.impactInr || 0);

    // Sanitise evidence — keep only fields that carry semantic value
    const SAFE_KEYS = [
        "city", "category", "platform",
        // Share
        "brandOsa", "brandOsaDelta", "marketShare", "marketShareMoM",
        "offtake", "offtakeMoM", "possibleCause", "myTopSku", "competitorSku",
        // Pricing
        "ourPpu", "compPpu", "gapPct", "gapPctChange", "impactedSku", "compSku",
        // Competitor OSA
        "skuOrBrand", "otherBrandOsa", "otherBrandOsaChangePct", "kwOsa",
        "ourBrandMkShare", "otherBrandMkShare",
        // Ad / Keywords
        "adSov", "adSovChangePct", "spendInr", "spend", "acos", "acosChangePct",
        "keyword", "campaign", "budgetCapped", "estLostSalesInr",
        // Supply
        "skuName", "fillRate", "poCreated", "poNo", "depotOrDb",
        "plannedQty", "dispatchedQty",
        // Stock
        "excessDOI", "excessInventoryValue", "currentDiscount", "openPOQty",
        // PO
        "osa", "projectedSalesLoss", "poStatus", "poRaisedDate",
        // Transfer
        "cpd", "backedDOI",
        // New Market Entry
        "competitorName", "pfu", "firstSeenDate",
    ];

    const cleanEvidence = (insight.evidence || [])
        .slice(0, 10)
        .map(row => {
            const cleaned = {};
            for (const k of SAFE_KEYS) {
                if (row[k] !== undefined && row[k] !== null && row[k] !== "-") {
                    cleaned[k] = row[k];
                }
            }
            return cleaned;
        })
        .filter(r => Object.keys(r).length > 0);

    const isEmptySignal =
        insight.id?.startsWith("empty_") ||
        cleanEvidence.length === 0 ||
        (cleanEvidence.length === 1 &&
            Object.values(cleanEvidence[0]).every(v => v === 0 || v === "-" || v === "0%"));

    // ── System Prompt ─────────────────────────────────────────────────────────
    const systemPrompt = `You are a Senior Retail Data Scientist generating executive-level AI insights for a retail intelligence dashboard called Trailytics.

RULES:
1. Respond ONLY with a valid JSON array of exactly 4 objects. No prose, no markdown fences, no explanation.
2. Each object must have exactly two keys: "label" (string, ≤3 words) and "text" (string).
3. Use **double-asterisks** to bold key numbers, brand names, SKUs, and cities — e.g. **Snickers** or **₹12.4 lac**.
4. Every bullet must follow: Observation → Financial Impact → Action. Keep each under 20 words.
5. The Action label must have the most actionable recommendation, not just an observation.
6. If data is empty or null (isEmpty = true), return 4 strategic "monitoring" insights — no fabricated numbers.
7. Do NOT use introductory phrases like "The data shows" or "Based on the table".
8. Labels must match the signal type context. Suggested labels per module:
   - Market Share / Headroom → "Share Loss", "Root Cause", "SKU Impact", "Action"
   - Pricing → "Pricing Alert", "SKU Gap", "Revenue at Risk", "Action"
   - Supply / Replenishment → "Stockout Risk", "Affected SKUs", "Sales at Risk", "Action"
   - Competitor OSA → "Opportunity", "Weak Competitors", "Upside", "Action"
   - Ad / Performance → "Wasted Spend", "Worst SKUs", "Est. Loss", "Action"
   - Keyword Efficiency → "Efficiency Alert", "Worst Keywords", "Budget Impact", "Action"
   - Surplus Stock → "Surplus Alert", "Slow Movers", "Discount Gap", "Action"
   - Transfer Issue → "Transfer Alert", "Affected SKUs", "PSL Impact", "Action"
   - Prioritise PO → "PO Urgency", "Top PO Needs", "Revenue at Risk", "Action"
   - New Market Entry → "New Entrant", "Market Expansion", "Threat Assessment", "Action"`;

    // ── User Prompt ───────────────────────────────────────────────────────────
    const userPrompt = isEmptySignal
        ? `Client: **${clientName}**
Module: ${moduleType}
Data Status: EMPTY — no actionable data detected for this signal.
Total Financial Impact: ${impactStr}

Generate 4 strategic "monitoring" insight bullets appropriate for an empty ${moduleType} signal. Focus on what ${clientName} should watch for and prepare.`
        : `Client: **${clientName}**
Module: ${moduleType}
Total Financial Impact: ${impactStr}
Number of evidence rows: ${cleanEvidence.length}

Dataset (JSON):
${JSON.stringify(cleanEvidence, null, 2)}

Generate 4 precise, high-value insight bullets for the AI Insights panel.`;

    return { systemPrompt, userPrompt };
};

// ─── Static fallback (mirrors original buildAISegments, trimmed) ──────────────

/**
 * Minimal static fallback — used only if the API call fails.
 * Returns 4 segments in the same shape as the Claude JSON response.
 */
const staticFallback = (insight) => {
    const brand  = insight.brandName || "Brand";
    const ev     = (insight.evidence || [])[0] || {};
    const impact = formatINRCompact(insight.impactInr || 0);
    const city   = ev.city && ev.city !== "-" ? ev.city : (insight.city || "region");

    const defaults = {
        "Share Headroom Hotspots":             [{ label: "Share Loss",     text: `**${brand}** is losing market share in **${city}**.` }, { label: "Root Cause",    text: `OSA or visibility gap vs competitors detected.` }, { label: "SKU Impact",    text: `Top impacted SKU data unavailable.` }, { label: "Action",        text: `Review keyword bids and OSA recovery plan. Impact: **${impact}**.` }],
        "Price Parity Radar":                  [{ label: "Pricing Alert",  text: `**${brand}** has a price gap vs competitor in **${city}**.` }, { label: "SKU Gap",       text: `PPU comparison data temporarily unavailable.` }, { label: "Revenue at Risk", text: `Estimated PSL: **${impact}**.` }, { label: "Action",        text: `Audit pricing in **${city}** and run markdown if overpriced.` }],
        "Competitor OSA Weak Spots":           [{ label: "Opportunity",    text: `Competitor OSA weakness detected in **${city}**.` }, { label: "Weak Competitors", text: `OSA data temporarily unavailable.` }, { label: "Upside",        text: `**${impact}** capture opportunity while competitor is weak.` }, { label: "Action",        text: `Boost **${brand}** sponsored placements in **${city}** now.` }],
        "Remove Ad Low OSA":                   [{ label: "Wasted Spend",   text: `Ad spend on low-OSA SKUs detected for **${brand}** in **${city}**.` }, { label: "Affected SKUs",  text: `OSA-ad mismatch data temporarily unavailable.` }, { label: "Est. Loss",     text: `**${impact}** lost from ad→OOS leakage.` }, { label: "Action",        text: `Pause ads for OOS SKUs in **${city}**; redirect to OSA >80% products.` }],
        "Keyword Efficiency and Budget Caps":  [{ label: "Efficiency Alert", text: `Underperforming keywords detected for **${brand}** in **${city}**.` }, { label: "Worst Keywords", text: `Keyword performance data temporarily unavailable.` }, { label: "Budget Impact", text: `**${impact}** at risk from keyword waste.` }, { label: "Action",        text: `Pause worst-ACOS keywords; target ACOS <15%.` }],
        "Replenishment Breaks":                [{ label: "Stockout Risk",  text: `Fill rate below threshold for **${brand}** in **${city}**.` }, { label: "Affected SKUs",  text: `SKU-level replenishment data temporarily unavailable.` }, { label: "Sales at Risk", text: `**${impact}** revenue at risk from supply gap.` }, { label: "Action",        text: `Escalate dispatch at local DC. Prioritise **${city}** first.` }],
        "Surplus Stock":                       [{ label: "Surplus Alert",  text: `Excess inventory detected for **${brand}** in **${city}**.` }, { label: "Slow Movers",    text: `DOI breakdown temporarily unavailable.` }, { label: "Discount Gap",   text: `**${impact}** in excess inventory value.` }, { label: "Action",        text: `Consider bundle offers or flash sales to clear stock in **${city}**.` }],
        "Prioritise PO":                       [{ label: "PO Urgency",     text: `Critical SKUs need urgent PO for **${brand}** in **${city}**.` }, { label: "Top PO Needs",  text: `SKU-level PO data temporarily unavailable.` }, { label: "Revenue at Risk", text: `PSL: **${impact}** if POs not raised immediately.` }, { label: "Action",        text: `Raise emergency PO. Prioritise **${city}** warehouse.` }],
        "Transfer Issue":                      [{ label: "Transfer Alert", text: `Stock transfer needed for **${brand}** to **${city}**.` }, { label: "Affected SKUs",  text: `Transfer details temporarily unavailable.` }, { label: "PSL Impact",    text: `**${impact}** at risk without inter-warehouse transfer.` }, { label: "Action",        text: `Initiate stock transfer to **${city}** to meet CPD demand.` }],
        "New Market Entry":                    [{ label: "New Entrant",    text: `New competitor detected in **${city}** for **${brand}**'s category.` }, { label: "Market Expansion", text: `Entry details temporarily unavailable.` }, { label: "Threat Assessment", text: `**${impact}** potential revenue exposure.` }, { label: "Action",        text: `Monitor new entrant in **${city}** and strengthen **${brand}** presence.` }],
    };

    return defaults[insight.type] || [
        { label: "Signal",  text: insight.whatWeSee?.[1] || "Deviation detected." },
        { label: "Details", text: insight.whatWeSee?.[0] || "Notable deviation found." },
        { label: "Impact",  text: `**${impact}** opportunity.` },
        { label: "Action",  text: `Review strategies in **${city}**.` },
    ];
};

// ─── Badges ───────────────────────────────────────────────────────────────────

const BetaBadge = () => (
    <span style={{
        fontSize: "8.5px", fontWeight: 800, letterSpacing: "0.05em",
        background: "#2563eb", color: "#fff", borderRadius: "5px",
        padding: "2.5px 8px", display: "inline-flex", alignItems: "center",
        textTransform: "uppercase", lineHeight: 1,
        boxShadow: "0 2px 4px rgba(37, 99, 235, 0.3)",
    }}>
        BETA
    </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * AIInsightsPanelLive
 *
 * Props:
 *   insight  {object}   — the signal card object from Insights.jsx
 *   onClose  {function} — callback to close the panel
 */
const AIInsightsPanelLive = ({ insight, onClose }) => {
    const [segments, setSegments]   = useState([]);
    const [phase, setPhase]         = useState("loading"); // "loading" | "reveal" | "error"
    const [retryKey, setRetryKey]   = useState(0);

    const fetchInsights = useCallback(async () => {
        setPhase("loading");
        setSegments([]);

        const { systemPrompt, userPrompt } = buildPrompt(insight);

        try {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 1000,
                    system: systemPrompt,
                    messages: [{ role: "user", content: userPrompt }],
                }),
            });

            if (!response.ok) throw new Error(`API error ${response.status}`);

            const data = await response.json();

            // Extract the text block from the response
            const rawText = (data.content || [])
                .filter(b => b.type === "text")
                .map(b => b.text)
                .join("");

            // Strip any accidental markdown fences
            const cleaned = rawText.replace(/```json|```/gi, "").trim();
            const parsed  = JSON.parse(cleaned);

            if (!Array.isArray(parsed) || parsed.length < 2) {
                throw new Error("Unexpected response shape");
            }

            // Enforce exactly 4 segments; assign priority positionally
            const normalised = parsed.slice(0, 4).map((seg, idx) => ({
                label:    seg.label || `Insight ${idx + 1}`,
                text:     seg.text  || "",
                priority: PRIORITY_ORDER[idx] || "neutral",
            }));

            setSegments(normalised);
            setPhase("reveal");

        } catch (err) {
            console.warn("[AIInsightsPanelLive] API call failed, using static fallback:", err.message);

            // Static fallback so the panel never goes blank
            const fallback = staticFallback(insight).map((seg, idx) => ({
                ...seg,
                priority: PRIORITY_ORDER[idx] || "neutral",
            }));
            setSegments(fallback);
            setPhase("error"); // shows a subtle retry notice
        }
    }, [insight, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
            className="ai-insights-panel"
            style={{
                position: "absolute", top: 0, right: 0,
                height: "100%",
                background: "rgba(255, 255, 255, 0.99)",
                backdropFilter: "blur(25px)",
                borderLeft: "1px solid rgba(226, 232, 240, 0.8)",
                boxShadow: "-12px 0 40px rgba(0,0,0,0.07)",
                zIndex: 60, display: "flex", flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px",
                background: "linear-gradient(135deg, #f8faff 0%, #f1f5ff 100%)",
                borderBottom: "1px solid rgba(99, 102, 241, 0.08)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: "8px",
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
                    }}>
                        <BrainCircuit size={16} color="#fff" strokeWidth={2.5} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{
                            fontSize: "12px", fontWeight: 700, color: "#1e1b4b",
                            display: "flex", alignItems: "center", gap: "5px",
                            letterSpacing: "-0.01em",
                        }}>
                            AI Summary <BetaBadge />
                        </div>
                        <div style={{
                            fontSize: "9px", color: "#6366f1", fontWeight: 700,
                            letterSpacing: "0.03em", textTransform: "uppercase", marginTop: "1px",
                        }}>
                            powered by Trailytics AI
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {/* Retry button — always visible, faded when loading */}
                    <button
                        onClick={() => setRetryKey(k => k + 1)}
                        title="Regenerate insights"
                        style={{
                            color: phase === "loading" ? "#cbd5e1" : "#94a3b8",
                            cursor: phase === "loading" ? "not-allowed" : "pointer",
                            background: "rgba(0,0,0,0.03)", border: "none",
                            padding: 5, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s ease",
                            pointerEvents: phase === "loading" ? "none" : "auto",
                        }}
                        onMouseEnter={(e) => {
                            if (phase !== "loading") {
                                e.currentTarget.style.background = "rgba(99,102,241,0.1)";
                                e.currentTarget.style.color = "#6366f1";
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(0,0,0,0.03)";
                            e.currentTarget.style.color = "#94a3b8";
                        }}
                    >
                        <RefreshCw size={13} strokeWidth={2.5} />
                    </button>

                    {/* Close */}
                    <button
                        onClick={onClose}
                        style={{
                            color: "#94a3b8", cursor: "pointer",
                            background: "rgba(0,0,0,0.03)", border: "none",
                            padding: 5, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                            e.currentTarget.style.color = "#ef4444";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(0,0,0,0.03)";
                            e.currentTarget.style.color = "#94a3b8";
                        }}
                    >
                        <X size={14} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            {/* ── Context pill (signal type) ──────────────────────────────── */}
            <div style={{
                padding: "8px 20px 0",
                display: "flex", alignItems: "center", gap: "6px",
            }}>
                <span style={{
                    fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em",
                    color: "#6366f1", background: "rgba(99,102,241,0.08)",
                    borderRadius: "4px", padding: "3px 8px",
                    textTransform: "uppercase",
                }}>
                    {insight.type}
                </span>
                {phase === "error" && (
                    <span style={{
                        fontSize: "9px", color: "#f59e0b", fontWeight: 600,
                        background: "rgba(245,158,11,0.08)", borderRadius: "4px",
                        padding: "3px 8px", letterSpacing: "0.03em",
                    }}>
                        ⚡ Static fallback
                    </span>
                )}
            </div>

            {/* ── Scrollable content ──────────────────────────────────────── */}
            <div style={{
                flex: 1, padding: "14px 16px 20px", overflowY: "auto",
                display: "flex", flexDirection: "column", gap: "14px",
                background: "linear-gradient(to bottom, #ffffff, #fbfcfd)",
            }}>
                {phase === "loading" ? (
                    /* Loading skeleton */
                    <div style={{
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        padding: "40px 0", gap: "12px",
                    }}>
                        <Loader2
                            size={24}
                            style={{
                                animation: "spin 1.2s linear infinite",
                                color: "#6366f1",
                            }}
                        />
                        <span style={{
                            color: "#64748b", fontSize: "11.5px",
                            fontWeight: 500, letterSpacing: "0.01em",
                        }}>
                            Analysing {insight.type}…
                        </span>
                        <span style={{
                            color: "#94a3b8", fontSize: "10px",
                            fontWeight: 400, textAlign: "center", lineHeight: 1.5,
                        }}>
                            Claude is reading the evidence data<br />and generating insights.
                        </span>
                    </div>
                ) : (
                    /* Segment cards */
                    segments.map((seg, idx) => {
                        const borderColor = priorityColors[seg.priority] || "#94a3b8";
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 40,
                                    delay: idx * 0.07,
                                }}
                                style={{
                                    background: "#fff",
                                    border: "1.5px solid rgba(226, 232, 240, 0.9)",
                                    borderLeft: `4px solid ${borderColor}`,
                                    borderRadius: "12px",
                                    padding: "14px 16px",
                                    boxShadow:
                                        "0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)",
                                }}
                            >
                                {/* Label */}
                                <div style={{
                                    fontSize: "9px", fontWeight: 800,
                                    textTransform: "uppercase", letterSpacing: "0.08em",
                                    marginBottom: "8px", color: borderColor,
                                    display: "flex", alignItems: "center", gap: "5px",
                                }}>
                                    <span style={{
                                        width: 6, height: 6, borderRadius: "50%",
                                        background: borderColor,
                                    }} />
                                    {seg.label}
                                </div>

                                {/* Body */}
                                <p style={{
                                    fontSize: "11.5px", color: "#334155",
                                    lineHeight: 1.6, margin: 0, fontWeight: 500,
                                }}>
                                    {renderBoldText(seg.text)}
                                </p>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <div style={{
                padding: "10px 16px",
                borderTop: "1px solid rgba(226, 232, 240, 0.6)",
                background: "#f8f9fa",
                display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Sparkles size={10} color="#6366f1" />
                    <span style={{ fontSize: "9.5px", color: "#64748b", fontWeight: 600 }}>
                        {phase === "reveal" ? "Live AI insights" : phase === "error" ? "Static insights" : "Generating…"}
                    </span>
                </div>
                {phase !== "loading" && (
                    <span style={{ fontSize: "9px", color: "#94a3b8" }}>
                        {insight.evidence?.length || 0} rows analysed
                    </span>
                )}
            </div>
        </motion.div>
    );
};

export default AIInsightsPanelLive;