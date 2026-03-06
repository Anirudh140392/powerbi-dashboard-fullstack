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
import axiosInstance from "../../api/axiosInstance";

const Header = ({ title = "Business Overview", onMenuClick }) => {
  const [priceMode, setPriceMode] = React.useState("MRP");
  const [isExpanded, setIsExpanded] = React.useState(true);

  const {
    channels,
    selectedChannel,
    setSelectedChannel,
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
    categories,
    selectedCategory,
    setSelectedCategory,
  } = React.useContext(FilterContext);

  const [darkStoreData, setDarkStoreData] = React.useState({ totalCount: 0, byPlatform: {} });

  React.useEffect(() => {
    const fetchDarkStoreCount = async () => {
      try {
        const params = {
          platform: platform === "All" ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
          location: selectedLocation === "All" ? undefined : (Array.isArray(selectedLocation) ? selectedLocation.join(",") : selectedLocation),
          channel: selectedChannel === "All" ? undefined : selectedChannel,
          startDate: timeStart ? timeStart.format("YYYY-MM-DD") : null,
          endDate: timeEnd ? timeEnd.format("YYYY-MM-DD") : null,
        };
        const res = await axiosInstance.get("/watchtower/dark-store-count", { params });
        if (res.data) {
          setDarkStoreData(res.data);
        }
      } catch (err) {
        console.warn("[Header] Failed to fetch darkstore count:", err.message);
      }
    };

    fetchDarkStoreCount();
  }, [platform, selectedLocation, selectedChannel, timeStart, timeEnd]);

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
        py: 0.8,
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
          flexWrap: { xs: "wrap", md: "nowrap" },
          gap: 1.5,
          alignItems: { xs: "flex-start", md: "center" },
          pb: 0.5,
        }}
      >
        {/* LEFT SIDE */}
        <Box sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          width: { xs: "100%", md: "auto" },
          justifyContent: { xs: "space-between", md: "flex-start" }
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              onClick={onMenuClick}
              sx={{ display: { xs: "block", sm: "none" }, p: 0.5 }}
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
                  fontWeight="600"
                  sx={{ whiteSpace: "nowrap", lineHeight: 1.2, fontSize: { xs: "0.9rem", sm: "1.0rem" } }}
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
                        flexShrink: 0
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        color: "#64748b",
                        maxWidth: { xs: "150px", sm: "none" },
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {darkStoreData.totalCount > 0 ? (
                        <>
                          DS # ({Object.entries(darkStoreData.byPlatform)
                            .map(([p, c]) => `${p}-${c}`)
                            .join(', ')})
                        </>
                      ) : (
                        "0 Active Platforms"
                      )}
                    </Typography>
                  </Box>
                )}
              </Box>
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
                gap: 1.5,
                flexWrap: { xs: "wrap", md: "nowrap" },
                width: { xs: "100%", md: "auto" },
                overflow: "visible",
              }}
            >

              {/* CHANNEL SELECTION */}
              <CustomHeaderDropdown
                label="CHANNEL"
                options={channels}
                value={selectedChannel}
                onChange={(newValue) => setSelectedChannel(newValue)}
                width={{ xs: "calc(50% - 6px)", sm: 130 }}
                multiSelect={true}
              />

              {/* PLATFORM SELECTION */}
              <CustomHeaderDropdown
                label="PLATFORM"
                options={platforms}
                value={platform}
                onChange={(newValue) => setPlatform(newValue)}
                width={{ xs: "calc(50% - 6px)", sm: 115 }}
                multiSelect={true}
              />

              {/* CATEGORY SELECTION */}
              <CustomHeaderDropdown
                label={title === "Availability Analysis" ? "SKU TYPE" : "CATEGORY"}
                options={title === "Availability Analysis" ? ["gold", "silver", "bronze", "non-pds"] : categories}
                value={selectedCategory}
                onChange={(newValue) => setSelectedCategory(newValue)}
                width={{ xs: "calc(50% - 6px)", sm: 115 }}
                multiSelect={true}
              />

              <CustomHeaderDropdown
                label="LOCATION"
                options={locations}
                value={selectedLocation}
                onChange={(newValue) => setSelectedLocation(newValue)}
                width={{ xs: "calc(50% - 6px)", sm: 115 }}
                multiSelect={true}
              />

              {location.pathname === "/visibility-anlysis" && (
                <CustomHeaderDropdown
                  label="KEYWORD"
                  options={keywords}
                  value={selectedKeyword}
                  onChange={(newValue) => setSelectedKeyword(newValue)}
                  width={{ xs: "calc(100%)", sm: 130 }}
                />
              )}

              {/* TIME PERIOD & COMPARE WITH INTEGRATED */}
              <Box sx={{ width: { xs: "100%", sm: 200 }, flexShrink: 0 }}>
                <Typography
                  sx={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    mb: 0.4,
                    opacity: 0.8,
                    textTransform: "uppercase",
                    letterSpacing: '0.05em',
                    fontFamily: 'Roboto, sans-serif',
                    color: '#64748b'
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
