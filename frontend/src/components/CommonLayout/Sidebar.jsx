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
  ListItemIcon,
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
  StarBorder as StarBorderIcon,
  LocalShipping as LocalShippingIcon,
  Description as DescriptionIcon,
} from "@mui/icons-material";


const Sidebar = ({
  platforms = ["Blinkit", "Instamart", "Zepto", "Flipkart", "Amazon"],
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
      { label: "Rating", path: "https://prestige-lac.vercel.app/", icon: <StarBorderIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Supply", path: "https://sku360.up.railway.app", icon: <LocalShippingIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Content", path: "https://content-pied-psi.vercel.app/", icon: <DescriptionIcon sx={{ fontSize: '1rem' }} /> },
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
        bgcolor: "#FFFFFF",
        backdropFilter: "blur(12px)",
        color: "#1e293b",
        borderRight: "1px solid rgba(0, 0, 0, 0.08)",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        width: sidebarWidth,
        overflow: "hidden",
      }}
    >
      <style>
        {`
          @keyframes border-pulse {
            0% { border-color: rgba(37, 99, 235, 0.1); box-shadow: 0 0 5px rgba(37, 99, 235, 0.05); }
            50% { border-color: rgba(37, 99, 235, 0.3); box-shadow: 0 0 10px rgba(37, 99, 235, 0.1); }
            100% { border-color: rgba(37, 99, 235, 0.1); box-shadow: 0 0 5px rgba(37, 99, 235, 0.05); }
          }
          @keyframes text-shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}
      </style>

      {/* Header / Logo */}
      <Box sx={{
        px: isCollapsed ? 0 : 2,
        py: 2,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box
          sx={{
            height: 48,
            py: 2,
            display: 'flex',
            alignItems: 'baseline',
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
              height: 40,
              width: isCollapsed ? 40 : 140,
              minWidth: isCollapsed ? 0 : 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              pb: '0px',
              mr: 0,
              transition: 'all 0.3s ease'
            }}
          >
            <img
              src="/trailytics_new_logo.png"
              alt="Logo"
              style={{
                height: '100%',
                width: '100%',
                objectFit: 'contain'
              }}
            />
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
              alignItems: 'flex-end',
              pb: '3px'
            }}
          >
            {/* <span style={{
              color: '#000000',
              fontSize: '1.2rem',
              fontWeight: 700,
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
              letterSpacing: '-0.5px',
              marginLeft: '1px'
            }}>
              -mozart
            </span> */}
          </Box>
        </Box>
        {!isMobile && (
          <IconButton
            onClick={toggleSidebar}
            sx={{
              color: 'rgba(0, 0, 0, 0.4)',
              p: 0.5,
              '&:hover': { color: '#000' },
              ...(isCollapsed ? {
                position: 'absolute',
                right: 4,
                bgcolor: 'rgba(0, 0, 0, 0.03)'
              } : {
                ml: 'auto'
              })
            }}
          >
            {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>

      {/* Search Bar */}
      {
        !isCollapsed && (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'rgba(0, 0, 0, 0.03)',
              borderRadius: '10px',
              px: 1.2, py: 0.4,
              border: '1px solid rgba(0, 0, 0, 0.06)',
              '&:focus-within': { borderColor: '#2563eb', bgcolor: '#fff' }
            }}>
              <SearchIcon sx={{ color: 'rgba(0, 0, 0, 0.3)', fontSize: '1rem' }} />
              <InputBase
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ ml: 0.8, color: '#000', fontSize: '0.8rem', flex: 1 }}
              />
            </Box>
          </Box>
        )
      }

      {/* Menu scroll area */}
      <Box sx={{
        flex: 1,
        overflowY: "auto", // Re-enable scroll if needed, or keep hidden if requested
        px: isCollapsed ? 1 : 1.5,
        '&::-webkit-scrollbar': { width: '4px' },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.05)', borderRadius: '4px' }
      }}>
        {Object.entries(filteredSections).map(([sectionName, items]) => (
          <Box key={sectionName} sx={{ mb: 2 }}>
            {!isCollapsed && (
              <Typography
                variant="overline"
                sx={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: "rgba(0, 0, 0, 0.3)",
                  letterSpacing: "0.05em",
                  mb: 1,
                  pl: 1,
                  display: 'block'
                }}
              >
                {sectionName}
              </Typography>
            )}
            {items.map((item) => {
              const isActive = currentPath === item.path;
              const isPiy = item.isPiy;

              return (
                <Tooltip key={item.label} title={isCollapsed ? item.label : ""} placement="right">
                  <ListItemButton
                    onClick={() => {
                      if (item.path.startsWith('http')) {
                        window.open(item.path, '_blank');
                      } else {
                        navigate(item.path);
                        if (isMobile && onClose) onClose();
                      }
                    }}
                    sx={{
                      minWidth: isCollapsed ? 54 : 44,
                      justifyContent: isCollapsed ? "center" : "flex-start",
                      px: isCollapsed ? 0 : 1.5,
                      py: 1,
                      borderRadius: "10px",
                      mb: 0.5,
                      bgcolor: isActive ? "rgba(37, 99, 235, 0.06)" : "transparent",
                      color: isActive ? "#2563eb" : "#475569",
                      borderLeft: isActive && !isCollapsed ? "3px solid #2563eb" : "3px solid transparent",
                      "&:hover": {
                        bgcolor: "rgba(0, 0, 0, 0.03)",
                        color: "#1e293b",
                        "& .MuiListItemIcon-root": { color: "#1e293b" }
                      },
                      transition: "all 0.2s ease",
                      ...(isPiy && {
                        border: "1px solid rgba(37, 99, 235, 0.1)",
                        animation: "border-pulse 2s infinite"
                      })
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: isCollapsed ? 0 : 1.2,
                        color: isActive ? "#2563eb" : "inherit",
                        transition: "color 0.2s",
                        display: 'flex',
                        justifyContent: 'center'
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>

                    {!isCollapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: "0.85rem",
                          fontWeight: isActive ? 700 : 500,
                          sx: isPiy ? {
                            background: "linear-gradient(90deg, #1e293b, #2563eb, #1e293b)",
                            backgroundSize: "200% auto",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            animation: "text-shimmer 3s linear infinite"
                          } : {
                            color: isActive ? "#2563eb" : "inherit"
                          }
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
