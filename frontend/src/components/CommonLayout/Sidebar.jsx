import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import trailLogo from "../../assets/trailytics.png";
import marsLogo from "../../assets/mars2.svg";
import mamaearthLogo from "../../assets/mamaearth.jpeg";
import marsPetcareLogo from "../../assets/Mars_Petcare_Logo.jpg";
import boatLogo from "../../assets/Boat.png";
import zydusLogo from "../../assets/zyduslogo.png";
import demoLogo from "../../assets/Demo.png";
import sugarLogo from "../../assets/sugar.png";
import pidiliteLogo from "../../assets/pidilite.png";
import marsDmartLogo from "../../assets/mars2.svg";
import cheffinLogo from "../../assets/cheffin.png";
import fastrackLogo from "../../assets/Fastrack.png";
import titanSkinLogo from "../../assets/titanskin.png";
import drlLogo from "../../assets/drl.png";
import emamiLogo from "../../assets/emami.jpg";
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
  Popover,
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
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowLeft as KeyboardArrowLeftIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  CloudDownload as CloudDownloadIcon,
} from "@mui/icons-material";

const getPlatformColors = (platformName) => {
  const name = String(platformName || '').toLowerCase();
  if (name.includes('blinkit')) return { cardBg: '#facc15', text: '#ffffff', subtext: 'rgba(255,255,255,0.9)', squircle: '#fef08a', squircleText: '#1e293b', border: '#eab308' };
  if (name.includes('instamart') || name.includes('swiggy')) return { cardBg: '#fb923c', text: '#ffffff', subtext: 'rgba(255,255,255,0.9)', squircle: '#fed7aa', squircleText: '#7c2d12', border: '#f97316' };
  if (name.includes('zepto')) return { cardBg: '#c084fc', text: '#ffffff', subtext: 'rgba(255,255,255,0.9)', squircle: '#e9d5ff', squircleText: '#4c1d95', border: '#a855f7' };
  if (name.includes('bigbasket') || name.includes('bb')) return { cardBg: '#4ade80', text: '#ffffff', subtext: 'rgba(255,255,255,0.9)', squircle: '#bbf7d0', squircleText: '#14532d', border: '#22c55e' };
  if (name.includes('amazon')) return { cardBg: '#60a5fa', text: '#ffffff', subtext: 'rgba(255,255,255,0.9)', squircle: '#bfdbfe', squircleText: '#1e3a8a', border: '#3b82f6' };
  if (name.includes('flipkart')) return { cardBg: '#38bdf8', text: '#ffffff', subtext: 'rgba(255,255,255,0.9)', squircle: '#bae6fd', squircleText: '#0c4a6e', border: '#0ea5e9' };
  return { cardBg: '#94a3b8', text: '#ffffff', subtext: 'rgba(255,255,255,0.9)', squircle: '#e2e8f0', squircleText: '#334155', border: '#64748b' };
};

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
  channels = ["All"],
  selectedChannel,
  onChannelChange,
  platforms = ["Blinkit", "Instamart", "Zepto", "Flipkart", "Amazon"],
  platformMetadata = [],
  selectedPlatform,
  onPlatformChange,
  open = false,
  onClose,
  isCollapsed,
  setIsCollapsed,
}) => {
  // Normalize selectedPlatform to always be a string — FilterContext or Matrix
  // filters can occasionally pass an object or array during dynamic updates
  selectedPlatform = typeof selectedPlatform === 'string'
    ? selectedPlatform
    : Array.isArray(selectedPlatform)
      ? (selectedPlatform[0] || 'All')
      : String(selectedPlatform || 'All');

  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  // Dynamic logo based on user's database
  const activeLogo = useMemo(() => {
    if (user?.dbName === 'mamaearth') return mamaearthLogo;
    if (user?.dbName === 'mars_petcare') return marsPetcareLogo;
    if (user?.dbName === 'mars_dmart') return marsDmartLogo;
    if (user?.dbName === 'boat') return boatLogo;
    if (user?.dbName === 'zydus' || user?.dbName === 'hm_zydus') return zydusLogo;
    if (user?.dbName === 'demo') return demoLogo;
    if (user?.dbName === 'sugar') return sugarLogo;
    if (user?.dbName === 'pidilite') return pidiliteLogo;
    if (user?.dbName === 'trailytics') return trailLogo;
    if (user?.dbName === 'cheffin') return cheffinLogo;
    if (user?.dbName === 'hm_titan_bags') return fastrackLogo;
    if (user?.dbName === 'hm_titan_skinn') return titanSkinLogo;
    if (user?.dbName === 'drl') return drlLogo;
    if (user?.dbName === 'emami') return emamiLogo;
    return marsLogo;
  }, [user?.dbName]);

  const activeLogoAlt = useMemo(() => {
    if (user?.dbName === 'mamaearth') return 'Mamaearth Logo';
    if (user?.dbName === 'mars_petcare') return 'Mars Petcare Logo';
    if (user?.dbName === 'mars_dmart') return 'Mars Dmart Logo';
    if (user?.dbName === 'boat') return 'Boat Logo';
    if (user?.dbName === 'zydus' || user?.dbName === 'hm_zydus') return 'Zydus Logo';
    if (user?.dbName === 'demo') return 'Demo Logo';
    if (user?.dbName === 'sugar') return 'Sugar Logo';
    if (user?.dbName === 'pidilite') return 'Pidilite Logo';
    if (user?.dbName === 'trailytics') return 'Trailytics Logo';
    if (user?.dbName === 'cheffin') return 'Cheffin Logo';
    if (user?.dbName === 'hm_titan_bags') return 'Fastrack Logo';
    if (user?.dbName === 'hm_titan_skinn') return 'Titan Skinn Logo';
    if (user?.dbName === 'drl') return 'DRL Logo';
    if (user?.dbName === 'emami') return 'Emami Logo';
    return 'Mars Logo';
  }, [user?.dbName]);
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [expandedSection, setExpandedSection] = useState("Q-COMM");
  const [channelAnchorEl, setChannelAnchorEl] = useState(null);
  const [platformAnchorEl, setPlatformAnchorEl] = useState(null);
  const [showPlatformOptions, setShowPlatformOptions] = useState(true); // Default to showing the carousel for visibility
  const platformScrollRef = useRef(null);

  const handleChannelHover = (event) => {
    setChannelAnchorEl(event.currentTarget);
  };

  const handleChannelClose = () => {
    setChannelAnchorEl(null);
  };

  const handlePlatformHover = (event) => {
    setPlatformAnchorEl(event.currentTarget);
  };

  const handlePlatformClose = () => {
    setPlatformAnchorEl(null);
  };

  const openChannelPopover = Boolean(channelAnchorEl);
  const openPlatformPopover = Boolean(platformAnchorEl);

  const currentPath = location.pathname;

  const menuSections = {
    "MAIN MENU": [
      { label: "India Overview", path: "/geo-intelligence", icon: <PublicIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Insights", path: "/insights", icon: <AssessmentIcon sx={{ fontSize: '1rem' }} />, showLive: true },
      { label: "Availability Analysis", path: "/availability-analysis", icon: <ShoppingCartIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Market Coverage", path: "/on-shelf-availability", icon: <InventoryIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Visibility Analysis", path: "/visibility-anlysis", icon: <VisibilityIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Market Share", path: "/market-share", icon: <AutoGraphIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mars_petcare', 'sugar'] },
      //{ label: "Sales Data", path: "/sales", icon: <BarChartIcon sx={{ fontSize: '1rem' }} /> },
      { label: "Pricing Analysis", path: "/pricing-analysis", icon: <PriceChangeIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mamaearth'] },
      { label: "Performance Marketing", path: "/performance-marketing", icon: <AdsClickIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mamaearth', 'boat'] },
      //{ label: "Portfolio Analysis", path: "/volume-cohort", icon: <AssessmentIcon sx={{ fontSize: '1rem' }} /> }, 
      { label: "Content Analysis", path: "/content-score", icon: <ArticleIcon sx={{ fontSize: '1rem' }} />, showOnlyForDb: ['mars'] },
      { label: "Inventory Analysis", path: "/inventory", icon: <InventoryIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mamaearth', 'boat'] },
      // { label: "Play it Yourself", path: "/piy", icon: <ScienceIcon sx={{ fontSize: '1rem' }} />, isPiy: true },
      // { label: "Category RCA", path: "/category-rca", icon: <AutoGraphIcon sx={{ fontSize: '1rem' }} />, isPiy: true },
      { label: "Ad Auto", path: "https://frontend-mamaearth.onrender.com", icon: <CampaignIcon sx={{ fontSize: '1rem' }} />, hideForDb: ['mars', 'boat', 'zydus', 'hm_zydus', 'mars_petcare'] },
      { label: "Download Report", path: "/download-report", icon: <CloudDownloadIcon sx={{ fontSize: '1rem' }} /> },
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
            height: isCollapsed ? 50 : (user?.dbName === 'mars_petcare' ? 150 : (user?.dbName === 'hm_titan_skinn' ? 120 : (user?.dbName === 'mamaearth' ? 100 : ((user?.dbName === 'zydus' || user?.dbName === 'hm_zydus' || user?.dbName === 'hm_titan_bags' || user?.dbName === 'emami') ? 80 : (user?.dbName === 'sugar' ? 80 : (user?.dbName === 'pidilite' ? 80 : (user?.dbName === 'cheffin' ? 80 : (user?.dbName === 'drl' ? 80 : 60)))))))),
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
                  maxHeight: isCollapsed ? '32px' : (user?.dbName === 'mars_petcare' ? '150px' : (user?.dbName === 'hm_titan_skinn' ? '120px' : (user?.dbName === 'mamaearth' ? '100px' : ((user?.dbName === 'zydus' || user?.dbName === 'hm_zydus' || user?.dbName === 'hm_titan_bags' || user?.dbName === 'emami') ? '80px' : (user?.dbName === 'sugar' ? '80px' : (user?.dbName === 'pidilite' ? '80px' : (user?.dbName === 'cheffin' ? '80px' : (user?.dbName === 'drl' ? '80px' : '45px')))))))),
                  width: isCollapsed ? '100%' : 'auto',
                  maxWidth: isCollapsed ? '42px' : (user?.dbName === 'mars_petcare' ? '250px' : (user?.dbName === 'hm_titan_skinn' ? '240px' : (user?.dbName === 'mamaearth' ? '240px' : ((user?.dbName === 'zydus' || user?.dbName === 'hm_zydus' || user?.dbName === 'hm_titan_bags' || user?.dbName === 'emami') ? '220px' : (user?.dbName === 'sugar' ? '220px' : (user?.dbName === 'pidilite' ? '220px' : (user?.dbName === 'cheffin' ? '220px' : (user?.dbName === 'drl' ? '220px' : '180px')))))))),
                  objectFit: 'contain',
                  padding: '0',
                  display: 'block',
                  borderRadius: (user?.dbName === 'mamaearth' || user?.dbName === 'emami') ? '8px' : '2px',
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

      {/* Channel Selector - Pill Segmented Control */}
      <Box sx={{
        px: isCollapsed ? 1 : 1.5,
        pt: 2,
        pb: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        {/* MAIN MENU Header (Top) */}
        {!isCollapsed && (user?.tabPermissions?.['Business Overview'] !== false || user?.tabPermissions?.['Scheduled Reports'] !== false || Object.values(user?.tabPermissions || {}).some(v => v === true)) && (
          <Typography
            variant="overline"
            sx={{
              fontSize: "12px",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 800,
              color: "rgba(30, 41, 59, 0.4)",
              letterSpacing: "0.08em",
              mb: 1,
              mt: 1,
              px: 2,
              display: 'flex',
              alignItems: 'center',
              '&::after': {
                content: '""',
                flex: 1,
                height: '1px',
                bgcolor: 'rgba(0, 0, 0, 0.04)',
                ml: 1.5,
              }
            }}
          >
            MAIN MENU
          </Typography>
        )}

        {/* Top Priority Actions */}
        {!isCollapsed && (
          <>
            <Box sx={{ px: 0, pb: 1, width: '100%' }}>
              {user?.tabPermissions?.['Business Overview'] !== false && (
                <ListItemButton
                  onClick={() => navigate('/watch-tower')}
                  className={currentPath === '/watch-tower' ? "sidebar-item-active" : ""}
                  sx={{
                    minWidth: 44,
                    maxWidth: "100%",
                    justifyContent: "flex-start",
                    px: 2,
                    py: 1,
                    borderRadius: "12px",
                    bgcolor: currentPath === '/watch-tower' ? "rgba(37, 99, 235, 0.08)" : "transparent",
                    color: currentPath === '/watch-tower' ? "#2563eb" : "#64748b",
                    position: 'relative',
                    overflow: 'hidden',
                    mb: 0.5,
                    "&:hover": {
                      bgcolor: currentPath === '/watch-tower' ? "rgba(37, 99, 235, 0.12)" : "rgba(30, 41, 59, 0.04)",
                      color: currentPath === '/watch-tower' ? "#1d4ed8" : "#1e293b",
                      transform: 'translateX(2px)',
                    },
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: 1.5,
                      color: currentPath === '/watch-tower' ? "#2563eb" : "inherit",
                      display: 'flex',
                      '& .MuiSvgIcon-root': {
                        fontSize: '1.15rem',
                      }
                    }}
                  >
                    <DashboardIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={"Business Overview"}
                    primaryTypographyProps={{
                      fontSize: "13px",
                      fontWeight: currentPath === '/watch-tower' ? 700 : 500,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    sx={{ my: 0 }}
                  />
                </ListItemButton>
              )}

              {user?.tabPermissions?.['Scheduled Reports'] !== false && (
                <ListItemButton
                  onClick={() => navigate('/scheduled-reports')}
                  className={currentPath === '/scheduled-reports' ? "sidebar-item-active" : ""}
                  sx={{
                    minWidth: 44,
                    maxWidth: "100%",
                    justifyContent: "flex-start",
                    px: 2,
                    py: 1,
                    borderRadius: "12px",
                    bgcolor: currentPath === '/scheduled-reports' ? "rgba(37, 99, 235, 0.08)" : "transparent",
                    color: currentPath === '/scheduled-reports' ? "#2563eb" : "#64748b",
                    position: 'relative',
                    overflow: 'hidden',
                    "&:hover": {
                      bgcolor: currentPath === '/scheduled-reports' ? "rgba(37, 99, 235, 0.12)" : "rgba(30, 41, 59, 0.04)",
                      color: currentPath === '/scheduled-reports' ? "#1d4ed8" : "#1e293b",
                      transform: 'translateX(2px)',
                    },
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: 1.5,
                      color: currentPath === '/scheduled-reports' ? "#2563eb" : "inherit",
                      display: 'flex',
                      '& .MuiSvgIcon-root': {
                        fontSize: '1.15rem',
                      }
                    }}
                  >
                    <ScheduleIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={"Scheduled Reports"}
                    primaryTypographyProps={{
                      fontSize: "13px",
                      fontWeight: currentPath === '/scheduled-reports' ? 700 : 500,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    sx={{ my: 0 }}
                  />
                </ListItemButton>
              )}
            </Box>
            {(user?.tabPermissions?.['Business Overview'] !== false || user?.tabPermissions?.['Scheduled Reports'] !== false) && (
              <Divider sx={{ mx: 2, mb: 1.5, borderColor: 'rgba(0,0,0,0.06)' }} />
            )}
          </>
        )}

        {user?.dbName !== 'emami' && (<Box sx={{
          display: 'flex',
          flexDirection: isCollapsed ? 'column' : 'row',
          gap: isCollapsed ? 1 : 3,
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          px: isCollapsed ? 0 : 2.5,
          pt: 1,
          pb: 0,
          width: '100%',
          borderBottom: isCollapsed ? 'none' : '1px solid rgba(0, 0, 0, 0.08)',
        }}>
          {channels.filter(ch => ch !== 'All').sort((a, b) => {
            const getOrder = (ch) => {
              const lower = ch.toLowerCase();
              if (lower === 'quickcomm' || lower === 'quick commerce') return 1;
              if (lower === 'ecommerce' || lower === 'ecom') return 2;
              return 3;
            };
            return getOrder(a) - getOrder(b);
          }).map((ch) => {
            const isSelected = selectedChannel === ch;
            let displayLabel = ch;
            if (ch.toLowerCase() === 'quickcomm' || ch.toLowerCase() === 'quick commerce') displayLabel = 'QComm';
            else if (ch.toLowerCase() === 'ecommerce' || ch.toLowerCase() === 'ecom') displayLabel = 'EComm';

            if (isCollapsed) {
              return (
                <Tooltip key={ch} title={displayLabel} placement="right">
                  <Box
                    onClick={() => onChannelChange?.(ch)}
                    sx={{
                      cursor: 'pointer',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      bgcolor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      color: isSelected ? '#2563eb' : '#64748b',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Typography sx={{ fontSize: '12px', fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}>
                      {displayLabel.charAt(0)}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            }

            return (
              <Box
                key={ch}
                onClick={() => onChannelChange?.(ch)}
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                  pb: 1,
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    bgcolor: isSelected ? '#2563eb' : 'transparent',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }
                }}
              >
                <Typography sx={{
                  fontSize: '13px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#1e293b' : '#64748b',
                  transition: 'all 0.2s',
                  '&:hover': {
                    color: '#1e293b'
                  }
                }}>
                  {displayLabel}
                </Typography>
              </Box>
            );
          })}
        </Box>
        )}
      </Box>

      {/* Platform Section: Active Card & Carousel */}
      {user?.dbName !== 'emami' && selectedChannel && selectedChannel !== 'All' && platforms.length > 0 && !isCollapsed && (
        <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {/* Active Platform Card */}
          {selectedPlatform && (
            <Box
              onClick={() => currentPath !== '/watch-tower' && setShowPlatformOptions(!showPlatformOptions)}
              sx={{
                bgcolor: '#ffffff',
                border: '1px solid rgba(0,0,0,0.05)',
                borderRadius: '12px',
                py: 0.75,
                px: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: currentPath === '/watch-tower' ? 'default' : 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 2px 4px -1px rgba(0,0,0,0.05)',
                '&:hover': {
                  transform: currentPath === '/watch-tower' ? 'none' : 'translateY(-1px)',
                  boxShadow: currentPath === '/watch-tower' ? '0 2px 4px -1px rgba(0,0,0,0.05)' : '0 4px 6px -1px rgba(0,0,0,0.08)',
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Squircle Icon */}
                <Box sx={{
                  width: 28,
                  height: 28,
                  bgcolor: '#ffffff',
                  borderRadius: '8px', // squircle shape
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: getPlatformColors(selectedPlatform).squircleText,
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  overflow: 'hidden',
                }}>
                  {(() => {
                    if (selectedPlatform === 'All') return <DashboardIcon sx={{ fontSize: '1.2rem' }} />;
                    const activeMeta = platformMetadata.find(meta => meta.pf_name === selectedPlatform);
                    return activeMeta?.platform_description ? (
                      <img
                        src={activeMeta.platform_description}
                        alt={selectedPlatform}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      selectedPlatform.substring(0, 2).toUpperCase()
                    );
                  })()}
                </Box>
                {/* Text Content */}
                <Box>
                  <Typography sx={{
                    color: '#1e293b',
                    fontWeight: 700,
                    fontSize: '12px',
                    fontFamily: "'DM Sans', sans-serif",
                    lineHeight: 1.1,
                    display: selectedPlatform === 'All' ? 'none' : 'block'
                  }}>
                    {selectedPlatform ? selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1) : ''}
                  </Typography>
                  <Typography sx={{
                    color: selectedPlatform === 'All' ? '#1e293b' : '#64748b',
                    fontSize: selectedPlatform === 'All' ? '12px' : '10px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: selectedPlatform === 'All' ? 600 : 500,
                    mt: selectedPlatform === 'All' ? 0 : 0.2
                  }}>
                    {currentPath === '/watch-tower' ? 'Tap to change platform' : (selectedPlatform === 'All' ? 'Select Platform' : 'Tap to change platform')}
                  </Typography>
                </Box>

              </Box>

              {/* Chevron */}
              {currentPath !== '/watch-tower' && (
                <Box sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b'
                }}>
                  {showPlatformOptions ? <KeyboardArrowUpIcon sx={{ fontSize: '1rem' }} /> : <KeyboardArrowDownIcon sx={{ fontSize: '1rem' }} />}
                </Box>
              )}
            </Box>
          )}

          {/* Platform Carousel */}
          <Collapse in={showPlatformOptions && currentPath !== '/watch-tower'}>
            <Box sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              mt: 0.5
            }}>
              {/* Scrollable Container */}
              <Box
                ref={platformScrollRef}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  overflowX: 'auto',
                  py: 1,
                  px: 1,
                  scrollBehavior: 'smooth',
                  '&::-webkit-scrollbar': { display: 'none' },
                  msOverflowStyle: 'none',
                  scrollbarWidth: 'none',
                  width: '100%',
                }}
              >
                {platforms.filter(p => p !== 'All').map(pName => {
                  const pf = platformMetadata.find(meta => meta.pf_name === pName);
                  if (!pf) return null;
                  const isSelected = selectedPlatform === pf.pf_name;
                  const colors = getPlatformColors(pf.pf_name);

                  return (
                    <Box
                      key={pf.pf_name}
                      onClick={() => {
                        onPlatformChange(pf.pf_name);
                        setShowPlatformOptions(false);
                      }}
                      sx={{
                        position: 'relative',
                        flexShrink: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 38,
                        height: 38,
                        borderRadius: '12px', // Squircle
                        border: isSelected ? `2px solid #2563eb` : `2px solid ${colors.border}`,
                        transition: 'all 0.2s',
                        p: 0, // No padding to ensure image touches border
                      }}
                    >
                      <Box sx={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '10px',
                        bgcolor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: colors.squircleText,
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        overflow: 'hidden',
                      }}>
                        {pf.platform_description ? (
                          <img
                            src={pf.platform_description}
                            alt={pf.pf_name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          pf.pf_name.substring(0, 2).toUpperCase()
                        )}
                      </Box>

                      {/* Checkmark Badge */}
                      {isSelected && (
                        <Box sx={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          bgcolor: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid #fff',
                          zIndex: 2,
                          boxShadow: '0 2px 4px rgba(37,99,235,0.3)',
                        }}>
                          <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 900 }}>✓</Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Collapse>
          <Divider sx={{ mt: 1, borderColor: "rgba(0,0,0,0.04)" }} />
        </Box>
      )}

      {/* Collapsed view for platform */}
      {user?.dbName !== 'emami' && selectedChannel && selectedChannel !== 'All' && platforms.length > 0 && isCollapsed && (
        <Box sx={{ py: 1.5, display: 'flex', justifyContent: 'center', borderBottom: "1px solid rgba(0, 0, 0, 0.04)" }}>
          {selectedPlatform && selectedPlatform !== 'All' && (
            <Tooltip title={selectedPlatform ? selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1) : ''} placement="right">
              <Box sx={{
                width: 32,
                height: 32,
                bgcolor: '#ffffff',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: getPlatformColors(selectedPlatform).squircleText,
                fontWeight: 800,
                fontSize: '0.8rem',
                border: '2px solid #2563eb',
                overflow: 'hidden',
              }}>
                {(() => {
                  const activeMeta = platformMetadata.find(meta => meta.pf_name === selectedPlatform);
                  return activeMeta?.platform_description ? (
                    <img
                      src={activeMeta.platform_description}
                      alt={selectedPlatform}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    selectedPlatform.substring(0, 2).toUpperCase()
                  );
                })()}
              </Box>
            </Tooltip>
          )}
        </Box>
      )}



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
                          {item.showLive && !isCollapsed && <SidebarStatusBadge type="LIVE" />}
                        </Box>
                      }
                      primaryTypographyProps={{
                        fontSize: "12px",
                        fontFamily: "'DM Sans', sans-serif",
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

        {/* ─── Supply Chain Collapsible Section ─── */}
        {!isCollapsed && user?.dbStatus !== false && (() => {
          const supplyChainSubpages = ['Priority Action'];
          const hasSupplyChainAccess = supplyChainSubpages.some(subpage => user?.tabPermissions?.[subpage] !== false);
          if (!hasSupplyChainAccess) return null;

          return (
            <Box sx={{ px: 0, mb: 2 }}>
              {/* Section Header */}
              <ListItemButton
                onClick={() => setExpandedSection(expandedSection === 'supply-chain' ? '' : 'supply-chain')}
                sx={{
                  px: 2,
                  py: 1.2,
                  borderRadius: "12px",
                  mb: 0.5,
                  color: "#64748b",
                  "&:hover": {
                    bgcolor: "rgba(30, 41, 59, 0.04)",
                    color: "#1e293b",
                  },
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 1.5,
                    color: "inherit",
                    display: 'flex',
                    '& .MuiSvgIcon-root': { fontSize: '1.15rem' }
                  }}
                >
                  <LocalShippingIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Supply Chain"
                  primaryTypographyProps={{
                    fontSize: "12px",
                    fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  sx={{ my: 0 }}
                />
                {expandedSection === 'supply-chain' ? (
                  <ExpandLessIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
                )}
              </ListItemButton>

              {/* Collapsible Children */}
              <Collapse in={expandedSection === 'supply-chain'} timeout="auto" unmountOnExit>
                <Box sx={{ pl: 2 }}>
                  {(() => {
                    const tabPerms = user?.tabPermissions;
                    if (tabPerms && tabPerms['Priority Action'] === false) return null;
                    const isActive = currentPath === '/priority-action';
                    return (
                      <ListItemButton
                        onClick={() => {
                          navigate('/priority-action');
                          if (isMobile && onClose) onClose();
                        }}
                        className={isActive ? "sidebar-item-active" : ""}
                        sx={{
                          minWidth: 44,
                          maxWidth: "100%",
                          justifyContent: "flex-start",
                          px: 2,
                          py: 1,
                          borderRadius: "12px",
                          mb: 0.5,
                          bgcolor: isActive ? "rgba(37, 99, 235, 0.08)" : "transparent",
                          color: isActive ? "#2563eb" : "#64748b",
                          position: 'relative',
                          overflow: 'hidden',
                          "&:hover": {
                            bgcolor: isActive ? "rgba(37, 99, 235, 0.12)" : "rgba(30, 41, 59, 0.04)",
                            color: isActive ? "#1d4ed8" : "#1e293b",
                            transform: 'translateX(2px)',
                          },
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 0,
                            mr: 1.5,
                            color: isActive ? "#2563eb" : "inherit",
                            display: 'flex',
                            '& .MuiSvgIcon-root': { fontSize: '1.15rem' }
                          }}
                        >
                          <StarBorderIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Priority Action"
                          primaryTypographyProps={{
                            fontSize: "12px",
                            fontWeight: isActive ? 700 : 500,
                            fontFamily: "'DM Sans', sans-serif",
                            color: isActive ? "#2563eb" : "inherit",
                            letterSpacing: '0.01em',
                          }}
                          sx={{ my: 0 }}
                        />
                      </ListItemButton>
                    );
                  })()}
                </Box>
              </Collapse>
            </Box>
          );
        })()}
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
