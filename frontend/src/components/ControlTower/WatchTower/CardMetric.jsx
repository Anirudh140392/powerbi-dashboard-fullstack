import { Box, Card, CardContent, Typography, Chip, Skeleton } from "@mui/material";
import { useState } from "react";

const CardMetric = ({ data, onViewTrends }) => {
  const isLoading = !data || data.length === 0;

  const cards = data && data.length > 0 ? data.map(item => ({
    title: item.name,
    value: item.label,
    sub: item.subtitle,
    change: item.trend,
    changeColor: item.trendType === 'up' ? 'green' : item.trendType === 'down' ? 'red' : 'grey',
    prevText: item.comparison,
    extra: item.units ? `#Units: ${item.units}` : null,
    extraChange: item.unitsTrend,
    extraChangeColor: item.unitsTrend && item.unitsTrend.includes('+') ? 'green' : 'red',
    chart: item.chart,
    labels: item.labels
  })) : [];

  const fallbackMonths = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];

  // Generate smooth data
  const generateValues = (card) => {
    if (card.chart && card.chart.length > 0) {
      // Normalize chart data to 0-100 range for the mini chart if needed, 
      // or just pass as is if the component handles it. 
      // The current component expects values roughly between 20-80 for visual appeal.
      // Let's just return the chart data.
      return card.chart;
    }
    return fallbackMonths.map(() => Math.floor(Math.random() * 60) + 20);
  };

  const isProfit = (txt) => txt?.includes("▲") || txt?.includes("+");

  const scrollNeeded = cards.length > 5;

  return (
    <Box sx={{ mb: 4 }}>
      <Card sx={{ p: 3, borderRadius: 4, boxShadow: 4 }}>
        {/* Header */}
        <Box
          display="flex"
          flexDirection={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          gap={2}
          mb={3}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: { xs: 30, sm: 36 },
                height: { xs: 30, sm: 36 },
                borderRadius: "50%",
                bgcolor: "primary.main",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: { xs: "1rem", sm: "1.2rem" },
              }}
            >
              📈
            </Box>

            <Typography variant="h5" fontWeight={600} sx={{ fontSize: { xs: "1.1rem", sm: "1.5rem" } }}>
              Watchtower Overview
            </Typography>

            <Chip label="All" size="small" variant="outlined" />
          </Box>
        </Box>

        {/* Cards Row */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            pb: 1,
            px: 1.5,
            scrollSnapType: "x mandatory",
            "&::-webkit-scrollbar": { display: "none" },
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          {isLoading
            ? // Show skeleton cards while loading
            [1, 2, 3, 4].map((i) => <SkeletonMetricCard key={i} />)
            : cards.map((card, index) => {
              const values = generateValues(card);
              const labels = Array.isArray(card.labels) && card.labels.length === values.length
                ? card.labels
                : fallbackMonths.slice(0, values.length);
              const color = isProfit(card.change) ? "#28a745" : "#dc3545";

              return (
                <MiniChartCard
                  key={index}
                  card={card}
                  months={labels}
                  values={values}
                  color={color}
                  scrollNeeded={scrollNeeded}
                  totalCards={cards.length}
                  onClick={() => onViewTrends && onViewTrends(card.title)}
                />
              );
            })
          }
        </Box>
      </Card>
    </Box>
  );
};

/* ------------ Skeleton Metric Card - Loading placeholder ------------ */
const SkeletonMetricCard = () => {
  return (
    <Card
      sx={{
        flexShrink: 0,
        width: 250,
        borderRadius: 3,
        scrollSnapAlign: "start",
      }}
    >
      <CardContent>
        {/* Title skeleton */}
        <Skeleton variant="text" width={100} height={24} animation="wave" sx={{ borderRadius: 1 }} />

        {/* Value + Sub skeleton */}
        <Box display="flex" alignItems="baseline" gap={1} mt={0.5}>
          <Skeleton variant="text" width={80} height={32} animation="wave" sx={{ borderRadius: 1 }} />
          <Skeleton variant="text" width={120} height={20} animation="wave" sx={{ borderRadius: 1 }} />
        </Box>

        {/* Change + prevText skeleton */}
        <Box display="flex" alignItems="center" gap={1} mt={0.5}>
          <Skeleton variant="text" width={100} height={18} animation="wave" sx={{ borderRadius: 1 }} />
          <Skeleton variant="text" width={100} height={18} animation="wave" sx={{ borderRadius: 1 }} />
        </Box>

        {/* Extra row skeleton */}
        <Box display="flex" alignItems="center" gap={1} mt={0.5}>
          <Skeleton variant="text" width={90} height={18} animation="wave" sx={{ borderRadius: 1 }} />
          <Skeleton variant="text" width={50} height={18} animation="wave" sx={{ borderRadius: 1 }} />
        </Box>

        {/* Mini chart skeleton */}
        <Box mt={1.5} sx={{ height: 80 }}>
          <Skeleton variant="rounded" width="100%" height={70} animation="wave" sx={{ borderRadius: 2 }} />
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
      onClick={onClick}
      sx={{
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
        width: { xs: 260, sm: 280 },
        borderRadius: 3,
        scrollSnapAlign: "start",
        transition: "0.25s",
        "&:hover": { transform: "translateY(-5px)", boxShadow: 6 },
      }}
    >
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 12, sm: 14 } }}>
          {card.title}
        </Typography>

        <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}>
          {card.value}{" "}
          <Typography component="span" color="text.secondary" sx={{ fontSize: { xs: 12, sm: 14 } }}>
            {card.sub}
          </Typography>
        </Typography>

        <Typography sx={{ color: card.changeColor, mt: 0.5, fontSize: { xs: 12, sm: 13 }, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {card.change}{" "}
          <Typography component="span" color="text.secondary" sx={{ fontSize: { xs: 12, sm: 13 } }}>
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
