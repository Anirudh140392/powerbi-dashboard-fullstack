import { Box, Card, CardContent, Typography, Chip, Skeleton } from "@mui/material";
import { useState } from "react";

const CardMetric = ({ data, onViewTrends }) => {
  // Check if data is loading (empty/undefined)
  const isLoading = !data || data.length === 0;

  const defaultCards = [
    { title: "Offtake", value: "₹0", sub: "MTD (Month-to-Date)", change: "0%", changeColor: "grey", prevText: "vs Previous Month", extra: "#Units: 0", extraChange: "0%", extraChangeColor: "grey" },
    { title: "Availability", value: "0%", sub: "MTD Coverage", change: "0%", changeColor: "grey", prevText: "vs Previous Month" },
    { title: "Promo Spends %", value: "0%", sub: "MTD (Avg.)", change: "0%", changeColor: "grey", prevText: "vs Previous Month" },
    { title: "Market Share", value: "0%", sub: "MTD", change: "0%", changeColor: "grey", prevText: "vs Previous Month" },
  ];

  const cards = data && data.length > 0 ? data.map(item => ({
    title: item.name,
    value: item.label,
    sub: item.subtitle,
    change: item.trend,
    changeColor: (item.trendType === 'positive' || item.trendType === 'up') ? '#22c55e' : (item.trendType === 'negative' || item.trendType === 'down') ? '#ef4444' : 'grey',
    prevText: item.comparison,
    extra: item.units ? `#Units: ${item.units}` : null,
    extraChange: item.unitsTrend,
    extraChangeColor: item.unitsTrend && item.unitsTrend.includes('+') ? 'green' : 'red',
    chart: item.chart,
    labels: item.labels
  })) : defaultCards;

  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];

  // Generate smooth data
  const generateValues = (card) => {
    if (card.chart && card.chart.length > 0) {
      return card.chart;
    }
    return months.map(() => Math.floor(Math.random() * 60) + 20);
  };

  const isProfit = (txt) => txt?.includes("▲") || txt?.includes("+");

  const scrollNeeded = cards.length > 5;

  return (
    <Box sx={{ mb: 4 }}>
      <Card sx={{ p: 3, borderRadius: 4, boxShadow: 4 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                bgcolor: "primary.main",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              📈
            </Box>
            <Typography variant="h5" fontWeight={600}>
              Watchtower Overview
            </Typography>
            <Chip label="All" size="large" variant="outlined" />
          </Box>
        </Box>

        {/* Cards Row */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: scrollNeeded ? "auto" : "hidden",
            pb: 1,
            px: 1.5,
            scrollSnapType: scrollNeeded ? "x mandatory" : "none",
          }}
        >
          {isLoading ? (
            // Skeleton loading cards
            [1, 2, 3, 4].map((_, index) => (
              <SkeletonChartCard key={index} scrollNeeded={scrollNeeded} totalCards={4} />
            ))
          ) : (
            cards.map((card, index) => {
              const values = generateValues(card);
              const color = isProfit(card.change) ? "#28a745" : "#dc3545";
              const cardLabels = card.labels || months;

              return (
                <MiniChartCard
                  key={index}
                  card={card}
                  months={cardLabels}
                  values={values}
                  color={color}
                  scrollNeeded={scrollNeeded}
                  totalCards={cards.length}
                  onClick={() => onViewTrends && onViewTrends(card.title, "Metric")}
                />
              );
            })
          )}
        </Box>
      </Card>
    </Box>
  );
};

/* ------------ Skeleton Chart Card - Fancy Shimmer Loading ------------ */
const SkeletonChartCard = ({ scrollNeeded, totalCards }) => {
  return (
    <Card
      sx={{
        flexShrink: 0,
        width: scrollNeeded ? 250 : `${100 / Math.min(totalCards, 5) - 1}%`,
        borderRadius: 3,
        scrollSnapAlign: "start",
      }}
    >
      <CardContent>
        {/* Title skeleton */}
        <Skeleton variant="text" width="50%" height={20} animation="wave" sx={{ borderRadius: 1 }} />

        {/* Value skeleton */}
        <Box display="flex" alignItems="baseline" gap={1} mt={0.5}>
          <Skeleton variant="text" width="40%" height={32} animation="wave" sx={{ borderRadius: 1 }} />
          <Skeleton variant="text" width="30%" height={18} animation="wave" sx={{ borderRadius: 1 }} />
        </Box>

        {/* Change skeleton */}
        <Box display="flex" alignItems="center" gap={1} mt={0.5}>
          <Skeleton variant="text" width={50} height={18} animation="wave" sx={{ borderRadius: 1, bgcolor: 'grey.300' }} />
          <Skeleton variant="text" width={80} height={18} animation="wave" sx={{ borderRadius: 1 }} />
        </Box>

        {/* Extra units skeleton */}
        <Skeleton variant="text" width="60%" height={18} animation="wave" sx={{ mt: 0.5, borderRadius: 1 }} />

        {/* Chart skeleton */}
        <Box mt={1.5} sx={{ height: 80, position: "relative" }}>
          <Skeleton
            variant="rectangular"
            width="100%"
            height={60}
            animation="wave"
            sx={{ borderRadius: 2, mt: 1 }}
          />
          {/* Fake chart dots */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <Skeleton key={i} variant="circular" width={8} height={8} animation="wave" />
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

/* ------------ Mini Chart Component with Tooltip + Smooth Curve ------------ */
const MiniChartCard = ({
  card,
  months,
  values,
  color,
  scrollNeeded,
  totalCards,
  onClick,
}) => {
  const [hover, setHover] = useState(null);

  // Create a smooth Bezier curve path
  const createSmoothPath = () => {
    if (values.length < 2) return ""; // Not enough points for a path

    const points = values.map((v, i) => ({
      x: (i / (values.length - 1)) * 100,
      y: 100 - v,
    }));

    let d = `M ${points[0].x},${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const cpX = (points[i - 1].x + points[i].x) / 2;
      d += ` Q ${cpX},${points[i - 1].y} ${points[i].x},${points[i].y}`;
    }

    return d;
  };

  return (
    <Card
      sx={{
        flexShrink: 0,
        width: scrollNeeded ? 250 : `${100 / Math.min(totalCards, 5) - 1}%`,
        borderRadius: 3,
        scrollSnapAlign: "start",
        transition: "0.25s",
        "&:hover": { transform: "translateY(-5px)", boxShadow: 6 },
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      <CardContent>
        <Typography variant="body2" color="text.secondary" fontSize={16}>
          {card.title}
        </Typography>

        <Typography variant="h6" fontWeight={600}>
          {card.value}{" "}
          <Typography component="span" color="text.secondary" fontSize={15}>
            {card.sub}
          </Typography>
        </Typography>

        <Typography variant="body3" sx={{ color: card.changeColor, mt: 1 }}>
          {card.change}{" "}
          <Typography component="span" color="text.secondary" fontSize={15}>
            {card.prevText}
          </Typography>
        </Typography>

        {card.extra && (
          <Typography variant="body2" color="text.secondary" mt={0.5} fontSize={15}>
            {card.extra}{" "}
            <span style={{ color: card.extraChangeColor }}>
              {card.extraChange}
            </span>
          </Typography>
        )}

        {/* Mini chart */}
        <Box mt={1.5} sx={{ height: 80, position: "relative" }}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 110"
            preserveAspectRatio="none"
          >
            {/* Smooth curve */}
            <path
              d={createSmoothPath()}
              fill="none"
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Dots layer - positioned absolutely to maintain circular shape */}
          {/* Dots + Tooltip */}
          {values.map((v, i) => {
            const xPercent = values.length > 1 ? (i / (values.length - 1)) * 100 : 50;
            const yPercent = 100 - v;

            return (
              <Box key={i}>
                {/* Tooltip */}
                {hover === i && (
                  <Box
                    sx={{
                      position: "absolute",
                      left: `${xPercent}%`,
                      top: `${(yPercent / 110) * 100 - 12}%`,
                      transform: "translate(-50%, -100%)",
                      bgcolor: "white",
                      px: 1.2,
                      py: 0.6,
                      borderRadius: 1.5,
                      boxShadow: 3,
                      zIndex: 5,
                      minWidth: 55,
                      textAlign: "center",
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {months[i]}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        color: "#555",
                        fontSize: "0.7rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      value : {v}
                    </Typography>
                  </Box>
                )}

                {/* Dot */}
                <Box
                  sx={{
                    position: "absolute",
                    left: `${xPercent}%`,
                    top: `${(yPercent / 110) * 100}%`,
                    width: hover === i ? 10 : 8,
                    height: hover === i ? 10 : 8,
                    borderRadius: "50%",
                    backgroundColor: hover === i ? color : "white",
                    border: `2px solid ${color}`,
                    transform: "translate(-50%, -50%)",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                    zIndex: 2,
                  }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </Box>
            );
          })}

          {/* X-axis labels */}
          <Box
            sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}
          >
            {months.map((month, i) => (
              <Typography
                key={i}
                variant="caption"
                sx={{
                  fontSize: "0.65rem",
                  color: "text.secondary",
                  opacity: 0.7,
                }}
              ></Typography>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CardMetric;
