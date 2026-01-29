import React, { useState } from "react";
import { Box, Typography, Button, TextField, InputAdornment, IconButton, Chip } from "@mui/material";
import { Search, TrendingUp, ChevronRight, BarChart2 } from "lucide-react";

const skuData = [
  {
    id: 1,
    name: "Colgate Strong Teeth Anticavity Toothpaste",
    image: "🦷",
    weight: "150 g",
    offtake: "₹57.0 K",
    offtakeChange: "-19.5%",
    offtakeValue: "₹13.8 K",
    offtakeShare: "10.7%",
    offtakeShareChange: "-18.4%",
    indexedImpressions: "7.1 K",
    impressionsChange: "-31.1%",
    indexedCVR: "8.1%",
    cvrChange: "+23.4%",
    asp: "₹98.5",
    aspChange: "-6.1%"
  },
  {
    id: 2,
    name: "Colgate Visible White Purple Whitening Toothpaste",
    image: "💜",
    weight: "120 g",
    offtake: "₹34.9 K",
    offtakeChange: "-32.8%",
    offtakeValue: "₹17.0 K",
    offtakeShare: "6.5%",
    offtakeShareChange: "-31.8%",
    indexedImpressions: "1.7 K",
    impressionsChange: "-26.4%",
    indexedCVR: "10.5%",
    cvrChange: "0.1%",
    asp: "₹157.1",
    aspChange: "-13.2%"
  },
  {
    id: 3,
    name: "Colgate MaxFresh Peppermint",
    image: "🌿",
    weight: "250 ml",
    offtake: "₹22.7 K",
    offtakeChange: "-28.5%",
    offtakeValue: "₹9.1 K",
    offtakeShare: "4.2%",
    offtakeShareChange: "-22.3%",
    indexedImpressions: "2.3 K",
    impressionsChange: "-18.7%",
    indexedCVR: "7.8%",
    cvrChange: "+5.2%",
    asp: "₹142.0",
    aspChange: "-8.9%"
  }
];

const SKUCard = ({ sku }) => {
  return (
    <Box
      sx={{
        bgcolor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        p: 2.5,
        minWidth: "320px",
        maxWidth: "380px",
        transition: "all 0.2s",
        "&:hover": {
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          transform: "translateY(-2px)"
        }
      }}
    >
      {/* Product Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            fontSize: "32px",
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "#f9fafb",
            borderRadius: "8px"
          }}
        >
          {sku.image}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#111827", mb: 0.5, lineHeight: 1.4 }}>
            {sku.name}
          </Typography>
          <Chip
            label={sku.weight}
            size="small"
            icon={<span style={{ fontSize: "12px" }}>📦</span>}
            sx={{
              height: "20px",
              fontSize: "11px",
              bgcolor: "#fef3c7",
              color: "#92400e",
              fontWeight: 500,
              "& .MuiChip-icon": { marginLeft: "4px" }
            }}
          />
        </Box>
        <IconButton size="small" sx={{ color: "#6b7280" }}>
          <TrendingUp size={16} />
        </IconButton>
      </Box>

      {/* Main Offtake */}
      <Box sx={{ mb: 2, pb: 2, borderBottom: "1px solid #f3f4f6" }}>
        <Typography sx={{ fontSize: "24px", fontWeight: 700, color: "#111827", mb: 0.5 }}>
          {sku.offtake}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 600,
              color: sku.offtakeChange.includes("-") ? "#dc2626" : "#16a34a"
            }}
          >
            {sku.offtakeChange.includes("-") ? "▼" : "▲"} {sku.offtakeChange} ({sku.offtakeValue})
          </Typography>
        </Box>
      </Box>

      {/* Metrics Grid */}
      <Box sx={{ display: "grid", gap: 1.5 }}>
        {/* Offtake Share */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography sx={{ fontSize: "12px", color: "#6b7280" }}>Offtake Share:</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>
              {sku.offtakeShare}
            </Typography>
            <Typography
              sx={{
                fontSize: "11px",
                fontWeight: 600,
                color: sku.offtakeShareChange.includes("-") ? "#dc2626" : "#16a34a"
              }}
            >
              {sku.offtakeShareChange.includes("-") ? "▼" : "▲"}{sku.offtakeShareChange}
            </Typography>
          </Box>
        </Box>

        {/* Indexed Impressions */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography sx={{ fontSize: "12px", color: "#6b7280" }}>Indexed Impressions:</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>
              {sku.indexedImpressions}
            </Typography>
            <Typography
              sx={{
                fontSize: "11px",
                fontWeight: 600,
                color: sku.impressionsChange.includes("-") ? "#dc2626" : "#16a34a"
              }}
            >
              {sku.impressionsChange.includes("-") ? "▼" : "▲"}{sku.impressionsChange}
            </Typography>
          </Box>
        </Box>

        {/* Indexed CVR */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography sx={{ fontSize: "12px", color: "#6b7280" }}>Indexed CVR:</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>
              {sku.indexedCVR}
            </Typography>
            <Typography
              sx={{
                fontSize: "11px",
                fontWeight: 600,
                color: sku.cvrChange.includes("-") || sku.cvrChange.includes("0") ? "#dc2626" : "#16a34a"
              }}
            >
              {sku.cvrChange.includes("-") ? "▼" : "▲"}{sku.cvrChange}
            </Typography>
          </Box>
        </Box>

        {/* ASP */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography sx={{ fontSize: "12px", color: "#6b7280" }}>ASP:</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>
              {sku.asp}
            </Typography>
            <Typography
              sx={{
                fontSize: "11px",
                fontWeight: 600,
                color: sku.aspChange.includes("-") ? "#dc2626" : "#16a34a"
              }}
            >
              {sku.aspChange.includes("-") ? "▼" : "▲"}{sku.aspChange}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Footer Button */}
      <Button
        endIcon={<ChevronRight size={14} />}
        sx={{
          mt: 2,
          width: "100%",
          textTransform: "none",
          fontSize: "13px",
          fontWeight: 600,
          color: "#6b7280",
          justifyContent: "space-between",
          px: 0,
          "&:hover": { bgcolor: "transparent", color: "#2563eb" }
        }}
      >
        Compare SKUs
      </Button>
    </Box>
  );
};

const SkuLevelBreakdown = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <Box
      sx={{
        bgcolor: "#fff",
        borderRadius: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        border: "1px solid #e5e7eb",
        p: 3,
        mb: 4
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography sx={{ fontSize: "18px", fontWeight: 600, color: "#111827" }}>
            SKU Level Breakdown
          </Typography>
          <Typography sx={{ fontSize: "14px", color: "#6b7280" }}>at</Typography>
          <Chip
            label="MRP"
            size="small"
            sx={{
              bgcolor: "#d1fae5",
              color: "#065f46",
              fontWeight: 600,
              fontSize: "12px",
              height: "24px"
            }}
          />
        </Box>

        <TextField
          placeholder="Search"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} color="#9ca3af" />
              </InputAdornment>
            )
          }}
          sx={{
            width: "240px",
            "& .MuiOutlinedInput-root": {
              borderRadius: "20px",
              bgcolor: "#f9fafb",
              fontSize: "14px",
              "& fieldset": { borderColor: "#e5e7eb" },
              "&:hover fieldset": { borderColor: "#d1d5db" }
            }
          }}
        />
      </Box>

      {/* Selected Filter */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1.5,
            px: 2.5,
            py: 1.5,
            bgcolor: "#dbeafe",
            border: "1px solid #93c5fd",
            borderRadius: "12px"
          }}
        >
          <Box>
            <Typography sx={{ fontSize: "11px", color: "#1e40af", fontWeight: 500, mb: 0.5 }}>
              Selected Category x City:
            </Typography>
            <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#1e40af" }}>
              All x Chennai
            </Typography>
          </Box>
          <IconButton size="small" sx={{ color: "#1e40af" }}>
            <TrendingUp size={16} />
          </IconButton>
        </Box>
      </Box>

      {/* SKU Cards */}
      <Box
        sx={{
          display: "flex",
          gap: 2.5,
          overflowX: "auto",
          pb: 2,
          "&::-webkit-scrollbar": {
            height: "6px"
          },
          "&::-webkit-scrollbar-track": {
            bgcolor: "#f3f4f6",
            borderRadius: "3px"
          },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "#d1d5db",
            borderRadius: "3px",
            "&:hover": {
              bgcolor: "#9ca3af"
            }
          }
        }}
      >
        {skuData.map((sku) => (
          <SKUCard key={sku.id} sku={sku} />
        ))}
      </Box>

      {/* Carousel Indicators */}
      <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 2 }}>
        <Box sx={{ width: "32px", height: "4px", bgcolor: "#2563eb", borderRadius: "2px" }} />
        <Box sx={{ width: "8px", height: "4px", bgcolor: "#e5e7eb", borderRadius: "2px" }} />
      </Box>


     
    </Box>
  );
};

export default SkuLevelBreakdown;
