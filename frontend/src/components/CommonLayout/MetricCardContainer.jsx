import { Box, Card, Typography, Chip, Skeleton, IconButton } from "@mui/material";
import { HelpOutline as HelpOutlineIcon } from "@mui/icons-material";
import MetricCard from "./MetricCard";
import { useHelp } from "../../utils/HelpContext";

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

export default function MetricCardContainer({ title = "Watchtower Overview", cards = [], loading = false, isLoading = false, helpMenu = null }) {
  const { openHelpWithMenu } = useHelp();
  const scrollNeeded = cards.length > 5;

  // Show skeleton cards whenever loading is true
  const showSkeletonCards = loading || isLoading;

  return (
    <Box sx={{ mb: 4 }}>
      <Card sx={{ p: 3, borderRadius: 4, boxShadow: 4, position: "relative" }}>
        {/* Floating loader removed as requested - skeletons are used instead */}

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

          {helpMenu && (
            <IconButton 
              size="small" 
              onClick={() => openHelpWithMenu(helpMenu)}
              sx={{ 
                bgcolor: "rgba(37, 99, 235, 0.05)",
                color: "#2563eb",
                "&:hover": { bgcolor: "rgba(37, 99, 235, 0.1)" },
                border: "1px solid rgba(37, 99, 235, 0.1)",
                width: 32,
                height: 32,
                animation: "pulseGlow 2s infinite",
                "@keyframes pulseGlow": {
                  "0%": {
                    boxShadow: "0 0 0 0 rgba(37, 99, 235, 0.4)",
                    borderColor: "rgba(37, 99, 235, 0.2)",
                    color: "#2563eb"
                  },
                  "50%": {
                    boxShadow: "0 0 0 10px rgba(37, 99, 235, 0)",
                    borderColor: "rgba(37, 99, 235, 0.6)",
                    color: "#1d4ed8"
                  },
                  "100%": {
                    boxShadow: "0 0 0 0 rgba(37, 99, 235, 0)",
                    borderColor: "rgba(37, 99, 235, 0.2)",
                    color: "#2563eb"
                  }
                }
              }}
            >
              <HelpOutlineIcon sx={{ fontSize: "1.2rem" }} />
            </IconButton>
          )}
        </Box>

        {/* Cards Row - Show skeleton or actual cards */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexWrap: { xs: "wrap", sm: "nowrap" },
            overflowX: { xs: "visible", sm: "auto", md: scrollNeeded ? "auto" : "visible" },
            pb: 1,
            scrollSnapType: { xs: "none", sm: "x mandatory", md: scrollNeeded ? "x mandatory" : "none" },
            // Ensure smooth scrolling on desktop/tablet
            WebkitOverflowScrolling: "touch",
          }}
        >
          {showSkeletonCards ? (
            // Skeleton cards during initial load
            [1, 2, 3, 4].map((i) => (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  minWidth: 200,
                  p: 2,
                  borderRadius: 3,
                  border: '1px solid #e2e8f0',
                  bgcolor: '#f8fafc',
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
