import React, { useContext, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { FilterContext } from "../../utils/FilterContext";
import { useSocket } from "../../utils/SocketContext";
import dayjs from "dayjs";

// Route → human-readable page name mapping
const PAGE_NAME_MAP = {
  "/watch-tower": "Business Overview",
  "/market-share": "Market Share",
  "/visibility-anlysis": "Visibility Analysis",
  "/availability-analysis": "Availability Analysis",
  "/on-shelf-availability": "Market Coverage",
  "/pricing-analysis": "Pricing Analysis",
  "/performance-marketing": "Performance Marketing",
  "/inventory": "Inventory Analysis",
  "/content-score": "Content Analysis",
  "/scheduled-reports": "Scheduled Reports",
  "/geo-intelligence": "India Overview",
  "/insights": "Insights",
  "/sales": "Sales Data",
  "/volume-cohort": "Portfolio Analysis",
};

// Route → ClickHouse table for max date lookup
const ROUTE_TABLE_MAP = {
  "/watch-tower": "rb_pdp_olap",
  "/market-share": "rb_ms_olap",
  "/visibility-anlysis": "rb_kw_olap",
  "/availability-analysis": "rb_pdp_olap",
  "/on-shelf-availability": "rb_pdp_olap",
  "/pricing-analysis": "rb_pdp_olap",
  "/performance-marketing": "rb_pm_olap",
  "/inventory": "rb_pdp_olap",
  "/content-score": "tb_content_score_data",
  "/scheduled-reports": "rb_pdp_olap",
  "/geo-intelligence": "rb_pdp_olap",
  "/insights": "rb_pdp_olap",
  "/sales": "rb_pdp_olap",
  "/volume-cohort": "rb_pdp_olap",
};

function getPageName(pathname) {
  if (PAGE_NAME_MAP[pathname]) return PAGE_NAME_MAP[pathname];
  for (const [route, name] of Object.entries(PAGE_NAME_MAP)) {
    if (pathname.startsWith(route)) return name;
  }
  return "Dashboard";
}

function getTableForRoute(pathname) {
  if (ROUTE_TABLE_MAP[pathname]) return ROUTE_TABLE_MAP[pathname];
  for (const [route, table] of Object.entries(ROUTE_TABLE_MAP)) {
    if (pathname.startsWith(route)) return table;
  }
  return "rb_pdp_olap";
}

const textSx = {
  color: "#1e3a5f",
  fontSize: "14px",
  fontWeight: 500,
  fontFamily: "'DM Sans', 'Inter', sans-serif",
  letterSpacing: "0.02em",
  lineHeight: "32px",
  userSelect: "none",
  whiteSpace: "nowrap",
  "& .date-highlight": {
    color: "#2563eb",
    fontWeight: 700,
  },
};

/**
 * NotificationScroller
 * Continuous marquee showing real-time Max(Date) via WebSocket.
 * Falls back to FilterContext.maxDate if WebSocket hasn't sent data yet.
 */
export default function NotificationScroller() {
  const { maxDate } = useContext(FilterContext);
  const { socketMaxDates } = useSocket();
  const location = useLocation();
  const copyRef = useRef(null);
  const containerRef = useRef(null);
  const [copyWidth, setCopyWidth] = useState(0);
  const [copies, setCopies] = useState(4);

  const pageName = useMemo(() => getPageName(location.pathname), [location.pathname]);
  const tableName = useMemo(() => getTableForRoute(location.pathname), [location.pathname]);

  // Prefer real-time WebSocket date, fall back to FilterContext
  const formattedDate = useMemo(() => {
    const socketDate = socketMaxDates?.[tableName];
    const dateToUse = socketDate || maxDate;
    if (!dateToUse) return "—";
    const d = dayjs(dateToUse);
    return d.isValid() ? d.format("DD MMM YYYY") : "—";
  }, [socketMaxDates, tableName, maxDate]);

  // Alert Generation Engine
  const alertMessages = useMemo(() => {
    const missingPlatforms = {};
    const alerts = [];

    const checkTable = (table, kpis, dayLevel) => {
      const platformDates = socketMaxDates?.[`${table}_platform`];
      const thresholdDate = dayjs().subtract(dayLevel, "days");

      // Case 1: We have platform-specific data from Socket
      if (platformDates && Object.keys(platformDates).length > 0) {
        Object.entries(platformDates).forEach(([platform, mDate]) => {
          if (!mDate || mDate === "0000-00-00") return;
          const d = dayjs(mDate);
          if (d.isValid() && d.isBefore(thresholdDate, "day")) {
            if (!missingPlatforms[platform]) missingPlatforms[platform] = [];
            missingPlatforms[platform].push(`${kpis} data is not present at day -${dayLevel} level`);
          }
        });
      } 
      // Case 2: Fallback to global maxDate from FilterContext if Socket data is missing for this table
      else if (maxDate) {
        const d = dayjs(maxDate);
        // Only apply if the table we are checking is the one relevant for this route
        if (tableName === table && d.isValid() && d.isBefore(thresholdDate, "day")) {
          alerts.push(`⚠️ Data refresh delayed for ${kpis} (Last update: ${d.format("DD MMM")})`);
        }
      }
    };

    checkTable("rb_pdp_olap", "Offtakes, OSA", 3);
    checkTable("rb_kw_olap", "SOS", 3);
    checkTable("rb_ms_olap", "Market Share", 4);

    // Group specific platform alerts into concise messages
    Object.entries(missingPlatforms).forEach(([platform, issues]) => {
      const issueString = issues.length > 1 ? "multiple metrics" : issues[0].split(" data")[0];
      const dayLevelStr = issues[0].match(/day -\d+/)?.[0] || "required";
      alerts.push(
        `⚠️ For ${platform} platform, ${issueString} data is not present at ${dayLevelStr} level due to maintenance work.`
      );
    });

    return alerts;
  }, [socketMaxDates, maxDate, tableName]);

  // Combine Page Info with active alerts
  const message = useMemo(() => {
    if (alertMessages.length === 0) return "";
    
    const baseInfo = `${pageName}  •  Data Updated: ${formattedDate}`;
    const alerts = alertMessages.join("  •  ");
    return `${baseInfo}  •  ${alerts}`;
  }, [pageName, formattedDate, alertMessages]);

  const highlightedHtml = useMemo(() => {
    if (!message) return "";
    return message.replace(
      formattedDate,
      `<span class="date-highlight">${formattedDate}</span>`
    );
  }, [message, formattedDate]);

  // Measure text width & calculate copies needed to fill viewport
  const measure = useCallback(() => {
    if (copyRef.current && containerRef.current) {
      const textW = copyRef.current.offsetWidth;
      const containerW = containerRef.current.offsetWidth;
      setCopyWidth(textW);
      const needed = Math.ceil(containerW / textW) + 1;
      setCopies(Math.max(needed, 2));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(measure, 100);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [measure, message]);

  const duration = copyWidth > 0 ? copyWidth / 60 : 20;

  // If no alerts, hide the bar entirely (per user request)
  if (alertMessages.length === 0) return null;

  return (
    <Box
      ref={containerRef}
      sx={{
        width: "100%",
        height: 32,
        minHeight: 32,
        maxHeight: 32,
        background: "linear-gradient(90deg, #eef4ff 0%, #dbeafe 50%, #eef4ff 100%)",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        position: "relative",
        zIndex: 10,
        borderBottom: "1px solid rgba(37, 99, 235, 0.1)",
        flexShrink: 0,
        ...(copyWidth > 0 && {
          "@keyframes marquee": {
            "0%":   { transform: "translateX(0px)" },
            "100%": { transform: `translateX(-${copyWidth}px)` },
          },
        }),
      }}
    >
      <Box
        sx={{
          display: "inline-flex",
          animation: copyWidth > 0 ? `marquee ${duration}s linear infinite` : "none",
          "&:hover": { animationPlayState: "paused" },
        }}
      >
        {Array.from({ length: copies }).map((_, i) => (
          <Typography
            key={i}
            ref={i === 0 ? copyRef : undefined}
            component="span"
            sx={{ ...textSx, px: 4 }}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ))}
      </Box>
    </Box>
  );
}
