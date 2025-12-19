import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  Box,
  Typography,
  Divider,
  Drawer,
  useMediaQuery,
  useTheme,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Circle as CircleIcon,
} from "@mui/icons-material";

const Sidebar = ({
  platforms = ["Blinkit", "Instamart", "Zepto"],
  selectedPlatform,
  onPlatformChange,
  open = false,
  onClose,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [expandedSection, setExpandedSection] = useState("Q-COMM");
  const [activePlatform, setActivePlatform] = useState(
    selectedPlatform || "Zepto"
  );

  useEffect(() => {
    if (selectedPlatform) {
      setActivePlatform(selectedPlatform);
    }
  }, [selectedPlatform]);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handlePlatformChange = (platform) => {
    setActivePlatform(platform);
    if (onPlatformChange) {
      onPlatformChange(platform);
    }
    if (isMobile && onClose) {
      onClose();
    }
  };

  const navigate = useNavigate();

  const menuSections = {
    "CONTROL TOWER": [
      { label: "Watch Tower", active: true },
    ],

    "Availability Analysis": [{ label: "Availability Analysis" }],
    "Visibility Analysis": [{ label: "Visibility Analysis" }],
    "Pricing Analysis": [{ label: "Pricing Analysis" }],
    "Market Share": [{ label: "Market Share" }],
    "Portfolio Analysis": [{ label: "Portfolio Analysis" }],

    "Performance Marketing": [{ label: "Performance Marketing" }],

    "Content Analysis": [{ label: "Content Analysis" }],

    ANALYTICS: [
      { label: "Category RCA" },
      { label: "Sales" }, // 🔥 ADD THIS
    ],

    "Inventory Analysis": [{ label: "Inventory Analysis" }],
    SALES: [{ label: "Sales" }],
    PIY: [{ label: "Play it Yourself" }],
  };

  const navbarContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "#1f2937",
        color: "#fff",
      }}
    >
      <style>
        {`
          @keyframes border-pulse {
            0% { border-color: rgba(56, 189, 248, 0.5); box-shadow: 0 0 5px rgba(56, 189, 248, 0.2); }
            50% { border-color: rgba(56, 189, 248, 1); box-shadow: 0 0 15px rgba(56, 189, 248, 0.6); }
            100% { border-color: rgba(56, 189, 248, 0.5); box-shadow: 0 0 5px rgba(56, 189, 248, 0.2); }
          }
          @keyframes text-shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}
      </style>
      {/* Logo Section */}
      <Box sx={{ p: 2.5, bgcolor: "rgba(0, 0, 0, 0.3)" }}>
        {/* <Box
          sx={{
            bgcolor: "#dc2626",
            color: "#fff",
            px: 2,
            py: 1,
            borderRadius: 1,
            fontWeight: 700,
            fontSize: '1rem',
            textAlign: 'center',
            mb: 0.5,
          }}
        >
          Colgate
        </Box> */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "#9ca3af",
              fontSize: "0.7rem",
              fontWeight: 500,
            }}
          >
            powered by
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: "#fff",
              fontSize: "0.7rem",
              fontWeight: 700,
            }}
          >
            Trailytics
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ bgcolor: "rgba(255,255,255,0.1)" }} />

      {/* Menu Sections */}
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {Object.entries(menuSections).map(([sectionName, items]) => (
          <Box key={sectionName}>
            <ListItemButton
              onClick={() => toggleSection(sectionName)}
              sx={{
                py: 1.5,
                px: 2,
                bgcolor:
                  expandedSection === sectionName
                    ? "rgba(255, 255, 255, 0.05)"
                    : "transparent",
                "&:hover": {
                  bgcolor: "rgba(255, 255, 255, 0.08)",
                },
              }}
            >
              <ListItemText
                primary={sectionName}
                primaryTypographyProps={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#9ca3af",
                  letterSpacing: "0.5px",
                }}
              />
              {expandedSection === sectionName ? (
                <ExpandLessIcon sx={{ fontSize: "1rem", color: "#9ca3af" }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: "1rem", color: "#9ca3af" }} />
              )}
            </ListItemButton>

            <Collapse in={expandedSection === sectionName} timeout="auto">
              <List sx={{ py: 0 }}>
                {items.map((item, index) => {
                  const isPiy = sectionName === "PIY";
                  return (
                    <ListItemButton
                      key={index}
                      onClick={() => {
                        // CONTROL TOWER
                        if (
                          sectionName === "CONTROL TOWER" &&
                          item.label === "Watch Tower"
                        ) {
                          navigate("/watch-tower"); // or your Watch Tower route
                        }
                        if (
                          sectionName === "CONTROL TOWER" &&
                          item.label === "Account Overview"
                        ) {
                          navigate("/account-overview");
                        }



                        // ANALYTICS
                        if (
                          sectionName === "ANALYTICS" &&
                          item.label === "Category RCA"
                        ) {
                          navigate("/category-rca");
                        }

                        // ANALYTICS
                        if (
                          sectionName === "Market Share" &&
                          item.label === "Market Share"
                        ) {
                          navigate("/market-share");
                        }

                        if (
                          sectionName === "Portfolio Analysis" &&
                          item.label === "Portfolio Analysis"
                        ) {
                          navigate("/volume-cohort");
                        }
                        // performance marketing
                        if (
                          sectionName === "Performance Marketing" &&
                          item.label === "Performance Marketing"
                        ) {
                          navigate("/performance-marketing");
                        }
                        // Content Analysis
                        if (
                          sectionName === "Content Analysis" &&
                          item.label === "Content Analysis"
                        ) {
                          navigate("/content-score");
                        }
                        // Pricing Analysis
                        if (
                          sectionName === "Pricing Analysis" &&
                          item.label === "Pricing Analysis"
                        ) {
                          navigate("/pricing-analysis");
                        }
                        // Content Analysis
                        if (
                          sectionName === "Availability Analysis" &&
                          item.label === "Availability Analysis"
                        ) {
                          navigate("/availability-analysis");
                        }
                        // Pricing Analysis
                        if (
                          sectionName === "Visibility Analysis" &&
                          item.label === "Visibility Analysis"
                        ) {
                          navigate("/visibility-anlysis");
                        }
                        // Pricing Analysis
                        if (sectionName === "PIY" && item.label === "Play it Yourself") {
                          navigate("/piy");
                        }
                        // Pricing Analysis
                        if (sectionName === "Inventory Analysis" && item.label === "Inventory Analysis") {
                          navigate("/inventory");
                        }
                        // SALES
                        if (sectionName === "SALES" && item.label === "Sales") {
                          navigate("/sales");
                        }
                      }}
                      sx={{
                        py: 1.25,
                        px: 3,
                        bgcolor:
                          (sectionName === "ANALYTICS" &&
                            item.label === "Category RCA") ||
                            (sectionName === "CONTROL TOWER" &&
                              item.label === "Watch Tower")
                            ? "rgba(255, 255, 255, 0.1)"
                            : isPiy ? "rgba(56, 189, 248, 0.1)" : "transparent",

                        borderLeft:
                          (sectionName === "ANALYTICS" &&
                            item.label === "Category RCA") ||
                            (sectionName === "CONTROL TOWER" &&
                              item.label === "Watch Tower")
                            ? "3px solid #3b82f6"
                            : isPiy ? "3px solid #38bdf8" : "3px solid transparent",

                        animation: isPiy ? "border-pulse 2s infinite" : "none",

                        "&:hover": {
                          bgcolor: isPiy ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.08)",
                        },
                      }}
                    >
                      {/* Icons */}
                      {item.icon ? (
                        <Box
                          component="span"
                          sx={{ fontSize: "0.9rem", mr: 1.5 }}
                        >
                          {item.icon}
                        </Box>
                      ) : (
                        <CircleIcon
                          sx={{
                            fontSize: "0.4rem",
                            mr: 1.5,
                            color: isPiy ? "#38bdf8" : "#6b7280",
                            filter: isPiy ? "drop-shadow(0 0 4px #38bdf8)" : "none"
                          }}
                        />
                      )}

                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: "0.85rem",
                          fontWeight: isPiy ? 700 : 500,
                          color: isPiy ? "#e0f2fe" : "#e5e7eb",
                          sx: isPiy ? {
                            background: "linear-gradient(90deg, #e0f2fe, #38bdf8, #e0f2fe)",
                            backgroundSize: "200% auto",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            animation: "text-shimmer 3s linear infinite"
                          } : {}
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Collapse>
          </Box>
        ))}
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        sx={{
          "& .MuiDrawer-paper": {
            width: 250,
            bgcolor: "#1f2937",
          },
        }}
      >
        {navbarContent}
      </Drawer>
    );
  }

  return (
    <Box
      sx={{
        width: 250,
        height: "100vh",
        bgcolor: "#1f2937",
        position: "fixed",
        left: 0,
        top: 0,
        boxShadow: "2px 0 8px rgba(0, 0, 0, 0.1)",
        overflowY: "auto",
        zIndex: 1200,
        "&::-webkit-scrollbar": {
          width: "6px",
        },
        "&::-webkit-scrollbar-track": {
          bgcolor: "rgba(255, 255, 255, 0.05)",
        },
        "&::-webkit-scrollbar-thumb": {
          bgcolor: "rgba(255, 255, 255, 0.2)",
          borderRadius: "3px",
          "&:hover": {
            bgcolor: "rgba(255, 255, 255, 0.3)",
          },
        },
      }}
    >
      {navbarContent}
    </Box>
  );
};

export default Sidebar;
