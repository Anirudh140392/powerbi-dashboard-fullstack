import React, { useState } from "react";
import { LineChart as LineChartIcon, X } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

/* ------------------------------------------------------
   ALL KPI CARDS (OLD + NEW)
-------------------------------------------------------*/
const KPI_CARDS = [
  {
    id: "sos_new",
    label: "SHARE OF SEARCH",
    value: "25%",
    unit: "",
    tag: "-1.3% MoM",
    tagTone: "warning",
    footer: "Organic + Paid view",
    trendTitle: "Share of Search Trend",
    trendSubtitle: "Last 7 periods",
    trendData: [
      { period: "P1", value: 5 },
      { period: "P2", value: 8 },
      { period: "P3", value: 6 },
      { period: "P4", value: 10 },
      { period: "P5", value: 7 },
      { period: "P6", value: 9 },
      { period: "P7", value: 6 },
    ],
  },

  {
    id: "inorganic",
    label: "INORGANIC SALES",
    value: "11%",
    unit: "",
    tag: "5.4% MoM",
    tagTone: "positive",
    footer: "Non-brand contribution",
    trendTitle: "Inorganic Sales Trend",
    trendSubtitle: "Last 7 periods",
    trendData: [
      { period: "P1", value: 2 },
      { period: "P2", value: 4 },
      { period: "P3", value: 5 },
      { period: "P4", value: 6 },
      { period: "P5", value: 8 },
      { period: "P6", value: 7 },
      { period: "P7", value: 9 },
    ],
  },

  {
    id: "conversion",
    label: "CONVERSION",
    value: "0.6%",
    unit: "",
    tag: "28% MoM",
    tagTone: "positive",
    footer: "Orders / Clicks",
    trendTitle: "Conversion Trend",
    trendSubtitle: "Last 7 periods",
    trendData: [
      { period: "P1", value: 1 },
      { period: "P2", value: 2 },
      { period: "P3", value: 1 },
      { period: "P4", value: 3 },
      { period: "P5", value: 2 },
      { period: "P6", value: 4 },
      { period: "P7", value: 3 },
    ],
  },

  {
    id: "roas_new",
    label: "ROAS",
    value: "2.1",
    unit: "",
    tag: "10.5% MoM",
    tagTone: "positive",
    footer: "Return on Ad Spend",
    trendTitle: "ROAS Trend",
    trendSubtitle: "Last 7 periods",
    trendData: [
      { period: "P1", value: 4 },
      { period: "P2", value: 6 },
      { period: "P3", value: 5 },
      { period: "P4", value: 7 },
      { period: "P5", value: 8 },
      { period: "P6", value: 7 },
      { period: "P7", value: 9 },
    ],
  },

  {
    id: "bmi",
    label: "BMI / SALES RATIO",
    value: "5%",
    unit: "",
    tag: "-4.6% MoM",
    tagTone: "warning",
    footer: "Efficiency index",
    trendTitle: "BMI / Sales Ratio Trend",
    trendSubtitle: "Last 7 periods",
    trendData: [
      { period: "P1", value: 10 },
      { period: "P2", value: 8 },
      { period: "P3", value: 7 },
      { period: "P4", value: 6 },
      { period: "P5", value: 5 },
      { period: "P6", value: 4 },
      { period: "P7", value: 3 },
    ],
  },

  {
    id: "osa",
    label: "AVG OSA",
    value: "95.6%",
    unit: "",
    tag: "stable",
    tagTone: "neutral",
    footer: "Availability weighted",
    trendTitle: "OSA – Weighted",
    trendSubtitle: "Last 4 periods",
    trendData: [
      { period: "P1", value: 95.2 },
      { period: "P2", value: 95.4 },
      { period: "P3", value: 95.7 },
      { period: "P4", value: 95.6 },
    ],
  },
];

/* ------------------------------------------------------
   TAG COLOR LOGIC
-------------------------------------------------------*/
function getTagColors(tone) {
  switch (tone) {
    case "positive":
      return { bg: "#E6F9EE", text: "#15803D" };
    case "warning":
      return { bg: "#FFF4DB", text: "#92400E" };
    default:
      return { bg: "#EEF2F7", text: "#4B5563" };
  }
}

/* ------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------*/
export default function PerformanceMatric({
  cardWidth = 240,
  cardHeight = 120,
}) {
  const [activeTrendId, setActiveTrendId] = useState(null);

  const activeCard = KPI_CARDS.find((c) => c.id === activeTrendId) || null;

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#F5F7FB",
        padding: "12px 16px",
        boxSizing: "border-box",
      }}
    >
      {/* Card Row */}
      <div
        style={{
          display: "flex",
          gap: 16,
          overflowX: "auto",
          paddingBottom: 8,
        }}
      >
        {KPI_CARDS.map((card) => (
          <KpiCard
            key={card.id}
            card={card}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            onOpenTrend={() => setActiveTrendId(card.id)}
          />
        ))}
      </div>

      {activeCard && (
        <TrendPopup card={activeCard} onClose={() => setActiveTrendId(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------
   KPI CARD
-------------------------------------------------------*/
function KpiCard({ card, cardWidth, cardHeight, onOpenTrend }) {
  const { bg, text } = getTagColors(card.tagTone);

  return (
    <div
      style={{
        flex: "0 0 auto",
        width: cardWidth,
        height: cardHeight,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: "14px 16px",
        boxSizing: "border-box",
        boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.06)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              fontWeight: 600,
              color: "#6B7280",
              marginBottom: 4,
            }}
          >
            {card.label}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 600 }}>{card.value}</span>
            {card.unit && <span style={{ fontSize: 14 }}>{card.unit}</span>}
          </div>
        </div>

        {/* Tag + Trend Icon */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              backgroundColor: bg,
              color: text,
              fontSize: 11,
              fontWeight: 500,
              display: "inline-block",
              marginBottom: 6,
            }}
          >
            {card.tag}
          </div>

          <button
            onClick={onOpenTrend}
            style={{
              border: "none",
              background: "#EEF2F7",
              padding: 4,
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            <LineChartIcon size={16} color="#4B5563" strokeWidth={1.7} />
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{card.footer}</div>
    </div>
  );
}

/* ------------------------------------------------------
   TREND POPUP — FIXED CENTERED GRAPH
-------------------------------------------------------*/
function TrendPopup({ card, onClose }) {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15,23,42,0.25)",
          zIndex: 40,
        }}
      />

      {/* Popup */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)", // ⭐ FIXED CENTER
          background: "#fff",
          borderRadius: 16,
          padding: 16,
          width: 360,
          maxWidth: "90vw",
          boxShadow:
            "0 18px 45px rgba(15,23,42,0.25), 0 0 0 1px rgba(15,23,42,0.05)",
          zIndex: 41,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {card.trendTitle}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              {card.trendSubtitle}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Chart Area */}
        <div
          style={{
            marginTop: 15,
            padding: 8,
            background: "#E6FAF4",
            borderRadius: 12,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: 150,
          }}
        >
          <div style={{ width: "100%", height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={card.trendData}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="#CCF0D8"
                  vertical={false}
                  strokeDasharray="3 3"
                />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={28} />

                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #E5E7EB",
                    fontSize: 11,
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#059669"
                  strokeWidth={2}
                  fill="url(#trendFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
