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

  // 🎯 DARK/LIGHT MODE CONTEXT
  const { mode, toggleTheme } = React.useContext(AppThemeContext);

  return (
    <Box
      sx={{
        bgcolor: (theme) => theme.palette.background.paper,
        borderBottom: "1px solid",
        borderColor: (theme) =>
          theme.palette.mode === "dark" ? "#374151" : "#e5e7eb",
        px: 3,
        py: 2,
        position: "sticky",
        top: 0,
        zIndex: 1100,
      }}
    >

      {/* ----------------------------- FIRST ROW ----------------------------- */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        {/* LEFT SECTION */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton
            onClick={onMenuClick}
            sx={{ display: { xs: "block", sm: "none" }, color: (theme) => theme.palette.text.primary }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton size="small" sx={{ color: (theme) => theme.palette.text.primary }}>
              <ArrowBackIcon />
            </IconButton>

            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: (theme) => theme.palette.text.primary,
              }}
            >
              {title}
            </Typography>
          </Box>
        </Box>

        {/* DATE PICKERS SECTION */}
        <Box sx={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {/* TIME PERIOD */}
          <Box>
            <Typography
              sx={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: (theme) => theme.palette.text.secondary,
                mb: 0.5,
              }}
            >
              TIME PERIOD
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <DatePicker
                format="DD MMM YY"
                value={timeStart}
                onChange={(v) => setTimeStart(v)}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      width: 135,
                    },
                  },
                }}
              />

              <ArrowForwardIcon
                sx={{
                  color: (theme) => theme.palette.text.secondary,
                  fontSize: 18,
                }}
              />

              <DatePicker
                format="DD MMM YY"
                value={timeEnd}
                onChange={(v) => setTimeEnd(v)}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      width: 135,
                    },
                  },
                }}
              />
            </Box>
          </Box>

          {/* COMPARE WITH */}
          <Box>
            <Typography
              sx={{
                fontSize: "0.7rem",
                fontWeight: 600,
                color: (theme) => theme.palette.text.secondary,
                mb: 0.5,
              }}
            >
              COMPARE WITH
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <DatePicker
                format="DD MMM YY"
                value={compareStart}
                onChange={(v) => setCompareStart(v)}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      width: 135,
                    },
                  },
                }}
              />

              <ArrowForwardIcon
                sx={{
                  color: (theme) => theme.palette.text.secondary,
                  fontSize: 18,
                }}
              />

              <DatePicker
                format="DD MMM YY"
                value={compareEnd}
                onChange={(v) => setCompareEnd(v)}
                slotProps={{
                  textField: {
                    size: "small",
                    sx: {
                      width: 135,
                    },
                  },
                }}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ----------------------------- SECOND ROW ----------------------------- */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          alignItems: "center",
          mt: 3,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {/* GC Labs */}
        <Button
          variant="contained"
          sx={{
            background: "#7c3aed",
            textTransform: "none",
            fontSize: "0.75rem",
          }}
        >
          GC Labs
        </Button>

        {/* Data Till */}
        <Button
          variant="outlined"
          sx={{
            borderColor: (theme) =>
              theme.palette.mode === "dark" ? "#4b5563" : "#d1d5db",
            color: (theme) => theme.palette.text.primary,
            textTransform: "none",
            fontSize: "0.75rem",
          }}
        >
          Data till 06 Oct 25
        </Button>

        {/* MRP / SP Toggle */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant={priceMode === "MRP" ? "contained" : "outlined"}
            onClick={() => setPriceMode("MRP")}
            sx={{
              background:
                priceMode === "MRP" ? "#059669" : "transparent",
              borderColor: (theme) =>
                theme.palette.mode === "dark" ? "#4b5563" : "#d1d5db",
              textTransform: "none",
              fontSize: "0.75rem",
            }}
          >
            MRP
          </Button>

          <Button
            variant={priceMode === "SP" ? "contained" : "outlined"}
            onClick={() => setPriceMode("SP")}
            sx={{
              background:
                priceMode === "SP" ? "#059669" : "transparent",
              borderColor: (theme) =>
                theme.palette.mode === "dark" ? "#4b5563" : "#d1d5db",
              textTransform: "none",
              fontSize: "0.75rem",
            }}
          >
            SP
          </Button>
        </Box>

        {/* 🌗 DARK/LIGHT MODE TOGGLE BUTTON */}
        {/* <IconButton
          onClick={toggleTheme}
          sx={{
            ml: 1,
            background:
              mode === "dark" ? "#374151" : "#e5e7eb",
            color:
              mode === "dark"
                ? "#f9fafb"
                : "#111827",
            "&:hover": {
              background:
                mode === "dark" ? "#4b5563" : "#d1d5db",
            },
          }}
        >
          {mode === "dark" ? (
            <LightModeIcon fontSize="small" />
          ) : (
            <DarkModeIcon fontSize="small" />
          )}
        </IconButton> */}
      </Box>
    </Box>
  );
};

export default Header;
