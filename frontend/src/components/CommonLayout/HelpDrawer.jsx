import React, { useState } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  Divider,
  Collapse,
} from "@mui/material";
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Dashboard as DashboardIcon,
  Public as PublicIcon,
  ShoppingCart as ShoppingCartIcon,
  Visibility as VisibilityIcon,
  AutoGraph as AutoGraphIcon,
  PriceChange as PriceChangeIcon,
  AdsClick as AdsClickIcon,
  Article as ArticleIcon,
  Inventory as InventoryIcon,
  Schedule as ScheduleIcon,
  HelpOutline as HelpIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  TouchApp as UsageIcon,
  ErrorOutline as PitfallsIcon,
  Psychology as InterpretationIcon,
  EmojiObjects as ExampleIcon,
  Calculate as LogicIcon,
} from "@mui/icons-material";

import { useHelp } from "../../utils/HelpContext";

const HelpDrawer = ({ userDbName }) => {
  const { helpDrawerOpen, closeHelp } = useHelp();
  const [activeTab, setActiveTab] = useState(0);
  const [activeMenu, setActiveMenu] = useState("Business Overview");
  const [expandedKpi, setExpandedKpi] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const businessOverviewGlossary = [
    {
      kpi: "Assortment",
      definition: "Numbers of Unique Products for a given Category/Brand which are currently listed on the selected marketplace platform.",
      usage: "Use to expand offtake by offering a diverse product range that appeals to more customers",
      interpretation: "Larger assortment may attract more customers; too many options can overwhelm.",
      pitfalls: "More products don’t guarantee sales; prioritize quality.",
      example: "If a brand offers 50 shoe models and all were available in the last 14 days then the assortment count for the brand is 50.",
      logic: "Count of unique products listed on the platform. An SKU is considered listed if it is available at least once in the last 14 days.",
    },
    {
      kpi: "Estimated Category Size",
      definition: "This metric estimates the overall size of categories.",
      usage: "Use to identify market opportunities, guiding strategies to increase offtake and market share.",
      interpretation: "Larger categories offer more potential but may have more competition.",
      pitfalls: "Inaccurate coverage assumptions (store/assortment/availability) can significantly distort estimates; also ignores regional/store-type demand variation.",
      example: "If a platform total sale is $15 million for chocolate category, it becomes it category size.",
      logic: "Total estimated sales of a category at a platform.",
    },
    {
      kpi: "Overall SOS (Share of Search)",
      definition: "Overall Share of Search measures % of shelf brand has occupied within search results (e.g., top N positions) for a given keyword/category.",
      usage: "Used to track digital shelf visibility and optimize presence across organic and paid placements.",
      interpretation: "Higher SOS = stronger visibility and higher likelihood of conversion; low SOS indicates discoverability issues.",
      pitfalls: "Not defining shelf size consistently (top 10 vs top 20); mixing keywords with different intent; ignoring position weight (rank 1 vs rank 10 treated same).",
      example: "If a brand has 4 products shown in top 10 SKUs for a keyword, SOS = (4/10)*100 = 40%",
      logic: "SOS% = Brand Shelf Space / Total Shelf Space * 100",
    },
    {
      kpi: "Weighted OSA",
      definition: "It is the weighted average availability of products in a category, considering importance (weighted by sales) and individual availability percentages of each SKU.",
      usage: "The weighting ensures that the most critical or high-selling SKUs have a greater impact on the metric.",
      interpretation: "Higher weighted OSA suggests better stock management in that category; low OSA can limit offtake.",
      example: "If Product A has 90% OSA and $1,000 sales, and Product B has 80% and $2,000 sales, weighted OSA for that category is 83.33%.",
      logic: "Σ (OSA % × Sales) / Total Sales; (Sales where sales for last 30 days in a location is considered as weight for an SKU)",
    },
    {
      kpi: "Market Share",
      definition: "This metric estimates your brand's sales contribution within specific product categories or groups.",
      usage: "Track & grow market share by identifying areas to increase sales within the category.",
      interpretation: "Higher share → strong market presence; Lower share → growth opportunities.",
      pitfalls: "Estimated numbers with 80–90% accuracy.",
      example: "If Brand A sales = ₹1 Cr and total category sales = ₹5 Cr, Market Share = 20%.",
      logic: "Market Share (%) = (Brand Sales ÷ Total Category Sales) × 100",
    },
    {
      kpi: "Offtake",
      definition: "Reported sales value by the platform based on maximum retail price (MRP).",
      usage: "Measure sales performance.",
      interpretation: "Higher offtake → strong sales; Lower values → potential issues with demand or availability.",
      example: "If 100 units sold at $50 each, offtake = $5,000.",
      logic: "Total sales at MRP provided by platform.",
    },
    {
      kpi: "Weighted Discount %",
      definition: "Weighted Discount% is the sales weighted discount across all SKUs in a specific category.",
      interpretation: "Higher → aggressive promotions; Lower → premium pricing.",
      example: "Product A: 10% discount, 1,000 units; Product B: 20% discount, 2,000 units; Weighted Discount% = [(10%*1000) + (20%*2000)] / (1000+2000) = 15%",
      logic: "Category level: Sum( (avg MRP – avg SP) * quantity ) / Sum(avg MRP * quantity ); SKU level: (avg MRP – avg SP) / avg MRP",
    },
  ];

  const GlossarySection = ({ title, text, icon, bgColor, borderColor, textColor }) => {
    if (!text) return null;
    return (
      <Box
        sx={{
          p: 1.5,
          mb: 1.5,
          bgcolor: bgColor,
          borderRadius: "12px",
          border: `1px solid ${borderColor}`,
          display: "flex",
          gap: 1.5,
        }}
      >
        <Box sx={{ color: textColor, mt: 0.2 }}>{icon}</Box>
        <Box>
          <Typography variant="caption" fontWeight="700" sx={{ color: textColor, textTransform: "uppercase", display: "block", mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: "#475569", fontSize: "0.775rem", lineHeight: 1.5 }}>
            {text}
          </Typography>
        </Box>
      </Box>
    );
  };

  const menuItems = [
    { label: "Business Overview", icon: <DashboardIcon sx={{ fontSize: "1.1rem" }} /> },
    { label: "India Overview", icon: <PublicIcon sx={{ fontSize: "1rem" }} /> },
    { label: "Availability Analysis", icon: <ShoppingCartIcon sx={{ fontSize: "1rem" }} /> },
    { label: "Visibility Analysis", icon: <VisibilityIcon sx={{ fontSize: "1rem" }} /> },
    { label: "Market Share", icon: <AutoGraphIcon sx={{ fontSize: "1rem" }} />, hideForDb: ["boat", "mars_petcare"] },
    { label: "Pricing Analysis", icon: <PriceChangeIcon sx={{ fontSize: "1rem" }} />, hideForDb: ["mamaearth"] },
    { label: "Performance Marketing", icon: <AdsClickIcon sx={{ fontSize: "1rem" }} />, hideForDb: ["mamaearth", "boat"] },
    { label: "Content Analysis", icon: <ArticleIcon sx={{ fontSize: "1rem" }} />, showOnlyForDb: ["mars"] },
    { label: "Inventory Analysis", icon: <InventoryIcon sx={{ fontSize: "1rem" }} />, hideForDb: ["mamaearth", "boat"] },
    { label: "Scheduled Reports", icon: <ScheduleIcon sx={{ fontSize: "1rem" }} /> },
  ];

  const filteredMenuItems = menuItems.filter((item) => {
    if (item.showOnlyForDb && !item.showOnlyForDb.includes(userDbName)) return false;
    if (item.hideForDb && item.hideForDb.includes(userDbName)) return false;
    return true;
  });

  const filteredGlossary = businessOverviewGlossary.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.kpi.toLowerCase().includes(q) ||
      item.definition.toLowerCase().includes(q) ||
      (item.usage && item.usage.toLowerCase().includes(q)) ||
      (item.interpretation && item.interpretation.toLowerCase().includes(q))
    );
  });

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Drawer
      anchor="right"
      open={helpDrawerOpen}
      onClose={closeHelp}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: "70vw", md: "60vw", lg: "50vw" },
          bgcolor: "#f8fafc",
          borderLeft: "1px solid #e2e8f0",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.05)",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "10px",
              bgcolor: "rgba(37, 99, 235, 0.1)",
              color: "#2563eb",
            }}
          >
            <HelpIcon />
          </Box>
          <Typography variant="h6" fontWeight="700" sx={{ color: "#1e293b", fontSize: "1.0rem" }}>
            Let's Get Started
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <TextField
            size="small"
            placeholder="Search help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: { xs: 150, sm: 250 },
              "& .MuiOutlinedInput-root": {
                borderRadius: "20px",
                bgcolor: "#f1f5f9",
                "& fieldset": { border: "none" },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "#64748b", fontSize: "1.2rem" }} />
                </InputAdornment>
              ),
            }}
          />
          <IconButton onClick={closeHelp} size="small" sx={{ color: "#64748b", "&:hover": { bgcolor: "#f1f5f9" } }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Help Sidebar */}
        <Box
          sx={{
            width: 210,
            borderRight: "1px solid #e2e8f0",
            bgcolor: "#ffffff",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography
              variant="overline"
              sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}
            >
              MODULES
            </Typography>
          </Box>
          <List sx={{ px: 1 }}>
            {filteredMenuItems.map((item) => (
              <ListItemButton
                key={item.label}
                selected={activeMenu === item.label}
                onClick={() => setActiveMenu(item.label)}
                sx={{
                  borderRadius: "8px",
                  mb: 0.5,
                  py: 1,
                  "&.Mui-selected": {
                    bgcolor: "rgba(37, 99, 235, 0.08)",
                    color: "#2563eb",
                    "& .MuiListItemIcon-root": { color: "#2563eb" },
                    "&:hover": { bgcolor: "rgba(37, 99, 235, 0.12)" },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "#64748b" }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: "0.825rem",
                    fontWeight: activeMenu === item.label ? 600 : 500,
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        {/* Content Tabs & View */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", bgcolor: "#f8fafc" }}>
          <Box sx={{ px: 3, bgcolor: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{
                "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0", bgcolor: "#2563eb" },
              }}
            >
              <Tab
                label="Glossary"
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  minWidth: 100,
                  color: "#64748b",
                  "&.Mui-selected": { color: "#2563eb" },
                }}
              />
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, p: 3, overflowY: "auto" }}>
            <Box>
              <Box sx={{ display: 'grid', gap: 2 }}>
                {activeMenu === "Business Overview" ? (
                  filteredGlossary.map((item) => {
                    const isExpanded = expandedKpi === item.kpi;
                    return (
                      <Box
                        key={item.kpi}
                        sx={{
                          bgcolor: "#ffffff",
                          borderRadius: "12px",
                          border: `1px solid ${isExpanded ? "#2563eb" : "#e2e8f0"}`,
                          boxShadow: isExpanded ? "0 4px 12px rgba(37, 99, 235, 0.06)" : "0 1px 3px rgba(0,0,0,0.02)",
                          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          overflow: "hidden",
                          "&:hover": {
                              borderColor: "#cbd5e1",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
                          }
                        }}
                      >
                        <ListItemButton
                          onClick={() => setExpandedKpi(isExpanded ? null : item.kpi)}
                          sx={{ 
                              p: 2, 
                              alignItems: "flex-start", 
                              gap: 2,
                              "&:hover .kpi-title": {
                                  color: "#2563eb",
                                  transform: "translateX(4px)"
                              }
                          }}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography 
                              className="kpi-title"
                              fontWeight="700" 
                              sx={{ 
                                  color: isExpanded ? "#2563eb" : "#1e293b", 
                                  fontSize: "0.95rem", 
                                  mb: 0.5,
                                  transition: "all 0.2s ease"
                              }}
                            >
                              {item.kpi}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "#64748b", fontSize: "0.825rem", lineHeight: 1.5 }}>
                              {item.definition}
                            </Typography>
                          </Box>
                          <Box sx={{ color: "#2563eb", mt: 0.5 }}>
                            {isExpanded ? <RemoveIcon /> : <AddIcon />}
                          </Box>
                        </ListItemButton>

                        <Collapse in={isExpanded}>
                          <Box sx={{ p: 2, pt: 0 }}>
                            <GlossarySection
                              title="Usage"
                              text={item.usage}
                              icon={<UsageIcon fontSize="small" />}
                              bgColor="#f0f9ff"
                              borderColor="#bae6fd"
                              textColor="#0369a1"
                            />
                            <GlossarySection
                              title="Common Pitfalls"
                              text={item.pitfalls}
                              icon={<PitfallsIcon fontSize="small" />}
                              bgColor="#fef2f2"
                              borderColor="#fecaca"
                              textColor="#b91c1c"
                            />
                            <GlossarySection
                              title="Interpretation"
                              text={item.interpretation}
                              icon={<InterpretationIcon fontSize="small" />}
                              bgColor="#faf5ff"
                              borderColor="#e9d5ff"
                              textColor="#7e22ce"
                            />
                            <GlossarySection
                              title="Example"
                              text={item.example}
                              icon={<ExampleIcon fontSize="small" />}
                              bgColor="#fffbeb"
                              borderColor="#fef3c7"
                              textColor="#b45309"
                            />
                            <GlossarySection
                              title="Logic / Calculation"
                              text={item.logic}
                              icon={<LogicIcon fontSize="small" />}
                              bgColor="#f0fdf4"
                              borderColor="#bbf7d0"
                              textColor="#15803d"
                            />
                          </Box>
                        </Collapse>
                      </Box>
                    );
                  })
                ) : (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography sx={{ color: "#64748b" }}>
                      Glossary content for {activeMenu} is coming soon.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

export default HelpDrawer;
