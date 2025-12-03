import React from "react";
import {
  Box,
  Typography,
  IconButton,
  Button,
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

const Header = ({ title = "Watch Tower", onMenuClick }) => {
  const [timeStart, setTimeStart] = React.useState(dayjs("2025-10-01"));
  const [timeEnd, setTimeEnd] = React.useState(dayjs("2025-10-06"));

  const [compareStart, setCompareStart] = React.useState(dayjs("2025-09-01"));
  const [compareEnd, setCompareEnd] = React.useState(dayjs("2025-09-06"));

  const [priceMode, setPriceMode] = React.useState("MRP");

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
        <Box sx={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {/* TIME PERIOD */}
          <Box>
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
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <DatePicker
                format="DD MMM YY"
                value={timeStart}
                onChange={setTimeStart}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: { width: 130 },
                  },
                }}
              />

              <ArrowForwardIcon sx={{ opacity: 0.6, fontSize: 18 }} />

              <DatePicker
                format="DD MMM YY"
                value={timeEnd}
                onChange={setTimeEnd}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: { width: 130 },
                  },
                }}
              />
            </Box>
          </Box>

          {/* COMPARE */}
          <Box>
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
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <DatePicker
                format="DD MMM YY"
                value={compareStart}
                onChange={setCompareStart}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: { width: 130 },
                  },
                }}
              />

              <ArrowForwardIcon sx={{ opacity: 0.6, fontSize: 18 }} />

              <DatePicker
                format="DD MMM YY"
                value={compareEnd}
                onChange={setCompareEnd}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: { width: 130 },
                  },
                }}
              />
            </Box>
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
