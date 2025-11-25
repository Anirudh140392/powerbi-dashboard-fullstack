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

const PlatformOverview = ({
  data = defaultPlatforms,
  onViewTrends,
  activeKpisTab,
}) => {
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
              {activeKpisTab}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            {activeKpisTab !== "Platform Overview" && (
              <Box
                sx={{
                  borderRadius: 5,
                  width: 180,
                  height: 36,
                  border: `1px solid ${theme.palette.divider}`,
                  background:
                    theme.palette.mode === "dark"
                      ? theme.palette.background.paper
                      : "#f2f6fb",
                  display: "flex",
                  alignItems: "center",
                  px: 1.5,
                }}
              >
                <select
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    fontSize: "0.85rem",
                    color: theme.palette.text.secondary,
                  }}
                >
                  <option>Blinkit</option>
                  <option>Zepto</option>
                  <option>Instamart</option>
                </select>
              </Box>
            )}

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
