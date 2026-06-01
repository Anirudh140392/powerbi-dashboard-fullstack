import React, { useContext, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { FilterContext } from "../../utils/FilterContext";
import { useSocket } from "../../utils/SocketContext";
import { useAuth } from "../../utils/AuthContext";
import axiosInstance from "../../api/axiosInstance";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

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

/**
 * DB_ALERT_CONFIG — Per-client timing and data freshness configuration
 * 
 * Structure per DB:
 *   prod/dev: { pdp, kw, sales, pm, ms } → IST time (HH:MM) after which data should be available
 *   levels: { pdp, kw, sales, pm, ms } → { platformName: dayLevel, _default: dayLevel }
 *     dayLevel: 0 = Same Day, 1 = Day-1, 2 = Day-2, 3 = Day-3, 30 = Monthly, null = N/A (skip)
 * 
 * KPI Mapping:
 *   OSA (Availability) → pdp level (rb_pdp_olap)
 *   Sales/Offtakes     → sales level (rb_pdp_olap, different timing)
 *   DOI (Inventory)    → pdp level (rb_pdp_olap)
 *   SOS                → kw level (rb_kw_olap)
 *   Market Share       → ms level (rb_ms_olap)
 *   PM                 → pm level (rb_pm_olap)
 */
const DB_ALERT_CONFIG = {
  boat: {
    prod: { pdp: "15:30", kw: "15:30", sales: "15:30", pm: "15:30", ms: "15:30" },
    dev:  { pdp: "09:30", kw: "09:30", sales: "13:30", pm: "13:30", ms: "13:30" },
    levels: {
      pdp:   { _default: 1 },
      kw:    { _default: 1 },
      sales: { instamart: 1, amazon: 2, _default: 2 },
      pm:    { amazon: 1, blinkit: 1, zepto: 1, _default: 1 },
      ms:    { amazon: 30, _default: 3 },
    }
  },
  mamaearth: {
    prod: { pdp: "16:30", kw: "16:30", sales: "16:30", pm: "16:30", ms: "16:30" },
    dev:  { pdp: "09:30", kw: "09:30", sales: "13:00", pm: "13:00", ms: "13:00" },
    levels: {
      pdp:   { _default: 1 },
      kw:    { _default: 1 },
      sales: { blinkit: 1, flipkart: 2, _default: 2 },
      pm:    { _default: 1 },
      ms:    { blinkit: 3, flipkart: null, _default: null },
    }
  },
  mars: {
    prod: { pdp: "15:00", kw: "15:00", sales: "15:00", pm: "15:00", ms: "15:00" },
    dev:  { pdp: "10:30", kw: "10:30", sales: "14:15", pm: "14:15", ms: "13:00" },
    levels: {
      pdp:   { _default: 1 },
      kw:    { _default: 1 },
      sales: { _default: 1 },
      pm:    { _default: 1 },
      ms:    { blinkit: 3, instamart: 3, zepto: 3, _default: null },
    }
  },
  mars_petcare: {
    prod: { pdp: "14:00", kw: "14:00", sales: "14:00", pm: "14:00", ms: "14:00" },
    dev:  { pdp: "10:30", kw: "10:30", sales: "13:30", pm: "13:30", ms: "13:30" },
    levels: {
      pdp:   { _default: 1 },
      kw:    { _default: 1 },
      sales: { _default: 2 },
      pm:    { _default: 1 },
      ms:    { _default: null },
    }
  },
  pidilite: {
    prod: { pdp: "16:00", kw: "16:00", sales: "16:00", pm: "16:00", ms: "16:00" },
    dev:  { pdp: "13:30", kw: "09:30", sales: "13:30", pm: "13:30", ms: "13:30" },
    levels: {
      pdp:   { _default: 0 },
      kw:    { _default: 0 },
      sales: { _default: 1 },
      pm:    { _default: 1 },
      ms:    { blinkit: 3, zepto: 3, _default: null },
    }
  },
  sugar: {
    prod: { pdp: "12:30", kw: "12:30", sales: "12:30", pm: "12:30", ms: "12:30" },
    dev:  { pdp: "09:30", kw: "09:30", sales: "09:30", pm: "09:30", ms: "09:30" },
    levels: {
      pdp:   { _default: 1 },
      kw:    { _default: 1 },
      sales: { _default: null },
      pm:    { _default: null },
      ms:    { _default: null },
    }
  },
  hm_zydus: {
    prod: { pdp: "12:30", kw: "12:30", sales: "12:30", pm: "12:30", ms: "12:30" },
    dev:  { pdp: "09:30", kw: "09:30", sales: "09:30", pm: "09:30", ms: "09:30" },
    levels: {
      pdp:   { _default: 1 },
      kw:    { _default: 1 },
      sales: { _default: null },
      pm:    { _default: null },
      ms:    { _default: null },
    }
  },
  zydus: {
    prod: { pdp: "12:30", kw: "12:30", sales: "12:30", pm: "12:30", ms: "12:30" },
    dev:  { pdp: "09:30", kw: "09:30", sales: "09:30", pm: "09:30", ms: "09:30" },
    levels: {
      pdp:   { _default: 1 },
      kw:    { _default: 1 },
      sales: { _default: null },
      pm:    { _default: null },
      ms:    { _default: null },
    }
  },
};

// Fallback config for DBs not in the map
const DEFAULT_ALERT_CONFIG = {
  prod: { pdp: "15:00", kw: "15:00", sales: "15:00", pm: "15:00", ms: "15:00" },
  dev:  { pdp: "09:30", kw: "09:30", sales: "13:30", pm: "13:30", ms: "13:30" },
  levels: {
    pdp:   { _default: 1 },
    kw:    { _default: 1 },
    sales: { _default: 2 },
    pm:    { _default: 1 },
    ms:    { _default: 3 },
  }
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

/** Get the data level (days old) for a specific KPI and platform */
function getDataLevel(levelConfig, platformName) {
  if (!levelConfig) return null;
  const pKey = (platformName || "").toLowerCase();
  if (levelConfig[pKey] !== undefined) return levelConfig[pKey];
  return levelConfig._default !== undefined ? levelConfig._default : null;
}

/** Parse "HH:MM" string into { hour, minute } */
function parseTime(timeStr) {
  const [h, m] = (timeStr || "12:00").split(":").map(Number);
  return { hour: h, minute: m };
}

/** Check if current IST time has passed the expected availability time */
function hasPassedExpectedTime(timeStr) {
  const now = dayjs().utcOffset(330); // IST = UTC+5:30
  const { hour, minute } = parseTime(timeStr);
  const expectedMinutes = hour * 60 + minute;
  const currentMinutes = now.hour() * 60 + now.minute();
  return currentMinutes >= expectedMinutes;
}

/** Capitalize first letter */
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
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
 * Continuous marquee showing real-time Max(Date) alerts.
 * Data source priority:
 *   1. WebSocket `socketMaxDates` (real-time, best case)
 *   2. REST API `/api/watchtower/max-dates-all` (fallback when WebSocket fails on server)
 *   3. FilterContext `maxDate` (last resort, only covers current page's table)
 */
export default function NotificationScroller() {
  const { maxDate } = useContext(FilterContext);
  const { socketMaxDates, isConnected } = useSocket();
  const { user } = useAuth();
  const location = useLocation();
  const copyRef = useRef(null);
  const containerRef = useRef(null);
  const [copyWidth, setCopyWidth] = useState(0);
  const [copies, setCopies] = useState(4);
  const [httpMaxDates, setHttpMaxDates] = useState(null);
  const httpFetchedRef = useRef(false);

  const pageName = useMemo(() => getPageName(location.pathname), [location.pathname]);
  const tableName = useMemo(() => getTableForRoute(location.pathname), [location.pathname]);
  const dbName = user?.dbName?.toLowerCase() || "";

  // HTTP fallback: fetch max dates via REST API when WebSocket is not connected
  useEffect(() => {
    // Only fetch via HTTP if:
    // 1. Socket is NOT connected
    // 2. Socket data is empty (no tables received)
    // 3. We haven't already fetched via HTTP
    const hasSocketData = socketMaxDates && Object.keys(socketMaxDates).length > 0;

    if (!hasSocketData && !httpFetchedRef.current) {
      // Wait 5 seconds to give WebSocket a chance to connect first
      const timer = setTimeout(async () => {
        // Re-check if socket data arrived during the wait
        if (httpFetchedRef.current) return;

        try {
          console.log("[NotificationScroller] 🌐 WebSocket data unavailable, fetching via REST API...");
          const res = await axiosInstance.get("/watchtower/max-dates-all");
          if (res.data && typeof res.data === "object") {
            console.log("[NotificationScroller] ✅ REST API max dates received:", res.data);
            setHttpMaxDates(res.data);
            httpFetchedRef.current = true;
          }
        } catch (err) {
          console.warn("[NotificationScroller] ⚠️ REST API fallback failed:", err.message);
        }
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [socketMaxDates, isConnected]);

  // Reset HTTP cache when socket reconnects with fresh data
  useEffect(() => {
    const hasSocketData = socketMaxDates && Object.keys(socketMaxDates).length > 0;
    if (hasSocketData && isConnected) {
      httpFetchedRef.current = false;
      setHttpMaxDates(null);
    }
  }, [socketMaxDates, isConnected]);

  // Merge data sources: Socket takes priority, then HTTP fallback
  const effectiveDates = useMemo(() => {
    const hasSocketData = socketMaxDates && Object.keys(socketMaxDates).length > 0;
    if (hasSocketData) return socketMaxDates;
    if (httpMaxDates) return httpMaxDates;
    return {};
  }, [socketMaxDates, httpMaxDates]);

  // Prefer real-time WebSocket date, fall back to FilterContext
  const formattedDate = useMemo(() => {
    const socketDate = effectiveDates?.[tableName];
    const dateToUse = socketDate || maxDate;
    if (!dateToUse) return "—";
    const d = dayjs(dateToUse);
    return d.isValid() ? d.format("DD MMM YYYY") : "—";
  }, [effectiveDates, tableName, maxDate]);

  // ─── Alert Generation Engine (Time-Aware, Platform-Wise, KPI-Level) ────────
  const alertMessages = useMemo(() => {
    const alerts = [];
    const isProd = effectiveDates?.isProd ?? false;
    const config = DB_ALERT_CONFIG[dbName] || DEFAULT_ALERT_CONFIG;
    const envTimes = isProd ? config.prod : config.dev;
    const levels = config.levels;

    /**
     * KPI Check Definitions:
     *   Each entry maps a human-readable KPI name to:
     *   - table: the ClickHouse table holding platform max dates
     *   - levelKey: which key in `levels` to use for data freshness
     *   - timeKey: which key in `envTimes` to use for availability time
     */
    const kpiChecks = [
      { kpi: "OSA",          platformKey: "kpi_osa_platform",    globalKey: "kpi_osa",      levelKey: "pdp",   timeKey: "pdp" },
      { kpi: "Sales",        platformKey: "kpi_sales_platform",  globalKey: "kpi_sales",    levelKey: "sales", timeKey: "sales" },
      { kpi: "DOI",          platformKey: "kpi_doi_platform",    globalKey: "kpi_doi",      levelKey: "pdp",   timeKey: "pdp" },
      { kpi: "SOS",          platformKey: "rb_kw_olap_platform", globalKey: "rb_kw_olap",   levelKey: "kw",    timeKey: "kw" },
      { kpi: "Market Share", platformKey: "rb_ms_olap_platform", globalKey: "rb_ms_olap",   levelKey: "ms",    timeKey: "ms" },
      { kpi: "PM",           platformKey: "rb_pm_olap_platform", globalKey: "rb_pm_olap",   levelKey: "pm",    timeKey: "pm" },
    ];

    // Group alerts per platform for cleaner messages
    const platformAlerts = {}; // { platformName: [{ kpi, expectedLevel, lastDate }] }

    kpiChecks.forEach(({ kpi, platformKey, globalKey, levelKey, timeKey }) => {
      const expectedTime = envTimes?.[timeKey];
      
      // Skip if current IST time hasn't passed the expected availability time yet
      if (!hasPassedExpectedTime(expectedTime)) return;

      const platformDates = effectiveDates?.[platformKey];

      if (platformDates && Object.keys(platformDates).length > 0) {
        // Check each platform individually
        Object.entries(platformDates).forEach(([platform, mDate]) => {
          if (!mDate || mDate === "0000-00-00") return;

          const dataLevel = getDataLevel(levels[levelKey], platform);
          // null means N/A — skip this KPI for this platform
          if (dataLevel === null || dataLevel === undefined) return;

          const d = dayjs(mDate);
          if (!d.isValid()) return;

          const expectedDate = dayjs().subtract(dataLevel, "day");
          if (d.isBefore(expectedDate, "day")) {
            const pKey = platform.toLowerCase();
            if (!platformAlerts[pKey]) platformAlerts[pKey] = [];
            platformAlerts[pKey].push({
              kpi,
              expectedLevel: dataLevel,
              lastDate: d.format("DD MMM"),
            });
          }
        });
      }
      // Fallback: check global table-level date
      else if (effectiveDates?.[globalKey]) {
        const globalLevel = getDataLevel(levels[levelKey], "_default");
        if (globalLevel === null || globalLevel === undefined) return;

        const d = dayjs(effectiveDates[globalKey]);
        if (d.isValid() && d.isBefore(dayjs().subtract(globalLevel, "day"), "day")) {
          alerts.push(`⚠️ ${kpi} data refresh delayed (Last update: ${d.format("DD MMM")})`);
        }
      }
      // Last resort: FilterContext maxDate
      else if (maxDate) {
        let isMatchingTable = false;
        if (tableName === "rb_pdp_olap" && (levelKey === "pdp" || levelKey === "sales")) isMatchingTable = true;
        else if (tableName === "rb_kw_olap" && levelKey === "kw") isMatchingTable = true;
        else if (tableName === "rb_ms_olap" && levelKey === "ms") isMatchingTable = true;
        else if (tableName === "rb_pm_olap" && levelKey === "pm") isMatchingTable = true;

        if (isMatchingTable) {
          const globalLevel = getDataLevel(levels[levelKey], "_default");
          if (globalLevel === null || globalLevel === undefined) return;

          const d = dayjs(maxDate);
          if (d.isValid() && d.isBefore(dayjs().subtract(globalLevel, "day"), "day")) {
            alerts.push(`⚠️ ${kpi} data refresh delayed (Last update: ${d.format("DD MMM")})`);
          }
        }
      }
    });

    // Build per-platform consolidated alert messages
    Object.entries(platformAlerts).forEach(([platform, issues]) => {
      const kpiList = issues.map(i => i.kpi).join(", ");
      const dayLevelStr = issues[0].expectedLevel === 0
        ? "Same Day"
        : issues[0].expectedLevel === 30
          ? "Monthly"
          : `D-${issues[0].expectedLevel}`;
      const lastDate = issues[0].lastDate;
      alerts.push(
        `⚠️ ${capitalize(platform)}: ${kpiList} data not updated at expected ${dayLevelStr} level (Last: ${lastDate})`
      );
    });

    // --- DOI Data Availability Alert (consolidated single line) ---
    const doiPlatforms = effectiveDates?.rb_doi_platforms;
    if (doiPlatforms && Object.keys(doiPlatforms).length > 0) {
      const missingDoiPlatforms = Object.entries(doiPlatforms)
        .filter(([, hasData]) => !hasData)
        .map(([platform]) => capitalize(platform));
      if (missingDoiPlatforms.length > 0) {
        const platformList = missingDoiPlatforms.join(", ");
        alerts.push(
          `⚠️ Unable to fetch ${platformList} DOI data from Portal`
        );
      }
    }

    return alerts;
  }, [effectiveDates, maxDate, tableName, dbName]);

  // Combine only active alerts for the marquee
  const message = useMemo(() => {
    if (alertMessages.length === 0) return "";
    return alertMessages.join("  •  ");
  }, [alertMessages]);

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
    if (alertMessages.length > 0) {
      console.log(`[NotificationScroller] 🔔 Active alerts for ${pageName}:`, alertMessages);
    }
  }, [alertMessages, pageName]);

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
