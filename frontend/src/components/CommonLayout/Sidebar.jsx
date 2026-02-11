import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  IconButton,
  InputBase,
  Tooltip,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Dashboard as DashboardIcon,
  Assessment as AssessmentIcon,
  Visibility as VisibilityIcon,
  PriceChange as PriceChangeIcon,
  BarChart as BarChartIcon,
  Inventory as InventoryIcon,
  AccountBalance as AccountBalanceIcon,
  Campaign as CampaignIcon,
  Article as ArticleIcon,
  ShoppingCart as ShoppingCartIcon,
  AutoGraph as AutoGraphIcon,
  AdsClick as AdsClickIcon,
  Science as ScienceIcon,
  Schedule as ScheduleIcon,
} from "@mui/icons-material";

const Sidebar = ({
  platforms = ["Blinkit", "Instamart", "Zepto"],
  selectedPlatform,
  onPlatformChange,
  open = false,
  onClose,
  isCollapsed,
  setIsCollapsed,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSection, setExpandedSection] = useState("Q-COMM");

  const currentPath = location.pathname;

  const menuSections = {
    "MAIN MENU": [
      { label: "Watch Tower", path: "/watch-tower", icon: <DashboardIcon sx={{ fontSize: '1.1rem' }} /> },
      { label: "Availability Analysis", path: "/availability-analysis", icon: <ShoppingCartIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Visibility Analysis", path: "/visibility-anlysis", icon: <VisibilityIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Market Share", path: "/market-share", icon: <AutoGraphIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Sales Data", path: "/sales", icon: <BarChartIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Pricing Analysis", path: "/pricing-analysis", icon: <PriceChangeIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Performance Marketing", path: "/performance-marketing", icon: <AdsClickIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Portfolio Analysis", path: "/volume-cohort", icon: <AssessmentIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Content Analysis", path: "/content-score", icon: <ArticleIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Inventory Analysis", path: "/inventory", icon: <InventoryIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Play it Yourself", path: "/piy", icon: <ScienceIcon sx={{ fontSize: '1rem' }} />, isPiy: true },
      { label: "Category RCA", path: "/category-rca", icon: <AutoGraphIcon sx={{ fontSize: '1rem' }} />, isPiy: true },
      { label: "Scheduled Reports", path: "/scheduled-reports", icon: <ScheduleIcon sx={{ fontSize: '1rem' }} /> },
    ],
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery) return menuSections;
    const result = {};
    Object.entries(menuSections).forEach(([section, items]) => {
      const filteredItems = items.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filteredItems.length > 0) result[section] = filteredItems;
    });
    return result;
  }, [searchQuery]);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  const sidebarWidth = isCollapsed ? 72 : 250;

  const navbarContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "rgba(17, 24, 39, 0.98)",
        backdropFilter: "blur(12px)",
        color: "#fff",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        width: sidebarWidth,
        overflow: "hidden", // 🔥 REMOVED SCROLLBAR
      }}
    >
      <style>
        {`
          @keyframes border-pulse {
            0% { border-color: rgba(56, 189, 248, 0.3); box-shadow: 0 0 5px rgba(56, 189, 248, 0.1); }
            50% { border-color: rgba(56, 189, 248, 0.8); box-shadow: 0 0 15px rgba(56, 189, 248, 0.4); }
            100% { border-color: rgba(56, 189, 248, 0.3); box-shadow: 0 0 5px rgba(56, 189, 248, 0.1); }
          }
          @keyframes text-shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}
      </style>

      {/* Header / Logo */}
      <Box sx={{
        px: isCollapsed ? 1 : 2,
        py: 2,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box
          sx={{
            height: 48,
            py: 2,
            display: 'flex',
            alignItems: 'baseline', // Keep container centered
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            px: isCollapsed ? 0 : 2.5,
            transition: 'all 0.3s ease',
            overflow: 'hidden',
            width: isCollapsed ? '100%' : 'auto'
          }}
        >
          {/* EY Logo Container */}
          <Box
            sx={{
              height: 32,
              width: 58,
              minWidth: isCollapsed ? 0 : 58,
              display: 'flex',
              alignItems: 'flex-end', // Align to bottom to help with baseline
              justifyContent: 'center',
              pb: '6px', // Fine-tune vertical position of the logo
              mr: 0
            }}
          >
            <svg viewBox="0 0 60 46" height="100%" width="100%" style={{ overflow: 'visible' }}>
              {/* Yellow Beam - Triangle pointing up-right */}
              <path d="M0 24 L58 8 V19 L0 24 Z" fill="#FFE600" />

              {/* E */}
              <path d="M2.5 44 V18 H24 V22 H7 V28 H22 V32 H7 V40 H25 V44 H2.5 Z" fill="#FFFFFF" />

              {/* Y */}
              <path d="M28 18 L37 32 L46 18 H51 L39 37 V44 H35 V37 L23 18 H28 Z" fill="#FFFFFF" />
            </svg>
          </Box>

          {/* "-mozart" Text */}
          <Box
            sx={{
              opacity: isCollapsed ? 0 : 1,
              width: isCollapsed ? 0 : 'auto',
              transform: isCollapsed ? 'translateX(-10px)' : 'translateX(0)',
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'flex-end', // Align to bottom
              pb: '3px' // Match the logo's bottom padding for baseline alignment
            }}
          >
            <span style={{
              color: '#FFFFFF',
              fontSize: '1.2rem', // Slightly smaller for better proportion
              fontWeight: 700,
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              letterSpacing: '-0.5px',
              marginLeft: '1px'
            }}>
              -mozart
            </span>
          </Box>
        </Box>
        {!isMobile && (
          <IconButton
            onClick={toggleSidebar}
            sx={{
              color: 'rgba(255,255,255,0.4)',
              p: 0.5,
              '&:hover': { color: '#fff' },
              ...(isCollapsed ? {
                position: 'absolute',
                right: 4,
                bgcolor: 'rgba(255,255,255,0.05)'
              } : {
                ml: 'auto'
              })
            }}
          >
            {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>

      {/* Search Bar - Slimmer or Conditional */}
      {
        !isCollapsed && (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '10px',
              px: 1.2, py: 0.4,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              '&:focus-within': { borderColor: '#3b82f6', bgcolor: 'rgba(255, 255, 255, 0.06)' }
            }}>
              <SearchIcon sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '1rem' }} />
              <InputBase
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ ml: 0.8, color: '#fff', fontSize: '0.8rem', flex: 1 }}
              />
            </Box>
          </Box>
        )
      }

      {/* Menu scroll area - Set to overflow hidden to remove scrollbar */}
      <Box sx={{
        flex: 1,
        overflowY: "hidden",
        px: isCollapsed ? 1 : 1.5,
      }}>
        {Object.entries(filteredSections).map(([sectionName, items]) => (
          <Box key={sectionName}>
            {items.map((item) => {
              const isActive = currentPath === item.path;
              const isPiy = item.isPiy;

              return (
                <Tooltip key={item.label} title={isCollapsed ? item.label : ""} placement="right">
                  <ListItemButton
                    onClick={() => {
                      navigate(item.path);
                      if (isMobile && onClose) onClose();
                    }}
                    sx={{
                      mb: 0.3,
                      borderRadius: '10px',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      px: isCollapsed ? 0 : 1.5,
                      py: 0.8, // 🔥 COMPACT PADDING
                      minHeight: 40,
                      bgcolor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.55)',
                      border: isPiy ? '1px solid rgba(56, 189, 248, 0.2)' : 'none',
                      animation: isPiy ? "border-pulse 2s infinite" : "none",
                      position: 'relative',
                      '&:hover': {
                        bgcolor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        color: '#fff',
                        '& .MuiSvgIcon-root': { color: '#fff' }
                      },
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isActive && !isCollapsed && (
                      <Box sx={{
                        position: 'absolute', left: 0, top: '25%', bottom: '25%',
                        width: 3, bgcolor: '#3b82f6', borderRadius: '0 4px 4px 0'
                      }} />
                    )}

                    <Box sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: isCollapsed ? 0 : 32,
                      color: isActive ? '#60a5fa' : 'inherit',
                      mr: isCollapsed ? 0 : 1.5,
                      transition: 'margin 0.3s'
                    }}>
                      {item.icon}
                    </Box>

                    {!isCollapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: "0.85rem",
                          fontWeight: isActive ? 700 : 500,
                          sx: isPiy ? {
                            background: "linear-gradient(90deg, #e0f2fe, #38bdf8, #e0f2fe)",
                            backgroundSize: "200% auto",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            animation: "text-shimmer 3s linear infinite"
                          } : {}
                        }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Footer Branding */}
      {!isCollapsed && (
        <Box sx={{
          mt: 'auto',
          py: 4,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.02em',
              fontWeight: 400
            }}
          >
            powered by <span style={{ fontWeight: 600, color: 'rgba(242, 236, 236, 0.6)' }}>trailytics</span>
          </Typography>
        </Box>
      )}
    </Box >
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        sx={{
          "& .MuiDrawer-paper": {
            width: 280,
            bgcolor: "transparent",
            border: 'none'
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
        width: sidebarWidth,
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 1200,
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {navbarContent}
    </Box>
  );
};

export default Sidebar;
