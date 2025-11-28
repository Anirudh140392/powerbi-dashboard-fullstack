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
  const [activePlatform, setActivePlatform] = useState(selectedPlatform || "Blinkit");

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
      // { label: "Account Overview" },
    ],
    "Q-COMM": [
      { label: "Blinkit", icon: "🟡" },
      // { label: "Instamart", icon: "🟠" },
      // { label: "Zepto", icon: "🟣" },
    ],
    ANALYTICS: [
      { label: "Category RCA" },
     
    ],
    'Portfolio Analysis': [
      { label: "Portfolio Analysis"},
      {label: "Price Per Pack"},
      {label: "Price Analysis"}
     
    ],
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
      {/* Logo Section */}
      <Box sx={{ p: 2.5, bgcolor: "rgba(0, 0, 0, 0.3)" }}>
        <Box
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
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              color: '#9ca3af',
              fontSize: '0.7rem',
              fontWeight: 500,
            }}
          >
            powered by
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: '#fff',
              fontSize: '0.7rem',
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
                {items.map((item, index) => (
                 <ListItemButton
  key={index}
  onClick={() => {
    // CONTROL TOWER
    if (sectionName === "CONTROL TOWER" && item.label === "Watch Tower") {
      navigate("/"); // or your Watch Tower route
    }
    if (sectionName === "CONTROL TOWER" && item.label === "Account Overview") {
      navigate("/account-overview");
    }

    // Q-COMM
    if (sectionName === "Q-COMM") {
      handlePlatformChange(item.label);
    }

    // ANALYTICS
    if (sectionName === "ANALYTICS" && item.label === "Category RCA") {
      navigate("/category-rca");

    }
    if (sectionName === "Portfolio Analysis" && item.label === "Portfolio Analysis") {
      navigate("/volume-cohort");
      
    }
     if (sectionName === "Portfolio Analysis" && item.label === "Price Per Pack") {
      navigate("/price-per-pack");
      
    }
    if (sectionName === "Portfolio Analysis" && item.label === "Price Analysis") {
      navigate("/price-analysis");
      
    }
  }}
  sx={{
    py: 1.25,
    px: 3,
    bgcolor:
      (sectionName === "Q-COMM" && activePlatform === item.label) ||
      (sectionName === "ANALYTICS" && item.label === "Category RCA") ||
      (sectionName === "ANALYTICS" && item.label === "Volume Cohort") ||
      (sectionName === "CONTROL TOWER" && item.label === "Watch Tower")
        ? "rgba(255, 255, 255, 0.1)"
        : "transparent",

    borderLeft:
      (sectionName === "Q-COMM" && activePlatform === item.label) ||
      (sectionName === "ANALYTICS" && item.label === "Category RCA") ||
      (sectionName === "ANALYTICS" && item.label === "Volume Cohort") ||
      (sectionName === "CONTROL TOWER" && item.label === "Watch Tower")
        ? "3px solid #3b82f6"
        : "3px solid transparent",

    "&:hover": {
      bgcolor: "rgba(255, 255, 255, 0.08)",
    },
  }}
>
  {/* Icons */}
  {item.icon ? (
    <Box component="span" sx={{ fontSize: "0.9rem", mr: 1.5 }}>
      {item.icon}
    </Box>
  ) : (
    <CircleIcon sx={{ fontSize: "0.4rem", mr: 1.5, color: "#6b7280" }} />
  )}

  <ListItemText
    primary={item.label}
    primaryTypographyProps={{
      fontSize: "0.85rem",
      fontWeight: 500,
      color: "#e5e7eb",
    }}
  />
</ListItemButton>

    
                ))}
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