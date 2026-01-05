import { Box, Card, Typography, Chip, Skeleton } from "@mui/material";
import MetricCard from "./MetricCard";

export default function MetricCardContainer({ title = "Watchtower Overview", cards = [], loading = false }) {
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

            <Typography variant="h6" fontWeight={600}>{title}</Typography>
            <Chip label="All" size="small" variant="outlined" />
          </Box>
        </Box>

        {/* Cards Row */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: scrollNeeded ? "auto" : "visible",
            pb: 1,
            scrollSnapType: scrollNeeded ? "x mandatory" : "none",
          }}
        >
          {loading || cards.length === 0 ? (
            // Skeleton loaders when loading or no data
            [1, 2, 3, 4].map((i) => (
              <Box key={i} sx={{ flex: "0 0 calc(25% - 12px)", minWidth: 200 }}>
                <Skeleton variant="rounded" height={140} animation="wave" sx={{ borderRadius: 3 }} />
              </Box>
            ))
          ) : (
            cards.map((card, index) => (
              <MetricCard
                key={index}
                card={card}
                scrollNeeded={scrollNeeded}
                totalCards={cards.length}
              />
            ))
          )}
        </Box>
      </Card>
    </Box>
  );
}

