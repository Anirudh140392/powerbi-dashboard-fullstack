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
import TrendsCompetitionDrawer from "@/components/AllAvailablityAnalysis/TrendsCompetitionDrawer";
import { Typography } from "@mui/material";
import { defaultBrands } from "@/utils/DataCenter";

/* ------------------------------------------------------
   ALL KPI CARDS (OLD + NEW)
-------------------------------------------------------*/
const KPI_CARDS = [
  {
    id: "sos_new",
    label: "Share Of Search",
    value: "25%",
    unit: "",
    tag: "-1.3%",
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
    label: "Inorganic Sales",
    value: "11%",
    unit: "",
    tag: "5.4%",
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
    label: "Conversion",
    value: "1%",
    unit: "",
    tag: "28%",
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
    label: "Roas",
    value: "2",
    unit: "",
    tag: "10.5%",
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
    label: "Bmi / Sales Ratio",
    value: "5%",
    unit: "",
    tag: "-4.6%",
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

  // {
  //   id: "osa",
  //   label: "AVG OSA",
  //   value: "95.6%",
  //   unit: "",
  //   tag: "stable",
  //   tagTone: "neutral",
  //   footer: "Availability weighted",
  //   trendTitle: "OSA – Weighted",
  //   trendSubtitle: "Last 4 periods",
  //   trendData: [
  //     { period: "P1", value: 95.2 },
  //     { period: "P2", value: 95.4 },
  //     { period: "P3", value: 95.7 },
  //     { period: "P4", value: 95.6 },
  //   ],
  // },
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
  const [showTrends, setShowTrends] = useState(false);
  const [selectedTrendName, setSelectedTrendName] = useState("All");
  const [selectedTrendLevel, setSelectedTrendLevel] = useState("Metric");

  const activeCard = KPI_CARDS.find((c) => c.id === activeTrendId) || null;

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "white",
        padding: "12px 16px",
        boxSizing: "border-box",
        borderRadius: "24px",
      }}
    >
      {/* Card Row */}
      <div
        style={{
          display: "flex",
          gap: 16,
          overflowX: "auto",
          paddingBottom: 8,
          paddingTop: 10,
          paddingLeft: 12,
          paddingRight: 12,
        }}
      >
        {KPI_CARDS.map((card) => (
          <KpiCard
            key={card.id}
            card={card}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            onOpenTrend={() => setActiveTrendId(card.id)}
            onViewTrends={(name) => {
              setSelectedTrendName(name);
              setSelectedTrendLevel("Metric");
              setShowTrends(true);
            }}
          />
        ))}
      </div>

      {activeCard && (
        <TrendPopup card={activeCard} onClose={() => setActiveTrendId(null)} />
      )}
      <TrendsCompetitionDrawer
        open={showTrends}
        onClose={() => setShowTrends(false)}
        selectedColumn={selectedTrendName}
        selectedLevel={selectedTrendLevel}
        dynamicKey="performance_dashboard_tower"
        brandOptions={defaultBrands.map(b => b.label)}
      />
    </div>
  );
}

/* ------------------------------------------------------
   KPI CARD
-------------------------------------------------------*/
function KpiCard({ card, onOpenTrend, onViewTrends }) {
  const { bg, text } = getTagColors(card.tagTone);

  return (
    <div
      style={{
        width: 260,
        height: 150,
        background: "#FFFFFF",
        borderRadius: 18,
        padding: "16px 18px",
        boxSizing: "border-box",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.15), -3px 0 6px rgba(0, 0, 0, 0.12), 3px 0 6px rgba(0, 0, 0, 0.12)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "transform 0.25s, box-shadow 0.25s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-5px)";
        e.currentTarget.style.boxShadow = "0 10px 20px rgba(0, 0, 0, 0.2), -5px 0 12px rgba(0, 0, 0, 0.15), 5px 0 12px rgba(0, 0, 0, 0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.15), -3px 0 6px rgba(0, 0, 0, 0.12), 3px 0 6px rgba(0, 0, 0, 0.12)";
      }}
    >
      {/* 🔵 ROW 1 — LABEL + GRAPH ICON */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >

        <Typography variant="body2" color="text.secondary">{card.label}</Typography>

        <div
          onClick={() => onViewTrends(card.label)}
          // onClick={onOpenTrend}
          className="trend-icon"
          style={{
            background: "#EEF2F7",
            padding: 6,
            borderRadius: "50%",
            cursor: "pointer",
          }}
        >
          <LineChartIcon size={18} color="#475569" />
        </div>
      </div>

      {/* 🔵 ROW 2 — VALUE + MOM TAG */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
        }}
      >
        {/* Value */}
        <div style={{ fontSize: 28, fontWeight: 700 }}>{card.value}</div>

        {/* MoM Tag */}
        <div
          style={{
            background: bg,
            color: text,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {card.tag}
        </div>
      </div>

      {/* 🔵 ROW 3 — FOOTER TEXT */}
      <div style={{ fontSize: "0.75rem", fontWeight: 400, color: "#94A3B8", fontFamily: "Roboto, sans-serif" }}>{card.footer}</div>
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
            <div style={{ fontSize: "1.2rem", fontWeight: 700, fontFamily: "Roboto, sans-serif" }}>
              {card.trendTitle}
            </div>
            <div style={{ fontSize: "0.75rem", fontWeight: 400, color: "#6B7280", fontFamily: "Roboto, sans-serif" }}>
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
