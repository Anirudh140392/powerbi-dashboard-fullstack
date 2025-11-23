import React, { useState } from "react";
import {
  Box,
  Paper,
  Avatar,
  Typography,
  Chip,
} from "@mui/material";
import { TrendingUp } from "@mui/icons-material";
import ProductCard from "./ProductCard";

export default function Insights({ products, onKnowMore }) {
  const [activeTab, setActiveTab] = useState("drainers");

  const tabs = [
    { id: "drainers", label: "#Top Drainers", count: 5 },
    { id: "gainers", label: "#Top Gainers", count: 5 },
    { id: "availDrop", label: "#Availability Drop", count: 5 },
    { id: "availGain", label: "#Availability Gain", count: 5 },
  ];

  return (
    <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
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
        <Typography variant="h6" fontWeight={600}>
          Insights
        </Typography>
   
      </Box>

      <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <Chip
            key={tab.id}
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {tab.label}
                <Chip
                  label={tab.count}
                  size="small"
                  sx={{
                    height: 20,
                    bgcolor:
                      activeTab === tab.id
                        ? "white"
                        : "rgba(255, 255, 255, 0.3)",
                    color: activeTab === tab.id ? "primary.main" : "inherit",
                    "& .MuiChip-label": { px: 1, fontSize: "0.75rem" },
                  }}
                />
              </Box>
            }
            onClick={() => setActiveTab(tab.id)}
            sx={{
              bgcolor: activeTab === tab.id ? "primary.main" : "grey.100",
              color: activeTab === tab.id ? "white" : "text.primary",
              fontWeight: 500,
              "&:hover": {
                bgcolor: activeTab === tab.id ? "primary.dark" : "grey.200",
              },
            }}
          />
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 1 }}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onKnowMore={onKnowMore}
          />
        ))}
      </Box>
    </Paper>
  );
}
