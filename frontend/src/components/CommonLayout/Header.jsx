import React from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  IconButton,
  Button,
  Autocomplete,
  TextField,
} from "@mui/material";

import {
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { AppThemeContext } from "../../utils/ThemeContext";
import { FilterContext } from "../../utils/FilterContext";
import DateRangeComparePicker from "./DateRangeComparePicker";

import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomHeaderDropdown from "./CustomHeaderDropdown";

const Header = ({ title = "Watch Tower", onMenuClick }) => {
  const [priceMode, setPriceMode] = React.useState("MRP");
  const [isExpanded, setIsExpanded] = React.useState(true);

  const {
    brands,
    selectedBrand,
    setSelectedBrand,
    keywords,
    selectedKeyword,
    setSelectedKeyword,
    locations,
    selectedLocation,
    setSelectedLocation,
    platforms,
    platform,
    setPlatform,
    timeStart,
    setTimeStart,
    timeEnd,
    setTimeEnd,
    compareStart,
    setCompareStart,
    compareEnd,
    setCompareEnd,
    setComparisonLabel,
  } = React.useContext(FilterContext);

  const location = useLocation();

  // 🌗 Dark/Light Mode
  const { mode } = React.useContext(AppThemeContext);

  return (
    <Box
      sx={{
        bgcolor: (theme) => theme.palette.background.paper,
        borderBottom: "1px solid",
        borderColor: (theme) => "#e5e7eb",
        px: { xs: 2, sm: 3 },
        py: 2,
        position: "sticky",
        top: 0,
        zIndex: 1200,
        transition: "all 0.3s ease",
      }}
    >
      {/* ---------------- FIRST ROW ---------------- */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "nowrap",
          gap: 1,
          alignItems: "center",
          overflowX: "auto",
          pb: 0.5, // slightly partial scrolling buffer
        }}
      >
        {/* LEFT SIDE */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton
            onClick={onMenuClick}
            sx={{ display: { xs: "block", sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => setIsExpanded(!isExpanded)}
              sx={{
                bgcolor: "#f1f5f9",
                "&:hover": { bgcolor: "#e2e8f0" },
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s ease",
              }}
            >
              <ChevronDown size={18} />
            </IconButton>

            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography
                variant="h6"
                fontWeight="700"
                sx={{ whiteSpace: "nowrap", lineHeight: 1.2 }}
              >
                {title}
              </Typography>
              {title !== "Performance Marketing" && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "#22C55E",
                    }}
                  />
                  {/* <Typography
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    {(() => {
                      const darkStorePlatforms = ["Blinkit", "Zepto", "Instamart"];
                      const marketplacePlatforms = ["Flipkart", "Amazon"];

                      // Dark store counts per platform
                      const darkStoreCounts = {
                        "Blinkit": 1860,
                        "Zepto": 1250,
                        "Instamart": 1210,
                      };

                      const selectedList = platform === "All"
                        ? [...darkStorePlatforms, ...marketplacePlatforms]
                        : (Array.isArray(platform) ? platform : [platform]);

                      const darkStoreTotal = selectedList
                        .filter(p => darkStorePlatforms.includes(p))
                        .reduce((sum, p) => sum + (darkStoreCounts[p] || 0), 0);

                      const mCount = selectedList.filter(p => marketplacePlatforms.includes(p)).length;

                      const parts = [];
                      if (darkStoreTotal > 0) parts.push(`${darkStoreTotal.toLocaleString()} Dark Stores`);
                      if (mCount > 0) parts.push(`${mCount} Active Marketplace${mCount > 1 ? 's' : ''}`);

                      return parts.length > 0 ? parts.join(" & ") : "0 Active Platforms";
                    })()}
                  </Typography> */}
                  <Typography
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    Darkstores # (Blinkit - 1860, Instamart - 1210, Zepto - 1250)
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* FILTERS CONTAINER */}
        <AnimatePresence>
          {isExpanded && (
            <Box
              component={motion.div}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "nowrap",
                overflow: "visible",
              }}
            >

              {/* PLATFORM SELECTION */}
              <CustomHeaderDropdown
                label="PLATFORM"
                options={platforms}
                value={platform}
                onChange={(newValue) => setPlatform(newValue)}
                width={150}
              />

              <CustomHeaderDropdown
                label="BRAND"
                options={brands}
                value={selectedBrand}
                onChange={(newValue) => setSelectedBrand(newValue)}
                width={150}
              />

              <CustomHeaderDropdown
                label="LOCATION"
                options={locations}
                value={selectedLocation}
                onChange={(newValue) => setSelectedLocation(newValue)}
                width={150}
              />

              {location.pathname === "/visibility-anlysis" && (
                <CustomHeaderDropdown
                  label="KEYWORD"
                  options={keywords}
                  value={selectedKeyword}
                  onChange={(newValue) => setSelectedKeyword(newValue)}
                  width={150}
                />
              )}

              {/* TIME PERIOD & COMPARE WITH INTEGRATED */}
              <Box sx={{ width: 220, flexShrink: 0 }}>
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    mb: 0.5,
                    opacity: 0.7,
                  }}
                >
                  TIME PERIOD
                </Typography>
                <DateRangeComparePicker
                  timeStart={timeStart}
                  timeEnd={timeEnd}
                  compareStart={compareStart}
                  compareEnd={compareEnd}
                  onApply={(start, end, cStart, cEnd, compareOn, label) => {
                    setTimeStart(start);
                    setTimeEnd(end);

                    // Format label for KPI cards
                    let formattedLabel = "VS PREV. PERIOD";
                    if (label) {
                      const up = label.toUpperCase();
                      if (up === "TODAY") formattedLabel = "VS YESTERDAY"; // Usually compares to yesterday
                      else if (up === "YESTERDAY") formattedLabel = "VS DAY BEFORE";
                      else if (up === "THIS MONTH") formattedLabel = "VS PREV. MONTH";
                      else if (up.includes("LAST")) formattedLabel = up.replace("LAST", "VS PREV.");
                      else formattedLabel = `VS ${up}`;
                    }
                    setComparisonLabel(formattedLabel);

                    if (compareOn) {
                      setCompareStart(cStart);
                      setCompareEnd(cEnd);
                    } else {
                      // Optionally reset comparison if needed, but keeping existing for now
                      setCompareStart(null);
                      setCompareEnd(null);
                    }
                  }}
                />
              </Box>
            </Box>
          )}
        </AnimatePresence>
      </Box>

      {/* ---------------- SECOND ROW ---------------- */}
      <AnimatePresence>
        {isExpanded && (
          <Box
            component={motion.div}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            sx={{
              display: "flex",
              gap: 2,
              justifyContent: "flex-end",
              flexWrap: "wrap",
              mt: 2,
              alignItems: "center",
              overflow: "visible",
            }}
          >
            {/* DATE INFO
            <Button
              variant="outlined"
              sx={{
                borderColor: "#d1d5db",
                textTransform: "none",
                fontSize: "0.75rem",
              }}
            >
              Data till {timeEnd.format("DD MMM YY")}
            </Button> */}

            {/* PRICE MODE SWITCH */}
            {/* <Box sx={{ display: "flex", gap: 1 }}>
              {["MRP", "SP"].map((label) => (
                <Button
                  key={label}
                  variant={priceMode === label ? "contained" : "outlined"}
                  onClick={() => setPriceMode(label)}
                  sx={{
                    textTransform: "none",
                    fontSize: "0.75rem",
                    background:
                      priceMode === label ? "#059669" : "transparent",
                    borderColor: "#d1d5db",
                  }}
                >
                  {label}
                </Button>
              ))}
            </Box> */}
          </Box>
        )}
      </AnimatePresence>

      {/* 🌗 THEME TOGGLE */}
      {/* 🌗 THEME TOGGLE REMOVED - Static Light Mode Enforced */}
    </Box>
  );
};

export default Header;
