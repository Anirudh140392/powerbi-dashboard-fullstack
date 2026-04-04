import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import eyLogo from "../../assets/sidebar_logo.png";
import marsLogo from "../../assets/mars2.svg";
import mamaearthLogo from "../../assets/mamaearth.jpeg";
import marsPetcareLogo from "../../assets/Mars_Petcare_Logo.jpg";
import boatLogo from "../../assets/Boat.png";
import { useAuth } from "../../utils/AuthContext";
import {
  Box,
  Typography,
  Divider,
  Drawer,
  useMediaQuery,
  useTheme,
  List,
  Button,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
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
  Public as PublicIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  MenuOpen as MenuOpenIcon,
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
  const { logout, user } = useAuth();

  // Dynamic logo based on user's database
  const activeLogo = useMemo(() => {
    if (user?.dbName === 'mamaearth') return mamaearthLogo;
    if (user?.dbName === 'mars_petcare') return marsPetcareLogo;
    if (user?.dbName === 'boat') return boatLogo;
    return marsLogo;
  }, [user?.dbName]);

  const activeLogoAlt = useMemo(() => {
    if (user?.dbName === 'mamaearth') return 'Mamaearth Logo';
    if (user?.dbName === 'mars_petcare') return 'Mars Petcare Logo';
    if (user?.dbName === 'boat') return 'Boat Logo';
    return 'Mars Logo';
  }, [user?.dbName]);
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [expandedSection, setExpandedSection] = useState("Q-COMM");

  const currentPath = location.pathname;

  const menuSections = {
    "MAIN MENU": [
      { label: "Business Overview", path: "/watch-tower", icon: <DashboardIcon sx={{ fontSize: '1.1rem' }} /> },
      { label: "India Overview", path: "/geo-intelligence", icon: <PublicIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Insights", path: "/insights", icon: <AssessmentIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Availability Analysis", path: "/availability-analysis", icon: <ShoppingCartIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Visibility Analysis", path: "/visibility-anlysis", icon: <VisibilityIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Market Share", path: "/market-share", icon: <AutoGraphIcon sx={{ fontSize: '1rem' }} /> },
      // { label: "Sales Data", path: "/sales", icon: <BarChartIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Pricing Analysis", path: "/pricing-analysis", icon: <PriceChangeIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mamaearth'] },
      { label: "Performance Marketing", path: "/performance-marketing", icon: <AdsClickIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mamaearth'] },
      // { label: "Portfolio Analysis", path: "/volume-cohort", icon: <AssessmentIcon sx={{ fontSize: '1rem' }} /> },
      // { label: "Content Analysis", path: "/content-score", icon: <ArticleIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Inventory Analysis", path: "/inventory", icon: <InventoryIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mamaearth'] },
      // { label: "Play it Yourself", path: "/piy", icon: <ScienceIcon sx={{ fontSize: '1rem' }} />, isPiy: true },
      // { label: "Category RCA", path: "/category-rca", icon: <AutoGraphIcon sx={{ fontSize: '1rem' }} />, isPiy: true },
      { label: "Scheduled Reports", path: "/scheduled-reports", icon: <ScheduleIcon sx={{ fontSize: '1rem' }} /> },
      //{ label: "Ad Auto", path: "https://demo.adauto.in/", icon: <CampaignIcon sx={{ fontSize: '1rem' }} /> },
      //{ label: "Rating", path: "https://prestige-lac.vercel.app/", icon: <StarBorderIcon sx={{ fontSize: '1rem' }} /> },
      //{ label: "Supply", path: "https://sku360.up.railway.app", icon: <LocalShippingIcon sx={{ fontSize: '1rem' }} /> },
      //{ label: "Content", path: "https://content-pied-psi.vercel.app/", icon: <DescriptionIcon sx={{ fontSize: '1rem' }} /> },
    ],
  };



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
        position: 'relative', // Ensure nested absolute elements are relative to this root
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
          .sidebar-item-active::before {
            content: "";
            position: absolute;
            left: 0;
            top: 15%;
            height: 70%;
            width: 4px;
            background: #2563eb;
            border-radius: 0 4px 4px 0;
            transition: all 0.3s ease;
          }
        `}
      </style>

      {/* Header / Logo */}
      <Box sx={{
        px: isCollapsed ? 1 : 2.5,
        py: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: "1px solid rgba(0, 0, 0, 0.04)",
        position: 'relative',
        overflow: 'visible' // CRITICAL: Allow the toggle button to float outside
      }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            width: '100%',
            height: isCollapsed ? 50 : (user?.dbName === 'mars_petcare' ? 120 : (user?.dbName === 'mamaearth' ? 80 : 60)),
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: isCollapsed ? '100%' : 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.05))'
            }}
          >
            <img
              src={activeLogo}
              alt={activeLogoAlt}
              style={{
                maxHeight: isCollapsed ? '32px' : (user?.dbName === 'mamaearth' ? '80px' : (user?.dbName === 'mars_petcare' ? '120px' : '45px')),
                width: isCollapsed ? '100%' : 'auto',
                maxWidth: isCollapsed ? '42px' : (user?.dbName === 'mamaearth' ? '220px' : (user?.dbName === 'mars_petcare' ? '230px' : '180px')),
                objectFit: 'contain',
                padding: '0',
                display: 'block',
                borderRadius: user?.dbName === 'mamaearth' ? '8px' : '2px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </Box>
        </Box>

        {!isMobile && (
          <IconButton
            onClick={toggleSidebar}
            sx={{
              color: 'rgba(30, 41, 59, 0.45)', // Slightly darker for better visibility on white
              p: 0.5,
              '&:hover': { 
                color: '#2563eb',
                bgcolor: '#FFFFFF',
                boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.12)',
              },
              position: 'absolute',
              right: -12, // Precisely overlap the border
              top: '50%', // Centered within the header (aligned with logo)
              transform: 'translateY(-50%)',
              bgcolor: '#FFFFFF',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              zIndex: 10,
              width: 28, // Slightly larger
              height: 28,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '& .MuiSvgIcon-root': {
                fontSize: '1rem' // Slightly larger icon
              }
            }}
          >
            {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        )}
      </Box>

      {/* Search Bar */}


      {/* Menu scroll area */}
      <Box sx={{
        flex: 1,
        overflowY: "auto", // Re-enable scroll if needed, or keep hidden if requested
        px: isCollapsed ? 1 : 1.5,
        '&::-webkit-scrollbar': { width: '4px' },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.05)', borderRadius: '4px' }
      }}>
        {Object.entries(menuSections).map(([sectionName, items]) => (
          <Box key={sectionName} sx={{ mb: 2 }}>
            {!isCollapsed && (
              <Typography
                variant="overline"
                sx={{
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  color: "rgba(30, 41, 59, 0.4)",
                  letterSpacing: "0.08em",
                  mb: 1.5,
                  mt: 1,
                  pl: isCollapsed ? 0 : 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  opacity: isCollapsed ? 0 : 1,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&::after': {
                    content: '""',
                    flex: isCollapsed ? 0 : 1,
                    height: '1px',
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    ml: isCollapsed ? 0 : 1.5,
                    mr: isCollapsed ? 0 : 1,
                    transition: 'all 0.3s'
                  }
                }}
              >
                {sectionName}
              </Typography>
            )}
            {items.filter((item) => !item.hideForDb || !item.hideForDb.includes(user?.dbName)).map((item) => {
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
                    className={isActive && !isCollapsed ? "sidebar-item-active" : ""}
                    sx={{
                      minWidth: isCollapsed ? 48 : 44,
                      maxWidth: isCollapsed ? 48 : "100%",
                      justifyContent: isCollapsed ? "center" : "flex-start",
                      px: isCollapsed ? 1 : 2,
                      py: 1.2,
                      borderRadius: "12px",
                      mb: 0.8,
                      mx: isCollapsed ? 'auto' : 0,
                      bgcolor: isActive ? "rgba(37, 99, 235, 0.08)" : "transparent",
                      color: isActive ? "#2563eb" : "#64748b",
                      position: 'relative',
                      overflow: 'hidden',
                      "&:hover": {
                        bgcolor: isActive ? "rgba(37, 99, 235, 0.12)" : "rgba(30, 41, 59, 0.04)",
                        color: isActive ? "#1d4ed8" : "#1e293b",
                        "& .MuiListItemIcon-root": { color: isActive ? "#2563eb" : "#1e293b" },
                        transform: isCollapsed ? 'scale(1.05)' : 'translateX(2px)',
                      },
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      ...(isPiy && {
                        border: "1px solid rgba(37, 99, 235, 0.15)",
                        animation: "border-pulse 2.5s infinite"
                      })
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: isCollapsed ? 0 : 1.5,
                        color: isActive ? "#2563eb" : "inherit",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: isCollapsed ? '100%' : 'auto',
                        '& .MuiSvgIcon-root': {
                          fontSize: isActive ? '1.25rem' : '1.15rem',
                        }
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>

                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: "0.88rem",
                        fontWeight: isActive ? 700 : 500,
                        sx: {
                          opacity: isCollapsed ? 0 : 1,
                          transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: isCollapsed ? 'translateX(-10px)' : 'translateX(0)',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          ...(isPiy && {
                            background: "linear-gradient(90deg, #1e293b, #2563eb, #1e293b)",
                            backgroundSize: "200% auto",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            animation: "text-shimmer 3s linear infinite",
                            letterSpacing: '0.01em'
                          }),
                          ...(!isPiy && {
                            color: isActive ? "#2563eb" : "inherit",
                            letterSpacing: '0.01em'
                          })
                        }
                      }}
                      sx={{
                        m: 0,
                        width: isCollapsed ? 0 : 'auto', // Important for centering
                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflow: 'hidden'
                      }}
                    />
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Footer / Powered By */}
      <Box sx={{
        px: isCollapsed ? 1 : 2,
        py: 2.5,
        mt: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        borderTop: "1px solid rgba(0, 0, 0, 0.04)",
        bgcolor: isCollapsed ? "transparent" : "rgba(248, 250, 252, 0.6)",
        backdropFilter: isCollapsed ? "none" : "blur(8px)",
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          px: 0.5,
          opacity: isCollapsed ? 0 : 1,
          maxHeight: isCollapsed ? 0 : 40,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Typography
              sx={{
                fontSize: '0.62rem',
                color: 'rgba(100, 116, 139, 0.6)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap'
              }}
            >
              Powered by
            </Typography>
            <Typography
              sx={{
                fontSize: '0.74rem',
                fontWeight: 800,
                color: 'rgba(30, 41, 59, 0.8)',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap'
              }}
            >
              Trailytics
            </Typography>
          </Box>
        </Box>

        <Button
          fullWidth={!isCollapsed}
          variant="contained"
          onClick={() => {
            logout();
            localStorage.clear();
            navigate('/login');
          }}
          startIcon={<LogoutIcon sx={{ 
            fontSize: "1.1rem !important",
            mr: isCollapsed ? 0 : 1,
            transition: 'margin 0.3s'
          }} />}
          sx={{
            minWidth: isCollapsed ? 44 : 0,
            maxWidth: isCollapsed ? 44 : "100%",
            height: isCollapsed ? 44 : 40,
            color: "#FFFFFF",
            bgcolor: "#ef4444",
            textTransform: "none",
            fontSize: "0.8rem",
            fontWeight: 700,
            borderRadius: "10px",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            mx: isCollapsed ? 'auto' : 0,
            "&:hover": {
              bgcolor: "#dc2626",
              transform: isCollapsed ? "scale(1.05)" : "translateY(-1px)",
              boxShadow: "0 6px 16px rgba(239, 68, 68, 0.3)",
            },
            ...(isCollapsed ? {
              px: 0,
              '& .MuiButton-startIcon': { 
                margin: 0,
                display: 'flex',
                justifyContent: 'center',
                width: '100%'
              },
            } : {
              px: 2
            })
          }}
        >
          <Box sx={{ 
            width: isCollapsed ? 0 : 'auto', 
            opacity: isCollapsed ? 0 : 1, 
            transition: 'all 0.3s',
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}>
            Sign Out
          </Box>
        </Button>
      </Box>
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
