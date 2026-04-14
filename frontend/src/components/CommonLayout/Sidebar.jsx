import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import eyLogo from "../../assets/sidebar_logo.png";
import marsLogo from "../../assets/mars2.svg";
import mamaearthLogo from "../../assets/mamaearth.jpeg";
import marsPetcareLogo from "../../assets/Mars_Petcare_Logo.jpg";
import boatLogo from "../../assets/Boat.png";
import zydusLogo from "../../assets/zyduslogo.png";
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
import { Sparkles } from "lucide-react";

const SidebarStatusBadge = ({ type }) => {
  const isLive = type === "LIVE";
  return (
    <span
      className={isLive ? "status-pulse-green" : "status-pulse-blue"}
      style={{
        fontSize: "7.5px",
        fontWeight: 800,
        background: isLive ? "#10b981" : "#2563eb",
        color: "#fff",
        borderRadius: "5px",
        padding: "2.5px 8px",
        marginLeft: "8px",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        fontFamily: "'Inter', sans-serif",
        boxShadow: isLive ? "0 2px 4px rgba(16, 185, 129, 0.3)" : "0 2px 4px rgba(37, 99, 235, 0.3)",
      }}>
      {type}
    </span>
  );
};



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
    if (user?.dbName === 'zydus') return zydusLogo;
    return marsLogo;
  }, [user?.dbName]);

  const activeLogoAlt = useMemo(() => {
    if (user?.dbName === 'mamaearth') return 'Mamaearth Logo';
    if (user?.dbName === 'mars_petcare') return 'Mars Petcare Logo';
    if (user?.dbName === 'boat') return 'Boat Logo';
    if (user?.dbName === 'zydus') return 'Zydus Logo';
    return 'Mars Logo';
  }, [user?.dbName]);
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [expandedSection, setExpandedSection] = useState("Q-COMM");

  const currentPath = location.pathname;

  const menuSections = {
    "MAIN MENU": [
      { label: "Business Overview", path: "/watch-tower", icon: <DashboardIcon sx={{ fontSize: '1.1rem' }} /> },
      { label: "India Overview", path: "/geo-intelligence", icon: <PublicIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Insights", path: "/insights", icon: <AssessmentIcon sx={{ fontSize: '1rem' }} />, showBeta: true },
      { label: "Availability Analysis", path: "/availability-analysis", icon: <ShoppingCartIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Visibility Analysis", path: "/visibility-anlysis", icon: <VisibilityIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Market Share", path: "/market-share", icon: <AutoGraphIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mars_petcare'] },
      //{ label: "Sales Data", path: "/sales", icon: <BarChartIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Pricing Analysis", path: "/pricing-analysis", icon: <PriceChangeIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mamaearth'] },
      { label: "Performance Marketing", path: "/performance-marketing", icon: <AdsClickIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mamaearth', 'boat'] },
      //{ label: "Portfolio Analysis", path: "/volume-cohort", icon: <AssessmentIcon sx={{ fontSize: '1rem' }} /> }, 
      { label: "Content Analysis", path: "/content-score", icon: <ArticleIcon sx={{ fontSize: '1rem' }} />, showOnlyForDb: ['mars'] },
      { label: "Inventory Analysis", path: "/inventory", icon: <InventoryIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mamaearth', 'boat'] },
      // { label: "Play it Yourself", path: "/piy", icon: <ScienceIcon sx={{ fontSize: '1rem' }} />, isPiy: true },
      // { label: "Category RCA", path: "/category-rca", icon: <AutoGraphIcon sx={{ fontSize: '1rem' }} />, isPiy: true },
      { label: "Scheduled Reports", path: "/scheduled-reports", icon: <ScheduleIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Ad Auto", path: "https://frontend-mamaearth.onrender.com", icon: <CampaignIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mars', 'boat', 'zydus', 'mars_petcare'] },
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
          .status-pulse-blue { animation: pulse-blue 2.5s infinite cubic-bezier(0.4, 0, 0.6, 1); }
          .status-pulse-green { animation: pulse-green 2.5s infinite cubic-bezier(0.4, 0, 0.6, 1); }
          @keyframes pulse-blue {
              0% {
                  box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.6);
                  transform: scale(1);
              }
              70% {
                  box-shadow: 0 0 0 8px rgba(37, 99, 235, 0);
                  transform: scale(1.05);
              }
              100% {
                  box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
                  transform: scale(1);
              }
          }
          @keyframes pulse-green {
              0% {
                  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6);
                  transform: scale(1);
              }
              70% {
                  box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
                  transform: scale(1.05);
              }
              100% {
                  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
                  transform: scale(1);
              }
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
            height: isCollapsed ? 50 : (user?.dbName === 'mars_petcare' ? 150 : (user?.dbName === 'mamaearth' ? 100 : (user?.dbName === 'zydus' ? 80 : 60))),
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
            {user?.dbName !== 'mars' && (
              <img
                src={activeLogo}
                alt={activeLogoAlt}
                style={{
                  maxHeight: isCollapsed ? '32px' : (user?.dbName === 'mamaearth' ? '100px' : (user?.dbName === 'mars_petcare' ? '150px' : (user?.dbName === 'zydus' ? '80px' : '45px'))),
                  width: isCollapsed ? '100%' : 'auto',
                  maxWidth: isCollapsed ? '42px' : (user?.dbName === 'mamaearth' ? '240px' : (user?.dbName === 'mars_petcare' ? '250px' : (user?.dbName === 'zydus' ? '220px' : '180px'))),
                  objectFit: 'contain',
                  padding: '0',
                  display: 'block',
                  borderRadius: user?.dbName === 'mamaearth' ? '8px' : '2px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            )}

            {user?.dbName === 'mars' && (
              <img
                src={marsLogo}
                alt="Mars Logo"
                style={{
                  maxHeight: isCollapsed ? '32px' : '45px',
                  width: isCollapsed ? '100%' : 'auto',
                  maxWidth: isCollapsed ? '42px' : '180px',
                  objectFit: 'contain',
                  padding: '0',
                  display: 'block',
                  borderRadius: '2px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            )}
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
            {items.filter((item) => {
              const dbName = user?.dbName;
              // If user's DB status is inactive, hide all items
              if (user?.dbStatus === false) return false;
              // If showOnlyForDb is provided, check if current db is in the list
              if (item.showOnlyForDb && !item.showOnlyForDb.includes(dbName)) return false;
              // If hideForDb is provided, check if current db is in the list
              if (item.hideForDb && item.hideForDb.includes(dbName)) return false;
              // Check per-user tab permissions (from admin panel)
              const tabPerms = user?.tabPermissions;
              if (tabPerms && Object.keys(tabPerms).length > 0) {
                // If this tab label has an explicit permission set, respect it
                if (tabPerms[item.label] !== undefined && tabPerms[item.label] === false) return false;
              }
              return true;
            }).map((item) => {
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
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {item.label}
                          {item.showBeta && !isCollapsed && <SidebarStatusBadge type="BETA" />}
                        </Box>
                      }
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
        py: 2,
        mt: 'auto',
        display: 'flex',
        flexDirection: isCollapsed ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        gap: isCollapsed ? 1.5 : 1,
        borderTop: "1px solid rgba(0, 0, 0, 0.04)",
        bgcolor: isCollapsed ? "transparent" : "rgba(248, 250, 252, 0.6)",
        backdropFilter: isCollapsed ? "none" : "blur(8px)",
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {!isCollapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  color: '#94a3b8',
                  fontWeight: 500,
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap'
                }}
              >
                Powered
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  color: '#94a3b8',
                  fontWeight: 500,
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap'
                }}
              >
                by
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap'
              }}
            >
              trailytics
            </Typography>
          </Box>
        )}

        <Button
          onClick={() => {
            logout();
            localStorage.clear();
            navigate('/login');
          }}
          sx={{
            minWidth: isCollapsed ? 36 : 'auto',
            height: isCollapsed ? 36 : 28,
            px: isCollapsed ? 0 : 1.2,
            color: "#ef4444",
            bgcolor: "transparent",
            border: "1px solid rgba(239, 68, 68, 0.45)",
            textTransform: "none",
            fontSize: "0.8rem",
            fontWeight: 700,
            borderRadius: "8px",
            display: 'flex',
            alignItems: 'center',
            gap: 0.6,
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              bgcolor: "#ef4444 !important",
              color: "#FFFFFF !important",
              border: "1px solid #ef4444",
              transform: "translateY(-1px)",
              "& .MuiSvgIcon-root": {
                color: "#FFFFFF",
              },
              "& .MuiTypography-root": {
                color: "#FFFFFF",
              }
            },
          }}
        >
          <LogoutIcon sx={{ fontSize: "1.05rem", transition: 'color 0.2s' }} />
          {!isCollapsed && (
            <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 800, transition: 'color 0.2s' }}>
              SignOut
            </Typography>
          )}
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
