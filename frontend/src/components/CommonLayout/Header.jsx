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

import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

            <Typography
              variant="h6"
              fontWeight="700"
              sx={{ whiteSpace: "nowrap" }}
            >
              {title}
            </Typography>
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
              {/* DARK STORE / MARKET PLACE COUNT */}
              <Box sx={{ flexShrink: 0 }}>
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    mb: 0.5,
                    opacity: 0.7,
                    textTransform: "uppercase",
                  }}
                >
                  {platform === "All"
                    ? "All"
                    : ["Flipkart", "Amazon"].includes(platform)
                    ? "MARKET PLACE"
                    : "DARK STORE"}
                </Typography>

                <Box
                  sx={{
                    width: 120,
                    height: "38px",
                    bgcolor: "#F8FAFC",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    alignItems: "center",
                    px: 2,
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "#22C55E",
                      flexShrink: 0,
                    }}
                  />

                  <Typography
                    sx={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "#334155",
                      lineHeight: 1,
                    }}
                  >
                    {platform === "All"
                      ? 5
                      : ["Blinkit", "Zepto", "Instamart"].includes(platform)
                      ? 3
                      : ["Flipkart", "Amazon"].includes(platform)
                      ? 2
                      : 0}
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      color: "#64748b",
                      lineHeight: 1,
                    }}
                  >
                    Active
                  </Typography>
                </Box>
              </Box>

              {/* PLATFORM SELECTION */}
              <Box sx={{ flexShrink: 0 }}>
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    mb: 0.5,
                    opacity: 0.7,
                  }}
                >
                  PLATFORM
                </Typography>
                <Autocomplete
                  disableClearable
                  options={["All", ...platforms]}
                  value={platform}
                  onChange={(event, newValue) => setPlatform(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      hiddenLabel
                      sx={{
                        width: 120,
                        "& .MuiOutlinedInput-root": {
                          height: "38px",
                          bgcolor: "#F8FAFC",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          "& fieldset": { borderColor: "#E2E8F0" },
                          "&:hover fieldset": { borderColor: "#CBD5E1" },
                          "&.Mui-focused fieldset": { borderColor: "#3B82F6" },
                        },
                      }}
                    />
                  )}
                  ListboxProps={{
                    sx: {
                      "& .MuiAutocomplete-option": {
                        padding: "4px 8px !important",
                        minHeight: "28px",
                        fontSize: "0.75rem",
                      },
                    },
                  }}
                />
              </Box>

              {/* BRAND SELECTION */}
              <Box sx={{ flexShrink: 0 }}>
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    mb: 0.5,
                    opacity: 0.7,
                  }}
                >
                  BRAND
                </Typography>
                <Autocomplete
                  options={["All", ...brands]}
                  value={selectedBrand}
                  onChange={(event, newValue) => setSelectedBrand(newValue)}
                  disableClearable
                  ListboxProps={{
                    style: {
                      maxHeight: "120px",
                    },
                    sx: {
                      "& .MuiAutocomplete-option": {
                        padding: "4px 8px !important",
                        minHeight: "28px",
                        fontSize: "0.75rem",
                      },
                    },
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      hiddenLabel
                      sx={{
                        width: 120,
                        "& .MuiOutlinedInput-root": {
                          height: "38px",
                          bgcolor: "#F8FAFC",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          "& fieldset": { borderColor: "#E2E8F0" },
                          "&:hover fieldset": { borderColor: "#CBD5E1" },
                          "&.Mui-focused fieldset": { borderColor: "#3B82F6" },
                        },
                      }}
                    />
                  )}
                />
              </Box>

              {/* LOCATION SELECTION */}
              <Box sx={{ flexShrink: 0 }}>
                <Typography
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    mb: 0.5,
                    opacity: 0.7,
                  }}
                >
                  LOCATION
                </Typography>
                <Autocomplete
                  disableClearable
                  options={["All", ...locations]}
                  value={selectedLocation}
                  onChange={(event, newValue) => setSelectedLocation(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      hiddenLabel
                      sx={{
                        width: 120,
                        "& .MuiOutlinedInput-root": {
                          height: "38px",
                          bgcolor: "#F8FAFC",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          "& fieldset": { borderColor: "#E2E8F0" },
                          "&:hover fieldset": { borderColor: "#CBD5E1" },
                          "&.Mui-focused fieldset": { borderColor: "#3B82F6" },
                        },
                      }}
                    />
                  )}
                  ListboxProps={{
                    style: {
                      maxHeight: "120px",
                    },
                    sx: {
                      "& .MuiAutocomplete-option": {
                        padding: "4px 8px !important",
                        minHeight: "28px",
                        fontSize: "0.75rem",
                      },
                    },
                  }}
                />
              </Box>

              {/* KEYWORD SELECTION - Only visible on Visibility Analysis page */}
              {location.pathname === "/visibility-anlysis" && (
                <Box sx={{ flexShrink: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      mb: 0.5,
                      opacity: 0.7,
                    }}
                  >
                    KEYWORD
                  </Typography>
                  <Autocomplete
                    disableClearable
                    options={keywords}
                    value={selectedKeyword}
                    onChange={(event, newValue) => setSelectedKeyword(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        hiddenLabel
                        sx={{
                          width: 120,
                          "& .MuiOutlinedInput-root": {
                            height: "38px",
                            bgcolor: "#F8FAFC",
                            borderRadius: "8px",
                            fontSize: "0.85rem",
                            fontWeight: 500,
                            "& fieldset": { borderColor: "#E2E8F0" },
                            "&:hover fieldset": { borderColor: "#CBD5E1" },
                            "&.Mui-focused fieldset": {
                              borderColor: "#3B82F6",
                            },
                          },
                        }}
                      />
                    )}
                    ListboxProps={{
                      style: {
                        maxHeight: "160px",
                      },
                      sx: {
                        "& .MuiAutocomplete-option": {
                          padding: "4px 8px !important",
                          minHeight: "28px",
                          fontSize: "0.75rem",
                        },
                      },
                    }}
                  />
                </Box>
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
                  onApply={(start, end, cStart, cEnd, compareOn) => {
                    setTimeStart(start);
                    setTimeEnd(end);
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
