import React from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  Avatar,
  Divider,
  Button,
} from "@mui/material";

export default function ProductCard({ product, onKnowMore }) {
  return (
    <Card
      sx={{
        minWidth: 360,
        background: "linear-gradient(135deg, #fef2f2 0%, #faf5ff 100%)",
        border: 1,
        borderColor: "divider",
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
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

        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
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
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ mb: 0.5, lineHeight: 1.3 }}
            >
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

        <Divider sx={{ mb: 2 }} />

        <Box sx={{ mb: 1 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography
              variant="caption"
              fontStyle="italic"
              color="text.secondary"
              fontWeight={500}
            >
              Top Impacted Cities
            </Typography>
            <Typography
              variant="caption"
              fontStyle="italic"
              color="text.secondary"
              fontWeight={500}
            >
              Offtake
            </Typography>
          </Box>

          {product.cities.slice(0, 2).map((city, idx) => (
            <Box
              key={idx}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                py: 1,
              }}
            >
              <Typography variant="body2" fontWeight={500}>
                {city.name}
              </Typography>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="body2" fontWeight={600}>
                  {city.offtake}
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={500}
                  sx={{
                    color: city.offtakeChange.includes("-")
                      ? "#dc2626"
                      : "#16a34a",
                  }}
                >
                  {city.offtakeChange.includes("-") ? "▼" : "▲"}{" "}
                  {city.offtakeChange}
                </Typography>
              </Box>
            </Box>
          ))}

          <Button
            onClick={() => onKnowMore(product)}
            sx={{
              mt: 1,
              textTransform: "none",
              color: "primary.main",
              fontWeight: 500,
              fontSize: "0.875rem",
              p: 0,
              "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
            }}
          >
            Know More →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
