import React, { useState } from "react";
import { Box, Card, Typography, Grid } from "@mui/material";
import {
  TrendingUp,
  AlertTriangle,
  FlaskConical,
  BarChart3,
  Sparkles,
} from "lucide-react";

const insightKPIs = [
  {
    label: "All Campaign Summary",
    value: 734,
    description: "All Product Summary",
    icon: BarChart3,
    gradient: "linear-gradient(to bottom right, #f8fafc, #f1f5f9, #f8fafc)",
    color: "#475569",
    hoverGradient: "linear-gradient(to bottom right, #475569, #334155, #1e293b)",
  },
  {
    label: "Q1 - Performing Well",
    value: 73,
    description: "Continue",
    icon: TrendingUp,
    gradient: "linear-gradient(to bottom right, #fff1f2, #ffe4e6, #fff1f2)",
    color: "#e11d48",
    hoverGradient:
      "linear-gradient(to bottom right, #e11d48, #db2777, #be185d)",
  },
  {
    label: "Q2 - Need Attention",
    value: 230,
    description: "Optimize",
    icon: AlertTriangle,
    gradient: "linear-gradient(to bottom right, #fffbeb, #fef9c3, #fffbeb)",
    color: "#f59e0b",
    hoverGradient:
      "linear-gradient(to bottom right, #fbbf24, #f59e0b, #d97706)",
  },
  {
    label: "Q3 - Experiment",
    value: 243,
    description: "Optimize then Scale",
    icon: FlaskConical,
    gradient: "linear-gradient(to bottom right, #fff7ed, #fee2d5, #fff7ed)",
    color: "#ea580c",
    hoverGradient:
      "linear-gradient(to bottom right, #ea580c, #d9480f, #dc2626)",
  },
  {
    label: "Q4 - Opportunity",
    value: 188,
    description: "Scale Up Spends",
    icon: TrendingUp,
    gradient: "linear-gradient(to bottom right, #eff6ff, #e0f2fe, #eff6ff)",
    color: "#0284c7",
    hoverGradient:
      "linear-gradient(to bottom right, #0284c7, #0ea5e9, #2563eb)",
  },
];

// Animation keyframes
const pulseKeyframes = {
  "0%": { opacity: 0.5 },
  "50%": { opacity: 1 },
  "100%": { opacity: 0.5 },
};

const pingKeyframes = {
  "0%": { transform: "scale(0.8)", opacity: 1 },
  "100%": { transform: "scale(2.4)", opacity: 0 },
};

export default function InsightHorizontalKpis() {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <Box sx={{ p: 4, minHeight: "60vh", background: "linear-gradient(to bottom right, #f8fafc, #dbeafe, #e0e7ff)" }}>
      <Box sx={{ maxWidth: "1200px", mx: "auto" }}>
        {/* HEADER CARD */}
        <Card
          sx={{
            p: 4,
            mb: 5,
            borderRadius: "30px",
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.3)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* BACKGROUND COLOR BLOBS */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0.15,
              pointerEvents: "none",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 250,
                height: 250,
                background: "linear-gradient(to bottom right, #3b82f6, #8b5cf6)",
                borderRadius: "50%",
                filter: "blur(80px)",
                animation: "pulse 4s ease-in-out infinite",
                "@keyframes pulse": pulseKeyframes,
              }}
            />
            <Box
              sx={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 350,
                height: 350,
                background: "linear-gradient(to top left, #ec4899, #f97316)",
                borderRadius: "50%",
                filter: "blur(90px)",
                animation: "pulse 4s ease-in-out infinite",
                animationDelay: "1s",
              }}
            />
          </Box>

          {/* HEADER CONTENT */}
          <Box sx={{ position: "relative", display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                p: 2,
                background: "linear-gradient(to bottom right, #6366f1, #7c3aed)",
                borderRadius: "16px",
                boxShadow: 3,
              }}
            >
              <Sparkles size={26} color="white" />
            </Box>

            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  background: "linear-gradient(to right, #1e293b, #334155, #0f172a)",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                }}
              >
                Actionable Insights
              </Typography>
              <Typography sx={{ color: "#64748b", mt: 0.5, fontWeight: 500 }}>
                Real-time performance analytics
              </Typography>
            </Box>
          </Box>

          <Box sx={{ height: 1, background: "linear-gradient(to right, transparent, #e2e8f0, transparent)", my: 3 }} />

          <Box
            sx={{
              display: "inline-block",
              px: 3,
              py: 1,
              borderRadius: 2,
              background: "linear-gradient(to right, #f1f5f9, #f8fafc)",
              border: "1px solid #e2e8f0",
              boxShadow: 1,
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#334155" }}>
              All Product Summary
            </Typography>
          </Box>
        </Card>

        {/* KPI CARDS GRID */}
      <Grid container spacing={3}>
  {insightKPIs.map((item, i) => {
    const Icon = item.icon;
    const isHovered = hoveredIndex === i;

    return (
      <Grid item xs={12} sm={6} md={2.4} key={i}>
        <Box
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          sx={{ position: "relative" }}
        >
          {/* Soft Glow */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: item.gradient,
              borderRadius: "24px",
              filter: "blur(22px)",
              opacity: isHovered ? 0.18 : 0,       // 🔥 softer glow
              transition: "opacity 0.45s ease",
            }}
          />

          {/* CARD */}
          <Card
            sx={{
              p: 3,
              height: 200,
              borderRadius: "28px",
              border: "1px solid #edf2f7",
              background: item.gradient,
              boxShadow: "0px 4px 14px rgba(0,0,0,0.06)",

              position: "relative",
              overflow: "hidden",
              transition: "all 0.45s cubic-bezier(.4,0,.2,1)",
              transform: isHovered ? "translateY(-4px)" : "none",
            }}
          >
            {/* Subtle hover tint */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: item.hoverGradient,
                opacity: isHovered ? 0.22 : 0,      // 💎 softer highlight
                transition: "opacity 0.45s ease",
              }}
            />

            {/* Content */}
            <Box sx={{ position: "relative", zIndex: 10 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    opacity: isHovered ? 0.9 : 0.8,
                    color: isHovered ? "#334155" : "#475569",
                    transition: "color 0.3s ease",
                  }}
                >
                  {item.label}
                </Typography>

                <Box
                  sx={{
                    p: 1,
                    borderRadius: "16px",
                    background: isHovered ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.7)",
                    transition: "all 0.3s ease",
                  }}
                >
                  <Icon size={20} color={item.color} />
                </Box>
              </Box>

              <Typography
                sx={{
                  fontSize: "40px",
                  fontWeight: 900,
                  color: item.color,
                  opacity: isHovered ? 1 : 0.9,
                  transition: "all 0.4s ease",
                }}
              >
                {item.value}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", mt: 2 }}>
                <Box
                  sx={{
                    height: 4,
                    width: isHovered ? 60 : 50,
                    background: isHovered ? "rgba(0,0,0,0.2)" : "#e2e8f0",
                    borderRadius: 2,
                    transition: "all 0.4s ease",
                  }}
                />

                <Typography
                  sx={{
                    ml: 1,
                    fontSize: 11,
                    fontWeight: 600,
                    opacity: isHovered ? 0.75 : 0.6,
                    color: "#475569",
                    transition: "all 0.4s ease",
                  }}
                >
                  {item.description}
                </Typography>
              </Box>
            </Box>
          </Card>
        </Box>
      </Grid>
    );
  })}
</Grid>

        {/* Bottom Stats Bar */}
        <Card
          sx={{
            mt: 4,
            p: 2,
            borderRadius: "20px",
            background: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 2 }}>
            {[
              ["98.5%", "Accuracy Rate"],
              ["+24%", "Growth YoY"],
              ["1.2M", "Total Reach"],
              ["4.8★", "Avg Rating"],
            ].map(([value, label], i) => (
              <Box key={i} textAlign="center">
                <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{value}</Typography>
                <Typography sx={{ fontSize: 12, color: "#64748b" }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Card>
      </Box>
    </Box>
  );
}
