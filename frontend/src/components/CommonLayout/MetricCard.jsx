import { Card, CardContent, Typography, Box, Skeleton, CircularProgress } from "@mui/material";
import MiniSparkline from "./MiniSparkLine";
import dayjs from "dayjs";

// Generate dynamic months based on a date range or default to last 7 months
const generateMonthLabels = (startDate, endDate) => {
  const labels = [];
  const start = startDate ? dayjs(startDate) : dayjs().subtract(6, 'month');
  const end = endDate ? dayjs(endDate) : dayjs();

  let current = start.startOf('month');
  while (current.isBefore(end) || current.isSame(end, 'month')) {
    labels.push(current.format('MMM'));
    current = current.add(1, 'month');
  }

  // Ensure we have at least 2 data points
  if (labels.length < 2) {
    labels.unshift(start.subtract(1, 'month').format('MMM'));
  }

  return labels;
};

// Generate daily/interpolated date labels to match the number of points
const generateDateLabels = (startDate, endDate, count) => {
  if (!startDate || !endDate || count <= 0) return [];
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const diffDays = end.diff(start, "day");

  return Array.from({ length: count }, (_, i) => {
    const dayOffset = count > 1 ? Math.floor(i * (diffDays / (count - 1))) : 0;
    return start.add(dayOffset, "day").format("MMM DD");
  });
};

const generateValues = (count) => Array.from({ length: count }, () => Math.floor(Math.random() * 60) + 20);

export default function MetricCard({ card, scrollNeeded, totalCards }) {
  // Use card-provided sparklineData if available, otherwise default to a fallback
  const values = (card.sparklineData !== undefined && card.sparklineData !== null)
    ? card.sparklineData
    : generateValues(7); // Default to 7 points if nothing provided

  // Generate labels
  let months = (card.months && card.months.length > 0)
    ? card.months
    : (card.startDate && card.endDate && values.length > 5)
      ? generateDateLabels(card.startDate, card.endDate, values.length)
      : (card.startDate && card.endDate)
        ? generateMonthLabels(card.startDate, card.endDate)
        : generateMonthLabels();

  // Ensure months matches values length if we have a mismatch
  if (months.length !== values.length && values.length > 0) {
    if (card.startDate && card.endDate) {
      months = generateDateLabels(card.startDate, card.endDate, values.length);
    }
  }

  const positive = card.change && (card.change.includes("▲") || card.change.includes("+"));
  const color = positive ? "#28a745" : "#dc3545";

  // Handle Loading state
  if (card.loading) {
    return (
      <Card
        sx={{
          flexShrink: 0,
          width: scrollNeeded ? 250 : `${100 / Math.min(totalCards, 5) - 1}%`,
          borderRadius: 3,
          scrollSnapAlign: "start",
          transition: "0.25s",
          bgcolor: "#fcfdfe",
          border: "1px solid #e2e8f0",
        }}
      >
        <CardContent>
          <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" width="80%" height={40} sx={{ mb: 2, borderRadius: 1 }} />
          <Skeleton variant="text" width="40%" height={24} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" width="100%" height={60} sx={{ borderRadius: 1 }} />
        </CardContent>
      </Card>
    );
  }

  // Handle "Coming Soon" state
  if (card.isComingSoon) {
    return (
      <Card
        sx={{
          flexShrink: 0,
          width: scrollNeeded ? 250 : `${100 / Math.min(totalCards, 5) - 1}%`,
          borderRadius: 3,
          scrollSnapAlign: "start",
          transition: "0.25s",
          position: "relative",
          bgcolor: "#f8fafc",
          border: "2px dashed #cbd5e1",
          "&:hover": { transform: "translateY(-5px)", boxShadow: 2 },
        }}
      >
        <CardContent sx={{ opacity: 0.7 }}>
          <Typography variant="body2" color="text.secondary">
            {card.title}
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 3,
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: "#e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1.5,
              }}
            >
              <Typography sx={{ fontSize: 24 }}>🕐</Typography>
            </Box>
            <Typography variant="h6" fontWeight={600} color="#64748b">
              Coming Soon
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {card.sub}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        flexShrink: 0,
        width: scrollNeeded ? 250 : `${100 / Math.min(totalCards, 5) - 1}%`,
        borderRadius: 3,
        scrollSnapAlign: "start",
        transition: "0.25s",
        "&:hover": { transform: "translateY(-5px)", boxShadow: 6 },
      }}
    >
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {card.title}
        </Typography>

        <Typography variant="h5" fontWeight={600}>
          {card.value}{" "}
          <Typography component="span" color="text.secondary">
            {card.sub}
          </Typography>
        </Typography>

        <Typography variant="body2" sx={{ color: card.changeColor, mt: 1 }}>
          {card.change}{" "}
          <Typography
            component="span"
            sx={card.prevTextStyle}
            color={!card.prevTextStyle ? "text.secondary" : undefined}
          >
            {card.prevText}
          </Typography>
        </Typography>

        {card.extra && (
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {card.extra}{" "}
            <span style={{ color: card.extraChangeColor }}>
              {card.extraChange}
            </span>
          </Typography>
        )}

        {/* Sparkline */}
        <Box sx={{ mb: 0 }}>
          <MiniSparkline months={months} values={values} color={color} title={card.title} />
        </Box>
      </CardContent>
    </Card>
  );
}

