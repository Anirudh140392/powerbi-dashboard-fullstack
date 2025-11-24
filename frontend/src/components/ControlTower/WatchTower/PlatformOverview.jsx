import React from "react";
// import { Card, Container } from "react-bootstrap";
import {
  BsGrid3X3GapFill,
  BsSearch,
  BsInfoCircle,
  BsCalendar,
} from "react-icons/bs";
import {
  Box,
  Card,
  CardContent,
  Container,
  Typography,
  Button,
  useTheme,
} from "@mui/material";

const defaultPlatforms = [
  {
    key: "all",
    label: "All",
    logo: "https://cdn-icons-png.flaticon.com/512/711/711284.png",
    columns: [
      {
        title: "Offtake",
        value: "₹9.0 Cr",
        change: { text: "▲3.2% (₹28.8 lac)", positive: true },
        meta: { units: "4.9 lac", change: "▲2.4%" },
      },
      {
        title: "Est. Category Share",
        value: "35.0%",
        change: { text: "▲0.4% (+0.1 pp)", positive: true },
        meta: { units: "4.9 lac", change: "▲2.4%" },
      },
      {
        title: "Category Size",
        value: "₹25.7 Cr",
        change: { text: "▲2.9% (₹72.5 lac)", positive: true },
        meta: { units: "4.9 lac", change: "▲2.4%" },
      },
      {
        title: "Wt. OSA%",
        value: "78.6%",
        change: { text: "▼9.4% (-8.2 pp)", positive: false },
        meta: { units: "4.9 lac", change: "▲2.4%" },
      },
      {
        title: "Wt. Disc %",
        value: "26.5%",
        change: { text: "▲6.2% (+1.6 pp)", positive: true },
        meta: { units: "4.9 lac", change: "▲2.4%" },
      },
      // {
      //   title: "Overall SOV",
      //   value: "37.4%",
      //   change: { text: "▼7.2% (-2.9 pp)", positive: false },
      //   meta: { units: "4.9 lac", change: "▲2.4%" },
      // },
      // {
      //   title: "Impressions",
      //   value: "21.0M",
      //   change: { text: "▲4.6% (+0.9M)", positive: true },
      //   meta: { units: "4.9 lac", change: "▲2.4%" },
      // },
      // {
      //   title: "Clicks",
      //   value: "973K",
      //   change: { text: "▲3.6% (+33.6K)", positive: true },
      //   meta: { units: "4.9 lac", change: "▲2.4%" },
      // },
      // {
      //   title: "CTR",
      //   value: "4.6%",
      //   change: { text: "▲0.2 pp", positive: true },
      //   meta: { units: "4.9 lac", change: "▲2.4%" },
      // },
      // {
      //   title: "CVR",
      //   value: "2.2%",
      //   change: { text: "▲0.1 pp", positive: true },
      //   meta: { units: "4.9 lac", change: "▲2.4%" },
      // },
      // {
      //   title: "Orders",
      //   value: "13.8K",
      //   change: { text: "▲1.5% (+201)", positive: true },
      //   meta: { units: "4.9 lac", change: "▲2.4%" },
      // },
      // {
      //   title: "Ad Spends",
      //   value: "₹1.63 Cr",
      //   change: { text: "▲2.8% (₹4.6 lac)", positive: true },
      //   meta: { units: "4.9 lac", change: "▲2.4%" },
      // },
      // {
      //   title: "ROAS",
      //   value: "5.44x",
      //   change: { text: "▲3.1% (+0.2x)", positive: true },
      //   meta: { units: "4.9 lac", change: "▲2.4%" },
      // },
    ],
  },

  // BLINKIT
  {
    key: "blinkit",
    label: "Blinkit",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Blinkit-yellow-rounded.svg",
    columns: [
      {
        title: "Offtake",
        value: "₹2.1 Cr",
        change: { text: "▲3.0% (₹6.1 lac)", positive: true },
        meta: { units: "1.1 lac", change: "▲1.8%" },
      },
      {
        title: "Est. Category Share",
        value: "38.3%",
        change: { text: "▲0.6% (+0.2 pp)", positive: true },
        meta: { units: "1.1 lac", change: "▲1.8%" },
      },
      {
        title: "Category Size",
        value: "₹5.48 Cr",
        change: { text: "▲2.2% (₹11.9 lac)", positive: true },
        meta: { units: "1.1 lac", change: "▲1.8%" },
      },
      {
        title: "Wt. OSA%",
        value: "75.4%",
        change: { text: "▼15.5% (-13.9 pp)", positive: false },
        meta: { units: "1.1 lac", change: "▲1.8%" },
      },
      {
        title: "Wt. Disc %",
        value: "24.0%",
        change: { text: "▲7.4% (+1.7 pp)", positive: true },
        meta: { units: "1.1 lac", change: "▲1.8%" },
      },
      // {
      //   title: "Overall SOV",
      //   value: "36.5%",
      //   change: { text: "▼7.3% (-2.9 pp)", positive: false },
      //   meta: { units: "1.1 lac", change: "▲1.8%" },
      // },
      // {
      //   title: "Impressions",
      //   value: "4.2M",
      //   change: { text: "▲4.0% (+0.16M)", positive: true },
      //   meta: { units: "1.1 lac", change: "▲1.8%" },
      // },
      // {
      //   title: "Clicks",
      //   value: "196K",
      //   change: { text: "▲3.5% (+6.6K)", positive: true },
      //   meta: { units: "1.1 lac", change: "▲1.8%" },
      // },
      // {
      //   title: "CTR",
      //   value: "4.7%",
      //   change: { text: "▲0.2 pp", positive: true },
      //   meta: { units: "1.1 lac", change: "▲1.8%" },
      // },
      // {
      //   title: "CVR",
      //   value: "2.1%",
      //   change: { text: "▲0.1 pp", positive: true },
      //   meta: { units: "1.1 lac", change: "▲1.8%" },
      // },
      // {
      //   title: "Orders",
      //   value: "4.1K",
      //   change: { text: "▲1.5% (+60)", positive: true },
      //   meta: { units: "1.1 lac", change: "▲1.8%" },
      // },
      // {
      //   title: "Ad Spends",
      //   value: "₹0.36 Cr",
      //   change: { text: "▲2.1% (₹0.8 lac)", positive: true },
      //   meta: { units: "1.1 lac", change: "▲1.8%" },
      // },
      // {
      //   title: "ROAS",
      //   value: "5.8x",
      //   change: { text: "▲2.5% (+0.1x)", positive: true },
      //   meta: { units: "1.1 lac", change: "▲1.8%" },
      // },
    ],
  },

  // ZEPTO
  {
    key: "zepto",
    label: "Zepto",
    logo: "https://upload.wikimedia.org/wikipedia/en/7/7d/Logo_of_Zepto.png",
    columns: [
      {
        title: "Offtake",
        value: "₹1.6 Cr",
        change: { text: "▲3.6% (₹5.6 lac)", positive: true },
        meta: { units: "0.9 lac", change: "▲1.2%" },
      },
      {
        title: "Est. Category Share",
        value: "36.4%",
        change: { text: "▲0.4% (+0.1 pp)", positive: true },
        meta: { units: "0.9 lac", change: "▲1.2%" },
      },
      {
        title: "Category Size",
        value: "₹4.40 Cr",
        change: { text: "▲1.9% (₹8.3 lac)", positive: true },
        meta: { units: "0.9 lac", change: "▲1.2%" },
      },
      {
        title: "Wt. OSA%",
        value: "79.7%",
        change: { text: "▼4.7% (-3.9 pp)", positive: false },
        meta: { units: "0.9 lac", change: "▲1.2%" },
      },
      {
        title: "Wt. Disc %",
        value: "29.9%",
        change: { text: "▲6.3% (+1.8 pp)", positive: true },
        meta: { units: "0.9 lac", change: "▲1.2%" },
      },
    ],
  },

  // SWIGGY
  {
    key: "swiggy",
    label: "Swiggy",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Swiggy_Logo_2024.webp",
    columns: [
      {
        title: "Offtake",
        value: "₹1.1 Cr",
        change: { text: "▲2.5% (₹2.8 lac)", positive: true },
        meta: { units: "0.7 lac", change: "▲0.8%" },
      },
      {
        title: "Est. Category Share",
        value: "30.5%",
        change: { text: "▲0.2% (+0.1 pp)", positive: true },
        meta: { units: "0.7 lac", change: "▲0.8%" },
      },
      {
        title: "Category Size",
        value: "₹3.61 Cr",
        change: { text: "▲1.7% (₹6.1 lac)", positive: true },
        meta: { units: "0.7 lac", change: "▲0.8%" },
      },
      {
        title: "Wt. OSA%",
        value: "83.3%",
        change: { text: "▼2.8% (-2.4 pp)", positive: false },
        meta: { units: "0.7 lac", change: "▲0.8%" },
      },
      {
        title: "Wt. Disc %",
        value: "27.3%",
        change: { text: "▲4.4% (+1.1 pp)", positive: true },
        meta: { units: "0.7 lac", change: "▲0.8%" },
      },
    ],
  },

  // AMAZON
  {
    key: "amazon",
    label: "Amazon",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
    columns: [
      {
        title: "Offtake",
        value: "₹2.2 Cr",
        change: { text: "▲3.1% (₹6.6 lac)", positive: true },
        meta: { units: "1.1 lac", change: "▲2.0%" },
      },
      {
        title: "Est. Category Share",
        value: "33.5%",
        change: { text: "▲0.3% (+0.1 pp)", positive: true },
        meta: { units: "1.1 lac", change: "▲2.0%" },
      },
      {
        title: "Category Size",
        value: "₹6.57 Cr",
        change: { text: "▲2.5% (₹16.0 lac)", positive: true },
        meta: { units: "1.1 lac", change: "▲2.0%" },
      },
      {
        title: "Wt. OSA%",
        value: "81.2%",
        change: { text: "▼3.1% (-2.6 pp)", positive: false },
        meta: { units: "1.1 lac", change: "▲2.0%" },
      },
      {
        title: "Wt. Disc %",
        value: "25.5%",
        change: { text: "▲3.6% (+0.9 pp)", positive: true },
        meta: { units: "1.1 lac", change: "▲2.0%" },
      },
    ],
  },
];

const SmallCard = ({ item }) => {
  const theme = useTheme();
  const { value, meta } = item;
  const hasValue = value !== null && value !== undefined;

  const cardBg =
    theme.palette.mode === "dark" ? theme.palette.background.paper : "#fff";
  const muted = theme.palette.text.secondary;
  const positive = theme.palette.success.main;
  const negative = theme.palette.error.main;

  return (
    <Card
      sx={{
        mb: 1.5,
        borderRadius: 2,
        height: 70,
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 1px 3px rgba(0,0,0,0.6)"
            : "0px 1px 3px rgba(0,0,0,0.1)",
        background: cardBg,
      }}
    >
      <CardContent sx={{ py: 1.2 }}>
        <Typography fontWeight="bold" fontSize="1.05rem" color="text.primary">
          {hasValue ? (
            value
          ) : (
            <span style={{ color: muted, fontSize: "0.8rem" }}>
              No Data Available
            </span>
          )}
        </Typography>

        {hasValue && meta && (
          <Typography fontSize="0.75rem" color="text.secondary" mt={0.4}>
            #{meta.units}{" "}
            <span
              style={{
                marginLeft: 4,
                color: meta.change?.includes("▲") ? positive : negative,
              }}
            >
              {meta.change}
            </span>
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const PlatformOverview = ({ data = defaultPlatforms, onViewTrends }) => {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 4 }}>
      <Card
        sx={{
          p: 3,
          borderRadius: 4,
          boxShadow: 4,
          height: 740,
          background: theme.palette.background.paper,
        }}
      >
        {/* Header */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
          mb={3}
        >
          <Box display="flex" alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? theme.palette.background.default
                    : "#f8f9fa",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BsGrid3X3GapFill size={20} color={theme.palette.primary.main} />
            </Box>

            <Typography ml={1.2} fontWeight={600} fontSize="1.1rem">
              Platform Overview
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            {/* Stale Data */}
            <Box
              display="flex"
              alignItems="center"
              px={1.5}
              py={0.7}
              sx={{
                borderRadius: 1,
                fontSize: "0.8rem",
                fontWeight: 500,
                background:
                  theme.palette.mode === "dark"
                    ? theme.palette.background.default
                    : "#f8f3f0",
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.secondary,
              }}
            >
              <BsCalendar style={{ marginRight: 6 }} /> Stale Data
            </Box>

            {/* Search Box */}
            <Box
              display="flex"
              alignItems="center"
              px={1.5}
              sx={{
                borderRadius: 5,
                width: 220,
                height: 36,
                border: `1px solid ${theme.palette.divider}`,
                background:
                  theme.palette.mode === "dark"
                    ? theme.palette.background.paper
                    : "#f2f6fb",
              }}
            >
              <input
                type="text"
                placeholder="Search"
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "0.85rem",
                }}
              />
              <BsSearch size={15} color={theme.palette.text.secondary} />
            </Box>
          </Box>
        </Box>

        {/* Horizontal Scroll Section */}
        <Box
          sx={{
            overflowX: "auto",
            pb: 1,
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Box
            display="flex"
            flexWrap="nowrap"
            alignItems="flex-start"
            height="612px"
            sx={{ gap: 2, minWidth: "100%" }}
          >
            {/* LEFT STICKY METRIC LIST */}
            <Box
              sx={{
                width: 160,
                minWidth: 140,
                flexShrink: 0,
                position: "sticky",
                left: 0,
                top: 0,

                background:
                  theme.palette.mode === "dark"
                    ? theme.palette.background.paper
                    : "#fff",
                zIndex: 5,
                height: "620px",
                boxShadow: "4px 0 6px -3px rgba(0,0,0,0.1)",
                pb: 2,
              }}
            >
              <Box display="grid" gap={1.4}>
                {/* Sticky Small Header Icon */}
                <Box
                  sx={{
                    width: 42,
                    height: 34,
                    borderRadius: "50%",
                    background:
                      theme.palette.mode === "dark"
                        ? theme.palette.background.paper
                        : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "sticky",
                    top: 28,

                    zIndex: 4,
                    mx: "auto",
                    boxShadow:
                      theme.palette.mode === "dark"
                        ? "0 2px 4px rgba(0,0,0,0.6)"
                        : "0 2px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <BsGrid3X3GapFill
                    size={18}
                    color={theme.palette.text.secondary}
                  />
                </Box>

                {/* Metric Buttons */}
                {data[0]?.columns.map((metric, i) => (
                  <Button
                    key={i}
                    sx={{
                      borderRadius: 2,
                      padding: "0.65rem 0.75rem",
                      pt: 2,
                      pl: 2.5,
                      height: 85,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background:
                        theme.palette.mode === "dark"
                          ? theme.palette.background.default
                          : "#f2f6fb",
                      color: theme.palette.text.primary,
                      border: `1px solid ${theme.palette.divider}`,
                      width: "100%",
                      mb: 1.5,
                      textTransform: "none",
                    }}
                  >
                    {metric.title}
                    <BsInfoCircle
                      size={14}
                      color={theme.palette.text.secondary}
                    />
                  </Button>
                ))}
              </Box>
            </Box>

            {/* PLATFORM COLUMNS */}
            {data.map((platform) => (
              <Box
                key={platform.key}
                sx={{
                  width: "min(260px, 45vw)",
                  minWidth: 220,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    border: "1px solid #e5e5e5",
                    borderRadius: 2,
                    background: "#f9fafb",
                    mr: 1,
                    overflowY: "auto",
                  }}
                >
                  {/* Sticky Platform Header */}
                  <Box
                    sx={{
                      mb: 1.5,
                      position: "sticky",
                      top: 4,
                      zIndex: 3,
                      background: theme.palette.background.default,
                    }}
                  >
                    <Card
                      sx={{
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        background:
                          platform.key === "all"
                            ? theme.palette.primary.main
                            : theme.palette.background.paper,
                        border:
                          platform.key === "all"
                            ? `2px solid ${theme.palette.primary.main}`
                            : `1px solid ${theme.palette.divider}`,
                        color:
                          platform.key === "all"
                            ? theme.palette.primary.contrastText
                            : theme.palette.text.primary,
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1}>
                        <img
                          src={platform.logo}
                          alt={platform.label}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            objectFit: "contain",
                            background: "#fff",
                            padding: 2,
                          }}
                        />
                        <Typography fontWeight={600} fontSize="0.9rem">
                          {platform.label}
                        </Typography>
                      </Box>
                    </Card>
                  </Box>

                  {/* Metric Cards */}
                  {platform.columns.map((column, i) => (
                    <Card
                      key={i}
                      sx={{
                        mb: 1,
                        p: 0.5,
                        borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        background: theme.palette.background.paper,
                        maxHeight: 90,
                        transition: "transform 0.1s ease",
                        "&:hover": { transform: "scale(1.02)" },
                      }}
                    >
                      <CardContent sx={{ py: 1, px: 1.5 }}>
                        <SmallCard item={column} />
                      </CardContent>
                    </Card>
                  ))}

                  {/* Footer Buttons */}
                  <Box display="flex" gap={1.2} mt={1}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewTrends(platform.label);
                      }}
                      sx={{
                        flex: 1,
                        textTransform: "none",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#2563eb",
                        "&:hover": { background: "#eff6ff" },
                      }}
                    >
                      My Trends <span style={{ fontSize: 10 }}>▶</span>
                    </Button>

                    <Button
                      variant="text"
                      size="small"
                      sx={{
                        flex: 1,
                        textTransform: "none",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#2563eb",
                        "&:hover": { background: "#eff6ff" },
                      }}
                    >
                      Competition <span style={{ fontSize: 10 }}>▶</span>
                    </Button>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export default PlatformOverview;
