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
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";

import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { AppThemeContext } from "../../utils/ThemeContext";
import { FilterContext } from "../../utils/FilterContext";
import DateRangeSelector from "./DateRangeSelector";

const Header = ({ title = "Watch Tower", onMenuClick }) => {
  const [priceMode, setPriceMode] = React.useState("MRP");

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
  const { mode, toggleTheme } = React.useContext(AppThemeContext);

  return (
    <Box
      sx={{
        bgcolor: (theme) => theme.palette.background.paper,
        borderBottom: "1px solid",
        borderColor: (theme) =>
          theme.palette.mode === "dark" ? "#374151" : "#e5e7eb",
        px: { xs: 2, sm: 3 },
        py: 2,
        position: "sticky",
        top: 0,
        zIndex: 1200,
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton
            onClick={onMenuClick}
            sx={{ display: { xs: "block", sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton size="small">
              <ArrowBackIcon />
            </IconButton>

            <Typography variant="h6" fontWeight="700">
              {title}
            </Typography>
          </Box>
        </Box>

        {/* DATE PICKERS */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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

          {/* TIME PERIOD */}
          <Box sx={{ width: 190 }}>
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
            <DateRangeSelector
              startDate={timeStart}
              endDate={timeEnd}
              onChange={(start, end) => {
                setTimeStart(start);
                setTimeEnd(end);
              }}
            />
          </Box>

          {/* COMPARE WITH */}
          <Box sx={{ width: 190 }}>
            <Typography
              sx={{
                fontSize: "0.7rem",
                fontWeight: 600,
                mb: 0.5,
                opacity: 0.7,
              }}
            >
              COMPARE WITH
            </Typography>
            <DateRangeSelector
              startDate={compareStart}
              endDate={compareEnd}
              onChange={(start, end) => {
                setCompareStart(start);
                setCompareEnd(end);
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* ---------------- SECOND ROW ---------------- */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          justifyContent: "flex-end",
          flexWrap: "wrap",
          mt: 2,
          alignItems: "center",
        }}
      >
        {/* DATE INFO */}
        <Button
          variant="outlined"
          sx={{
            borderColor: (theme) =>
              theme.palette.mode === "dark" ? "#4b5563" : "#d1d5db",
            textTransform: "none",
            fontSize: "0.75rem",
          }}
        >
          Data till {timeEnd.format("DD MMM YY")}
        </Button>

        {/* PRICE MODE SWITCH */}
        <Box sx={{ display: "flex", gap: 1 }}>
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
                borderColor: (theme) =>
                  theme.palette.mode === "dark" ? "#4b5563" : "#d1d5db",
              }}
            >
              {label}
            </Button>
          ))}
        </Box>

        {/* 🌗 THEME TOGGLE */}
        {/* <IconButton
          onClick={toggleTheme}
          sx={{
            ml: 1,
            border: "1px solid",
            borderColor:
              mode === "dark" ? "#4b5563" : "#d1d5db",
          }}
        >
          {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton> */}
      </Box>
    </Box>
  );
};

export default Header;
