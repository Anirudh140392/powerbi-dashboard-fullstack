import React, { useState } from "react";
import {
  Box,
  Drawer,
  Avatar,
  Typography,
  IconButton,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
} from "@mui/material";
import {
  TrendingUp,
  NavigateBefore,
  NavigateNext,
  Close,
  OpenInNew,
} from "@mui/icons-material";

export default function InsightsDrawer({ product, onClose, totalProducts }) {
  const [showAllCities, setShowAllCities] = useState(false);

  if (!product) return null;

  const displayedCities = showAllCities
    ? product.cities
    : product.cities.slice(0, 2);

  return (
    <Drawer
      anchor="right"
      open={Boolean(product)}
      onClose={onClose}
      PaperProps={{
        sx: { width: 920 },
      }}
    >
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: "grey.100",
                borderRadius: 1.5,
              }}
            >
              <TrendingUp sx={{ fontSize: 20, color: "text.secondary" }} />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Insights
              </Typography>

            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IconButton size="small">
                <NavigateBefore />
              </IconButton>
              <Typography variant="body2" fontWeight={500}>
                {product.rank} out of {totalProducts}
              </Typography>
              <IconButton size="small">
                <NavigateNext />
              </IconButton>
            </Box>
            <Typography variant="body2" color="text.secondary">
              MTD vs Previous Month
            </Typography>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>

        {/* Product Info */}
        <Card
          sx={{
            background: "linear-gradient(135deg, #fef2f2 0%, #faf5ff 100%)",
            mb: 3,
          }}
        >
          <CardContent>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}
            >
              <Chip
                label={`Top Drainers ${product.rank}`}
                size="small"
                sx={{
                  bgcolor: "#ef4444",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "0.75rem",
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Cat: {product.category}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Avatar
                variant="rounded"
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: "white",
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: "#fee2e2",
                    borderRadius: 1,
                  }}
                />
              </Avatar>
              <Box>
                <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>
                  {product.name}
                </Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Typography variant="caption" sx={{ color: "#f97316" }}>
                    📦 {product.weight}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#14b8a6" }}>
                    💧 {product.growth}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                  City
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                  <Box>Estimated Offtake</Box>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                  <Box>Est.</Box>
                  <Box>Cat Share</Box>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                  Wt. OSA %
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                  Overall SOS
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                  Ad SOS
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                  Wt. Disc %
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedCities.map((city, idx) => (
                <TableRow key={idx} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {city.name}
                      </Typography>
                      <IconButton size="small" sx={{ color: "primary.main" }}>
                        <OpenInNew sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      {city.offtake}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontSize="0.7rem"
                      sx={{
                        color: city.offtakeChange.includes("-")
                          ? "#dc2626"
                          : "#16a34a",
                      }}
                    >
                      {city.offtakeChange}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      {city.catShare}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontSize="0.7rem"
                      sx={{
                        color: city.catShareChange.includes("-")
                          ? "#dc2626"
                          : "#16a34a",
                      }}
                    >
                      {city.catShareChange}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      {city.wtOsa}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontSize="0.7rem"
                      sx={{
                        color: city.wtOsaChange.includes("-")
                          ? "#dc2626"
                          : "#16a34a",
                      }}
                    >
                      {city.wtOsaChange}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      {city.overallSos}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontSize="0.7rem"
                      sx={{
                        color: city.overallSosChange.includes("-")
                          ? "#dc2626"
                          : "#16a34a",
                      }}
                    >
                      {city.overallSosChange}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      -
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                      {city.adSos}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      {city.wtDisc}
                    </Typography>
                    <Typography variant="caption" fontSize="0.7rem" sx={{ color: "#16a34a" }}>
                      {city.wtDiscChange}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}

              {product.overall && (
                <TableRow sx={{ bgcolor: "grey.50" }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      Overall
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      {product.overall.offtake}
                    </Typography>
                    <Typography variant="caption" fontSize="0.7rem" sx={{ color: "#dc2626" }}>
                      {product.overall.offtakeChange}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      {product.overall.catShare}
                    </Typography>
                    <Typography variant="caption" fontSize="0.7rem" sx={{ color: "#dc2626" }}>
                      {product.overall.catShareChange}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      {product.overall.wtOsa}
                    </Typography>
                    <Typography variant="caption" fontSize="0.7rem" sx={{ color: "#dc2626" }}>
                      {product.overall.wtOsaChange}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      {product.overall.overallSos}
                    </Typography>
                    <Typography variant="caption" fontSize="0.7rem" sx={{ color: "#dc2626" }}>
                      {product.overall.overallSosChange}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      -
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                      {product.overall.adSos}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} fontSize="0.75rem">
                      {product.overall.wtDisc}
                    </Typography>
                    <Typography variant="caption" fontSize="0.7rem" sx={{ color: "#16a34a" }}>
                      {product.overall.wtDiscChange}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {!showAllCities && product.cities.length > 2 && (
          <Button
            onClick={() => setShowAllCities(true)}
            sx={{
              mt: 2,
              textTransform: "none",
              color: "primary.main",
              fontWeight: 500,
              fontSize: "0.875rem",
              "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
            }}
          >
            + Show More Cities
          </Button>
        )}

        {showAllCities && (
          <Button
            onClick={() => setShowAllCities(false)}
            sx={{
              mt: 2,
              textTransform: "none",
              color: "primary.main",
              fontWeight: 500,
              fontSize: "0.875rem",
              "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
            }}
          >
            − Show Less Cities
          </Button>
        )}
      </Box>
    </Drawer>
  );
}
