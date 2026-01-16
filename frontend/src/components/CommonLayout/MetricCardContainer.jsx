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

  // Show skeleton cards during initial load (when no data exists yet)
  const showSkeletonCards = loading && cards.length === 0;

  return (
    <Box sx={{ mb: 4 }}>
      <Card sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, boxShadow: 4, position: "relative", overflow: "visible" }}>
        {/* Floating loader overlay - only when cards exist and refreshing */}
        {loading && cards.length > 0 && (
          <FloatingLoader loading={true} label="Updating overview..." />
        )}

        {/* Header */}
        <Box display="flex" flexDirection={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} mb={3} gap={2}>
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

        {/* Cards Row - Show skeleton or actual cards */}
        <Box
          sx={{
            display: "flex",
            gap: { xs: 1.5, md: 2 },
            overflowX: "auto",
            pb: 1,
            px: { xs: 0, sm: 0 },
            scrollSnapType: "x mandatory",
            "&::-webkit-scrollbar": { display: "none" },
            msOverflowStyle: "none",
            scrollbarWidth: "none",
            mx: { xs: 0, sm: 0 }
          }}
        >
          {showSkeletonCards ? (
            // Skeleton cards during initial load
            [1, 2, 3, 4].map((i) => (
              <Box
                key={i}
                sx={{
                  flexShrink: 0,
                  width: { xs: 260, sm: 250 },
                  p: 2,
                  borderRadius: 3,
                  border: '1px solid #e2e8f0',
                  bgcolor: '#f8fafc',
                  scrollSnapAlign: "start"
                }}
              >
                <Skeleton variant="text" width="60%" height={18} animation="wave" sx={{ borderRadius: 1, mb: 1 }} />
                <Skeleton variant="text" width="80%" height={36} animation="wave" sx={{ borderRadius: 1, mb: 1 }} />
                <Skeleton variant="text" width="90%" height={14} animation="wave" sx={{ borderRadius: 1, mb: 2 }} />
                <Skeleton variant="text" width="50%" height={14} animation="wave" sx={{ borderRadius: 1 }} />
                <Skeleton variant="rounded" width="100%" height={60} animation="wave" sx={{ borderRadius: 2, mt: 2 }} />
              </Box>
            ))
          ) : (
            // Actual cards
            cards.map((card, index) => (
              <Box key={index} sx={{ flexShrink: 0, scrollSnapAlign: "start" }}>
                <MetricCard
                  card={card}
                  scrollNeeded={scrollNeeded}
                  totalCards={cards.length}
                />
              </Box>
            ))
          )}
        </Box>
      </Card>
    </Box>
  );
}

