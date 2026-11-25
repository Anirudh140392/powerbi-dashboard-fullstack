import React, { useState, useEffect } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Alert,
  Tooltip,
  Snackbar,
} from "@mui/material";
import {
  Close as CloseIcon,
  AutoGraph as AutoGraphIcon,
  Timeline as TimelineIcon,
  Layers as LayersIcon,
  Lightbulb as LightbulbIcon,
  CompareArrows as CompareArrowsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  ContentCopy as ContentCopyIcon,
  Email as EmailIcon,
  HelpOutline as HelpOutlineIcon,
  Campaign as CampaignIcon,
  LocalShipping as LocalShippingIcon,
  Handshake as HandshakeIcon,
  Terminal as TerminalIcon,
  ArrowForward as ArrowForwardIcon,
  MenuBook as MenuBookIcon,
  Storefront as StorefrontIcon,
  LocationOn as LocationOnIcon,
  Category as CategoryIcon,
  Inventory2 as Inventory2Icon,
} from "@mui/icons-material";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import axios from "axios";
import AssignAnomalyEmailModal from "./AssignAnomalyEmailModal";

// Plain-Language Business Glossary Dictionary
const GLOSSARY = {
  osa: {
    term: "OSA (On-Shelf Availability)",
    plain: "Percentage of time your product is in-stock and purchasable by shoppers on platforms like Blinkit, Zepto, or Amazon. Target benchmark is ≥ 85%.",
  },
  offtakes: {
    term: "Offtakes (Gross Revenue)",
    plain: "Total consumer sales generated across quick-commerce and marketplace platforms.",
  },
  qty_sold: {
    term: "Quantity Sold (Volume)",
    plain: "Total individual packs or units dispatched to consumers.",
  },
  inorganic_sale: {
    term: "Inorganic (Ad) Sales",
    plain: "Revenue directly attributed to sponsored product ads and paid search campaigns.",
  },
  organic_sale: {
    term: "Organic Sales",
    plain: "Base sales driven naturally by brand awareness, search ranking, and returning customers without ad spend.",
  },
  ad_spend: {
    term: "Ad Spend (Campaign Budget)",
    plain: "Total money invested in platform media (Sponsored Products, Banner Ads, Brand Days).",
  },
  roas: {
    term: "ROAS (Return on Ad Spend)",
    plain: "Revenue generated for every ₹1 spent on ads. (e.g. 4.0x means ₹4 sales for every ₹1 ad spend).",
  },
  asp_ppu: {
    term: "ASP / PPU (Average Selling Price)",
    plain: "The net realized price paid per unit by consumers after all channel discounts and coupons.",
  },
  doi_dih: {
    term: "DOI (Days of Inventory)",
    plain: "How many days of consumer demand your current warehouse and dark store stock will cover before running out.",
  },
  psl: {
    term: "PSL (Potential Sales Loss)",
    plain: "Revenue lost because shoppers tried to buy your product but encountered an out-of-stock error.",
  },
  sos: {
    term: "Share of Search (SOS)",
    plain: "Your brand's share of page-1 search visibility when customers search for core category keywords.",
  },
};

// Enterprise Name & Title Normalizers (100% crash-proof against non-strings)
const formatClient = (c) => {
  if (!c) return "Brand";
  const str = String(c).trim();
  const map = {
    boat: "boAt",
    pidilite: "Pidilite",
    drl: "Dr. Reddy's",
    mars: "Mars Snacking",
    mars_petcare: "Mars Petcare",
    prestige: "Prestige",
    danone: "Danone",
    hayatna: "Hayatna",
    emami: "Emami",
    mamaearth: "Mamaearth",
    sugar: "Sugar Cosmetics",
  };
  return map[str.toLowerCase()] || (str ? str.charAt(0).toUpperCase() + str.slice(1) : "Brand");
};

const formatPlatform = (p) => {
  if (!p) return "All Platforms";
  const str = String(p).trim();
  const map = {
    amazon: "Amazon",
    "amazon pharmacy": "Amazon Pharmacy",
    blinkit: "Blinkit",
    zepto: "Zepto",
    instamart: "Instamart",
    bigbasket: "BigBasket",
    flipkart: "Flipkart",
    "flipkart minutes": "Flipkart Minutes",
    apollo: "Apollo 24|7",
    "apollo 247": "Apollo 24|7",
    firstcry: "FirstCry",
    "1mg": "Tata 1mg",
    pharmeasy: "PharmEasy",
    netmeds: "Netmeds",
  };
  return map[str.toLowerCase()] || (str ? str.charAt(0).toUpperCase() + str.slice(1) : "All Platforms");
};

const formatLocation = (loc) => {
  if (!loc) return "All Locations";
  const str = String(loc).trim();
  const l = str.toLowerCase();
  if (l === "nation") return "Pan-India Hubs";
  if (l === "other") return "Regional Hubs";
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "All Locations";
};

const formatCategory = (cat) => {
  if (!cat) return "Primary Category";
  const str = String(cat).trim();
  const map = {
    tws: "TWS Earbuds",
    neckbands: "Wireless Neckbands",
    headphones: "Headphones",
    wearables: "Smartwatches & Wearables",
    speakers: "Speakers & Soundbars",
    accessories: "Mobile Accessories",
    "smart watches": "Smartwatches",
  };
  return map[str.toLowerCase()] || str
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ") || "Primary Category";
};

const formatSkuName = (s) => {
  if (!s) return "Catalog Listing";
  let str = String(s).trim();
  for (const suf of [" w/", " w", " -", " /"]) {
    if (str.endsWith(suf)) str = str.slice(0, -suf.length).trim();
  }
  const words = str.split(" ").filter(Boolean).map((w) => {
    const lw = w.toLowerCase();
    if (lw === "boat") return "boAt";
    if (lw === "tws") return "TWS";
    if (lw === "anc") return "ANC";
    if (lw === "pro") return "Pro";
    if (lw === "plus") return "Plus";
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
  return words.join(" ") || "Catalog Listing";
};

export default function KpiAnomalyChartDrawer({
  open,
  onClose,
  kpiKey,
  kpiLabel,
  client = "",
  moduleName = "business_overview",
  segmentName = "business_overview_overview",
  apiValue = null,
  logicValue = null,
  uiValue = null,
  anomalyData = null,
}) {
  const isStalled = Boolean(anomalyData?.status === 'DATA_INGESTION_STALLED' || String(anomalyData?.rca?.summary || '').includes('Data Ingestion Stalled'));

  const [days, setDays] = useState(30);
  const [viewMode, setViewMode] = useState("daily"); // "daily" | "2hour"
  const [selectedPulse, setSelectedPulse] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [decompLevel, setDecompLevel] = useState("platform"); // platform | city | brand | category | sku
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false); // Expandable drawer width toggle
  const [copiedToast, setCopiedToast] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [selectedKpiFilter, setSelectedKpiFilter] = useState(null);

  const ALL_KPIS = [
    { key: "offtakes", label: "OFFTAKES" },
    { key: "qty_sold", label: "QTY SOLD" },
    { key: "ad_spend", label: "SPEND" },
    { key: "inorganic_sale", label: "INORGANIC SALES" },
    { key: "osa", label: "OSA" },
    { key: "wt_osa", label: "WT OSA" },
    { key: "asp_ppu", label: "ASP" },
    { key: "listing_percent", label: "LISTING %" },
    { key: "overall_sov", label: "OVERALL SOV" },
    { key: "ad_sos", label: "AD SOS" },
    { key: "organic_sos", label: "ORGANIC SOS" },
    { key: "sos", label: "SOS" },
    { key: "market_share", label: "MKT SHARE" },
    { key: "cat_size", label: "CAT SIZE" },
    { key: "roas", label: "ROAS" },
    { key: "conversion", label: "CONVERSION" },
  ];

  // Map arbitrary KPI key to underlying metric for time series & OLAP
  const resolveMetricKey = (key) => {
    if (!key) return anomalyData?.metric || "offtakes";
    const k = key.toLowerCase();
    if (k.includes("discount")) return "discount";
    if (k.includes("wt_osa") || k.includes("weighted_osa") || k.includes("weighted osa")) return "wt_osa";
    if (k.includes("ad_sos") || k.includes("ad sos") || k.includes("sponsored")) return "ad_sos";
    if (k.includes("organic_sos") || k.includes("organic sos")) return "organic_sos";
    if (k.includes("overall_sov") || k.includes("overall sov") || k.includes("sov")) return "overall_sov";
    if (k.includes("sos") || k.includes("search")) return "sos";
    if (k.includes("osa") || k.includes("availability")) return "osa";
    if (k.includes("roas")) return "roas";
    if (k.includes("listing")) return "listing_percent";
    if (k.includes("conversion")) return "conversion";
    if (k.includes("mkt_share") || k.includes("market_share") || k.includes("market share")) return "market_share";
    if (k.includes("cat_size") || k.includes("category size") || k.includes("category_size")) return "cat_size";
    if (k.includes("inorganic")) return "inorganic_sale";
    if (k.includes("spend")) return "ad_spend";
    if (k.includes("qty") || k.includes("unit")) return "qty_sold";
    if (k.includes("price") || k.includes("sp") || k.includes("asp") || k.includes("ppu")) return "asp_ppu";
    if (k.includes("offtake") || k.includes("sale") || k.includes("revenue")) return "offtakes";
    return anomalyData?.metric || "offtakes";
  };

  const metric = resolveMetricKey(kpiKey);

  const getMetricHeaderLabel = () => {
    switch (metric) {
      case "discount": return "Average Discount (%)";
      case "wt_osa": return "Weighted OSA (%)";
      case "osa": return "On-Shelf Availability (%)";
      case "ad_sos": return "Ad / Sponsored SOS (%)";
      case "organic_sos": return "Organic SOS (%)";
      case "overall_sov": return "Overall SOV (%)";
      case "sos": return "Share of Search (%)";
      case "roas": return "ROAS (x)";
      case "listing_percent": return "Listing Coverage (%)";
      case "conversion": return "Conversion Rate (%)";
      case "market_share": return "Market Share (%)";
      case "cat_size": return "Category Size (₹)";
      case "inorganic_sale": return "Inorganic Sales (₹)";
      case "ad_spend": return "Ad Spend (₹)";
      case "qty_sold": return "Units Sold";
      case "asp_ppu": return "Average Selling Price (₹)";
      default: return "Sales Contribution";
    }
  };

  const getRowMetricVal = (row) => {
    if (!row) return 0;
    if (metric === "discount") return row.discount ?? row.value;
    if (metric === "osa") return row.osa ?? row.value;
    if (metric === "wt_osa") return row.wt_osa ?? row.osa ?? row.value;
    if (metric === "sos") return row.sos ?? row.value;
    if (metric === "ad_sos") return row.ad_sos ?? row.value;
    if (metric === "organic_sos") return row.organic_sos ?? row.value;
    if (metric === "roas") return row.roas ?? row.value;
    if (metric === "qty_sold") return row.qty ?? row.value;
    if (metric === "asp_ppu") return row.asp ?? row.value;
    if (metric === "ad_spend") return row.spend ?? row.value;
    if (metric === "inorganic_sale") return row.inorg_sales ?? row.value;
    return row.value !== undefined && row.value !== null ? row.value : row.sales;
  };

  const resolvePlatformFromKpi = (key) => {
    if (!key) return null;
    const k = key.toLowerCase();
    for (const p of [
      "amazon pharmacy", "apollo 247", "apollo", "first cry", "firstcry",
      "1_mg", "1mg", "pharmeasy", "netmeds", "myntra", "nykaa", "truemeds",
      "blinkit", "zepto", "instamart", "amazon", "flipkart", "bigbasket",
      "jiomart", "meesho", "shopify"
    ]) {
      if (k.includes(p)) return p;
    }
    return null;
  };

  const detectedPlatform = anomalyData?.platform || anomalyData?.anomalyObj?.platform || resolvePlatformFromKpi(kpiLabel || kpiKey);

  useEffect(() => {
    if (!open) return;
    fetchTrendData();
  }, [open, client, metric, days, viewMode, kpiKey, detectedPlatform]);

  const fetchTrendData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("/ds-tester/anomaly/chart", {
        params: {
          client,
          metric,
          days,
          granularity: viewMode,
          platform: detectedPlatform,
          kpi: kpiLabel || kpiKey,
          actual: anomalyData?.actual,
          baseline: anomalyData?.baseline,
          deviation_pct: anomalyData?.deviation_pct,
          severity: anomalyData?.severity,
        },
        timeout: 60000,
      });
      setChartData(res.data);
      if (res.data?.pulses?.length > 0) {
        const cur = res.data.pulses.find((p) => p.is_current) || res.data.pulses[res.data.pulses.length - 1];
        if (!selectedPulse || !res.data.pulses.some((p) => p.id === selectedPulse.id)) {
          setSelectedPulse(cur);
        }
      }
    } catch (err) {
      console.error("Failed to fetch anomaly chart data:", err);
      setError("Unable to load ClickHouse time series. Please verify service health.");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (val, metricOverride) => {
    if (val === null || val === undefined) return "—";
    const num = Number(val);
    if (isNaN(num)) return val;
    const m = metricOverride || metric;
    if (
      m === "discount" ||
      m === "osa" ||
      m === "wt_osa" ||
      m === "sos" ||
      m === "ad_sos" ||
      m === "organic_sos" ||
      m === "overall_sov" ||
      m === "listing_percent" ||
      m === "market_share" ||
      m === "conversion"
    ) {
      return `${num.toFixed(1)}%`;
    }
    if (m === "roas") {
      return `${num.toFixed(2)}x`;
    }
    if (m === "asp_ppu") {
      return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
    }
    if (m === "qty_sold") {
      if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M units`;
      if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}k units`;
      return `${Math.round(num).toLocaleString("en-IN")} units`;
    }
    if (m === "offtakes" || m === "ad_spend" || m === "inorganic_sale" || m === "cat_size") {
      if (Math.abs(num) >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
      if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
      return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;
    }
    return num.toLocaleString("en-IN", { maximumFractionDigits: 1 });
  };

  const points = chartData?.points || [];
  const latestPoint = points.length > 0 ? points[points.length - 1] : null;

  // Real verified numbers from Stage 1 & Sentinel anomaly verification
  const verifiedActual = anomalyData?.actual !== undefined && anomalyData?.actual !== null
    ? anomalyData.actual
    : (chartData?.verified_actual !== undefined && chartData?.verified_actual !== null
      ? chartData.verified_actual
      : latestPoint?.actual);

  const verifiedBaseline = anomalyData?.baseline !== undefined && anomalyData?.baseline !== null
    ? anomalyData.baseline
    : (chartData?.verified_baseline !== undefined && chartData?.verified_baseline !== null
      ? chartData.verified_baseline
      : latestPoint?.baseline);

  const verifiedDevPct = anomalyData?.deviation_pct !== undefined && anomalyData?.deviation_pct !== null
    ? anomalyData.deviation_pct
    : (chartData?.verified_dev !== undefined && chartData?.verified_dev !== null
      ? chartData.verified_dev
      : (latestPoint?.deviation_pct || 0));

  const deviationPct = verifiedDevPct;
  const verifiedSeverity = anomalyData?.severity
    || chartData?.verified_severity
    || (Math.abs(verifiedDevPct) >= 20 ? "CRITICAL" : Math.abs(verifiedDevPct) >= 10 ? "WARNING" : "NORMAL");

  const isAnomaly = (anomalyData?.deviation_pct !== undefined && anomalyData?.deviation_pct !== null)
    ? (Math.abs(anomalyData.deviation_pct) >= (anomalyData.threshold_pct || 10))
    : (chartData?.verified_dev !== undefined && chartData?.verified_dev !== null
      ? (Math.abs(chartData.verified_dev) >= (chartData.threshold_pct || 10))
      : Boolean(latestPoint?.is_anomaly || Math.abs(verifiedDevPct) >= 10));
  const decomp = chartData?.decomposition || {};

  const topPlatform = decomp?.level1_platforms?.[0] || null;
  const topCity = decomp?.level2_cities?.[0] || null;
  const topBrand = decomp?.level3_brands?.[0] || null;
  const topCategory = decomp?.level4_categories?.[0] || null;
  const topSku = decomp?.level5_skus?.[0] || null;

  const clientName = formatClient(client);
  const platformName = detectedPlatform
    ? formatPlatform(detectedPlatform)
    : (topPlatform?.name ? formatPlatform(topPlatform.name) : "Target Platform");
  const locationName = topCity?.name ? formatLocation(topCity.name) : "Target Locations";
  const categoryName = topCategory?.name ? formatCategory(topCategory.name) : "Target Category";
  const skuName = topSku?.product ? formatSkuName(topSku.product) : "Catalog Listing";
  const skuPid = topSku?.pid || "";
  const devAbs = Math.abs(verifiedDevPct).toFixed(1);

  // Pillar 1: Automated Plain-English Executive Story Narrative
  const generateExecutiveStory = () => {
    const dir = verifiedDevPct < 0 ? "dropped" : "surged";
    const devSign = verifiedDevPct > 0 ? `+${verifiedDevPct}%` : `${verifiedDevPct}%`;

    if (anomalyData?.rca?.summary) {
      if (isStalled) {
        return (
          <span>
            <strong>{clientName}</strong>: {anomalyData.rca.summary}{" "}
            <span style={{ color: "#dc2626", fontWeight: 700 }}>
              Zero records were ingested in this period due to pipeline stoppage. Upstream scrapers/ETL sync must be restarted.
            </span>
          </span>
        );
      }
      return (
        <span>
          <strong>{clientName}</strong>: {anomalyData.rca.summary}{" "}
          Recorded actual value of <strong style={{ color: isAnomaly ? "#dc2626" : "#0f172a" }}>{formatNumber(verifiedActual)}</strong>{" "}
          diverging from historical baseline <strong>{formatNumber(verifiedBaseline)}</strong> by{" "}
          <strong style={{ color: isAnomaly ? "#dc2626" : "#16a34a" }}>{devSign}</strong>.
          {topCity?.name && (
            <span>
              {" "}The variation is concentrated in <strong>{locationName}</strong> on <strong>{platformName}</strong>
              {metric === "osa" && topCity.osa !== undefined && (
                <span> (where On-Shelf Availability is <strong style={{ color: (topCity?.osa !== undefined && topCity.osa < 70) ? "#dc2626" : "#16a34a" }}>{topCity.osa}%</strong>)</span>
              )}
              {topSku?.product && (
                <span>, with primary SKU impact on <em>"{skuName}"</em> {skuPid ? `(${skuPid})` : ""} across regional hubs</span>
              )}.
            </span>
          )}
        </span>
      );
    }

    if (metric === "discount") {
      return (
        <span>
          <strong>{clientName}</strong> Average Discount on <strong>{platformName}</strong> {dir} by{" "}
          <strong style={{ color: "#dc2626" }}>{devAbs}%</strong> vs. the 30-day baseline of{" "}
          <strong>{formatNumber(verifiedBaseline, "discount")}</strong>, breaching the 10% maximum tolerance boundary.
          {topCity?.name && (
            <span>
              {" "}The promotional discount shift is concentrated in <strong>{locationName}</strong> on <strong>{platformName}</strong>
              {topCity.discount !== undefined && (
                <span> (where average discount is <strong style={{ color: isAnomaly ? "#dc2626" : "#16a34a" }}>{topCity.discount}%</strong>)</span>
              )}.
            </span>
          )}
          {topSku?.product && (
            <span> Primary SKU margin impact on <em>"{skuName}"</em> {skuPid ? `(${skuPid})` : ""} across distribution hubs.</span>
          )}
        </span>
      );
    }

    if (metric === "sos" || metric === "ad_sos" || metric === "organic_sos" || metric === "overall_sov") {
      return (
        <span>
          <strong>{clientName}</strong> {kpiLabel || "Share of Search (SOS)"} on <strong>{platformName}</strong> {dir} by{" "}
          <strong style={{ color: "#dc2626" }}>{devAbs}%</strong> vs. the 30-day baseline of{" "}
          <strong>{formatNumber(verifiedBaseline, metric)}</strong>, breaching the 10% tolerance boundary.
          {topCity?.name && (
            <span>
              {" "}Visibility variation is concentrated in <strong>{locationName}</strong> on <strong>{platformName}</strong>.
            </span>
          )}
          {topSku?.product && (
            <span> Primary impacted listing: <em>"{skuName}"</em> {skuPid ? `(${skuPid})` : ""} in search results.</span>
          )}
        </span>
      );
    }

    if (metric === "osa" || metric === "wt_osa" || (metric === "offtakes" && verifiedDevPct < -10)) {
      return (
        <span>
          <strong>{clientName}</strong> {kpiLabel || metric} on <strong>{platformName}</strong> {dir} by{" "}
          <strong style={{ color: "#dc2626" }}>{devAbs}%</strong> vs. the 30-day baseline of{" "}
          <strong>{formatNumber(verifiedBaseline)}</strong>, breaching the 10% maximum tolerance boundary.
          {topCity?.name && (
            <span>
              {" "}The shortfall is concentrated in <strong>{locationName}</strong> on <strong>{platformName}</strong>
              {topCity.osa !== undefined && (
                <span> where On-Shelf Availability (OSA) fell to <strong style={{ color: (topCity?.osa !== undefined && topCity.osa < 70) ? "#dc2626" : "#16a34a" }}>{topCity.osa}%</strong></span>
              )}.
            </span>
          )}
          {topSku?.product && (
            <span> Primary SKU impact on <em>"{skuName}"</em> {skuPid ? `(${skuPid})` : ""} across fulfillment hubs.</span>
          )}
        </span>
      );
    }

    if (metric === "asp_ppu" || Math.abs(verifiedDevPct) >= 15) {
      return (
        <span>
          <strong>{clientName}</strong> net realized selling price {dir} by{" "}
          <strong style={{ color: "#d97706" }}>{devAbs}%</strong> on <strong>{platformName}</strong>,
          diverging from the 30-day baseline of <strong>{formatNumber(verifiedBaseline)}</strong>.
          This indicates promotional adjustments, channel discount shifts, or catalog revision.
        </span>
      );
    }

    return (
      <span>
        <strong>{clientName}</strong> {kpiLabel || metric} recorded an actual value of{" "}
        <strong>{formatNumber(verifiedActual)}</strong> against a rolling baseline of{" "}
        <strong>{formatNumber(verifiedBaseline)}</strong> ({devSign} deviation).
        {isAnomaly ? " Tolerance corridor breached." : " Operating within normal tolerance limits."}
      </span>
    );
  };

  // Pillar 4: Role-Based Remediation Action Playbook
  const getRoleBasedPlaybook = () => {
    if (metric === "osa" || (metric === "offtakes" && deviationPct < -10)) {
      return [
        {
          role: "Performance Marketing & Ad Ops",
          icon: <CampaignIcon sx={{ color: "#dc2626" }} />,
          priority: "IMMEDIATE (Within 1 Hour)",
          badgeColor: "#dc2626",
          bgColor: "#fef2f2",
          action: `Auto-pause Sponsored Product ads on out-of-stock listings for '${(skuName || '').slice(0, 30)}' in ${locationName} to eliminate wasted ad spend while availability is below 70%.`,
        },
        {
          role: "Supply Chain & Logistics",
          icon: <LocalShippingIcon sx={{ color: "#2563eb" }} />,
          priority: "URGENT (Within 12 Hours)",
          badgeColor: "#2563eb",
          bgColor: "#eff6ff",
          action: `Dispatch emergency secondary replenishment consignment from Central CFA to ${platformName} dark stores in ${locationName}. Restock buffer to 14 days of forward cover.`,
        },
        {
          role: "Key Account Management (KAM)",
          icon: <HandshakeIcon sx={{ color: "#d97706" }} />,
          priority: "HIGH (Within 24 Hours)",
          badgeColor: "#d97706",
          bgColor: "#fffbeb",
          action: `Alert ${platformName} category manager regarding localized pod replenishment delay to prevent search algorithm delisting penalties.`,
        },
        {
          role: "Data Engineering & Analytics",
          icon: <TerminalIcon sx={{ color: "#7c3aed" }} />,
          priority: "SCHEDULED AUDIT",
          badgeColor: "#7c3aed",
          bgColor: "#f5f3ff",
          action: `Verify ClickHouse partition sync for ${client}.rb_pdp_olap and ensure real-time scraper pipeline health.`,
        },
      ];
    }

    if (metric === "asp_ppu" || Math.abs(deviationPct) >= 15) {
      return [
        {
          role: "Key Account Management (KAM)",
          icon: <HandshakeIcon sx={{ color: "#d97706" }} />,
          priority: "IMMEDIATE (Within 2 Hours)",
          badgeColor: "#d97706",
          bgColor: "#fffbeb",
          action: `Audit seller vouchers and active platform promos on ${platformName}. Verify if unauthorized 3P sellers are violating MAP (Minimum Advertised Price).`,
        },
        {
          role: "Commercial / Pricing Strategy",
          icon: <CampaignIcon sx={{ color: "#2563eb" }} />,
          priority: "HIGH (Same Day)",
          badgeColor: "#2563eb",
          bgColor: "#eff6ff",
          action: `Re-harmonize channel discounts between quick-commerce (Blinkit/Zepto) and marketplaces (Amazon/Flipkart) to eliminate channel arbitrage.`,
        },
        {
          role: "Data Engineering & Analytics",
          icon: <TerminalIcon sx={{ color: "#7c3aed" }} />,
          priority: "SCHEDULED AUDIT",
          badgeColor: "#7c3aed",
          bgColor: "#f5f3ff",
          action: `Validate ERP pricing feed catalog push to ensure correct MSRP and selling prices are published.`,
        },
      ];
    }

    return [
      {
        role: "Data Engineering & Analytics",
        icon: <TerminalIcon sx={{ color: "#2563eb" }} />,
        priority: "ROUTINE CHECK",
        badgeColor: "#2563eb",
        bgColor: "#eff6ff",
        action: `Audit ClickHouse table row counts and verify scraper completion for ${clientName}.`,
      },
      {
        role: "Business Operations",
        icon: <CampaignIcon sx={{ color: "#16a34a" }} />,
        priority: "MONITOR",
        badgeColor: "#16a34a",
        bgColor: "#f0fdf4",
        action: `Observe next 2-hour pulse to determine if variation is a temporary intra-day lull or structural trend.`,
      },
    ];
  };

  // Pillar 6: "One-Click Executive Share"
  const handleCopyExecutiveBrief = () => {
    const briefText = `🚨 *TRAILYTICS ANOMALY SENTINEL BRIEF* 🚨
• Client: ${clientName}
• Metric: ${kpiLabel || metric}
• Latest Actual: ${formatNumber(latestPoint?.actual)}
• Rolling Baseline: ${formatNumber(latestPoint?.baseline)}
• Deviation: ${deviationPct > 0 ? "+" : ""}${deviationPct}% (Threshold: ≤ 10%)
• Severity: ${Math.abs(deviationPct) >= 25 ? "CRITICAL BREACH" : Math.abs(deviationPct) >= 10 ? "WARNING" : "NORMAL"}

📍 *5-Level Drill-Down Trail*:
1. Platform: ${platformName} (${topPlatform?.share_pct ?? 0}% share, ${topPlatform?.osa ?? 0}% OSA)
2. Location: ${locationName} (${topCity?.share_pct ?? 0}% share, ${topCity?.osa ?? 0}% OSA)
3. Brand: ${clientName}
4. Category: ${categoryName}
5. Culprit SKU: ${skuName} (${skuPid})

⚡ *Immediate Action Required*:
1. [Ad Ops] Pause sponsored ads on out-of-stock listings in ${platformName}.
2. [Supply Chain] Dispatch emergency replenishment PO to ${locationName} distribution hub.
3. [KAM] Coordinate with platform category lead to update inventory safety buffers.

_Generated by Trailytics Anomaly Sentinel (Manual On-Demand Scan)_`;

    navigator.clipboard.writeText(briefText);
    setCopiedToast(true);
  };

  const playbook = getRoleBasedPlaybook();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: {
            xs: "100%",
            md: isExpanded ? "95vw" : 880,
            lg: isExpanded ? "96vw" : 1000,
          },
          transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          bgcolor: "#ffffff",
          color: "#0f172a",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          p: 0,
        },
      }}
    >
      {/* Header Bar */}
      <Box
        sx={{
          p: 2.5,
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          bgcolor: "#f8fafc",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <AutoGraphIcon sx={{ color: "#2563eb", fontSize: 28 }} />
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                {kpiLabel || kpiKey}
              </Typography>
              <Chip
                label={isAnomaly ? `${verifiedSeverity} (${verifiedDevPct > 0 ? "+" : ""}${verifiedDevPct}% Deviation)` : "NORMAL (≤10%)"}
                size="small"
                sx={{
                  fontWeight: 800,
                  fontSize: "11px",
                  bgcolor: isAnomaly ? (verifiedSeverity === "CRITICAL" ? "#fee2e2" : "#fef3c7") : "#dcfce7",
                  color: isAnomaly ? (verifiedSeverity === "CRITICAL" ? "#dc2626" : "#d97706") : "#16a34a",
                  border: `1px solid ${isAnomaly ? (verifiedSeverity === "CRITICAL" ? "#fecaca" : "#fde68a") : "#bbf7d0"}`,
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: "#64748b", fontSize: "12px", mt: 0.2 }}>
              Workspace: <strong style={{ color: "#2563eb" }}>{clientName}</strong> | Module:{" "}
              <strong style={{ color: "#334155" }}>{moduleName}</strong> | Max Threshold Constraint:{" "}
              <strong style={{ color: "#d97706" }}>≤ 10%</strong>
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* One-Click Executive Brief Share (Pillar 6) */}
          <Button
            size="small"
            variant="outlined"
            onClick={handleCopyExecutiveBrief}
            startIcon={<ContentCopyIcon fontSize="small" />}
            sx={{
              borderColor: "#cbd5e1",
              color: "#334155",
              fontWeight: 700,
              fontSize: "11px",
              textTransform: "none",
              borderRadius: "8px",
              bgcolor: "#ffffff",
              "&:hover": { bgcolor: "#f1f5f9", borderColor: "#94a3b8" },
            }}
          >
            Copy Brief
          </Button>

          {/* Assign Anomaly via Outlook Mail */}
          <Button
            size="small"
            variant="outlined"
            onClick={() => setEmailModalOpen(true)}
            startIcon={<EmailIcon fontSize="small" />}
            sx={{
              borderColor: "#38bdf8",
              color: "#0369a1",
              fontWeight: 700,
              fontSize: "11px",
              textTransform: "none",
              borderRadius: "8px",
              bgcolor: "#f0f9ff",
              "&:hover": { bgcolor: "#e0f2fe", borderColor: "#0284c7" },
            }}
          >
            Assign via Email
          </Button>

          {/* Business Glossary Toggle (Pillar 3) */}
          <Tooltip title="View Plain-Language Business Glossary">
            <IconButton
              size="small"
              onClick={() => setShowGlossary(!showGlossary)}
              sx={{
                color: showGlossary ? "#2563eb" : "#64748b",
                bgcolor: showGlossary ? "#eff6ff" : "transparent",
              }}
            >
              <MenuBookIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* IDEA 1: Dual-Mode Toggle: Daily Baseline vs 2-Hour Sentinel Pulse */}
          <Box sx={{ display: "flex", alignItems: "center", bgcolor: "#f1f5f9", borderRadius: "8px", p: 0.3, border: "1px solid #e2e8f0" }}>
            <Button
              size="small"
              onClick={() => setViewMode("daily")}
              sx={{
                py: 0.2,
                px: 1,
                fontSize: "11px",
                fontWeight: 700,
                color: viewMode === "daily" ? "#2563eb" : "#64748b",
                bgcolor: viewMode === "daily" ? "#ffffff" : "transparent",
                boxShadow: viewMode === "daily" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                borderRadius: "6px",
                textTransform: "none",
              }}
            >
              📅 Daily Trend
            </Button>
            <Button
              size="small"
              onClick={() => setViewMode("2hour")}
              sx={{
                py: 0.2,
                px: 1,
                fontSize: "11px",
                fontWeight: 700,
                color: viewMode === "2hour" ? "#2563eb" : "#64748b",
                bgcolor: viewMode === "2hour" ? "#ffffff" : "transparent",
                boxShadow: viewMode === "2hour" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                borderRadius: "6px",
                textTransform: "none",
              }}
            >
              ⏱️ 2-Hour Pulse
            </Button>
          </Box>

          {/* Lookback Range Selectors (shown in Daily mode) */}
          {viewMode === "daily" ? (
            <Box sx={{ display: "flex", bgcolor: "#f1f5f9", borderRadius: "8px", p: 0.4, border: "1px solid #e2e8f0" }}>
              {[7, 14, 30].map((d) => (
                <Button
                  key={d}
                  size="small"
                  onClick={() => setDays(d)}
                  sx={{
                    minWidth: 38,
                    py: 0.2,
                    px: 0.8,
                    fontSize: "11px",
                    fontWeight: 700,
                    color: days === d ? "#2563eb" : "#64748b",
                    bgcolor: days === d ? "#ffffff" : "transparent",
                    boxShadow: days === d ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {d}D
                </Button>
              ))}
            </Box>
          ) : (
            <Chip
              label="12 Pulses (Last 24h)"
              size="small"
              sx={{
                height: 26,
                fontSize: "11px",
                fontWeight: 700,
                bgcolor: "#eff6ff",
                color: "#2563eb",
                border: "1px solid #bfdbfe",
              }}
            />
          )}

          {/* Expand / Fullscreen Toggle */}
          <Tooltip title={isExpanded ? "Collapse Sidebar (Standard View)" : "Expand Sidebar (Wide Canvas View)"}>
            <IconButton
              size="small"
              onClick={() => setIsExpanded(!isExpanded)}
              sx={{ color: isExpanded ? "#2563eb" : "#64748b" }}
            >
              {isExpanded ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>

          <IconButton onClick={fetchTrendData} size="small" sx={{ color: "#64748b" }}>
            <RefreshIcon fontSize="small" />
          </IconButton>

          <IconButton onClick={onClose} size="small" sx={{ color: "#64748b" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* PILLAR 1: Clean Executive Summary Card (Replaces the messy banner) */}
      <Box sx={{ p: 2.5, bgcolor: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        <Card
          sx={{
            p: 2.5,
            bgcolor: isAnomaly ? "#fff8f8" : "#f8fdf9",
            border: `1px solid ${isAnomaly ? "#fecaca" : "#bbf7d0"}`,
            borderRadius: "14px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {/* Top Bar of the Card */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: isAnomaly ? "#dc2626" : "#16a34a",
                  boxShadow: isAnomaly ? "0 0 8px rgba(220, 38, 38, 0.5)" : "0 0 8px rgba(22, 163, 74, 0.5)",
                }}
              />
              <Typography sx={{ fontWeight: 800, fontSize: "14px", color: "#0f172a", letterSpacing: "0.01em" }}>
                Executive Summary
              </Typography>
              <Chip
                label={isAnomaly ? `⚠️ Tolerance Breached (${verifiedDevPct > 0 ? "+" : ""}${verifiedDevPct}% vs. ±10% Bound)` : "Within Normal Range"}
                size="small"
                sx={{
                  fontSize: "10px",
                  fontWeight: 800,
                  height: 20,
                  bgcolor: isAnomaly ? "#fee2e2" : "#dcfce7",
                  color: isAnomaly ? "#dc2626" : "#16a34a",
                  border: `1px solid ${isAnomaly ? "#fecaca" : "#bbf7d0"}`,
                }}
              />
            </Box>

            {/* Clean Metric Pills */}
            {(verifiedActual !== undefined && verifiedActual !== null) && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ px: 1.5, py: 0.5, bgcolor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                  <Typography sx={{ fontSize: "10px", color: "#64748b", fontWeight: 700 }}>ACTUAL</Typography>
                  <Typography sx={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                    {formatNumber(verifiedActual)}
                  </Typography>
                </Box>
                <Box sx={{ px: 1.5, py: 0.5, bgcolor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                  <Typography sx={{ fontSize: "10px", color: "#64748b", fontWeight: 700 }}>30D BASELINE</Typography>
                  <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "#64748b" }}>
                    {formatNumber(verifiedBaseline)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    bgcolor: isAnomaly ? "#fee2e2" : "#dcfce7",
                    border: `1px solid ${isAnomaly ? "#fecaca" : "#bbf7d0"}`,
                    borderRadius: "8px",
                  }}
                >
                  <Typography sx={{ fontSize: "10px", color: isAnomaly ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                    {isStalled ? "PIPELINE STATUS" : "DEVIATION"}
                  </Typography>
                  <Typography sx={{ fontSize: "14px", fontWeight: 800, color: isAnomaly ? "#dc2626" : "#16a34a" }}>
                    {isStalled ? "STALLED (0 REC)" : (verifiedDevPct > 0 ? `+${verifiedDevPct}%` : `${verifiedDevPct}%`)}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>

          {/* Narrative Body */}
          <Typography sx={{ fontSize: "13.5px", color: "#334155", lineHeight: 1.6, mb: 2 }}>
            {generateExecutiveStory()}
          </Typography>

          {/* Key Drivers Row */}
          <Box
            sx={{
              pt: 1.5,
              borderTop: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1.5,
            }}
          >
            <Typography sx={{ fontSize: "11px", fontWeight: 800, color: "#64748b" }}>KEY DRIVERS:</Typography>
            <Chip
              icon={<StorefrontIcon style={{ fontSize: 14 }} />}
              label={`Platform: ${platformName}${topPlatform?.share_pct !== undefined ? ` (${topPlatform.share_pct}% Share)` : ""}`}
              size="small"
              sx={{ bgcolor: "#ffffff", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: 600, color: "#1e293b" }}
            />
            <Chip
              icon={<LocationOnIcon style={{ fontSize: 14 }} />}
              label={`Location: ${locationName}${topCity?.osa !== undefined && metric === "osa" ? ` (OSA: ${topCity.osa}%)` : ""}`}
              size="small"
              sx={{
                bgcolor: (topCity?.osa !== undefined && topCity.osa < 70) ? "#fee2e2" : "#ffffff",
                border: `1px solid ${(topCity?.osa !== undefined && topCity.osa < 70) ? "#fecaca" : "#e2e8f0"}`,
                fontSize: "11px",
                fontWeight: 600,
                color: (topCity?.osa !== undefined && topCity.osa < 70) ? "#dc2626" : "#1e293b",
              }}
            />
            <Chip
              icon={<CategoryIcon style={{ fontSize: 14 }} />}
              label={`Category: ${categoryName}`}
              size="small"
              sx={{ bgcolor: "#ffffff", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: 600, color: "#1e293b" }}
            />
            <Chip
              icon={<Inventory2Icon style={{ fontSize: 14 }} />}
              label={`SKU: ${(skuName || '').slice(0, 24)}...`}
              size="small"
              sx={{ bgcolor: "#fee2e2", border: "1px solid #fecaca", fontSize: "11px", fontWeight: 700, color: "#dc2626" }}
            />
          </Box>
        </Card>
      </Box>

      {/* PILLAR 2: Clean 5-Step Hierarchy Cards (Replaces messy squished buttons) */}
      <Box sx={{ px: 2.5, py: 2, bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography sx={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", letterSpacing: "0.02em" }}>
            ROOT CAUSE HIERARCHY TRAIL
          </Typography>
          <Typography sx={{ fontSize: "11px", color: "#64748b" }}>
            Click any tier to view its detailed breakdown below
          </Typography>
        </Box>

        <Grid container spacing={1.5}>
          {/* Step 1: Platform */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              onClick={() => { setActiveTab(1); setDecompLevel("platform"); }}
              sx={{
                p: 1.5,
                bgcolor: decompLevel === "platform" && activeTab === 1 ? "#eff6ff" : "#ffffff",
                border: `1px solid ${decompLevel === "platform" && activeTab === 1 ? "#2563eb" : "#e2e8f0"}`,
                borderRadius: "10px",
                cursor: "pointer",
                boxShadow: decompLevel === "platform" && activeTab === 1 ? "0 0 0 1px #2563eb" : "0 1px 2px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "#2563eb" },
              }}
            >
              <Typography sx={{ fontSize: "10px", fontWeight: 800, color: "#2563eb", mb: 0.3 }}>
                1. PLATFORM
              </Typography>
              <Typography sx={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", mb: 0.8 }} noWrap>
                {platformName}
              </Typography>
              <Chip
                label={topPlatform?.share_pct !== undefined ? `${topPlatform.share_pct}% Share` : "Active Channel"}
                size="small"
                sx={{ height: 18, fontSize: "9px", fontWeight: 700, bgcolor: "#f1f5f9", color: "#475569" }}
              />
            </Card>
          </Grid>

          {/* Step 2: City / Location */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              onClick={() => { setActiveTab(1); setDecompLevel("city"); }}
              sx={{
                p: 1.5,
                bgcolor: decompLevel === "city" && activeTab === 1 ? "#eff6ff" : "#ffffff",
                border: `1px solid ${decompLevel === "city" && activeTab === 1 ? "#2563eb" : "#e2e8f0"}`,
                borderRadius: "10px",
                cursor: "pointer",
                boxShadow: decompLevel === "city" && activeTab === 1 ? "0 0 0 1px #2563eb" : "0 1px 2px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "#2563eb" },
              }}
            >
              <Typography sx={{ fontSize: "10px", fontWeight: 800, color: "#2563eb", mb: 0.3 }}>
                2. LOCATION
              </Typography>
              <Typography sx={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", mb: 0.8 }} noWrap>
                {locationName}
              </Typography>
              <Chip
                label={topCity?.osa !== undefined && metric === "osa" ? `OSA: ${topCity.osa}%` : (topCity?.share_pct !== undefined ? `${topCity.share_pct}% Share` : "Active Hub")}
                size="small"
                sx={{
                  height: 18,
                  fontSize: "9px",
                  fontWeight: 700,
                  bgcolor: (topCity?.osa !== undefined && topCity.osa < 70) ? "#fee2e2" : "#dcfce7",
                  color: (topCity?.osa !== undefined && topCity.osa < 70) ? "#dc2626" : "#16a34a",
                }}
              />
            </Card>
          </Grid>

          {/* Step 3: Brand */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              onClick={() => { setActiveTab(1); setDecompLevel("brand"); }}
              sx={{
                p: 1.5,
                bgcolor: decompLevel === "brand" && activeTab === 1 ? "#eff6ff" : "#ffffff",
                border: `1px solid ${decompLevel === "brand" && activeTab === 1 ? "#2563eb" : "#e2e8f0"}`,
                borderRadius: "10px",
                cursor: "pointer",
                boxShadow: decompLevel === "brand" && activeTab === 1 ? "0 0 0 1px #2563eb" : "0 1px 2px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "#2563eb" },
              }}
            >
              <Typography sx={{ fontSize: "10px", fontWeight: 800, color: "#2563eb", mb: 0.3 }}>
                3. BRAND
              </Typography>
              <Typography sx={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", mb: 0.8 }} noWrap>
                {clientName}
              </Typography>
              <Chip
                label="Own Brand"
                size="small"
                sx={{ height: 18, fontSize: "9px", fontWeight: 700, bgcolor: "#dbeafe", color: "#1e40af" }}
              />
            </Card>
          </Grid>

          {/* Step 4: Category */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              onClick={() => { setActiveTab(1); setDecompLevel("category"); }}
              sx={{
                p: 1.5,
                bgcolor: decompLevel === "category" && activeTab === 1 ? "#eff6ff" : "#ffffff",
                border: `1px solid ${decompLevel === "category" && activeTab === 1 ? "#2563eb" : "#e2e8f0"}`,
                borderRadius: "10px",
                cursor: "pointer",
                boxShadow: decompLevel === "category" && activeTab === 1 ? "0 0 0 1px #2563eb" : "0 1px 2px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "#2563eb" },
              }}
            >
              <Typography sx={{ fontSize: "10px", fontWeight: 800, color: "#2563eb", mb: 0.3 }}>
                4. CATEGORY
              </Typography>
              <Typography sx={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", mb: 0.8 }} noWrap>
                {categoryName}
              </Typography>
              <Chip
                label={topCategory?.osa !== undefined && metric === "osa" ? `OSA: ${topCategory.osa}%` : "Primary Segment"}
                size="small"
                sx={{ height: 18, fontSize: "9px", fontWeight: 700, bgcolor: "#f1f5f9", color: "#475569" }}
              />
            </Card>
          </Grid>

          {/* Step 5: Culprit SKU */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              onClick={() => { setActiveTab(1); setDecompLevel("sku"); }}
              sx={{
                p: 1.5,
                bgcolor: decompLevel === "sku" && activeTab === 1 ? "#fee2e2" : "#ffffff",
                border: `1px solid ${decompLevel === "sku" && activeTab === 1 ? "#dc2626" : "#e2e8f0"}`,
                borderRadius: "10px",
                cursor: "pointer",
                boxShadow: decompLevel === "sku" && activeTab === 1 ? "0 0 0 1px #dc2626" : "0 1px 2px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "#dc2626" },
              }}
            >
              <Typography sx={{ fontSize: "10px", fontWeight: 800, color: "#dc2626", mb: 0.3 }}>
                5. CULPRIT SKU
              </Typography>
              <Typography sx={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", mb: 0.8 }} noWrap>
                {skuName}
              </Typography>
              <Chip
                label={skuPid || "Hero SKU"}
                size="small"
                sx={{ height: 18, fontSize: "9px", fontFamily: "monospace", bgcolor: "#fee2e2", color: "#dc2626" }}
              />
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* PILLAR 3: Plain-Language Business Glossary Drawer/Banner (Collapsible) */}
      {showGlossary && (
        <Box
          sx={{
            px: 3,
            py: 2,
            bgcolor: "#f1f5f9",
            borderBottom: "1px solid #cbd5e1",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <MenuBookIcon sx={{ color: "#2563eb", fontSize: 20 }} />
              <Typography sx={{ fontWeight: 800, fontSize: "13px", color: "#0f172a" }}>
                PLAIN-LANGUAGE BUSINESS GLOSSARY (WHAT DO THESE METRICS MEAN?)
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setShowGlossary(false)} sx={{ color: "#64748b" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Grid container spacing={2}>
            {Object.entries(GLOSSARY).map(([key, item]) => (
              <Grid item xs={12} sm={6} md={4} key={key}>
                <Card sx={{ bgcolor: "#ffffff", p: 1.5, borderRadius: "8px", height: "100%", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                  <Typography sx={{ fontSize: "12px", fontWeight: 800, color: "#2563eb", mb: 0.5 }}>
                    {item.term}
                  </Typography>
                  <Typography sx={{ fontSize: "11px", color: "#475569", lineHeight: 1.4 }}>
                    {item.plain}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Main Tabs Navigation */}
      <Box sx={{ borderBottom: "1px solid #e2e8f0", px: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          textColor="inherit"
          indicatorColor="primary"
          sx={{
            "& .MuiTab-root": {
              textTransform: "none",
              fontSize: "13px",
              fontWeight: 700,
              minWidth: 120,
              color: "#64748b",
              "&.Mui-selected": { color: "#2563eb" },
            },
            "& .MuiTabs-indicator": { bgcolor: "#2563eb" },
          }}
        >
          <Tab icon={<TimelineIcon fontSize="small" />} iconPosition="start" label="Time Series & ±10% Bounds" />
          <Tab icon={<LayersIcon fontSize="small" />} iconPosition="start" label="5-Level Granular Breakdown" />
          <Tab icon={<LightbulbIcon fontSize="small" />} iconPosition="start" label="Role-Based Action Playbook" />
          <Tab icon={<CompareArrowsIcon fontSize="small" />} iconPosition="start" label="3-Way Consistency Check" />
        </Tabs>
      </Box>

      {/* Content Area */}
      <Box sx={{ p: 3, overflowY: "auto", flexGrow: 1, bgcolor: "#ffffff" }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress sx={{ color: "#2563eb" }} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2, bgcolor: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }}>
            {error}
          </Alert>
        )}

        {/* TAB 0: Time Series Corridor & 2-Hour Pulse History */}
        {!loading && activeTab === 0 && (
          <Box>
            {/* IDEA 2: Interactive 2-Hour Sentinel Heartbeat Strip */}
            <Box
              sx={{
                mb: 2.5,
                p: 2,
                bgcolor: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "#16a34a",
                      boxShadow: "0 0 8px rgba(22, 163, 74, 0.6)",
                    }}
                  />
                  <Typography sx={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", letterSpacing: "0.02em" }}>
                    2-HOUR SENTINEL PULSE HEARTBEAT (LAST 24 HOURS)
                  </Typography>
                  <Chip
                    label="Stage 1 Verified"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "9px",
                      fontWeight: 700,
                      bgcolor: "#dcfce7",
                      color: "#16a34a",
                      border: "1px solid #bbf7d0",
                    }}
                  />
                </Box>
                <Typography sx={{ fontSize: "11px", color: "#64748b" }}>
                  Next Scheduled Pulse: <strong style={{ color: "#2563eb" }}>{chartData?.next_pulse_time || "14:00"}</strong> (Runs Every 2 Hours)
                </Typography>
              </Box>

              {/* Horizontal Flex Strip of 12 Two-Hour Checkpoints */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, overflowX: "auto", pb: 0.5, pt: 0.2 }}>
                {(chartData?.pulses || []).map((p) => {
                  const isAnom = p.status === "ANOMALY";
                  const isSel = selectedPulse?.id === p.id;
                  const isCur = p.is_current;
                  return (
                    <Tooltip
                      key={p.id}
                      arrow
                      title={
                        <Box sx={{ p: 0.8, fontSize: "11px" }}>
                          <Typography sx={{ fontWeight: 800, fontSize: "12px", mb: 0.3, color: isAnom ? "#f87171" : "#4ade80" }}>
                            {p.full_label} {isCur && "• (Latest Pulse)"}
                          </Typography>
                          <div>Status: <strong>{isAnom ? "ANOMALY DETECTED (>10% dev)" : "100% HEALTHY (Normal)"}</strong></div>
                          <div>Stage 1: Verified (API == Logic == Live UI)</div>
                          <div>Variance vs 30D Baseline: <strong>{p.deviation_pct > 0 ? `+${p.deviation_pct}%` : `${p.deviation_pct}%`}</strong></div>
                          <div>Tested Value: {formatNumber(p.actual)} | Baseline: {formatNumber(p.baseline)}</div>
                          <div style={{ marginTop: "4px", fontSize: "10px", color: "#94a3b8" }}>
                            Click to focus on this 2-hour checkpoint
                          </div>
                        </Box>
                      }
                    >
                      <Box
                        onClick={() => {
                          setSelectedPulse(p);
                          setViewMode("2hour");
                        }}
                        sx={{
                          flex: "1 0 auto",
                          minWidth: 62,
                          py: 0.8,
                          px: 1,
                          textAlign: "center",
                          borderRadius: "10px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          bgcolor: isSel
                            ? (isAnom ? "#fee2e2" : "#eff6ff")
                            : (isCur ? (isAnom ? "#fff1f2" : "#f0fdf4") : "#f8fafc"),
                          border: isSel
                            ? `2px solid ${isAnom ? "#dc2626" : "#2563eb"}`
                            : (isCur ? `1.5px solid ${isAnom ? "#f87171" : "#86efac"}` : "1px solid #e2e8f0"),
                          boxShadow: isSel ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                          "&:hover": {
                            borderColor: isAnom ? "#dc2626" : "#2563eb",
                            transform: "translateY(-1px)",
                          },
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0.5, mb: 0.2 }}>
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              bgcolor: isAnom ? "#dc2626" : "#16a34a",
                            }}
                          />
                          <Typography
                            sx={{
                              fontSize: "11px",
                              fontWeight: 800,
                              color: isSel ? (isAnom ? "#dc2626" : "#2563eb") : "#0f172a",
                            }}
                          >
                            {p.time}
                          </Typography>
                        </Box>
                        <Typography
                          sx={{
                            fontSize: "9px",
                            fontWeight: 700,
                            color: isAnom ? "#dc2626" : "#16a34a",
                          }}
                        >
                          {p.deviation_pct > 0 ? `+${p.deviation_pct}%` : `${p.deviation_pct}%`}
                        </Typography>
                        {isCur && (
                          <Chip
                            label="NOW"
                            size="small"
                            sx={{
                              height: 13,
                              fontSize: "7.5px",
                              fontWeight: 900,
                              mt: 0.2,
                              bgcolor: isAnom ? "#dc2626" : "#16a34a",
                              color: "#ffffff",
                              borderRadius: "3px",
                            }}
                          />
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>

            {/* Chart Subtitle Header */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Typography sx={{ fontSize: "12.5px", color: "#64748b" }}>
                {viewMode === "2hour" ? (
                  <>
                    Showing <strong style={{ color: "#2563eb" }}>2-Hour Sentinel Pulse Checkpoints</strong> over the last 24 hours.
                    Each dot represents an isolated, <strong>Stage 1 verified</strong> check (API == Logic == Live UI) within the strict ±10% steady-state boundary.
                  </>
                ) : (
                  <>
                    Showing <strong style={{ color: "#2563eb" }}>Daily Baseline Trend</strong>.
                    The shaded corridor illustrates the strict <strong>±10% steady-state boundary</strong> derived from the ClickHouse rolling baseline.
                  </>
                )}
              </Typography>
            </Box>

            {/* IDEA 1: Main Dual-Mode Chart (Daily vs 2-Hour) */}
            <Box sx={{ height: isExpanded ? 460 : 340, width: "100%", bgcolor: "#ffffff", p: 2, borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => (viewMode === "2hour" ? val : (val && val.length > 5 ? val.slice(5) : val))}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(val) => {
                      if (metric === "osa") return `${val}%`;
                      if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
                      if (val >= 100000) return `${(val / 100000).toFixed(0)}L`;
                      return val;
                    }}
                  />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <Box
                            sx={{
                              bgcolor: "#ffffff",
                              border: "1px solid #cbd5e1",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                              p: 1.5,
                              borderRadius: "8px",
                              color: "#0f172a",
                              fontSize: "12px",
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                              <Typography sx={{ fontWeight: 800, color: "#2563eb" }}>
                                {d.full_date || d.date}
                              </Typography>
                              {viewMode === "2hour" && (
                                <Chip label="2-Hour Pulse" size="small" sx={{ height: 16, fontSize: "8.5px", fontWeight: 700, bgcolor: "#eff6ff", color: "#2563eb" }} />
                              )}
                            </Box>
                            <div>{viewMode === "2hour" ? "Tested Actual: " : "Daily Actual: "}<strong>{formatNumber(d.actual)}</strong></div>
                            <div>{viewMode === "2hour" ? "Hourly Baseline: " : "Rolling Baseline: "}{formatNumber(d.baseline)}</div>
                            <div style={{ color: "#64748b", fontSize: "11px" }}>
                              Upper (+10%): {formatNumber(d.upper_bound)}
                            </div>
                            <div style={{ color: "#64748b", fontSize: "11px" }}>
                              Lower (-10%): {formatNumber(d.lower_bound)}
                            </div>
                            <div
                              style={{
                                marginTop: "6px",
                                fontWeight: 700,
                                color: d.is_anomaly ? "#dc2626" : "#16a34a",
                              }}
                            >
                              Deviation: {d.deviation_pct > 0 ? `+${d.deviation_pct}%` : `${d.deviation_pct}%`}{" "}
                              {d.is_anomaly ? "(BREACH)" : "(WITHIN BOUNDS)"}
                            </div>
                            {viewMode === "2hour" && (
                              <div style={{ marginTop: "4px", fontSize: "10.5px", color: "#16a34a", fontWeight: 600 }}>
                                ✓ Stage 1 Verified (API == Logic == Live UI)
                              </div>
                            )}
                          </Box>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="upper_bound"
                    stroke="none"
                    fill="rgba(37, 99, 235, 0.08)"
                    name="Safe Corridor (+10%)"
                  />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    name={viewMode === "2hour" ? "Hourly Baseline" : "Rolling Baseline"}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={(props) => {
                      if (!props || !props.payload) return null;
                      const { cx, cy, payload } = props;
                      const isSel = selectedPulse && (payload?.time === selectedPulse?.time || payload?.date === selectedPulse?.full_label);
                      if (payload?.is_anomaly) {
                        return (
                          <circle
                            key={payload.date}
                            cx={cx}
                            cy={cy}
                            r={isSel ? 7 : 5}
                            fill="#dc2626"
                            stroke={isSel ? "#991b1b" : "#ffffff"}
                            strokeWidth={isSel ? 3 : 2}
                          />
                        );
                      }
                      return (
                        <circle
                          key={payload.date}
                          cx={cx}
                          cy={cy}
                          r={isSel ? 6 : 3}
                          fill={isSel ? "#1d4ed8" : "#2563eb"}
                          stroke={isSel ? "#ffffff" : "none"}
                          strokeWidth={isSel ? 2 : 0}
                        />
                      );
                    }}
                    name={viewMode === "2hour" ? "2-Hour Verified Actual" : "Daily Actual"}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        )}

        {/* TAB 1: 5-Level Granular Breakdown */}
        {!loading && activeTab === 1 && (
          <Box>
            {/* Live Dashboard KPI Filter Chips */}
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.75 }}>
                Filter / Focus Multi-Dimensional KPI Across All 5 Breakdown Levels:
              </Typography>
              <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 0.75, alignItems: "center" }}>
                {ALL_KPIS.map((kpi) => {
                  const effectiveKey = selectedKpiFilter || metric;
                  const isSelected = effectiveKey === kpi.key;
                  return (
                    <Chip
                      key={kpi.key}
                      label={kpi.label}
                      size="small"
                      clickable
                      onClick={() => setSelectedKpiFilter(selectedKpiFilter === kpi.key ? null : kpi.key)}
                      sx={{
                        fontSize: "11px",
                        fontWeight: isSelected ? 800 : 600,
                        bgcolor: isSelected ? "#2563eb" : "#f8fafc",
                        color: isSelected ? "#ffffff" : "#475569",
                        border: `1px solid ${isSelected ? "#1d4ed8" : "#cbd5e1"}`,
                        borderRadius: "6px",
                        cursor: "pointer",
                        "&:hover": { bgcolor: isSelected ? "#1d4ed8" : "#e2e8f0" },
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            {/* 5-Level Navigation Tabs */}
            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
              {[
                { id: "platform", label: "Level 1: Platform" },
                { id: "city", label: "Level 2: City / Location" },
                { id: "brand", label: "Level 3: Brand" },
                { id: "category", label: "Level 4: Category" },
                { id: "sku", label: "Level 5: SKU Culprits" },
              ].map((lvl) => (
                <Button
                  key={lvl.id}
                  size="small"
                  onClick={() => setDecompLevel(lvl.id)}
                  sx={{
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "none",
                    borderRadius: "8px",
                    px: 1.5,
                    bgcolor: decompLevel === lvl.id ? "#eff6ff" : "#f8fafc",
                    color: decompLevel === lvl.id ? "#1d4ed8" : "#475569",
                    border: `1px solid ${decompLevel === lvl.id ? "#3b82f6" : "#e2e8f0"}`,
                    "&:hover": { bgcolor: "#eff6ff" },
                  }}
                >
                  {lvl.label}
                </Button>
              ))}
            </Box>

            {/* Level 1: Platform */}
            {decompLevel === "platform" && (
              <Box>
                <Typography sx={{ fontSize: "13px", color: "#64748b", mb: 1.5 }}>
                  Cross-platform volume & availability distribution ({decomp.level1_platforms?.length || 0} Platforms present on Live Dashboard).
                </Typography>
                <TableContainer component={Paper} sx={{ bgcolor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", maxHeight: 440, overflowY: "auto" }}>
                  <Table size="small" stickyHeader>
                    <TableHead sx={{ bgcolor: "#f1f5f9" }}>
                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Platform</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "offtakes" ? "#2563eb" : "#334155", fontWeight: 700 }}>Sales Contribution</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "qty_sold" ? "#2563eb" : "#334155", fontWeight: 700 }}>Volume (Units)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "osa" ? "#2563eb" : "#334155", fontWeight: 700 }}>OSA (%)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "wt_osa" ? "#2563eb" : "#334155", fontWeight: 700 }}>Weighted OSA (%)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "asp_ppu" ? "#2563eb" : "#334155", fontWeight: 700 }}>ASP (₹)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "discount" ? "#2563eb" : "#334155", fontWeight: 700 }}>Discount (%)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "ad_spend" ? "#2563eb" : "#334155", fontWeight: 700 }}>Spend (₹)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "roas" ? "#2563eb" : "#334155", fontWeight: 700 }}>ROAS (x)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "sos" ? "#2563eb" : "#334155", fontWeight: 700 }}>Share of Search (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Share (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level1_platforms || []).map((p) => {
                        const isTargetAnomaly = detectedPlatform && (p.raw_name?.toLowerCase() === detectedPlatform.toLowerCase() || p.name?.toLowerCase().includes(detectedPlatform.toLowerCase()));
                        const isBreach = p.is_breach !== undefined ? p.is_breach : (p.osa < 70);
                        const curMetric = selectedKpiFilter || metric;
                        return (
                          <TableRow key={p.name} sx={{ bgcolor: isTargetAnomaly || isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isTargetAnomaly ? "#dc2626" : "#2563eb", fontWeight: 800, textTransform: "capitalize" }}>
                              {formatPlatform(p.name)}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "offtakes" ? 800 : 500 }}>
                              {formatNumber(p.sales, "offtakes")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace", fontWeight: curMetric === "qty_sold" ? 800 : 400 }}>
                              {formatNumber(p.qty, "qty_sold")}
                            </TableCell>
                            <TableCell sx={{ color: (p.osa !== undefined && p.osa < 70) ? "#dc2626" : "#16a34a", fontWeight: curMetric === "osa" ? 800 : 700 }}>
                              {p.osa !== undefined && p.osa !== null ? `${p.osa}%` : "—"}
                            </TableCell>
                            <TableCell sx={{ color: (p.wt_osa !== undefined && p.wt_osa < 70) ? "#dc2626" : "#16a34a", fontWeight: curMetric === "wt_osa" ? 800 : 600 }}>
                              {p.wt_osa !== undefined && p.wt_osa !== null ? `${p.wt_osa}%` : "—"}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "asp_ppu" ? 800 : 400 }}>
                              {formatNumber(p.asp, "asp_ppu")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontWeight: curMetric === "discount" ? 800 : 400 }}>
                              {p.discount !== undefined && p.discount !== null ? `${p.discount}%` : "—"}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace", fontWeight: curMetric === "ad_spend" ? 800 : 400 }}>
                              {formatNumber(p.spend, "ad_spend")}
                            </TableCell>
                            <TableCell sx={{ color: (p.roas !== undefined && p.roas < 2.0 && p.roas > 0) ? "#dc2626" : "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "roas" ? 800 : 600 }}>
                              {p.roas !== undefined && p.roas !== null ? `${p.roas}x` : "—"}
                            </TableCell>
                            <TableCell sx={{ color: (p.sos !== undefined && p.sos < 5.0 && p.sos > 0) ? "#dc2626" : "#475569", fontWeight: curMetric === "sos" ? 800 : 400 }}>
                              {p.sos !== undefined && p.sos !== null ? `${p.sos}%` : "—"}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontWeight: 600 }}>{p.share_pct}%</TableCell>
                            <TableCell>
                              {isTargetAnomaly ? (
                                <Chip label="ANOMALY DETECTED (TARGET)" size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : p.status_label ? (
                                <Chip label={p.status_label} size="small" sx={{ bgcolor: isBreach ? "#fef2f2" : "#f0fdf4", color: isBreach ? "#b91c1c" : "#16a34a", fontWeight: 700, fontSize: "10px" }} />
                              ) : isBreach ? (
                                <Chip label={`ANOMALY DETECTED: (${p.osa}%)`} size="small" sx={{ bgcolor: "#fef2f2", color: "#b91c1c", fontWeight: 700, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Level 2: City */}
            {decompLevel === "city" && (
              <Box>
                <Typography sx={{ fontSize: "13px", color: "#64748b", mb: 1.5 }}>
                  Geographical performance across all {decomp.level2_cities?.length || 0} active locations present on live dashboard.
                </Typography>
                <TableContainer component={Paper} sx={{ bgcolor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", maxHeight: 440, overflowY: "auto" }}>
                  <Table size="small" stickyHeader>
                    <TableHead sx={{ bgcolor: "#f1f5f9" }}>
                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>City / Location</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "offtakes" ? "#2563eb" : "#334155", fontWeight: 700 }}>Sales Contribution</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "qty_sold" ? "#2563eb" : "#334155", fontWeight: 700 }}>Volume (Units)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "osa" ? "#2563eb" : "#334155", fontWeight: 700 }}>OSA (%)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "asp_ppu" ? "#2563eb" : "#334155", fontWeight: 700 }}>ASP (₹)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "discount" ? "#2563eb" : "#334155", fontWeight: 700 }}>Discount (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Share (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level2_cities || []).map((c) => {
                        const isBreach = c.is_breach !== undefined ? c.is_breach : (c.osa < 70);
                        const curMetric = selectedKpiFilter || metric;
                        return (
                          <TableRow key={c.name} sx={{ bgcolor: isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#0f172a", fontWeight: 700, textTransform: "capitalize" }}>
                              {formatLocation(c.name)}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "offtakes" ? 800 : 500 }}>
                              {formatNumber(c.sales, "offtakes")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace", fontWeight: curMetric === "qty_sold" ? 800 : 400 }}>
                              {formatNumber(c.qty, "qty_sold")}
                            </TableCell>
                            <TableCell sx={{ color: (c.osa !== undefined && c.osa < 70) ? "#dc2626" : "#16a34a", fontWeight: curMetric === "osa" ? 800 : 700 }}>
                              {c.osa !== undefined && c.osa !== null ? `${c.osa}%` : "—"}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "asp_ppu" ? 800 : 400 }}>
                              {formatNumber(c.asp, "asp_ppu")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontWeight: curMetric === "discount" ? 800 : 400 }}>
                              {c.discount !== undefined && c.discount !== null ? `${c.discount}%` : "—"}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontWeight: 600 }}>{c.share_pct}%</TableCell>
                            <TableCell>
                              {c.status_label ? (
                                <Chip label={c.status_label} size="small" sx={{ bgcolor: isBreach ? "#fee2e2" : "#f0fdf4", color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 800, fontSize: "10px" }} />
                              ) : isBreach ? (
                                <Chip label={`ANOMALY DETECTED: (${c.osa}%)`} size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Level 3: Brand */}
            {decompLevel === "brand" && (
              <Box>
                <Typography sx={{ fontSize: "13px", color: "#64748b", mb: 1.5 }}>
                  Own Brand performance benchmarked against all {decomp.level3_brands?.length || 0} Category Competitors on live dashboard.
                </Typography>
                <TableContainer component={Paper} sx={{ bgcolor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", maxHeight: 440, overflowY: "auto" }}>
                  <Table size="small" stickyHeader>
                    <TableHead sx={{ bgcolor: "#f1f5f9" }}>
                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Brand</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Classification</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "offtakes" ? "#2563eb" : "#334155", fontWeight: 700 }}>Portfolio Sales</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "qty_sold" ? "#2563eb" : "#334155", fontWeight: 700 }}>Units Sold</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "osa" ? "#2563eb" : "#334155", fontWeight: 700 }}>OSA (%)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "asp_ppu" ? "#2563eb" : "#334155", fontWeight: 700 }}>ASP (₹)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "discount" ? "#2563eb" : "#334155", fontWeight: 700 }}>Discount (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level3_brands || []).map((b) => {
                        const curMetric = selectedKpiFilter || metric;
                        return (
                          <TableRow key={b.name}>
                            <TableCell sx={{ color: "#0f172a", fontWeight: 700 }}>{b.name}</TableCell>
                            <TableCell>
                              <Chip
                                label={b.type}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: "10px",
                                  bgcolor: b.type === "Own Brand" ? "#dbeafe" : "#f1f5f9",
                                  color: b.type === "Own Brand" ? "#1e40af" : "#475569",
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "offtakes" ? 800 : 500 }}>
                              {formatNumber(b.sales, "offtakes")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace", fontWeight: curMetric === "qty_sold" ? 800 : 400 }}>
                              {formatNumber(b.qty, "qty_sold")}
                            </TableCell>
                            <TableCell sx={{ color: (b.osa !== undefined && b.osa < 70) ? "#dc2626" : "#16a34a", fontWeight: curMetric === "osa" ? 800 : 700 }}>
                              {b.osa !== undefined && b.osa !== null ? `${b.osa}%` : "—"}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "asp_ppu" ? 800 : 400 }}>
                              {formatNumber(b.asp, "asp_ppu")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontWeight: curMetric === "discount" ? 800 : 400 }}>
                              {b.discount !== undefined && b.discount !== null ? `${b.discount}%` : "—"}
                            </TableCell>
                            <TableCell>
                              {b.is_breach ? (
                                <Chip label="ANOMALY DETECTED" size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : b.type === "Own Brand" ? (
                                <Chip label="OWN BRAND DRIVER" size="small" sx={{ bgcolor: "#dbeafe", color: "#1e40af", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="BENCHMARK COMPETITOR" size="small" sx={{ bgcolor: "#f1f5f9", color: "#64748b", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Level 4: Category */}
            {decompLevel === "category" && (
              <Box>
                <Typography sx={{ fontSize: "13px", color: "#64748b", mb: 1.5 }}>
                  All {decomp.level4_categories?.length || 0} categories present on live dashboard to isolate product line anomalies.
                </Typography>
                <TableContainer component={Paper} sx={{ bgcolor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", maxHeight: 440, overflowY: "auto" }}>
                  <Table size="small" stickyHeader>
                    <TableHead sx={{ bgcolor: "#f1f5f9" }}>
                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Category</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "offtakes" ? "#2563eb" : "#334155", fontWeight: 700 }}>Category Sales</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "qty_sold" ? "#2563eb" : "#334155", fontWeight: 700 }}>Units Sold</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "osa" ? "#2563eb" : "#334155", fontWeight: 700 }}>OSA (%)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "asp_ppu" ? "#2563eb" : "#334155", fontWeight: 700 }}>ASP (₹)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "discount" ? "#2563eb" : "#334155", fontWeight: 700 }}>Discount (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level4_categories || []).map((cat) => {
                        const isBreach = cat.is_breach !== undefined ? cat.is_breach : (cat.osa < 70);
                        const curMetric = selectedKpiFilter || metric;
                        return (
                          <TableRow key={cat.name} sx={{ bgcolor: isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#0f172a", fontWeight: 700 }}>{formatCategory(cat.name)}</TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "offtakes" ? 800 : 500 }}>
                              {formatNumber(cat.sales, "offtakes")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace", fontWeight: curMetric === "qty_sold" ? 800 : 400 }}>
                              {formatNumber(cat.qty, "qty_sold")}
                            </TableCell>
                            <TableCell sx={{ color: (cat.osa !== undefined && cat.osa < 70) ? "#dc2626" : "#16a34a", fontWeight: curMetric === "osa" ? 800 : 700 }}>
                              {cat.osa !== undefined && cat.osa !== null ? `${cat.osa}%` : "—"}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "asp_ppu" ? 800 : 400 }}>
                              {formatNumber(cat.asp, "asp_ppu")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontWeight: curMetric === "discount" ? 800 : 400 }}>
                              {cat.discount !== undefined && cat.discount !== null ? `${cat.discount}%` : "—"}
                            </TableCell>
                            <TableCell>
                              {cat.status_label ? (
                                <Chip label={cat.status_label} size="small" sx={{ bgcolor: isBreach ? "#fee2e2" : "#f0fdf4", color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 800, fontSize: "10px" }} />
                              ) : isBreach ? (
                                <Chip label={`ANOMALY DETECTED: (${cat.osa}%)`} size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Level 5: SKU Culprits */}
            {decompLevel === "sku" && (
              <Box>
                <Typography sx={{ fontSize: "13px", color: "#64748b", mb: 1.5 }}>
                  All {decomp.level5_skus?.length || 0} SKU listings present on live dashboard ranked by commercial impact.
                </Typography>
                <TableContainer component={Paper} sx={{ bgcolor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", maxHeight: 440, overflowY: "auto" }}>
                  <Table size="small" stickyHeader>
                    <TableHead sx={{ bgcolor: "#f1f5f9" }}>
                      <TableRow>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Product / SKU</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Web_Pid</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Platform</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "offtakes" ? "#2563eb" : "#334155", fontWeight: 700 }}>SKU Sales</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "qty_sold" ? "#2563eb" : "#334155", fontWeight: 700 }}>Units Sold</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "osa" ? "#2563eb" : "#334155", fontWeight: 700 }}>OSA (%)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "asp_ppu" ? "#2563eb" : "#334155", fontWeight: 700 }}>ASP (₹)</TableCell>
                        <TableCell sx={{ color: (selectedKpiFilter || metric) === "discount" ? "#2563eb" : "#334155", fontWeight: 700 }}>Discount (%)</TableCell>
                        <TableCell sx={{ color: "#334155", fontWeight: 700 }}>Anomaly Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(decomp.level5_skus || []).map((sku) => {
                        const isBreach = sku.is_breach !== undefined ? sku.is_breach : (sku.osa < 70);
                        const curMetric = selectedKpiFilter || metric;
                        return (
                          <TableRow key={sku.pid} sx={{ bgcolor: isBreach ? "#fff1f2" : "inherit" }}>
                            <TableCell sx={{ color: isBreach ? "#dc2626" : "#0f172a", fontWeight: 700, fontSize: "12px" }}>
                              {sku.product}
                            </TableCell>
                            <TableCell sx={{ color: "#64748b", fontFamily: "monospace", fontSize: "11px" }}>
                              {sku.pid}
                            </TableCell>
                            <TableCell sx={{ color: "#2563eb", textTransform: "capitalize", fontSize: "11px" }}>
                              {formatPlatform(sku.platform)}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "offtakes" ? 800 : 500 }}>
                              {formatNumber(sku.sales, "offtakes")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontFamily: "monospace", fontWeight: curMetric === "qty_sold" ? 800 : 400 }}>
                              {formatNumber(sku.qty, "qty_sold")}
                            </TableCell>
                            <TableCell sx={{ color: (sku.osa !== undefined && sku.osa < 70) ? "#dc2626" : "#16a34a", fontWeight: curMetric === "osa" ? 800 : 700 }}>
                              {sku.osa !== undefined && sku.osa !== null ? `${sku.osa}%` : "—"}
                            </TableCell>
                            <TableCell sx={{ color: "#0f172a", fontFamily: "monospace", fontWeight: curMetric === "asp_ppu" ? 800 : 400 }}>
                              {formatNumber(sku.asp, "asp_ppu")}
                            </TableCell>
                            <TableCell sx={{ color: "#475569", fontWeight: curMetric === "discount" ? 800 : 400 }}>
                              {sku.discount !== undefined && sku.discount !== null ? `${sku.discount}%` : "—"}
                            </TableCell>
                            <TableCell>
                              {sku.status_label ? (
                                <Chip label={sku.status_label} size="small" sx={{ bgcolor: isBreach ? "#fee2e2" : "#f0fdf4", color: isBreach ? "#dc2626" : "#16a34a", fontWeight: 800, fontSize: "10px" }} />
                              ) : isBreach ? (
                                <Chip label={`ANOMALY DETECTED: (${sku.osa}%)`} size="small" sx={{ bgcolor: "#fee2e2", color: "#dc2626", fontWeight: 800, fontSize: "10px" }} />
                              ) : (
                                <Chip label="NORMAL" size="small" sx={{ bgcolor: "#f0fdf4", color: "#16a34a", fontWeight: 600, fontSize: "10px" }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Box>
        )}

        {/* TAB 2: PILLAR 4 Role-Based Action Playbook */}
        {!loading && activeTab === 2 && (
          <Box>
            <Typography sx={{ fontSize: "13px", color: "#64748b", mb: 2 }}>
              Immediate, role-based operational action items. Assign tasks directly to relevant departments:
            </Typography>

            <Grid container spacing={2}>
              {playbook.map((step, idx) => (
                <Grid item xs={12} md={isExpanded ? 6 : 12} key={idx}>
                  <Card
                    sx={{
                      bgcolor: "#ffffff",
                      border: `1px solid #e2e8f0`,
                      borderLeft: `4px solid ${step.badgeColor}`,
                      borderRadius: "12px",
                      p: 2,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      height: "100%",
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        {step.icon}
                        <Typography sx={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>
                          {step.role}
                        </Typography>
                      </Box>
                      <Chip
                        label={step.priority}
                        size="small"
                        sx={{
                          fontSize: "10px",
                          fontWeight: 800,
                          bgcolor: step.bgColor,
                          color: step.badgeColor,
                          border: `1px solid ${step.badgeColor}40`,
                        }}
                      />
                    </Box>

                    <Typography sx={{ fontSize: "13px", color: "#334155", lineHeight: 1.5 }}>
                      {step.action}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* TAB 3: 3-Way Consistency Comparison */}
        {!loading && activeTab === 3 && (
          <Box>
            <Typography sx={{ fontSize: "13px", color: "#64748b", mb: 2 }}>
              Side-by-side consistency check across API Response, ClickHouse OLAP Logic, and Scraped UI.
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Card sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography sx={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>STEP 1: API</Typography>
                    <Typography sx={{ fontSize: "20px", fontWeight: 800, color: "#2563eb", my: 0.5 }}>
                      {(anomalyData?.api ?? apiValue) !== null && (anomalyData?.api ?? apiValue) !== undefined ? (anomalyData?.api ?? apiValue) : "—"}
                    </Typography>
                    <Typography sx={{ fontSize: "11px", color: "#94a3b8" }}>Direct Express Backend</Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={4}>
                <Card sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography sx={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>STEP 2: LOGIC</Typography>
                    <Typography sx={{ fontSize: "20px", fontWeight: 800, color: "#16a34a", my: 0.5 }}>
                      {(anomalyData?.logic ?? logicValue) !== null && (anomalyData?.logic ?? logicValue) !== undefined ? (anomalyData?.logic ?? logicValue) : "—"}
                    </Typography>
                    <Typography sx={{ fontSize: "11px", color: "#94a3b8" }}>ClickHouse Fast OLAP</Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={4}>
                <Card sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography sx={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>STEP 3: LIVE UI</Typography>
                    <Typography sx={{ fontSize: "20px", fontWeight: 800, color: "#d97706", my: 0.5 }}>
                      {(anomalyData?.ui ?? uiValue) !== null && (anomalyData?.ui ?? uiValue) !== undefined ? (anomalyData?.ui ?? uiValue) : "—"}
                    </Typography>
                    <Typography sx={{ fontSize: "11px", color: "#94a3b8" }}>Selenium Scraped Screen</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Alert
              severity="info"
              sx={{
                mt: 3,
                bgcolor: "#eff6ff",
                color: "#1e40af",
                border: "1px solid #bfdbfe",
              }}
            >
              All three verification steps enforce the strict <strong>≤ 10% maximum tolerance rule</strong>.
              When all three agree within 10%, the verification state is marked <strong>PASS</strong>.
            </Alert>
          </Box>
        )}
      </Box>

      {/* Assign Anomaly Outlook Email Modal */}
      <AssignAnomalyEmailModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        client={client}
        selectedAnomaly={
          anomalyData
            ? {
              ...anomalyData,
              id: anomalyData.id || `${client}_${kpiKey}_sentinel`,
              client: anomalyData.client || client,
              kpi: kpiKey,
              kpi_label: kpiLabel,
              module: moduleName,
              step1_api_val: anomalyData.api ?? apiValue,
              step2_logic_val: anomalyData.logic ?? logicValue,
              step3_ui_val: anomalyData.ui ?? uiValue,
              actual: verifiedActual,
              baseline: verifiedBaseline,
              deviation_pct: verifiedDevPct,
              threshold_pct: anomalyData.threshold_pct || 10.0,
              severity: verifiedSeverity,
            }
            : {
              id: `${client}_${kpiKey}_sentinel`,
              client,
              kpi: kpiKey,
              kpi_label: kpiLabel,
              module: moduleName,
              step1_api_val: apiValue,
              step2_logic_val: logicValue,
              step3_ui_val: uiValue,
              actual: verifiedActual,
              baseline: verifiedBaseline,
              deviation_pct: verifiedDevPct,
              threshold_pct: 10.0,
              severity: verifiedSeverity,
            }
        }
      />



      {/* Copy Notification Toast */}
      <Snackbar
        open={copiedToast}
        autoHideDuration={3000}
        onClose={() => setCopiedToast(false)}
        message="📋 Executive brief copied to clipboard! Ready to paste into Slack / WhatsApp."
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Drawer>
  );
}
