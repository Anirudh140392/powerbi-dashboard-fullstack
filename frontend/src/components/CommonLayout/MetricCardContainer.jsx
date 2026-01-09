import { Box, Card, Typography, Chip, Skeleton } from "@mui/material";
import MetricCard from "./MetricCard";

// Floating loader component - displays overlay while refreshing
const FloatingLoader = ({ loading = false, label = "Updating..." }) => {
  if (!loading) return null;

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        bgcolor: "rgba(255, 255, 255, 0.75)",
        backdropFilter: "blur(1px)",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          bgcolor: "rgba(255, 255, 255, 0.95)",
          px: 2.5,
          py: 1.5,
          borderRadius: 50,
          boxShadow: 3,
          border: "1px solid #e5e7eb",
        }}
      >
        <Box
          sx={{
            width: 18,
            height: 18,
            border: "2px solid #e5e7eb",
            borderTopColor: "#475569",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            "@keyframes spin": {
              "0%": { transform: "rotate(0deg)" },
              "100%": { transform: "rotate(360deg)" },
            },
          }}
        />
        <Typography variant="body2" fontWeight={500} color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Box>
  );
};

export default function MetricCardContainer({ title = "Watchtower Overview", cards = [], loading = false }) {
  const scrollNeeded = cards.length > 5;

  return (
    <Box sx={{ mb: 4 }}>
      <Card sx={{ p: 3, borderRadius: 4, boxShadow: 4, position: "relative" }}>
        {/* Floating loader overlay */}
        <FloatingLoader loading={loading} label="Updating overview..." />

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

            <Typography variant="h6" fontWeight={600}>{title}</Typography>
            <Chip label="All" size="small" variant="outlined" />
          </Box>

          {/* <Chip label="MTD vs Previous Month" variant="filled" /> */}
        </Box>

        {/* Cards Row - Always render cards, loader overlays */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: scrollNeeded ? "auto" : "visible",
            pb: 1,
            scrollSnapType: scrollNeeded ? "x mandatory" : "none",
          }}
        >
          {cards.map((card, index) => (
            <MetricCard
              key={index}
              card={card}
              scrollNeeded={scrollNeeded}
              totalCards={cards.length}
            />
          ))}
        </Box>
      </Card>
    </Box>
  );
}
