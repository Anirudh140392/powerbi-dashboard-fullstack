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
    platform, setPlatform,
    timeStart, setTimeStart,
    timeEnd, setTimeEnd,
    compareStart, setCompareStart,
    compareEnd, setCompareEnd
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
          flexWrap: "wrap",
          gap: 2,
          alignItems: "center",
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
                transition: "transform 0.3s ease"
              }}
            >
              <ChevronDown size={18} />
            </IconButton>

            <Typography variant="h6" fontWeight="700">
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
                gap: 2,
                flexWrap: "wrap",
                overflow: "visible"
              }}
            >
              {/* PLATFORM SELECTION */}
              <Box>
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
                  options={platforms}
                  value={platform}
                  onChange={(event, newValue) => setPlatform(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      sx={{ width: 130 }}
                    />
                  )}
                />
              </Box>

              {/* BRAND SELECTION */}
              <Box>
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
                  options={brands}
                  value={selectedBrand}
                  onChange={(event, newValue) => setSelectedBrand(newValue)}
                  disableClearable
                  ListboxProps={{
                    style: {
                      maxHeight: "160px", // Approx 4 items (assuming ~40px per item)
                    },
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      sx={{ width: 130 }}
                    />
                  )}
                />
              </Box>

              {/* LOCATION SELECTION */}
              <Box>
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
                  options={locations}
                  value={selectedLocation}
                  onChange={(event, newValue) => setSelectedLocation(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      sx={{ width: 130 }}
                    />
                  )}
                  ListboxProps={{
                    style: {
                      maxHeight: "160px",
                    },
                  }}
                />
              </Box>

              {/* KEYWORD SELECTION - Only visible on Visibility Analysis page */}
              {location.pathname === '/visibility-anlysis' && (
                <Box>
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
                        sx={{ width: 130 }}
                      />
                    )}
                    ListboxProps={{
                      style: {
                        maxHeight: "160px",
                      },
                    }}
                  />
                </Box>
              )}

              {/* TIME PERIOD & COMPARE WITH INTEGRATED */}
              <Box sx={{ width: 220 }}>
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
              overflow: "visible"
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
