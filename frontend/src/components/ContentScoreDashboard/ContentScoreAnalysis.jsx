// --------------------------------------------------------------
//  NEXT-GEN CONTENT ANALYSIS UI — LIGHT THEME (React JS + MUI)
// --------------------------------------------------------------

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Box,
  Grid,
  Typography,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Drawer,
  Fab,
  Divider,
  Tabs,
  Tab,
  LinearProgress,
  Paper,
  IconButton,
  Stack,
} from "@mui/material";

import { motion } from "framer-motion";
import { Filter, X, ChevronRight } from "lucide-react";
import styled from "styled-components";

import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import axiosInstance from "../../api/axiosInstance";

// --------------------------------------------------------------
// SAMPLE DATA
// --------------------------------------------------------------
const MOCK_ROWS = [
  {
    platform: "Instamart",
    format: "Ice Cream",
    brand: "Amul",
    descriptionCount: 39,
    imageCount: 3,
    ratingCount: 0,
    ratingValue: 0,
    titleCount: 37,
    descriptionScore: 9,
    imageScore: 4,
    ratingScore: 0,
    reviewScore: 0,
    titleScore: 10,
  },
  {
    platform: "Instamart",
    format: "Ice Cream",
    brand: "Baskin Robbins",
    descriptionCount: 43,
    imageCount: 2,
    ratingCount: 0,
    ratingValue: 0,
    titleCount: 46,
    descriptionScore: 10,
    imageScore: 3,
    ratingScore: 0,
    reviewScore: 0,
    titleScore: 10,
  },
  {
    platform: "Blinkit",
    format: "Frozen",
    brand: "Kwality Walls",
    descriptionCount: 31,
    imageCount: 4,
    ratingCount: 10,
    ratingValue: 4.1,
    titleCount: 29,
    descriptionScore: 7,
    imageScore: 6,
    ratingScore: 10,
    reviewScore: 4,
    titleScore: 7,
  },
];

// --------------------------------------------------------------
// UTILITIES
// --------------------------------------------------------------
const getOverallScore = (row) => {
  return (
    row.descriptionScore +
    row.imageScore +
    row.ratingScore +
    row.reviewScore +
    row.titleScore
  );
};

const getStatusLabel = (score) => {
  if (score >= 70) return "Excellent";
  if (score >= 50) return "Good";
  if (score >= 30) return "Needs Work";
  return "Weak";
};

const getStatusColor = (score) => {
  if (score >= 70) return "#43A047";
  if (score >= 50) return "#1E88E5";
  if (score >= 30) return "#FB8C00";
  return "#E53935";
};

// --------------------------------------------------------------
// DESCRIPTION ANALYZER — SMART LOGIC
// --------------------------------------------------------------
const analyzeDescription = (count) => {
  let status = "";
  let color = "";
  let insight = "";
  let recommendation = "";
  let severity = 0;

  if (count === 0) {
    status = "Missing";
    color = "#E53935";
    insight = "No description found. This severely impacts conversion.";
    recommendation =
      "Add a keyword-rich, structured description of at least 500–800 words.";
    severity = 3;
  } else if (count < 100) {
    status = "Very Short";
    color = "#FB8C00";
    insight = "Description is too short to communicate value.";
    recommendation =
      "Expand to 400–600 words. Add bullet points, features, benefits, and USPs.";
    severity = 2;
  } else if (count < 300) {
    status = "Short";
    color = "#F9A825";
    insight = "Description covers basics but lacks depth.";
    recommendation =
      "Increase detail: Add specifications, use-cases, ingredients, and trust elements.";
    severity = 1;
  } else if (count <= 1000) {
    status = "Optimal";
    color = "#43A047";
    insight = "Description is within ideal length and well-balanced.";
    recommendation =
      "Add structured formatting (H1/H2), relevant keywords, and FAQs.";
    severity = 0;
  } else if (count <= 1600) {
    status = "Long";
    color = "#1E88E5";
    insight = "Description is good but may feel lengthy.";
    recommendation =
      "Shorten by 15–20%. Use concise bullet points and highlight key value points.";
    severity = 1;
  } else {
    status = "Too Long";
    color = "#8E24AA";
    insight = "Very long description may reduce readability.";
    recommendation =
      "Trim to ~800–1200 words. Remove repetitive lines and focus on clarity.";
    severity = 2;
  }

  return { status, color, insight, recommendation, severity };
};

// --------------------------------------------------------------
// STYLED COMPONENTS
// --------------------------------------------------------------
const GlassCard = styled(motion.div)`
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 18px;
  padding: 18px 20px;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.25);
`;

const Pill = styled.div`
  padding: 5px 12px;
  border-radius: 999px;
  background: ${(p) => p.bg || "rgba(148,163,184,0.08)"};
  font-size: 11px;
  font-weight: 600;
  color: ${(p) => p.color || "#475569"};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const SmallLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.08em;
`;

// --------------------------------------------------------------
// SCORE RING CARD
// --------------------------------------------------------------
const PlatformScoreRing = ({ platform, score }) => {
  const COLORS = {
    Blinkit: "#16A34A",
    Zepto: "#9333EA",
    Instamart: "#0284C7",
  };

  const data = [{ value: score, fill: COLORS[platform] || "#6366F1" }];

  return (
    <GlassCard whileHover={{ y: -4, boxShadow: "0 20px 45px rgba(15,23,42,0.15)" }}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <SmallLabel>Platform Score</SmallLabel>
          <Typography variant="h6" sx={{ mt: 0.5 }}>
            {platform}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <Typography variant="h4" fontWeight={800}>
              {score}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              /100
            </Typography>
          </Stack>

          <Pill
            style={{
              marginTop: 8,
            }}
            bg={getStatusColor(score) + "15"}
            color={getStatusColor(score)}
          >
            {getStatusLabel(score)}
          </Pill>
        </Box>

        <Box sx={{ width: 120, height: 120 }}>
          <ResponsiveContainer>
            <RadialBarChart
              data={data}
              startAngle={220}
              endAngle={-40}
              innerRadius="70%"
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={999} />
            </RadialBarChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </GlassCard>
  );
};

// --------------------------------------------------------------
// METRIC STRIP
// --------------------------------------------------------------
const MetricStrip = ({ label, value, max, caption }) => {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <GlassCard
      style={{ marginBottom: 14 }}
      whileHover={{ y: -2, boxShadow: "0 18px 40px rgba(15,23,42,0.08)" }}
    >
      <Box display="flex" alignItems="center" gap={3}>
        <Box flex={2}>
          <SmallLabel>{label}</SmallLabel>
          <Typography variant="body2" sx={{ mt: 0.5 }} color="text.secondary">
            {caption}
          </Typography>
        </Box>
        <Box flex={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" fontWeight={700}>
              {value}
            </Typography>
            {max && (
              <Typography variant="caption" color="text.secondary">
                Max {max}
              </Typography>
            )}
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min(pct, 100)}
            sx={{
              mt: 1,
              height: 8,
              borderRadius: 999,
              backgroundColor: "#E2E8F0",
              "& .MuiLinearProgress-bar": {
                borderRadius: 999,
              },
            }}
          />
        </Box>
      </Box>
    </GlassCard>
  );
};

// --------------------------------------------------------------
// BRAND CARD
// --------------------------------------------------------------
const BrandCard = ({ row }) => {
  const overall = getOverallScore(row);
  const mainColor =
    overall >= 60 ? "#22C55E" : overall >= 40 ? "#3B82F6" : "#F97316";

  return (
    <GlassCard
      whileHover={{ y: -4, boxShadow: "0 24px 60px rgba(15,23,42,0.18)" }}
      style={{ height: "100%" }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <SmallLabel>{row.platform}</SmallLabel>
          <Typography variant="h6" sx={{ mt: 0.5 }}>
            {row.brand}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {row.format}
          </Typography>
        </Box>

        <Pill bg={mainColor + "18"} color={mainColor}>
          {getStatusLabel(overall)}
        </Pill>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Overall Content Score
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <Typography variant="h4" fontWeight={800} sx={{ color: mainColor }}>
            {overall}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            / 100
          </Typography>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={Math.min((overall / 100) * 100, 100)}
          sx={{
            mt: 1.5,
            height: 8,
            borderRadius: 999,
            backgroundColor: "#E2E8F0",
            "& .MuiLinearProgress-bar": {
              borderRadius: 999,
              background: `linear-gradient(90deg, ${mainColor}, #38BDF8)`,
            },
          }}
        />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Grid container spacing={1}>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Description
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {row.descriptionScore}/20
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Title
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {row.titleScore}/20
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Images
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {row.imageScore}/20
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Rating
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {row.ratingScore}/20
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Reviews
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {row.reviewScore}/10
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <Typography variant="caption" color="text.secondary">
            Rating Count
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {row.ratingCount}
          </Typography>
        </Grid>
      </Grid>

      <Box
        sx={{
          mt: 2,
          p: 1.2,
          borderRadius: 14,
          background: "linear-gradient(90deg,#EEF2FF,#ECFEFF)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            Next Best Action
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            Focus on {overall < 60 ? "description & images" : "ratings & reviews"}
          </Typography>
        </Box>
        <IconButton size="small">
          <ChevronRight size={18} />
        </IconButton>
      </Box>
    </GlassCard>
  );
};

// --------------------------------------------------------------
// MAIN PAGE
// --------------------------------------------------------------
export default function ContentScoreAnalysis() {
  const [platform, setPlatform] = useState("All");
  const [format, setFormat] = useState("All");
  const [brand, setBrand] = useState("All");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const calledOnce = useRef(false);

  useEffect(() => {
    if (calledOnce.current) return;
    calledOnce.current = true;

    const fetchContentData = async () => {
      try {
        const response = await axiosInstance.get('/content-analysis', {
          params: { platform: 'Blinkit' } // Default filter
        });
        console.log("Content Analysis Data:", response.data);
      } catch (error) {
        console.error("Error fetching Content Analysis data:", error);
      }
    };

    fetchContentData();
  }, []);

  const formats = ["All", ...new Set(MOCK_ROWS.map((r) => r.format))];
  const brands = ["All", ...new Set(MOCK_ROWS.map((r) => r.brand))];

  const filtered = useMemo(
    () =>
      MOCK_ROWS.filter(
        (r) =>
          (platform === "All" || r.platform === platform) &&
          (format === "All" || r.format === format) &&
          (brand === "All" || r.brand === brand)
      ),
    [platform, format, brand]
  );

  const selected = filtered[0];

  const platformScores = { Blinkit: 68, Zepto: 55, Instamart: 40 };

  return (
    <Box
      sx={{
        p: 3,
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #E0F2FE 0, transparent 45%), radial-gradient(circle at bottom right, #F5F3FF 0, #F8FAFC 55%)",
      }}
    >
      {/* HEADER */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Content Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Smart, light-themed view of your platform content health.
          </Typography>
        </Box>

        <Pill bg="rgba(59,130,246,0.08)" color="#1D4ED8">
          Live · Auto Insights
        </Pill>
      </Box>

      {/* TABS */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 999,
          display: "inline-flex",
          mb: 3,
          p: 0.5,
          backgroundColor: "rgba(255,255,255,0.8)",
          border: "1px solid rgba(148,163,184,0.3)",
        }}
      >
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          TabIndicatorProps={{ style: { display: "none" } }}
        >
          <Tab
            label="Overview"
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 999,
              minHeight: 36,
              px: 3,
              mx: 0.3,
              "&.Mui-selected": {
                background:
                  "linear-gradient(90deg,rgba(59,130,246,0.12),rgba(129,140,248,0.12))",
              },
            }}
          />
          <Tab
            label="Brand Comparison"
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 999,
              minHeight: 36,
              px: 3,
              mx: 0.3,
              "&.Mui-selected": {
                background:
                  "linear-gradient(90deg,rgba(16,185,129,0.12),rgba(52,211,153,0.12))",
              },
            }}
          />
        </Tabs>
      </Paper>

      {/* CONTENT */}
      <Box mt={1}>
        {/* ---------------- TAB 0 — OVERVIEW ---------------- */}
        {tab === 0 && selected && (
          <Grid container spacing={3}>
            {/* Platform Score Rings */}
            {Object.keys(platformScores).map((p) => (
              <Grid item xs={12} sm={4} key={p}>
                <PlatformScoreRing platform={p} score={platformScores[p]} />
              </Grid>
            ))}

            {/* Left Column: Focused Brand */}
            <Grid item xs={12} md={4}>
              <GlassCard
                whileHover={{ y: -3, boxShadow: "0 20px 50px rgba(15,23,42,0.14)" }}
                style={{ height: "100%" }}
              >
                <SmallLabel>Focused Brand</SmallLabel>
                <Typography variant="h6" sx={{ mt: 0.7 }}>
                  {selected.brand}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selected.platform} · {selected.format}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                {/* -------- Description Logic (FULL AI LOGIC ADDED) -------- */}
                {(() => {
                  const desc = analyzeDescription(selected.descriptionCount);
                  return (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        Description Status
                      </Typography>

                      <Box
                        sx={{
                          mt: 0.5,
                          display: "inline-block",
                          px: 1,
                          py: 0.5,
                          borderRadius: 2,
                          background: desc.color + "22",
                        }}
                      >
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ color: desc.color }}
                        >
                          {desc.status} · {selected.descriptionCount} words
                        </Typography>
                      </Box>

                      <Typography
                        variant="body2"
                        sx={{ mt: 1, color: "#374151", lineHeight: 1.4 }}
                      >
                        {desc.insight}
                      </Typography>

                      <Typography
                        variant="caption"
                        sx={{
                          mt: 1.2,
                          display: "block",
                          color: "#6B7280",
                          background: "rgba(148,163,184,0.12)",
                          p: 1.2,
                          borderRadius: 2,
                          fontWeight: 500,
                          lineHeight: 1.4,
                        }}
                      >
                        {desc.recommendation}
                      </Typography>
                    </>
                  );
                })()}

                <Divider sx={{ my: 1.5 }} />

                {/* Meta KPIs */}
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Images
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selected.imageCount}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Ratings
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selected.ratingValue || "N/A"}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Rating Count
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selected.ratingCount}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Title Length
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selected.titleCount} chars
                    </Typography>
                  </Grid>
                </Grid>
              </GlassCard>
            </Grid>

            {/* Right Column: KPI Strips */}
            <Grid item xs={12} md={8}>
              <MetricStrip
                label="Description Score"
                value={selected.descriptionScore}
                max={20}
                caption={`Current description count: ${selected.descriptionCount}.`}
              />
              <MetricStrip
                label="Title Score"
                value={selected.titleScore}
                max={20}
                caption={`Current title length: ${selected.titleCount} characters.`}
              />
              <MetricStrip
                label="Image Score"
                value={selected.imageScore}
                max={20}
                caption={`You have ${selected.imageCount} images.`}
              />
              <MetricStrip
                label="Rating Score"
                value={selected.ratingScore}
                max={20}
                caption={
                  selected.ratingCount === 0
                    ? "Ratings not available for this item."
                    : `Rating: ${selected.ratingValue} from ${selected.ratingCount} users.`
                }
              />
              <MetricStrip
                label="Review Score"
                value={selected.reviewScore}
                max={10}
                caption={"Review activity insights."}
              />
            </Grid>
          </Grid>
        )}

        {/* ---------------- TAB 1 — BRAND COMPARISON ---------------- */}
        {tab === 1 && (
          <Grid container spacing={3}>
            {filtered.map((row) => (
              <Grid item xs={12} sm={6} md={4} key={row.brand + row.platform}>
                <BrandCard row={row} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Floating Filter Button */}
      <Fab
        color="primary"
        onClick={() => setDrawerOpen(true)}
        sx={{ position: "fixed", bottom: 30, right: 30, boxShadow: 6 }}
      >
        <Filter size={22} />
      </Fab>

      {/* Filter Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 340,
            p: 3,
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(18px)",
          },
        }}
      >
        <Box>
          <Box display="flex" justifyContent="space-between" mb={2}>
            <Typography variant="h6" fontWeight={700}>
              Filters
            </Typography>
            <X onClick={() => setDrawerOpen(false)} style={{ cursor: "pointer" }} />
          </Box>

          <Divider sx={{ mb: 2 }} />

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Platform</InputLabel>
            <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {["All", "Blinkit", "Zepto", "Instamart"].map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Format</InputLabel>
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              {formats.map((f) => (
                <MenuItem key={f} value={f}>
                  {f}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Brand</InputLabel>
            <Select value={brand} onChange={(e) => setBrand(e.target.value)}>
              {brands.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Drawer>
    </Box>
  );
}
