import React, { useState, useEffect, useCallback, useContext } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
} from "@mui/material";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
} from "recharts";
import dayjs from "dayjs";

// Import API service
import { fetchSecondarySalesTimeline } from "../../../api/secondarySalesService";
import { FilterContext } from "../../../utils/FilterContext";

const platformLegends = [
  { name: "Amazon", color: "#1e293b" },
  { name: "Big Basket", color: "#64748b" },
  { name: "Blinkit", color: "#0d9488" },
  { name: "Firstcry", color: "#0284c7" },
  { name: "Firstcry B2B", color: "#475569" },
  { name: "Flipkart", color: "#800020" },
  { name: "Jiomart", color: "#0369a1" },
  { name: "Meesho", color: "#581c87" },
  { name: "Myntra", color: "#ec4899" },
  { name: "Nykaa Beauty", color: "#d946ef" },
  { name: "Nykaa Man", color: "#06b6d4" },
  { name: "Pharmeasy", color: "#14b8a6" },
  { name: "Shopify", color: "#16a34a" },
  { name: "Sjit", color: "#38bdf8" },
  { name: "Swiggy", color: "#f97316" },
  { name: "Zepto", color: "#eab308" },
];

export default function SecondaryDailyTracking({ timeStart, timeEnd }) {
  const filterCtx = useContext(FilterContext) || {};
  const { activeGranularity } = filterCtx;
  const [dailyMrpData, setDailyMrpData] = useState([]);
  const [monthlyPlatformTrend, setMonthlyPlatformTrend] = useState([]);
  const [loading, setLoading] = useState(false);

  // Log props on mount and change
  useEffect(() => {
    console.log('[SecondaryDailyTracking] Component mounted/updated with props:', {
      timeStart: timeStart ? timeStart.format("YYYY-MM-DD") : 'undefined',
      timeEnd: timeEnd ? timeEnd.format("YYYY-MM-DD") : 'undefined'
    });
  }, [timeStart, timeEnd]);

  // Calculate adaptive label and tick intervals based on data range
  const calculateIntervals = useCallback((dataLength, dateRange) => {
    if (!dataLength || dataLength === 0) return { labelInterval: 1, tickInterval: 0 };
    
    // Calculate days between start and end
    const daysDiff = timeStart && timeEnd ? timeEnd.diff(timeStart, 'day') + 1 : dataLength;
    
    let labelInterval, tickInterval;
    
    if (daysDiff <= 7) {
      // 1 week or less: show every point
      labelInterval = 1;
      tickInterval = 0;
    } else if (daysDiff <= 30) {
      // 1 month: show every 3rd label, every 2nd tick
      labelInterval = 3;
      tickInterval = Math.max(0, Math.floor(dataLength / 15));
    } else if (daysDiff <= 90) {
      // 3 months: show every 7th label, every 5th tick  
      labelInterval = 7;
      tickInterval = Math.max(0, Math.floor(dataLength / 12));
    } else if (daysDiff <= 180) {
      // 6 months: show every 14th label, every 10th tick
      labelInterval = 14;
      tickInterval = Math.max(0, Math.floor(dataLength / 10));
    } else {
      // More than 6 months: show every 30th label, every 20th tick
      labelInterval = 30;
      tickInterval = Math.max(0, Math.floor(dataLength / 8));
    }
    
    return { labelInterval, tickInterval };
  }, [timeStart, timeEnd]);

  // Format short values for labels
  const formatShortValue = useCallback((val) => {
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)}CR`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `${(val / 1000).toFixed(2)}K`;
    return val.toFixed(2);
  }, []);

  // Build params for API call
  const buildParams = useCallback(() => {
    const params = {
      metricType: 'MRP',
    };

    // Add date range
    if (timeStart) {
      params.startDate = timeStart.format("YYYY-MM-DD");
      console.log('[SecondaryDailyTracking] Start date:', params.startDate);
    } else {
      console.warn('[SecondaryDailyTracking] No timeStart provided');
    }
    
    if (timeEnd) {
      params.endDate = timeEnd.format("YYYY-MM-DD");
      console.log('[SecondaryDailyTracking] End date:', params.endDate);
    } else {
      console.warn('[SecondaryDailyTracking] No timeEnd provided');
    }

    params.granularity = activeGranularity || 'monthly';

    return params;
  }, [timeStart, timeEnd, activeGranularity]);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    console.log('[SecondaryDailyTracking] Starting fetch...');
    setLoading(true);
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('[SecondaryDailyTracking] Fetch timeout - setting loading to false');
      setLoading(false);
    }, 10000); // 10 second timeout
    
    try {
      const params = buildParams();
      console.log('[SecondaryDailyTracking] Fetching with params:', params);
      
      const response = await fetchSecondarySalesTimeline(params);
      console.log('[SecondaryDailyTracking] API response:', response);

      if (response?.success && response.data && response.data.length > 0) {
        console.log('[SecondaryDailyTracking] Data length:', response.data.length);
        console.log('[SecondaryDailyTracking] First item:', response.data[0]);
        
        // Transform API data to chart format
        const transformedData = response.data.map(item => {
          const value = parseFloat(item.value) || 0;
          return {
            day: item.month || item.date || item.label,
            val: value / 1000000, // Convert to millions
            label: formatShortValue(value)
          };
        });

        console.log('[SecondaryDailyTracking] Transformed data:', transformedData);
        setDailyMrpData(transformedData);
        
        // Create monthly platform data by transforming the timeline data
        const mockMonthlyData = transformedData.slice(-6).map((item) => ({
          month: item.day,
          Amazon: parseFloat((parseFloat(item.val) * 0.6).toFixed(1)), // 60% share
          Flipkart: parseFloat((parseFloat(item.val) * 0.15).toFixed(1)), // 15% share
          Blinkit: parseFloat((parseFloat(item.val) * 0.08).toFixed(1)), // 8% share
          Nykaa: parseFloat((parseFloat(item.val) * 0.07).toFixed(1)), // 7% share
          Zepto: parseFloat((parseFloat(item.val) * 0.05).toFixed(1)), // 5% share
          Meesho: parseFloat((parseFloat(item.val) * 0.05).toFixed(1)), // 5% share
        }));
        console.log('[SecondaryDailyTracking] Monthly platform data:', mockMonthlyData);
        setMonthlyPlatformTrend(mockMonthlyData);
      } else {
        console.warn('[SecondaryDailyTracking] No data in response or empty data array');
        setDailyMrpData([]);
        setMonthlyPlatformTrend([]);
      }
    } catch (error) {
      console.error('[SecondaryDailyTracking] Error fetching data:', error);
      setDailyMrpData([]);
      setMonthlyPlatformTrend([]);
    } finally {
      clearTimeout(timeoutId);
      console.log('[SecondaryDailyTracking] Fetch complete, loading set to false');
      setLoading(false);
    }
  }, [buildParams, formatShortValue]);

  // Fetch data on mount and when filters/dates change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Box sx={{ width: "100%", mt: 4 }}>
      {/* SECTION HEADER */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e2e8f0",
          pb: 1.5,
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 5,
              height: 24,
              backgroundColor: "#7c3aed",
              borderRadius: 1,
            }}
          />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              color: "#1e293b",
              letterSpacing: "0.05em",
              fontFamily: "Roboto, sans-serif",
            }}
          >
            {activeGranularity === "daily"
              ? "SECONDARY DAILY TRACKING"
              : activeGranularity === "weekly"
              ? "SECONDARY WEEKLY TRACKING"
              : "SECONDARY MONTHLY TRACKING"}
          </Typography>
        </Box>
      </Box>



      {/* CARD 2: MONTHLY SALES TREND (MULTI-PLATFORM LINE CHART) */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          border: "1px solid #f1f5f9",
          backgroundColor: "#fff",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: "0.85rem", fontWeight: 800, color: "#1e293b", letterSpacing: "0.03em", mb: 1.5 }}>
            MONTHLY SALES TREND
          </Typography>

          {/* Platform Legends */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.2, mb: 2 }}>
            {platformLegends.map((p) => (
              <Box key={p.name} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: p.color }} />
                <Typography sx={{ fontSize: "0.62rem", fontWeight: 600, color: "#64748b" }}>
                  {p.name}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ width: "100%", height: 320 }}>
            {loading ? (
              <Skeleton variant="rounded" width="100%" height={320} sx={{ borderRadius: 2 }} />
            ) : monthlyPlatformTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyPlatformTrend} margin={{ top: 25, right: 15, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 9, fill: "#475569", fontWeight: 600 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) => `${val}M`}
                    tick={{ fontSize: 9, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 60]}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <Box sx={{ backgroundColor: "#fff", p: 1.5, border: "1px solid #e2e8f0", borderRadius: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                            <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: "#1e293b", mb: 0.5 }}>
                              {label}
                            </Typography>
                            {payload.map((entry) => {
                              const val = parseFloat(entry.value) || 0;
                              const formatted = val >= 10 ? `${(val / 10).toFixed(2)}CR` : `${val.toFixed(2)}M`;
                              return (
                                <Typography key={entry.name} sx={{ fontSize: "0.7rem", fontWeight: 700, color: entry.color }}>
                                  {entry.name}: {formatted}
                                </Typography>
                              );
                            })}
                          </Box>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Amazon"
                    stroke="#1e293b"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#1e293b" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Flipkart"
                    stroke="#800020"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#800020" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Blinkit"
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#0d9488" }}
                  />
                  <Line type="monotone" dataKey="Nykaa" stroke="#d946ef" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="Zepto" stroke="#eab308" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="Meesho" stroke="#581c87" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                <Typography sx={{ fontSize: "0.85rem", color: "#94a3b8" }}>Platform trend data coming soon</Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
