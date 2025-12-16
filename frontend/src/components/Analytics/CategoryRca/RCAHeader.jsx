import React from "react";
import {
  Box,
  Typography,
  IconButton,
  Button,
} from "@mui/material";

import {

  Menu as MenuIcon,
} from "@mui/icons-material";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";

const RCAHeader = ({ title = "Blinkit > RCA Category", onMenuClick }) => {
  // Default date range: 1st of current month to today
  const [timeStart, setTimeStart] = React.useState(dayjs().startOf('month'));
  const [timeEnd, setTimeEnd] = React.useState(dayjs());

  const [compareStart, setCompareStart] = React.useState(dayjs("2025-09-01"));
  const [compareEnd, setCompareEnd] = React.useState(dayjs("2025-09-06"));

  // MRP / SP Toggle
  const [priceMode, setPriceMode] = React.useState("MRP");

  return (
    <Box
      sx={{
        bgcolor: "#fff",
        borderBottom: "1px solid #e5e7eb",
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
            sx={{ display: { xs: "block", sm: "none" }, color: "#374151" }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>


            <Typography variant="h6" sx={{ fontWeight: 700, color: "#111827" }}>
              {title}
            </Typography>
          </Box>
        </Box>

        {/* DATE PICKERS SECTION */}
        <Box sx={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {/* TIME PERIOD */}
          <Box>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "#6b7280", mb: 0.5 }}>
              TIME PERIOD
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <DatePicker
                format="DD MMM YY"
                value={timeStart}
                onChange={(v) => setTimeStart(v)}
                slotProps={{ textField: { size: "small", sx: { width: 135 } } }}
              />
              <ArrowForwardIcon sx={{ color: "#6b7280", fontSize: 18 }} />
              <DatePicker
                format="DD MMM YY"
                value={timeEnd}
                onChange={(v) => setTimeEnd(v)}
                slotProps={{ textField: { size: "small", sx: { width: 135 } } }}
              />
            </Box>
          </Box>

          {/* COMPARE WITH */}
          <Box>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "#6b7280", mb: 0.5 }}>
              COMPARE WITH
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <DatePicker
                format="DD MMM YY"
                value={compareStart}
                onChange={(v) => setCompareStart(v)}
                slotProps={{ textField: { size: "small", sx: { width: 135 } } }}
              />
              <ArrowForwardIcon sx={{ color: "#6b7280", fontSize: 18 }} />
              <DatePicker
                format="DD MMM YY"
                value={compareEnd}
                onChange={(v) => setCompareEnd(v)}
                slotProps={{ textField: { size: "small", sx: { width: 135 } } }}
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
          justifyContent: "flex-end",   // ALIGN TO EXTREME RIGHT
        }}
      >
        {/* GC Labs */}
        <Button
          variant="contained"
          sx={{ background: "#7c3aed", textTransform: "none", fontSize: "0.75rem" }}
        >
          GC Labs
        </Button>

        {/* Data Till */}
        <Button
          variant="outlined"
          sx={{ borderColor: "#d1d5db", textTransform: "none", fontSize: "0.75rem" }}
        >
          Data till 06 Oct 25
        </Button>

        {/* MRP / SP Toggle */}
        <Box sx={{ display: "flex", gap: 1 }}>

          <Button
            variant={priceMode === "MRP" ? "contained" : "outlined"}
            onClick={() => setPriceMode("MRP")}
            sx={{
              background: priceMode === "MRP" ? "#059669" : "transparent",
              borderColor: "#d1d5db",
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
              background: priceMode === "SP" ? "#059669" : "transparent",
              borderColor: "#d1d5db",
              textTransform: "none",
              fontSize: "0.75rem",
            }}
          >
            SP
          </Button>

        </Box>
      </Box>
    </Box>
  );
};

export default RCAHeader;
