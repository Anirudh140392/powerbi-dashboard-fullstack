import { Box, Card, Typography, Chip, Skeleton } from "@mui/material";
import MetricCard from "./MetricCard";

// Skeleton loader component for metric cards
const MetricCardSkeleton = () => (
  <Box
    sx={{
      flex: "0 0 auto",
      minWidth: 200,
      maxWidth: 240,
      p: 2,
      borderRadius: 3,
      border: "1px solid #e5e7eb",
      bgcolor: "#fafafa",
    }}
  >
    <Skeleton variant="text" width="60%" height={20} sx={{ mb: 1 }} />
    <Skeleton variant="text" width="40%" height={32} sx={{ mb: 1 }} />
    <Skeleton variant="rectangular" width="100%" height={40} sx={{ borderRadius: 1, mb: 1 }} />
    <Skeleton variant="text" width="80%" height={16} />
  </Box>
);

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

          {/* <Chip label="MTD vs Previous Month" variant="filled" /> */}
        </Box>

        {/* Cards Row - Show skeleton when loading */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: scrollNeeded ? "auto" : "visible",
            pb: 1,
            scrollSnapType: scrollNeeded ? "x mandatory" : "none",
          }}
        >
          {loading ? (
            // Show skeleton loaders when loading
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
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
