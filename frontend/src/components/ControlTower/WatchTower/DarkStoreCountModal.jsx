import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Skeleton,
  Button,
} from "@mui/material";
import { X, Store, Download } from "lucide-react";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import axiosInstance from "../../../api/axiosInstance";

/**
 * DarkStoreCountModal
 * Shows dark store counts grouped by platform with expandable city rows.
 * Columns: Total Dark Stores (Total | Listed)
 */
export default function DarkStoreCountModal({ open, onClose, onDataFetched }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedPlatforms, setExpandedPlatforms] = useState({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    axiosInstance
      .get("/watchtower/dark-store-count")
      .then((res) => {
        setData(res.data);
        if (res.data && typeof res.data.totalCount === "number" && onDataFetched) {
          onDataFetched(res.data.totalCount);
        }
      })
      .catch((err) => {
        console.error("[DarkStoreCountModal] Error:", err);
        setData({ totalCount: 0, byPlatform: [] });
      })
      .finally(() => setLoading(false));
  }, [open, onDataFetched]);

  const togglePlatform = (platform) => {
    setExpandedPlatforms((prev) => ({
      ...prev,
      [platform]: !prev[platform],
    }));
  };

  const handleDownload = () => {
    if (!platforms || platforms.length === 0) return;

    const excelRows = [];
    platforms.forEach((pf) => {
      excelRows.push({
        Platform: pf.platform,
        City: "All Cities (Total)",
        "Total Dark Stores": pf.total,
        "Listed Dark Stores": pf.listed,
      });
      (pf.cities || []).forEach((c) => {
        excelRows.push({
          Platform: pf.platform,
          City: c.city,
          "Total Dark Stores": c.total,
          "Listed Dark Stores": c.listed,
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dark_Stores");
    const fileName = `Dark_Store_Count_${dayjs().format("YYYYMMDD")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const fmt = (n) =>
    typeof n === "number" ? n.toLocaleString("en-IN") : "0";

  const platforms = data?.byPlatform || [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          maxHeight: "85vh",
        },
      }}
    >
      {/* ── Header ── */}
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 2,
          px: 3,
          borderBottom: "1px solid #e2e8f0",
          bgcolor: "#fafbfc",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Store size={18} color="#fff" />
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "#1e293b",
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1.2,
              }}
            >
              Dark Store Count
            </Typography>
            <Typography
              sx={{
                fontSize: "0.7rem",
                color: "#94a3b8",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              powered by Trailytics
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleDownload}
            disabled={!platforms || platforms.length === 0}
            startIcon={<Download size={15} />}
            sx={{
              textTransform: "none",
              fontSize: "0.78rem",
              fontWeight: 600,
              borderRadius: "8px",
              borderColor: "#cbd5e1",
              color: "#475569",
              px: 1.5,
              py: 0.5,
              "&:hover": {
                borderColor: "#94a3b8",
                bgcolor: "#f8fafc",
              },
            }}
          >
            Download
          </Button>

          <IconButton onClick={onClose} size="small" sx={{ color: "#94a3b8" }}>
            <X size={18} />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* ── Content ── */}
      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ p: 3 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                height={48}
                sx={{ borderRadius: "8px", mb: 1.5 }}
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            {/* ── Table ── */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "'Inter', 'Roboto', sans-serif",
              }}
            >
              <thead>
                {/* Group header row */}
                <tr>
                  <th
                    style={{
                      ...thStyle,
                      borderBottom: "1px solid #e2e8f0",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#475569",
                    }}
                    rowSpan={2}
                  >
                    Platform
                  </th>
                  <th
                    style={{
                      ...thGroupStyle,
                      background:
                        "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
                      color: "#4338ca",
                    }}
                    colSpan={2}
                  >
                    Total Dark Stores
                  </th>
                </tr>
                {/* Sub header row */}
                <tr>
                  <th style={{ ...thSubStyle, color: "#4338ca" }}>Total</th>
                  <th style={{ ...thSubStyle, color: "#4338ca" }}>Listed</th>
                </tr>
              </thead>
              <tbody>
                {platforms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        textAlign: "center",
                        padding: "32px 16px",
                        color: "#94a3b8",
                        fontSize: "0.85rem",
                      }}
                    >
                      No dark store data available
                    </td>
                  </tr>
                ) : (
                  platforms.map((pf, idx) => (
                    <React.Fragment key={pf.platform}>
                      {/* Platform row */}
                      <tr
                        style={{
                          backgroundColor:
                            idx % 2 === 0 ? "#ffffff" : "#fafbfc",
                          cursor: "pointer",
                          transition: "background-color 0.15s",
                        }}
                        onClick={() => togglePlatform(pf.platform)}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#f1f5f9")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            idx % 2 === 0 ? "#ffffff" : "#fafbfc")
                        }
                      >
                        <td style={{ ...tdPlatformStyle }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Typography
                              sx={{
                                fontWeight: 600,
                                fontSize: "0.82rem",
                                color: "#1e293b",
                              }}
                            >
                              {pf.platform}
                            </Typography>
                          </Box>
                          <Typography
                            sx={{
                              fontSize: "0.68rem",
                              color: "#6366f1",
                              fontWeight: 600,
                              cursor: "pointer",
                              mt: 0.3,
                              display: "flex",
                              alignItems: "center",
                              gap: 0.3,
                              "&:hover": { color: "#4f46e5" },
                            }}
                          >
                            {expandedPlatforms[pf.platform]
                              ? "− Hide Cities"
                              : "+ Show Cities"}
                          </Typography>
                        </td>
                        <td style={tdNumStyle}>
                          <span style={{ fontWeight: 700, color: "#1e293b" }}>
                            {fmt(pf.total)}
                          </span>
                        </td>
                        <td style={tdNumStyle}>
                          <span style={{ fontWeight: 600, color: "#475569" }}>
                            {fmt(pf.listed)}
                          </span>
                        </td>
                      </tr>

                      {/* City rows (collapsible) */}
                      {expandedPlatforms[pf.platform] &&
                        pf.cities.map((city, ci) => (
                          <tr
                            key={`${pf.platform}-${city.city}`}
                            style={{
                              backgroundColor:
                                ci % 2 === 0 ? "#f8fafc" : "#f1f5f9",
                              transition: "background-color 0.15s",
                            }}
                          >
                            <td
                              style={{
                                ...tdCityStyle,
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.8,
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor: "#cbd5e1",
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography
                                  sx={{
                                    fontSize: "0.78rem",
                                    color: "#475569",
                                    fontWeight: 500,
                                  }}
                                >
                                  {city.city}
                                </Typography>
                              </Box>
                            </td>
                            <td style={tdCityNumStyle}>
                              <span
                                style={{ fontWeight: 600, color: "#334155" }}
                              >
                                {fmt(city.total)}
                              </span>
                            </td>
                            <td style={tdCityNumStyle}>
                              <span
                                style={{ fontWeight: 500, color: "#64748b" }}
                              >
                                {fmt(city.listed)}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Table cell styles ── */
const thStyle = {
  padding: "12px 16px",
  fontSize: "0.72rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
};

const thGroupStyle = {
  padding: "8px 16px",
  fontSize: "0.7rem",
  fontWeight: 700,
  textAlign: "center",
  letterSpacing: "0.03em",
  borderBottom: "1px solid #e2e8f0",
};

const thSubStyle = {
  padding: "6px 16px",
  fontSize: "0.68rem",
  fontWeight: 600,
  textAlign: "center",
  borderBottom: "2px solid #e2e8f0",
  backgroundColor: "#fafbfc",
};

const tdPlatformStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid #f1f5f9",
};

const tdNumStyle = {
  padding: "12px 16px",
  textAlign: "center",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "0.82rem",
};

const tdCityStyle = {
  padding: "8px 16px 8px 36px",
  borderBottom: "1px solid #e8ecf1",
};

const tdCityNumStyle = {
  padding: "8px 16px",
  textAlign: "center",
  borderBottom: "1px solid #e8ecf1",
  fontSize: "0.78rem",
};

