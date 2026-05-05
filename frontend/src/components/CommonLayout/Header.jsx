import React from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  IconButton,
  Button,
  Autocomplete,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Checkbox,
  Skeleton,
  Tooltip,
} from "@mui/material";

import {
  ArrowBack as ArrowBackIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AppThemeContext } from "../../utils/ThemeContext";
import { FilterContext } from "../../utils/FilterContext";
import DateRangeComparePicker from "./DateRangeComparePicker";

import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X, Layers, Monitor, LayoutGrid, Tag, MapPin, Hash, Type, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomHeaderDropdown from "./CustomHeaderDropdown";
import axiosInstance from "../../api/axiosInstance";

/* ═══════════════════════════════════════════════════════════════════
   WATCH TOWER FILTER MODAL — sidebar tabs + checkbox panel
   ═══════════════════════════════════════════════════════════════════ */
const FILTER_TABS = [
  { key: "channel", label: "Channel", icon: Layers },
  { key: "platform", label: "Platform", icon: Monitor },
  { key: "category", label: "Category", icon: LayoutGrid },
  { key: "brand", label: "Brand", icon: Tag },
  { key: "location", label: "City", icon: MapPin },
];

function WatchTowerFilterModal({
  open, onClose, hideChannelPlatform = false,
  channels, selectedChannel, setSelectedChannel,
  platforms, platform, setPlatform,
  categories, selectedCategory, setSelectedCategory,
  brands, selectedBrand, setSelectedBrand,
  locations = [], selectedLocation, setSelectedLocation,
}) {
  const [activeTab, setActiveTab] = React.useState(hideChannelPlatform ? "category" : "channel");
  const [searchTerm, setSearchTerm] = React.useState("");

  // ─── Draft (local) state — never touches FilterContext until Apply ───
  const [draftChannel, setDraftChannel] = React.useState(selectedChannel);
  const [draftPlatform, setDraftPlatform] = React.useState(platform);
  const [draftCategory, setDraftCategory] = React.useState(selectedCategory);
  const [draftBrand, setDraftBrand] = React.useState(selectedBrand);
  const [draftLocation, setDraftLocation] = React.useState(selectedLocation);

  // ─── Local option lists (cascaded from draft selections) ───
  const [localPlatforms, setLocalPlatforms] = React.useState(platforms);
  const [localCategories, setLocalCategories] = React.useState(categories);
  const [localBrands, setLocalBrands] = React.useState(brands);
  const [localLocations, setLocalLocations] = React.useState(locations);

  const availableTabs = hideChannelPlatform
    ? FILTER_TABS.filter(t => t.key !== "channel" && t.key !== "platform")
    : FILTER_TABS;

  // Sync drafts + local options from context every time the modal opens
  React.useEffect(() => {
    if (open) {
      setDraftChannel(selectedChannel);
      setDraftPlatform(platform);
      setDraftCategory(selectedCategory);
      setDraftBrand(selectedBrand);
      setDraftLocation(selectedLocation);
      setLocalPlatforms(platforms);
      setLocalCategories(categories);
      setLocalBrands(brands);
      setLocalLocations(locations);
      setActiveTab("channel");
      setSearchTerm("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ─── CASCADE: when draftChannel changes → fetch available platforms ───
  React.useEffect(() => {
    if (!open) return;
    const channelParam = draftChannel === "All" ? undefined : (Array.isArray(draftChannel) ? draftChannel.join(",").toLowerCase() : draftChannel.toLowerCase());

    // Fetch platforms for this channel (only platforms support the channel param)
    axiosInstance.get("/watchtower/platforms", { params: { channel: channelParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalPlatforms(res.data);
          // Reset draft platform if current selection is no longer valid
          setDraftPlatform(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(p => res.data.includes(p));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });

          // Also trigger categories/brands refetch for these platforms
          const platParam = res.data.join(",").toLowerCase();
          axiosInstance.get("/watchtower/categories", { params: { platform: platParam } })
            .then(catRes => {
              if (catRes.data && Array.isArray(catRes.data) && catRes.data.length > 0) {
                const cats = catRes.data.filter(c => c !== "All");
                setLocalCategories(cats);
                setDraftCategory(prev => {
                  if (prev === "All") return "All";
                  const currList = Array.isArray(prev) ? prev : [prev];
                  const valid = currList.filter(c => cats.includes(c));
                  if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
                  return valid.length === cats.length ? "All" : (valid.length === 1 ? valid[0] : valid);
                });
              }
            })
            .catch(() => { });

          axiosInstance.get("/watchtower/brands", { params: { platform: platParam } })
            .then(brandRes => {
              if (brandRes.data && Array.isArray(brandRes.data) && brandRes.data.length > 0) {
                setLocalBrands(brandRes.data);
                setDraftBrand(prev => {
                  if (prev === "All") return "All";
                  const currList = Array.isArray(prev) ? prev : [prev];
                  const valid = currList.filter(b => brandRes.data.includes(b));
                  if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
                  return valid.length === brandRes.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
                });
              }
            })
            .catch(() => { });
        }
      })
      .catch(() => { });
  }, [draftChannel, open]);

  // ─── CASCADE: when draftPlatform changes (specific selection) → refetch categories and brands ───
  React.useEffect(() => {
    if (!open) return;
    // Only run when a specific platform is selected (not "All")
    // When "All", the channel cascade already handles categories/brands
    if (draftPlatform === "All") return;
    const platformParam = (Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform).toLowerCase();

    axiosInstance.get("/watchtower/categories", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const cats = res.data.filter(c => c !== "All");
          setLocalCategories(cats);
          setDraftCategory(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(c => cats.includes(c));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return (valid.length === cats.length && cats.length > 0) ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });

    axiosInstance.get("/watchtower/brands", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalBrands(res.data);
          setDraftBrand(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(b => res.data.includes(b));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return (valid.length === res.data.length && res.data.length > 0) ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftPlatform, open]);

  // Reset search when tab changes
  React.useEffect(() => { setSearchTerm(""); }, [activeTab]);

  // map tab key → { options (local), draftValue, setDraft }
  const tabConfig = {
    channel: { options: channels, value: draftChannel, onChange: setDraftChannel },
    platform: { options: localPlatforms, value: draftPlatform, onChange: setDraftPlatform },
    category: { options: localCategories, value: draftCategory, onChange: setDraftCategory },
    brand: { options: localBrands, value: draftBrand, onChange: setDraftBrand },
    location: { options: localLocations, value: draftLocation, onChange: setDraftLocation },
  };

  const { options, value, onChange } = tabConfig[activeTab];

  // normalise value → array
  const getSelected = (v, opts) => {
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return [...opts];
    if (Array.isArray(v)) return v;
    if (!v) return [];
    return [v];
  };

  const selected = getSelected(value, options);

  const filteredOptions = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggle = (opt) => {
    let next;
    if (selected.includes(opt)) {
      next = selected.filter(s => s !== opt && s !== "All");
    } else {
      next = [...selected.filter(s => s !== "All"), opt];
    }
    if (next.length === options.length && options.length > 0) onChange("All");
    else onChange(next);
  };

  const selectAll = () => onChange("All");
  const clearAll = () => onChange([]);

  const tabMeta = availableTabs.find(t => t.key === activeTab);

  // count selected for a given filter key (draft-based)
  const countFor = (key) => {
    const cfg = tabConfig[key];
    const v = cfg.value;
    const opts = cfg.options;
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return 0;
    if (Array.isArray(v) && v.length === opts.length && opts.length > 0) return 0;
    if (Array.isArray(v)) return v.length;
    if (v) return 1;
    return 0;
  };

  // ─── APPLY: commit all drafts to FilterContext (triggers API calls) ───
  const handleApply = () => {
    const normalize = (val) => {
      if (!val || val === "All") return val;
      if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v.toLowerCase() : v);
      return typeof val === 'string' ? val.toLowerCase() : val;
    };

    if (!hideChannelPlatform) {
      setSelectedChannel(normalize(draftChannel));
      setPlatform(normalize(draftPlatform));
    }
    setSelectedCategory(normalize(draftCategory));
    setSelectedBrand(normalize(draftBrand));
    if (setSelectedLocation) setSelectedLocation(normalize(draftLocation));
    onClose();
  };

  // ─── CANCEL: discard drafts ───
  const handleCancel = () => {
    onClose();
  };

  // ─── RESET ALL: set all drafts to "All" (not yet committed) ───
  const handleResetAll = () => {
    if (!hideChannelPlatform) {
      setDraftChannel("All");
      setDraftPlatform("All");
    }
    setDraftCategory("All");
    setDraftBrand("All");
    setDraftLocation("All");
  };

  // total active filter count across all tabs
  const totalActiveCount = availableTabs.reduce((sum, t) => sum + countFor(t.key), 0);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "18px",
          boxShadow: "0 30px 60px -15px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)",
          overflow: "hidden",
          height: "540px",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
        }
      }}
    >
      {/* ── BODY: sidebar + content ── */}
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* LEFT SIDEBAR */}
        <Box
          sx={{
            width: 230,
            flexShrink: 0,
            background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Sidebar header */}
          <Box
            sx={{
              px: 2.5, pt: 2.5, pb: 2,
              background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              gap: 1.2,
            }}
          >
            <Box
              sx={{
                width: 32, height: 32,
                borderRadius: "10px",
                background: "rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(8px)",
              }}
            >
              <SlidersHorizontal size={16} color="white" />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.95rem", fontWeight: 700,
                  color: "white",
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  lineHeight: 1.2,
                }}
              >
                Filters
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.65rem", fontWeight: 500,
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                }}
              >
                {totalActiveCount > 0 ? `${totalActiveCount} active` : "None active"}
              </Typography>
            </Box>
          </Box>

          {/* Tabs */}
          <Box sx={{ pt: 1.5, pb: 1, flex: 1 }}>
            {availableTabs.map(tab => {
              const isActive = activeTab === tab.key;
              const cnt = countFor(tab.key);
              const TabIcon = tab.icon;
              return (
                <Box
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  sx={{
                    mx: 1, mb: 0.5, px: 1.8, py: 1.3,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.2,
                    borderRadius: "10px",
                    bgcolor: isActive ? "white" : "transparent",
                    color: isActive ? "#1e3a5f" : "#64748b",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "0.85rem",
                    fontFamily: "'Inter', 'Roboto', sans-serif",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: isActive ? "0 2px 8px rgba(37,99,235,0.10)" : "none",
                    border: isActive ? "1px solid rgba(37,99,235,0.12)" : "1px solid transparent",
                    "&:hover": {
                      bgcolor: isActive ? "white" : "rgba(255,255,255,0.65)",
                      transform: "translateX(2px)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 28, height: 28,
                      borderRadius: "8px",
                      background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <TabIcon size={14} color={isActive ? "white" : "#94a3b8"} />
                  </Box>
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {cnt > 0 && (
                    <Box
                      component="span"
                      sx={{
                        background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#94a3b8",
                        color: "white",
                        borderRadius: "6px",
                        px: 0.7, py: 0.15,
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        minWidth: 18,
                        textAlign: "center",
                        lineHeight: "16px",
                      }}
                    >
                      {cnt}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* RIGHT CONTENT PANEL */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

          {/* Header row */}
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5, position: "relative" }}>
            {/* Close button */}
            <IconButton
              onClick={handleCancel}
              sx={{
                position: "absolute", top: 12, right: 12,
                width: 32, height: 32,
                bgcolor: "#f1f5f9",
                "&:hover": { bgcolor: "#e2e8f0" },
                transition: "all 0.15s ease",
              }}
            >
              <X size={16} color="#64748b" />
            </IconButton>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 5 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'Inter', 'Roboto', sans-serif", color: "#0f172a", letterSpacing: "-0.01em" }}>
                  {tabMeta?.label}
                </Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", mt: 0.2, fontFamily: "'Inter', 'Roboto', sans-serif" }}>
                  Select {tabMeta?.label.toLowerCase()}s to filter your dashboard
                </Typography>
              </Box>
              <Box
                sx={{
                  background: selected.length === options.length ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#f1f5f9",
                  color: selected.length === options.length ? "white" : "#475569",
                  borderRadius: "20px",
                  px: 1.5, py: 0.4,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                {selected.length === options.length ? "All" : selected.length} selected
              </Box>
            </Box>

            {/* Select all / Clear + Search */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={selectAll}
                sx={{
                  textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600,
                  borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3,
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  "&:hover": { borderColor: "#2563eb", color: "#2563eb", bgcolor: "#eff6ff" },
                  transition: "all 0.15s ease",
                }}
              >
                Select all
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={clearAll}
                sx={{
                  textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600,
                  borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3,
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  "&:hover": { borderColor: "#ef4444", color: "#ef4444", bgcolor: "#fef2f2" },
                  transition: "all 0.15s ease",
                }}
              >
                Clear
              </Button>
              <TextField
                size="small"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search size={14} style={{ marginRight: 6, color: "#94a3b8" }} />,
                  sx: {
                    borderRadius: "10px", bgcolor: "#f8fafc", height: "32px",
                    fontSize: "0.78rem",
                    fontFamily: "'Inter', 'Roboto', sans-serif",
                    "& fieldset": { borderColor: "#e2e8f0" },
                    "&:hover fieldset": { borderColor: "#cbd5e1 !important" },
                    "&.Mui-focused fieldset": { borderColor: "#2563eb !important", borderWidth: "1.5px !important" },
                  },
                }}
                sx={{ ml: "auto", width: 190 }}
              />
            </Box>
          </Box>

          <Divider sx={{ borderColor: "#f1f5f9" }} />

          {/* Checkbox list */}
          <Box
            sx={{
              flex: 1, overflowY: "auto", px: 1.5, py: 0.5,
              "&::-webkit-scrollbar": { width: "5px" },
              "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
              "&::-webkit-scrollbar-thumb": { bgcolor: "#d1d5db", borderRadius: "10px" },
              "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#9ca3af" },
            }}
          >
            {filteredOptions.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <Search size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
                <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif" }}>
                  No results found
                </Typography>
              </Box>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <Box
                    key={opt}
                    onClick={() => toggle(opt)}
                    sx={{
                      display: "flex", alignItems: "center", gap: 1.5,
                      px: 1.5, py: 1,
                      mx: 0.5, my: 0.3,
                      cursor: "pointer",
                      borderRadius: "10px",
                      bgcolor: isChecked ? "#eff6ff" : "transparent",
                      border: isChecked ? "1px solid #bfdbfe" : "1px solid transparent",
                      transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        bgcolor: isChecked ? "#dbeafe" : "#f8fafc",
                        transform: "translateX(2px)",
                      },
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={isChecked}
                      sx={{
                        p: 0.3,
                        color: "#cbd5e1",
                        "&.Mui-checked": { color: "#2563eb" },
                        transition: "all 0.15s ease",
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: "0.84rem",
                        fontWeight: isChecked ? 600 : 450,
                        color: isChecked ? "#1e40af" : "#475569",
                        fontFamily: "'Inter', 'Roboto', sans-serif",
                        transition: "all 0.15s ease",
                        textTransform: 'capitalize',
                      }}
                    >
                      {opt}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* ── FOOTER ── */}
      <Box
        sx={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "1px solid #e2e8f0",
          px: 3, py: 1.8,
          background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)",
        }}
      >
        <Button
          variant="text"
          onClick={handleResetAll}
          startIcon={<X size={14} />}
          sx={{
            textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem",
            color: "#ef4444", px: 1.5,
            fontFamily: "'Inter', 'Roboto', sans-serif",
            "&:hover": { bgcolor: "#fef2f2" },
            transition: "all 0.15s ease",
          }}
        >
          Reset All
        </Button>

        <Box sx={{ display: "flex", gap: 1.2 }}>
          <Button
            variant="outlined"
            onClick={handleCancel}
            sx={{
              textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem",
              borderColor: "#e2e8f0", color: "#64748b", px: 2.5,
              fontFamily: "'Inter', 'Roboto', sans-serif",
              "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" },
              transition: "all 0.15s ease",
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            sx={{
              textTransform: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.8rem",
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "white",
              px: 3.5, py: 0.8,
              fontFamily: "'Inter', 'Roboto', sans-serif",
              boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
                boxShadow: "0 6px 20px rgba(37,99,235,0.45)",
                transform: "translateY(-1px)",
              },
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            Apply Filters
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MARKET SHARE FILTER MODAL — Channel, Platform, Category
   ═══════════════════════════════════════════════════════════════════ */
const MS_FILTER_TABS = [
  { key: "channel", label: "Channel", icon: Layers },
  { key: "category", label: "Category", icon: LayoutGrid },
];

function MarketShareFilterModal({
  open, onClose,
  channels, selectedChannel, setSelectedChannel,
  platforms, platform, setPlatform,
  categories, selectedCategory, setSelectedCategory,
}) {
  const [activeTab, setActiveTab] = React.useState("channel");
  const [searchTerm, setSearchTerm] = React.useState("");

  const [draftChannel, setDraftChannel] = React.useState(selectedChannel);
  const [draftPlatform, setDraftPlatform] = React.useState(platform);
  const [draftCategory, setDraftCategory] = React.useState(selectedCategory);

  React.useEffect(() => {
    if (open) {
      setDraftChannel(selectedChannel);
      setDraftPlatform(platform);
      setDraftCategory(selectedCategory);
      setActiveTab("channel");
      setSearchTerm("");
    }
  }, [open, selectedChannel, platform, selectedCategory]);

  React.useEffect(() => { setSearchTerm(""); }, [activeTab]);

  const tabConfig = {
    channel: { options: channels, value: draftChannel, onChange: setDraftChannel },
    platform: { options: platforms, value: draftPlatform, onChange: setDraftPlatform },
    category: { options: categories, value: draftCategory, onChange: setDraftCategory },
  };

  const { options, value, onChange } = tabConfig[activeTab];

  const getSelected = (v, opts) => {
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return [...opts];
    if (Array.isArray(v)) return v;
    if (!v) return [];
    return [v];
  };

  const selected = getSelected(value, options);
  const filteredOptions = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggle = (opt) => {
    let next;
    if (selected.includes(opt)) {
      next = selected.filter(s => s !== opt && s !== "All");
    } else {
      next = [...selected.filter(s => s !== "All"), opt];
    }
    if (next.length === options.length && options.length > 0) onChange("All");
    else onChange(next);
  };

  const selectAll = () => onChange("All");
  const clearAll = () => onChange([]);

  const tabMeta = MS_FILTER_TABS.find(t => t.key === activeTab);

  const countFor = (key) => {
    const cfg = tabConfig[key];
    const v = cfg.value;
    const opts = cfg.options;
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return 0;
    if (Array.isArray(v) && v.length === opts.length && opts.length > 0) return 0;
    if (Array.isArray(v)) return v.length;
    if (v) return 1;
    return 0;
  };

  const handleApply = () => {
    const normalize = (val) => {
      if (!val || val === "All") return val;
      if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v.toLowerCase() : v);
      return typeof val === 'string' ? val.toLowerCase() : val;
    };

    setSelectedChannel(normalize(draftChannel));
    setPlatform(normalize(draftPlatform));
    setSelectedCategory(normalize(draftCategory));
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleResetAll = () => {
    setDraftChannel("All");
    setDraftPlatform("All");
    setDraftCategory("All");
  };

  const totalActiveCount = MS_FILTER_TABS.reduce((sum, t) => sum + countFor(t.key), 0);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "18px",
          boxShadow: "0 30px 60px -15px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)",
          overflow: "hidden",
          height: "540px",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
        }
      }}
    >
      {/* ── BODY: sidebar + content ── */}
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* LEFT SIDEBAR */}
        <Box
          sx={{
            width: 230,
            flexShrink: 0,
            background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Sidebar header */}
          <Box
            sx={{
              px: 2.5, pt: 2.5, pb: 2,
              background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              gap: 1.2,
            }}
          >
            <Box
              sx={{
                width: 32, height: 32,
                borderRadius: "10px",
                background: "rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(8px)",
              }}
            >
              <SlidersHorizontal size={16} color="white" />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.95rem", fontWeight: 700,
                  color: "white",
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  lineHeight: 1.2,
                }}
              >
                Filters
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.65rem", fontWeight: 500,
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                }}
              >
                {totalActiveCount > 0 ? `${totalActiveCount} active` : "None active"}
              </Typography>
            </Box>
          </Box>

          {/* Tabs */}
          <Box sx={{ pt: 1.5, pb: 1, flex: 1 }}>
            {MS_FILTER_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const cnt = countFor(tab.key);
              const TabIcon = tab.icon;
              return (
                <Box
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  sx={{
                    mx: 1, mb: 0.5, px: 1.8, py: 1.3,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.2,
                    borderRadius: "10px",
                    bgcolor: isActive ? "white" : "transparent",
                    color: isActive ? "#1e3a5f" : "#64748b",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "0.85rem",
                    fontFamily: "'Inter', 'Roboto', sans-serif",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: isActive ? "0 2px 8px rgba(37,99,235,0.10)" : "none",
                    border: isActive ? "1px solid rgba(37,99,235,0.12)" : "1px solid transparent",
                    "&:hover": {
                      bgcolor: isActive ? "white" : "rgba(255,255,255,0.65)",
                      transform: "translateX(2px)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 28, height: 28,
                      borderRadius: "8px",
                      background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <TabIcon size={14} color={isActive ? "white" : "#94a3b8"} />
                  </Box>
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {cnt > 0 && (
                    <Box
                      component="span"
                      sx={{
                        background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#94a3b8",
                        color: "white",
                        borderRadius: "6px",
                        px: 0.7, py: 0.15,
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        minWidth: 18,
                        textAlign: "center",
                        lineHeight: "16px",
                      }}
                    >
                      {cnt}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* RIGHT CONTENT PANEL */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

          {/* Header row */}
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5, position: "relative" }}>
            {/* Close button */}
            <IconButton
              onClick={handleCancel}
              sx={{
                position: "absolute", top: 12, right: 12,
                width: 32, height: 32,
                bgcolor: "#f1f5f9",
                "&:hover": { bgcolor: "#e2e8f0" },
                transition: "all 0.15s ease",
              }}
            >
              <X size={16} color="#64748b" />
            </IconButton>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 5 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'Inter', 'Roboto', sans-serif", color: "#0f172a", letterSpacing: "-0.01em" }}>
                  {tabMeta?.label}
                </Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", mt: 0.2, fontFamily: "'Inter', 'Roboto', sans-serif" }}>
                  Select {tabMeta?.label?.toLowerCase()}s to filter your dashboard
                </Typography>
              </Box>
              <Box
                sx={{
                  background: selected.length === options.length ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#f1f5f9",
                  color: selected.length === options.length ? "white" : "#475569",
                  borderRadius: "20px",
                  px: 1.5, py: 0.4,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                {selected.length === options.length ? "All" : selected.length} selected
              </Box>
            </Box>

            {/* Select all / Clear + Search */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={selectAll}
                sx={{
                  textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600,
                  borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3,
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  "&:hover": { borderColor: "#2563eb", color: "#2563eb", bgcolor: "#eff6ff" },
                  transition: "all 0.15s ease",
                }}
              >
                Select all
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={clearAll}
                sx={{
                  textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600,
                  borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3,
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  "&:hover": { borderColor: "#ef4444", color: "#ef4444", bgcolor: "#fef2f2" },
                  transition: "all 0.15s ease",
                }}
              >
                Clear
              </Button>
              <TextField
                size="small"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search size={14} style={{ marginRight: 6, color: "#94a3b8" }} />,
                  sx: {
                    borderRadius: "10px", bgcolor: "#f8fafc", height: "32px",
                    fontSize: "0.78rem",
                    fontFamily: "'Inter', 'Roboto', sans-serif",
                    "& fieldset": { borderColor: "#e2e8f0" },
                    "&:hover fieldset": { borderColor: "#cbd5e1 !important" },
                    "&.Mui-focused fieldset": { borderColor: "#2563eb !important", borderWidth: "1.5px !important" },
                  },
                }}
                sx={{ ml: "auto", width: 190 }}
              />
            </Box>
          </Box>

          <Divider sx={{ borderColor: "#f1f5f9" }} />

          {/* Checkbox list */}
          <Box
            sx={{
              flex: 1, overflowY: "auto", px: 1.5, py: 0.5,
              "&::-webkit-scrollbar": { width: "5px" },
              "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
              "&::-webkit-scrollbar-thumb": { bgcolor: "#d1d5db", borderRadius: "10px" },
              "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#9ca3af" },
            }}
          >
            {filteredOptions.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <Search size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
                <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif" }}>
                  No results found
                </Typography>
              </Box>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <Box
                    key={opt}
                    onClick={() => toggle(opt)}
                    sx={{
                      display: "flex", alignItems: "center", gap: 1.5,
                      px: 1.5, py: 1,
                      mx: 0.5, my: 0.3,
                      cursor: "pointer",
                      borderRadius: "10px",
                      bgcolor: isChecked ? "#eff6ff" : "transparent",
                      border: isChecked ? "1px solid #bfdbfe" : "1px solid transparent",
                      transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        bgcolor: isChecked ? "#dbeafe" : "#f8fafc",
                        transform: "translateX(2px)",
                      },
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={isChecked}
                      sx={{
                        p: 0.3,
                        color: "#cbd5e1",
                        "&.Mui-checked": { color: "#2563eb" },
                        transition: "all 0.15s ease",
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: "0.84rem",
                        fontWeight: isChecked ? 600 : 450,
                        color: isChecked ? "#1e40af" : "#475569",
                        fontFamily: "'Inter', 'Roboto', sans-serif",
                        transition: "all 0.15s ease",
                        textTransform: 'capitalize',
                      }}
                    >
                      {opt}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* ── FOOTER ── */}
      <Box
        sx={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "1px solid #e2e8f0",
          px: 3, py: 1.8,
          background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)",
        }}
      >
        <Button
          variant="text"
          onClick={handleResetAll}
          startIcon={<X size={14} />}
          sx={{
            textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem",
            color: "#ef4444", px: 1.5,
            fontFamily: "'Inter', 'Roboto', sans-serif",
            "&:hover": { bgcolor: "#fef2f2" },
            transition: "all 0.15s ease",
          }}
        >
          Reset All
        </Button>

        <Box sx={{ display: "flex", gap: 1.2 }}>
          <Button
            variant="outlined"
            onClick={handleCancel}
            sx={{
              textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem",
              borderColor: "#e2e8f0", color: "#64748b", px: 2.5,
              fontFamily: "'Inter', 'Roboto', sans-serif",
              "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" },
              transition: "all 0.15s ease",
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            sx={{
              textTransform: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.8rem",
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "white",
              px: 3.5, py: 0.8,
              fontFamily: "'Inter', 'Roboto', sans-serif",
              boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
                boxShadow: "0 6px 20px rgba(37,99,235,0.45)",
                transform: "translateY(-1px)",
              },
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            Apply Filters
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AVAILABILITY ANALYSIS FILTER MODAL — Channel, Platform, Category, Location
   ═══════════════════════════════════════════════════════════════════ */
const AVAIL_FILTER_TABS = [
  { key: "channel", label: "Channel", icon: Layers },
  { key: "category", label: "Category", icon: LayoutGrid },
  { key: "brand", label: "Brand", icon: Tag },
  { key: "location", label: "Location", icon: MapPin },
];

function AvailabilityFilterModal({
  open, onClose,
  channels = [], selectedChannel, setSelectedChannel,
  platforms = [], platform, setPlatform,
  categories = [], selectedCategory, setSelectedCategory,
  brands = [], selectedBrand, setSelectedBrand,
  locations = [], selectedLocation, setSelectedLocation,
}) {
  const [activeTab, setActiveTab] = React.useState("channel");
  const [searchTerm, setSearchTerm] = React.useState("");

  const [draftChannel, setDraftChannel] = React.useState(selectedChannel);
  const [draftPlatform, setDraftPlatform] = React.useState(platform);
  const [draftCategory, setDraftCategory] = React.useState(selectedCategory);
  const [draftBrand, setDraftBrand] = React.useState(selectedBrand);
  const [draftLocation, setDraftLocation] = React.useState(selectedLocation);

  const [localPlatforms, setLocalPlatforms] = React.useState(platforms);
  const [localCategories, setLocalCategories] = React.useState(categories);
  const [localBrands, setLocalBrands] = React.useState(brands);
  const [localLocations, setLocalLocations] = React.useState(locations);

  React.useEffect(() => {
    if (open) {
      setDraftChannel(selectedChannel);
      setDraftPlatform(platform);
      setDraftCategory(selectedCategory);
      setDraftBrand(selectedBrand);
      setDraftLocation(selectedLocation);
      setLocalPlatforms(platforms);
      setLocalCategories(categories);
      setLocalBrands(brands);
      setLocalLocations(locations);
      setActiveTab("channel");
      setSearchTerm("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // CASCADE: draftChannel → platforms, categories, locations
  React.useEffect(() => {
    if (!open) return;
    const channelParam = draftChannel === "All" ? undefined : (Array.isArray(draftChannel) ? draftChannel.join(",") : draftChannel);

    axiosInstance.get("/watchtower/platforms", { params: { channel: channelParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalPlatforms(res.data);
          setDraftPlatform(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(p => res.data.includes(p));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });

          const platParam = res.data.join(",");
          axiosInstance.get("/watchtower/categories", { params: { platform: platParam } })
            .then(catRes => {
              if (catRes.data && Array.isArray(catRes.data) && catRes.data.length > 0) {
                const cats = catRes.data.filter(c => c !== "All");
                setLocalCategories(cats);
                setDraftCategory(prev => {
                  if (prev === "All") return "All";
                  const currList = Array.isArray(prev) ? prev : [prev];
                  const valid = currList.filter(c => cats.includes(c));
                  if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
                  return valid.length === cats.length ? "All" : (valid.length === 1 ? valid[0] : valid);
                });
              }
            })
            .catch(() => { });

          axiosInstance.get("/watchtower/locations", { params: { platform: platParam } })
            .then(locRes => {
              if (locRes.data && Array.isArray(locRes.data) && locRes.data.length > 0) {
                setLocalLocations(locRes.data);
                setDraftLocation(prev => {
                  if (prev === "All") return "All";
                  const currList = Array.isArray(prev) ? prev : [prev];
                  const valid = currList.filter(l => locRes.data.includes(l));
                  if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
                  return valid.length === locRes.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
                });
              }
            })
            .catch(() => { });
        }
      })
      .catch(() => { });
  }, [draftChannel, open]);

  // CASCADE: draftPlatform (specific) → categories, locations
  React.useEffect(() => {
    if (!open) return;
    if (draftPlatform === "All") return;
    const platformParam = Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform;

    axiosInstance.get("/watchtower/categories", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const cats = res.data.filter(c => c !== "All");
          setLocalCategories(cats);
          setDraftCategory(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(c => cats.includes(c));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return (valid.length === cats.length && cats.length > 0) ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });

    axiosInstance.get("/watchtower/locations", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalLocations(res.data);
          setDraftLocation(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(l => res.data.includes(l));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return (valid.length === res.data.length && res.data.length > 0) ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftPlatform, open]);

  // CASCADE: draftPlatform → brands
  React.useEffect(() => {
    if (!open) return;
    const platformParam = draftPlatform === "All"
      ? (localPlatforms.length > 0 ? localPlatforms.join(",") : undefined)
      : (Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform);

    axiosInstance.get("/watchtower/brands", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data)) {
          setLocalBrands(res.data);
          setDraftBrand(prev => {
            if (prev === "All" || (Array.isArray(prev) && prev.includes("All"))) return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(b => res.data.includes(b));
            return valid.length > 0 ? valid : "All";
          });
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPlatform, open]);

  React.useEffect(() => { setSearchTerm(""); }, [activeTab]);

  const tabConfig = {
    channel: { options: channels, value: draftChannel, onChange: setDraftChannel },
    platform: { options: localPlatforms, value: draftPlatform, onChange: setDraftPlatform },
    category: { options: localCategories, value: draftCategory, onChange: setDraftCategory },
    brand: { options: localBrands, value: draftBrand, onChange: setDraftBrand },
    location: { options: localLocations, value: draftLocation, onChange: setDraftLocation },
  };

  const { options, value, onChange } = tabConfig[activeTab];

  const getSelected = (v, opts) => {
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return [...opts];
    if (Array.isArray(v)) return v;
    if (!v) return [];
    return [v];
  };

  const selected = getSelected(value, options);
  const filteredOptions = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggle = (opt) => {
    let next;
    if (selected.includes(opt)) {
      next = selected.filter(s => s !== opt && s !== "All");
    } else {
      next = [...selected.filter(s => s !== "All"), opt];
    }
    if (next.length === options.length && options.length > 0) onChange("All");
    else onChange(next);
  };

  const selectAll = () => onChange("All");
  const clearAll = () => onChange([]);

  const tabMeta = AVAIL_FILTER_TABS.find(t => t.key === activeTab);

  const countFor = (key) => {
    const cfg = tabConfig[key];
    const v = cfg.value;
    const opts = cfg.options;
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return 0;
    if (Array.isArray(v) && v.length === opts.length && opts.length > 0) return 0;
    if (Array.isArray(v)) return v.length;
    if (v) return 1;
    return 0;
  };

  const handleApply = () => {
    setSelectedChannel(draftChannel);
    setPlatform(draftPlatform);
    setSelectedCategory(draftCategory);
    setSelectedBrand(draftBrand);
    setSelectedLocation(draftLocation);
    onClose();
  };

  const handleCancel = () => { onClose(); };

  const handleResetAll = () => {
    setDraftChannel("All");
    setDraftPlatform("All");
    setDraftCategory("All");
    setDraftBrand("All");
    setDraftLocation("All");
  };

  const totalActiveCount = AVAIL_FILTER_TABS.reduce((sum, t) => sum + countFor(t.key), 0);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "18px",
          boxShadow: "0 30px 60px -15px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)",
          overflow: "hidden",
          height: "540px",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
        }
      }}
    >
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* LEFT SIDEBAR */}
        <Box
          sx={{
            width: 230,
            flexShrink: 0,
            background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              px: 2.5, pt: 2.5, pb: 2,
              background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
              display: "flex",
              alignItems: "center",
              gap: 1.2,
            }}
          >
            <Box
              sx={{
                width: 32, height: 32,
                borderRadius: "10px",
                background: "rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(8px)",
              }}
            >
              <SlidersHorizontal size={16} color="white" />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.95rem", fontWeight: 700,
                  color: "white",
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  lineHeight: 1.2,
                }}
              >
                Filters
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.65rem", fontWeight: 500,
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                }}
              >
                {totalActiveCount > 0 ? `${totalActiveCount} active` : "None active"}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ pt: 1.5, pb: 1, flex: 1 }}>
            {AVAIL_FILTER_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const cnt = countFor(tab.key);
              const TabIcon = tab.icon;
              return (
                <Box
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  sx={{
                    mx: 1, mb: 0.5, px: 1.8, py: 1.3,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.2,
                    borderRadius: "10px",
                    bgcolor: isActive ? "white" : "transparent",
                    color: isActive ? "#1e3a5f" : "#64748b",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "0.85rem",
                    fontFamily: "'Inter', 'Roboto', sans-serif",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: isActive ? "0 2px 8px rgba(37,99,235,0.10)" : "none",
                    border: isActive ? "1px solid rgba(37,99,235,0.12)" : "1px solid transparent",
                    "&:hover": {
                      bgcolor: isActive ? "white" : "rgba(255,255,255,0.65)",
                      transform: "translateX(2px)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 28, height: 28,
                      borderRadius: "8px",
                      background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <TabIcon size={14} color={isActive ? "white" : "#94a3b8"} />
                  </Box>
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {cnt > 0 && (
                    <Box
                      component="span"
                      sx={{
                        background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#94a3b8",
                        color: "white",
                        borderRadius: "6px",
                        px: 0.7, py: 0.15,
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        minWidth: 18,
                        textAlign: "center",
                        lineHeight: "16px",
                      }}
                    >
                      {cnt}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* RIGHT CONTENT PANEL */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5, position: "relative" }}>
            <IconButton
              onClick={handleCancel}
              sx={{
                position: "absolute", top: 12, right: 12,
                width: 32, height: 32,
                bgcolor: "#f1f5f9",
                "&:hover": { bgcolor: "#e2e8f0" },
                transition: "all 0.15s ease",
              }}
            >
              <X size={16} color="#64748b" />
            </IconButton>

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 5 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'Inter', 'Roboto', sans-serif", color: "#0f172a", letterSpacing: "-0.01em" }}>
                  {tabMeta?.label}
                </Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", mt: 0.2, fontFamily: "'Inter', 'Roboto', sans-serif" }}>
                  Select {tabMeta?.label.toLowerCase()}s to filter your dashboard
                </Typography>
              </Box>
              <Box
                sx={{
                  background: selected.length === options.length ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#f1f5f9",
                  color: selected.length === options.length ? "white" : "#475569",
                  borderRadius: "20px",
                  px: 1.5, py: 0.4,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                {selected.length === options.length ? "All" : selected.length} selected
              </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={selectAll}
                sx={{
                  textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600,
                  borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3,
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  "&:hover": { borderColor: "#2563eb", color: "#2563eb", bgcolor: "#eff6ff" },
                  transition: "all 0.15s ease",
                }}
              >
                Select all
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={clearAll}
                sx={{
                  textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600,
                  borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3,
                  fontFamily: "'Inter', 'Roboto', sans-serif",
                  "&:hover": { borderColor: "#ef4444", color: "#ef4444", bgcolor: "#fef2f2" },
                  transition: "all 0.15s ease",
                }}
              >
                Clear
              </Button>
              <TextField
                size="small"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search size={14} style={{ marginRight: 6, color: "#94a3b8" }} />,
                  sx: {
                    borderRadius: "10px", bgcolor: "#f8fafc", height: "32px",
                    fontSize: "0.78rem",
                    fontFamily: "'Inter', 'Roboto', sans-serif",
                    "& fieldset": { borderColor: "#e2e8f0" },
                    "&:hover fieldset": { borderColor: "#cbd5e1 !important" },
                    "&.Mui-focused fieldset": { borderColor: "#2563eb !important", borderWidth: "1.5px !important" },
                  },
                }}
                sx={{ ml: "auto", width: 190 }}
              />
            </Box>
          </Box>

          <Divider sx={{ borderColor: "#f1f5f9" }} />

          <Box
            sx={{
              flex: 1, overflowY: "auto", px: 1.5, py: 0.5,
              "&::-webkit-scrollbar": { width: "5px" },
              "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
              "&::-webkit-scrollbar-thumb": { bgcolor: "#d1d5db", borderRadius: "10px" },
              "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#9ca3af" },
            }}
          >
            {filteredOptions.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <Search size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
                <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif" }}>
                  No results found
                </Typography>
              </Box>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <Box
                    key={opt}
                    onClick={() => toggle(opt)}
                    sx={{
                      display: "flex", alignItems: "center", gap: 1.5,
                      px: 1.5, py: 1,
                      mx: 0.5, my: 0.3,
                      cursor: "pointer",
                      borderRadius: "10px",
                      bgcolor: isChecked ? "#eff6ff" : "transparent",
                      border: isChecked ? "1px solid #bfdbfe" : "1px solid transparent",
                      transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        bgcolor: isChecked ? "#dbeafe" : "#f8fafc",
                        transform: "translateX(2px)",
                      },
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={isChecked}
                      sx={{
                        p: 0.3,
                        color: "#cbd5e1",
                        "&.Mui-checked": { color: "#2563eb" },
                        transition: "all 0.15s ease",
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: "0.84rem",
                        fontWeight: isChecked ? 600 : 450,
                        color: isChecked ? "#1e40af" : "#475569",
                        fontFamily: "'Inter', 'Roboto', sans-serif",
                        transition: "all 0.15s ease",
                        textTransform: 'capitalize',
                      }}
                    >
                      {opt}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* FOOTER */}
      <Box
        sx={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: "1px solid #e2e8f0",
          px: 3, py: 1.8,
          background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)",
        }}
      >
        <Button
          variant="text"
          onClick={handleResetAll}
          startIcon={<X size={14} />}
          sx={{
            textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem",
            color: "#ef4444", px: 1.5,
            fontFamily: "'Inter', 'Roboto', sans-serif",
            "&:hover": { bgcolor: "#fef2f2" },
            transition: "all 0.15s ease",
          }}
        >
          Reset All
        </Button>

        <Box sx={{ display: "flex", gap: 1.2 }}>
          <Button
            variant="outlined"
            onClick={handleCancel}
            sx={{
              textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem",
              borderColor: "#e2e8f0", color: "#64748b", px: 2.5,
              fontFamily: "'Inter', 'Roboto', sans-serif",
              "&:hover": { borderColor: "##cbd5e1", bgcolor: "#f8fafc" },
              transition: "all 0.15s ease",
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            sx={{
              textTransform: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.8rem",
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "white",
              px: 3.5, py: 0.8,
              fontFamily: "'Inter', 'Roboto', sans-serif",
              boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
                boxShadow: "0 6px 20px rgba(37,99,235,0.45)",
                transform: "translateY(-1px)",
              },
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            Apply Filters
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VISIBILITY ANALYSIS FILTER MODAL — Channel, Platform, Category, Keyword Type, Keyword
   ═══════════════════════════════════════════════════════════════════ */
const VIS_FILTER_TABS = [
  { key: "category", label: "Category", icon: LayoutGrid },
  { key: "brand", label: "Brand", icon: Tag },
  { key: "location", label: "Location", icon: MapPin },
  { key: "keywordType", label: "Keyword Type", icon: Type },
  { key: "keyword", label: "Keyword", icon: Hash },
];

function VisibilityFilterModal({
  open, onClose,
  selectedChannel,
  platforms = [], platform, setPlatform,
  categories = [], selectedCategory, setSelectedCategory,
  brands = [], selectedBrand, setSelectedBrand,
  locations = [], selectedLocation, setSelectedLocation,
  keywordTypes = [], selectedKeywordType, setSelectedKeywordType,
  keywords = [], selectedKeyword, setSelectedKeyword,
}) {
  const [activeTab, setActiveTab] = React.useState("platform");
  const [searchTerm, setSearchTerm] = React.useState("");

  const [draftPlatform, setDraftPlatform] = React.useState(platform);
  const [draftCategory, setDraftCategory] = React.useState(selectedCategory);
  const [draftBrand, setDraftBrand] = React.useState(selectedBrand);
  const [draftLocation, setDraftLocation] = React.useState(selectedLocation);
  const [draftKeywordType, setDraftKeywordType] = React.useState(selectedKeywordType);
  const [draftKeyword, setDraftKeyword] = React.useState(selectedKeyword);

  const [localPlatforms, setLocalPlatforms] = React.useState(platforms);
  const [localCategories, setLocalCategories] = React.useState(categories);
  const [localBrands, setLocalBrands] = React.useState(brands);
  const [localLocations, setLocalLocations] = React.useState(locations);
  const [localKeywordTypes, setLocalKeywordTypes] = React.useState(keywordTypes);
  const [localKeywords, setLocalKeywords] = React.useState(keywords);

  React.useEffect(() => {
    if (open) {
      setDraftPlatform(platform);
      setDraftCategory(selectedCategory);
      setDraftBrand(selectedBrand);
      setDraftLocation(selectedLocation);
      setDraftKeywordType(selectedKeywordType);
      setDraftKeyword(selectedKeyword);
      setLocalPlatforms(platforms);
      setLocalCategories(categories);
      setLocalBrands(brands);
      setLocalLocations(locations);
      setLocalKeywordTypes(keywordTypes);
      setLocalKeywords(keywords);
      setActiveTab("platform");
      setSearchTerm("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // CASCADE: selectedChannel → platforms
  React.useEffect(() => {
    if (!open) return;
    const channelParam = selectedChannel === "All" ? undefined : (Array.isArray(selectedChannel) ? selectedChannel.join(",") : selectedChannel);
    axiosInstance.get("/watchtower/platforms", { params: { channel: channelParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalPlatforms(res.data);
          setDraftPlatform(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(p => res.data.includes(p));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [selectedChannel, open]);

  // CASCADE: draftPlatform → categories, keywordTypes, keywords
  React.useEffect(() => {
    if (!open) return;
    const platformParam = draftPlatform === "All"
      ? (localPlatforms.length > 0 ? localPlatforms.join(",") : undefined)
      : (Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform);

    axiosInstance.get("/watchtower/categories", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const cats = res.data.filter(c => c !== "All");
          setLocalCategories(cats);
          setDraftCategory(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(c => cats.includes(c));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return (valid.length === cats.length && cats.length > 0) ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });

    axiosInstance.get("/visibility-analysis/keyword-types", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data)) {
          const kts = res.data.filter(k => k !== "All");
          setLocalKeywordTypes(kts);
          setDraftKeywordType(prev => {
            if (prev === "All" || (Array.isArray(prev) && prev.includes("All"))) return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(k => kts.includes(k));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid;
          });
        }
      })
      .catch(() => { });

    const catParam = draftCategory === "All" ? undefined : (Array.isArray(draftCategory) ? draftCategory.join(",") : draftCategory);
    axiosInstance.get("/visibility-analysis/keywords", { params: { platform: platformParam, category: catParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data)) {
          const kws = res.data.filter(k => k !== "All");
          setLocalKeywords(kws);
          setDraftKeyword(prev => {
            if (prev === "All" || (Array.isArray(prev) && prev.includes("All"))) return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(k => kws.includes(k));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid;
          });
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPlatform, draftCategory, open]);

  // CASCADE: draftPlatform → brands
  React.useEffect(() => {
    if (!open) return;
    const platformParam = draftPlatform === "All"
      ? (localPlatforms.length > 0 ? localPlatforms.join(",") : undefined)
      : (Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform);

    axiosInstance.get("/watchtower/brands", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data)) {
          setLocalBrands(res.data);
          setDraftBrand(prev => {
            if (prev === "All" || (Array.isArray(prev) && prev.includes("All"))) return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(b => res.data.includes(b));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid;
          });
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPlatform, open]);

  React.useEffect(() => { setSearchTerm(""); }, [activeTab]);

  const tabConfig = {
    platform: { options: localPlatforms, value: draftPlatform, onChange: setDraftPlatform },
    category: { options: localCategories, value: draftCategory, onChange: setDraftCategory },
    brand: { options: localBrands, value: draftBrand, onChange: setDraftBrand },
    location: { options: localLocations, value: draftLocation, onChange: setDraftLocation },
    keywordType: { options: localKeywordTypes, value: draftKeywordType, onChange: setDraftKeywordType },
    keyword: { options: localKeywords, value: draftKeyword, onChange: setDraftKeyword },
  };

  const { options, value, onChange } = tabConfig[activeTab];

  const getSelected = (v, opts) => {
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return [...opts];
    if (Array.isArray(v)) return v;
    if (!v) return [];
    return [v];
  };

  const selected = getSelected(value, options);
  const filteredOptions = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggle = (opt) => {
    let next;
    if (selected.includes(opt)) {
      next = selected.filter(s => s !== opt && s !== "All");
    } else {
      next = [...selected.filter(s => s !== "All"), opt];
    }
    if (next.length === options.length && options.length > 0) onChange("All");
    else onChange(next);
  };

  const selectAll = () => onChange("All");
  const clearAll = () => onChange([]);

  const tabMeta = VIS_FILTER_TABS.find(t => t.key === activeTab);

  const countFor = (key) => {
    const cfg = tabConfig[key];
    const v = cfg.value;
    const opts = cfg.options;
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return 0;
    if (Array.isArray(v) && v.length === opts.length && opts.length > 0) return 0;
    if (Array.isArray(v)) return v.length;
    if (v) return 1;
    return 0;
  };

  const handleApply = () => {
    setPlatform(draftPlatform);
    setSelectedCategory(draftCategory);
    setSelectedBrand(draftBrand);
    setSelectedLocation(draftLocation);
    setSelectedKeywordType(draftKeywordType);
    setSelectedKeyword(draftKeyword);
    onClose();
  };

  const handleCancel = () => { onClose(); };

  const handleResetAll = () => {
    setDraftPlatform("All");
    setDraftCategory("All");
    setDraftBrand("All");
    setDraftLocation("All");
    setDraftKeywordType(["All"]);
    setDraftKeyword(["All"]);
  };

  const totalActiveCount = VIS_FILTER_TABS.reduce((sum, t) => sum + countFor(t.key), 0);

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth
      PaperProps={{
        sx: {
          borderRadius: "18px",
          boxShadow: "0 30px 60px -15px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)",
          overflow: "hidden", height: "540px",
          display: "flex", flexDirection: "column", background: "#fff",
        }
      }}
    >
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* LEFT SIDEBAR */}
        <Box sx={{ width: 230, flexShrink: 0, background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2, background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)", display: "flex", alignItems: "center", gap: 1.2 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: "10px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
              <SlidersHorizontal size={16} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "white", fontFamily: "'Inter', 'Roboto', sans-serif", lineHeight: 1.2 }}>Filters</Typography>
              <Typography sx={{ fontSize: "0.65rem", fontWeight: 500, color: "rgba(255,255,255,0.7)", fontFamily: "'Inter', 'Roboto', sans-serif" }}>
                {totalActiveCount > 0 ? `${totalActiveCount} active` : "None active"}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ pt: 1.5, pb: 1, flex: 1, overflowY: "auto" }}>
            {VIS_FILTER_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const cnt = countFor(tab.key);
              const TabIcon = tab.icon;
              return (
                <Box key={tab.key} onClick={() => setActiveTab(tab.key)}
                  sx={{
                    mx: 1, mb: 0.5, px: 1.8, py: 1.1, cursor: "pointer", display: "flex", alignItems: "center", gap: 1.2,
                    borderRadius: "10px", bgcolor: isActive ? "white" : "transparent",
                    color: isActive ? "#1e3a5f" : "#64748b", fontWeight: isActive ? 700 : 500,
                    fontSize: "0.83rem", fontFamily: "'Inter', 'Roboto', sans-serif",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: isActive ? "0 2px 8px rgba(37,99,235,0.10)" : "none",
                    border: isActive ? "1px solid rgba(37,99,235,0.12)" : "1px solid transparent",
                    "&:hover": { bgcolor: isActive ? "white" : "rgba(255,255,255,0.65)", transform: "translateX(2px)" },
                  }}
                >
                  <Box sx={{ width: 26, height: 26, borderRadius: "7px", background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>
                    <TabIcon size={13} color={isActive ? "white" : "#94a3b8"} />
                  </Box>
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {cnt > 0 && (
                    <Box component="span" sx={{ background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#94a3b8", color: "white", borderRadius: "6px", px: 0.7, py: 0.15, fontSize: "0.6rem", fontWeight: 700, minWidth: 18, textAlign: "center", lineHeight: "16px" }}>
                      {cnt}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* RIGHT CONTENT */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5, position: "relative" }}>
            <IconButton onClick={handleCancel} sx={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, bgcolor: "#f1f5f9", "&:hover": { bgcolor: "#e2e8f0" }, transition: "all 0.15s ease" }}>
              <X size={16} color="#64748b" />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 5 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'Inter', 'Roboto', sans-serif", color: "#0f172a", letterSpacing: "-0.01em" }}>{tabMeta?.label}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", mt: 0.2, fontFamily: "'Inter', 'Roboto', sans-serif" }}>Select {tabMeta?.label.toLowerCase()}s to filter your dashboard</Typography>
              </Box>
              <Box sx={{ background: selected.length === options.length ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#f1f5f9", color: selected.length === options.length ? "white" : "#475569", borderRadius: "20px", px: 1.5, py: 0.4, fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.2s ease" }}>
                {selected.length === options.length ? "All" : selected.length} selected
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 1.5 }}>
              <Button size="small" variant="outlined" onClick={selectAll} sx={{ textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#2563eb", color: "#2563eb", bgcolor: "#eff6ff" }, transition: "all 0.15s ease" }}>Select all</Button>
              <Button size="small" variant="outlined" onClick={clearAll} sx={{ textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#ef4444", color: "#ef4444", bgcolor: "#fef2f2" }, transition: "all 0.15s ease" }}>Clear</Button>
              <TextField size="small" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{ startAdornment: <Search size={14} style={{ marginRight: 6, color: "#94a3b8" }} />, sx: { borderRadius: "10px", bgcolor: "#f8fafc", height: "32px", fontSize: "0.78rem", fontFamily: "'Inter', 'Roboto', sans-serif", "& fieldset": { borderColor: "#e2e8f0" }, "&:hover fieldset": { borderColor: "#cbd5e1 !important" }, "&.Mui-focused fieldset": { borderColor: "#2563eb !important", borderWidth: "1.5px !important" } } }}
                sx={{ ml: "auto", width: 190 }}
              />
            </Box>
          </Box>
          <Divider sx={{ borderColor: "#f1f5f9" }} />
          <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 0.5, "&::-webkit-scrollbar": { width: "5px" }, "&::-webkit-scrollbar-track": { bgcolor: "transparent" }, "&::-webkit-scrollbar-thumb": { bgcolor: "#d1d5db", borderRadius: "10px" }, "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#9ca3af" } }}>
            {filteredOptions.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <Search size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
                <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif" }}>No results found</Typography>
              </Box>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <Box key={opt} onClick={() => toggle(opt)}
                    sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1, mx: 0.5, my: 0.3, cursor: "pointer", borderRadius: "10px", bgcolor: isChecked ? "#eff6ff" : "transparent", border: isChecked ? "1px solid #bfdbfe" : "1px solid transparent", transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)", "&:hover": { bgcolor: isChecked ? "#dbeafe" : "#f8fafc", transform: "translateX(2px)" } }}
                  >
                    <Checkbox size="small" checked={isChecked} sx={{ p: 0.3, color: "#cbd5e1", "&.Mui-checked": { color: "#2563eb" }, transition: "all 0.15s ease" }} />
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: isChecked ? 600 : 450, color: isChecked ? "#1e40af" : "#475569", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.15s ease", textTransform: 'capitalize' }}>{opt}</Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* FOOTER */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", px: 3, py: 1.8, background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)" }}>
        <Button variant="text" onClick={handleResetAll} startIcon={<X size={14} />} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem", color: "#ef4444", px: 1.5, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { bgcolor: "#fef2f2" }, transition: "all 0.15s ease" }}>Reset All</Button>
        <Box sx={{ display: "flex", gap: 1.2 }}>
          <Button variant="outlined" onClick={handleCancel} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem", borderColor: "#e2e8f0", color: "#64748b", px: 2.5, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" }, transition: "all 0.15s ease" }}>Cancel</Button>
          <Button variant="contained" onClick={handleApply} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.8rem", background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "white", px: 3.5, py: 0.8, fontFamily: "'Inter', 'Roboto', sans-serif", boxShadow: "0 4px 14px rgba(37,99,235,0.35)", "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37,99,235,0.45)", transform: "translateY(-1px)" }, transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" }}>Apply Filters</Button>
        </Box>
      </Box>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRICING ANALYSIS FILTER MODAL — Channel, Platform, Category, Brand, Location
   ═══════════════════════════════════════════════════════════════════ */
const PRICING_FILTER_TABS = [
  { key: "channel", label: "Channel", icon: Layers },
  { key: "category", label: "Category", icon: LayoutGrid },
  { key: "brand", label: "Brand", icon: Tag },
  { key: "location", label: "Location", icon: MapPin },
];

function PricingFilterModal({
  open, onClose,
  channels = [], selectedChannel, setSelectedChannel,
  platforms = [], platform, setPlatform,
  categories = [], selectedCategory, setSelectedCategory,
  brands = [], selectedBrand, setSelectedBrand,
  locations = [], selectedLocation, setSelectedLocation,
}) {
  const [activeTab, setActiveTab] = React.useState("channel");
  const [searchTerm, setSearchTerm] = React.useState("");

  // ─── Draft (local) state — never touches FilterContext until Apply ───
  const [draftChannel, setDraftChannel] = React.useState(selectedChannel);
  const [draftPlatform, setDraftPlatform] = React.useState(platform);
  const [draftCategory, setDraftCategory] = React.useState(selectedCategory);
  const [draftBrand, setDraftBrand] = React.useState(selectedBrand);
  const [draftLocation, setDraftLocation] = React.useState(selectedLocation);

  // ─── Local option lists ───
  const [localPlatforms, setLocalPlatforms] = React.useState(platforms);
  const [localCategories, setLocalCategories] = React.useState(categories);
  const [localBrands, setLocalBrands] = React.useState(brands);

  React.useEffect(() => {
    if (open) {
      setDraftChannel(selectedChannel);
      setDraftPlatform(platform);
      setDraftCategory(selectedCategory);
      setDraftBrand(selectedBrand);
      setDraftLocation(selectedLocation);

      setLocalPlatforms(platforms);
      setLocalCategories(categories);
      setLocalBrands(brands);

      setActiveTab("channel");
      setSearchTerm("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // CASCADE: when draftChannel changes → fetch available platforms
  React.useEffect(() => {
    if (!open) return;
    const channelParam = draftChannel === "All" ? undefined : (Array.isArray(draftChannel) ? draftChannel.join(",") : draftChannel);

    axiosInstance.get("/watchtower/platforms", { params: { channel: channelParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalPlatforms(res.data);
          setDraftPlatform(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(p => res.data.includes(p));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftChannel, open]);

  // CASCADE: when draftPlatform changes → refetch categories and brands
  React.useEffect(() => {
    if (!open) return;
    if (draftPlatform === "All") return;
    const platformParam = Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform;

    // Categories
    axiosInstance.get("/watchtower/categories", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const cats = res.data.filter(c => c !== "All");
          setLocalCategories(cats);
          setDraftCategory(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(c => cats.includes(c));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === cats.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });

    // Brands
    axiosInstance.get("/watchtower/brands", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalBrands(res.data);
          setDraftBrand(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(b => res.data.includes(b));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftPlatform, open]);

  React.useEffect(() => { setSearchTerm(""); }, [activeTab]);

  const tabConfig = {
    channel: { options: channels, value: draftChannel, onChange: setDraftChannel },
    platform: { options: localPlatforms, value: draftPlatform, onChange: setDraftPlatform },
    category: { options: localCategories, value: draftCategory, onChange: setDraftCategory },
    brand: { options: localBrands, value: draftBrand, onChange: setDraftBrand },
    location: { options: locations, value: draftLocation, onChange: setDraftLocation },
  };

  const { options, value, onChange } = tabConfig[activeTab];

  const getSelected = (v, opts) => {
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return [...opts];
    if (Array.isArray(v)) return v;
    if (!v) return [];
    return [v];
  };

  const selected = getSelected(value, options);
  const filteredOptions = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggle = (opt) => {
    let next;
    if (selected.includes(opt)) {
      next = selected.filter(s => s !== opt && s !== "All");
    } else {
      next = [...selected.filter(s => s !== "All"), opt];
    }
    if (next.length === options.length && options.length > 0) onChange("All");
    else onChange(next);
  };

  const selectAll = () => onChange("All");
  const clearAll = () => onChange([]);

  const tabMeta = PRICING_FILTER_TABS.find(t => t.key === activeTab);

  const countFor = (key) => {
    const cfg = tabConfig[key];
    const v = cfg.value;
    const opts = cfg.options;
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return 0;
    if (Array.isArray(v) && v.length === opts.length && opts.length > 0) return 0;
    if (Array.isArray(v)) return v.length;
    if (v) return 1;
    return 0;
  };

  const handleApply = () => {
    setSelectedChannel(draftChannel);
    setPlatform(draftPlatform);
    setSelectedCategory(draftCategory);
    setSelectedBrand(draftBrand);
    setSelectedLocation(draftLocation);
    onClose();
  };

  const handleCancel = () => onClose();

  const handleResetAll = () => {
    setDraftChannel("All");
    setDraftPlatform("All");
    setDraftCategory("All");
    setDraftBrand("All");
    setDraftLocation("All");
  };

  const totalActiveCount = PRICING_FILTER_TABS.reduce((sum, t) => sum + countFor(t.key), 0);

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "18px", boxShadow: "0 30px 60px -15px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)", overflow: "hidden", height: "540px", display: "flex", flexDirection: "column", background: "#fff", } }}>
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Box sx={{ width: 230, flexShrink: 0, background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", }}>
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2, background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)", display: "flex", alignItems: "center", gap: 1.2, }}>
            <Box sx={{ width: 32, height: 32, borderRadius: "10px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", }}>
              <SlidersHorizontal size={16} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "white", fontFamily: "'Inter', 'Roboto', sans-serif", lineHeight: 1.2, }}>Filters</Typography>
              <Typography sx={{ fontSize: "0.65rem", fontWeight: 500, color: "rgba(255,255,255,0.7)", fontFamily: "'Inter', 'Roboto', sans-serif", }}>{totalActiveCount > 0 ? `${totalActiveCount} active` : "None active"}</Typography>
            </Box>
          </Box>
          <Box sx={{ pt: 1.5, pb: 1, flex: 1 }}>
            {PRICING_FILTER_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const cnt = countFor(tab.key);
              const TabIcon = tab.icon;
              return (
                <Box key={tab.key} onClick={() => setActiveTab(tab.key)} sx={{ mx: 1, mb: 0.5, px: 1.8, py: 1.3, cursor: "pointer", display: "flex", alignItems: "center", gap: 1.2, borderRadius: "10px", bgcolor: isActive ? "white" : "transparent", color: isActive ? "#1e3a5f" : "#64748b", fontWeight: isActive ? 700 : 500, fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: isActive ? "0 2px 8px rgba(37,99,235,0.10)" : "none", border: isActive ? "1px solid rgba(37,99,235,0.12)" : "1px solid transparent", "&:hover": { bgcolor: isActive ? "white" : "rgba(255,255,255,0.65)", transform: "translateX(2px)", }, }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: "8px", background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease", }}>
                    <TabIcon size={14} color={isActive ? "white" : "#94a3b8"} />
                  </Box>
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {cnt > 0 && (
                    <Box component="span" sx={{ background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#94a3b8", color: "white", borderRadius: "6px", px: 0.7, py: 0.15, fontSize: "0.6rem", fontWeight: 700, minWidth: 18, textAlign: "center", lineHeight: "16px", }}>{cnt}</Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5, position: "relative" }}>
            <IconButton onClick={handleCancel} sx={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, bgcolor: "#f1f5f9", "&:hover": { bgcolor: "#e2e8f0" }, transition: "all 0.15s ease", }}>
              <X size={16} color="#64748b" />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 5 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'Inter', 'Roboto', sans-serif", color: "#0f172a", letterSpacing: "-0.01em" }}>{tabMeta?.label}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", mt: 0.2, fontFamily: "'Inter', 'Roboto', sans-serif" }}>Select {tabMeta?.label.toLowerCase()}s to filter your dashboard</Typography>
              </Box>
              <Box sx={{ background: selected.length === options.length ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#f1f5f9", color: selected.length === options.length ? "white" : "#475569", borderRadius: "20px", px: 1.5, py: 0.4, fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.2s ease", }}>{selected.length === options.length ? "All" : selected.length} selected</Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 1.5 }}>
              <Button size="small" variant="outlined" onClick={selectAll} sx={{ textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#2563eb", color: "#2563eb", bgcolor: "#eff6ff" }, transition: "all 0.15s ease", }}>Select all</Button>
              <Button size="small" variant="outlined" onClick={clearAll} sx={{ textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#ef4444", color: "#ef4444", bgcolor: "#fef2f2" }, transition: "all 0.15s ease", }}>Clear</Button>
              <TextField size="small" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: <Search size={14} style={{ marginRight: 6, color: "#94a3b8" }} />, sx: { borderRadius: "10px", bgcolor: "#f8fafc", height: "32px", fontSize: "0.78rem", fontFamily: "'Inter', 'Roboto', sans-serif", "& fieldset": { borderColor: "#e2e8f0" }, "&:hover fieldset": { borderColor: "#cbd5e1 !important" }, "&.Mui-focused fieldset": { borderColor: "#2563eb !important", borderWidth: "1.5px !important" }, }, }} sx={{ ml: "auto", width: 190 }} />
            </Box>
          </Box>
          <Divider sx={{ borderColor: "#f1f5f9" }} />
          <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 0.5, "&::-webkit-scrollbar": { width: "5px" }, "&::-webkit-scrollbar-track": { bgcolor: "transparent" }, "&::-webkit-scrollbar-thumb": { bgcolor: "#d1d5db", borderRadius: "10px" }, "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#9ca3af" }, }}>
            {filteredOptions.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}><Search size={32} color="#cbd5e1" style={{ marginBottom: 8 }} /><Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif" }}>No results found</Typography></Box>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <Box key={opt} onClick={() => toggle(opt)} sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1, mx: 0.5, my: 0.3, cursor: "pointer", borderRadius: "10px", bgcolor: isChecked ? "#eff6ff" : "transparent", border: isChecked ? "1px solid #bfdbfe" : "1px solid transparent", transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)", "&:hover": { bgcolor: isChecked ? "#dbeafe" : "#f8fafc", transform: "translateX(2px)", }, }}>
                    <Checkbox size="small" checked={isChecked} sx={{ p: 0.3, color: "#cbd5e1", "&.Mui-checked": { color: "#2563eb" }, transition: "all 0.15s ease", }} />
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: isChecked ? 600 : 450, color: isChecked ? "#1e40af" : "#475569", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.15s ease", textTransform: 'capitalize' }}>{opt}</Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", px: 3, py: 1.8, background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)", }}>
        <Button variant="text" onClick={handleResetAll} startIcon={<X size={14} />} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem", color: "#ef4444", px: 1.5, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { bgcolor: "#fef2f2" }, transition: "all 0.15s ease", }}>Reset All</Button>
        <Box sx={{ display: "flex", gap: 1.2 }}>
          <Button variant="outlined" onClick={handleCancel} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem", borderColor: "#e2e8f0", color: "#64748b", px: 2.5, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" }, transition: "all 0.15s ease", }}>Cancel</Button>
          <Button variant="contained" onClick={handleApply} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.8rem", background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "white", px: 3.5, py: 0.8, fontFamily: "'Inter', 'Roboto', sans-serif", boxShadow: "0 4px 14px rgba(37,99,235,0.35)", "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37,99,235,0.45)", transform: "translateY(-1px)", }, transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", }}>Apply Filters</Button>
        </Box>
      </Box>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PERFORMANCE MARKETING FILTER MODAL — Channel, Platform, Category, Brand, Location
   ═══════════════════════════════════════════════════════════════════ */
const PERFORMANCE_FILTER_TABS = [
  { key: "channel", label: "Channel", icon: Layers },
  { key: "category", label: "Category", icon: LayoutGrid },
  { key: "brand", label: "Brand", icon: Tag },
  { key: "location", label: "Location", icon: MapPin },
];

function PerformanceFilterModal({
  open, onClose,
  channels = [], selectedChannel, setSelectedChannel,
  platforms = [], platform, setPlatform,
  categories = [], selectedCategory, setSelectedCategory,
  brands = [], selectedBrand, setSelectedBrand,
  locations = [], selectedLocation, setSelectedLocation,
}) {
  const [activeTab, setActiveTab] = React.useState("channel");
  const [searchTerm, setSearchTerm] = React.useState("");

  const [draftChannel, setDraftChannel] = React.useState(selectedChannel);
  const [draftPlatform, setDraftPlatform] = React.useState(platform);
  const [draftCategory, setDraftCategory] = React.useState(selectedCategory);
  const [draftBrand, setDraftBrand] = React.useState(selectedBrand);
  const [draftLocation, setDraftLocation] = React.useState(selectedLocation);

  const [localPlatforms, setLocalPlatforms] = React.useState(platforms);
  const [localCategories, setLocalCategories] = React.useState(categories);
  const [localBrands, setLocalBrands] = React.useState(brands);

  React.useEffect(() => {
    if (open) {
      setDraftChannel(selectedChannel);
      setDraftPlatform(platform);
      setDraftCategory(selectedCategory);
      setDraftBrand(selectedBrand);
      setDraftLocation(selectedLocation);

      setLocalPlatforms(platforms);
      setLocalCategories(categories);
      setLocalBrands(brands);

      setActiveTab("channel");
      setSearchTerm("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // CASCADE: Channel -> Platforms
  React.useEffect(() => {
    if (!open) return;
    const channelParam = draftChannel === "All" ? undefined : (Array.isArray(draftChannel) ? draftChannel.join(",") : draftChannel);

    axiosInstance.get("/performance-marketing/platforms", { params: { channel: channelParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalPlatforms(res.data);
          setDraftPlatform(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(p => res.data.includes(p));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftChannel, open]);

  // CASCADE: Platform -> Categories & Brands
  React.useEffect(() => {
    if (!open) return;
    if (draftPlatform === "All") return;
    const platformParam = Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform;

    // Categories
    axiosInstance.get("/performance-marketing/categories", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const cats = res.data.filter(c => c !== "All");
          setLocalCategories(cats);
          setDraftCategory(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(c => cats.includes(c));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === cats.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });

    // Brands
    axiosInstance.get("/performance-marketing/brands", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalBrands(res.data);
          setDraftBrand(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(b => res.data.includes(b));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftPlatform, open]);

  React.useEffect(() => { setSearchTerm(""); }, [activeTab]);

  const tabConfig = {
    channel: { options: channels, value: draftChannel, onChange: setDraftChannel },
    platform: { options: localPlatforms, value: draftPlatform, onChange: setDraftPlatform },
    category: { options: localCategories, value: draftCategory, onChange: setDraftCategory },
    brand: { options: localBrands, value: draftBrand, onChange: setDraftBrand },
    location: { options: locations, value: draftLocation, onChange: setDraftLocation },
  };

  const { options, value, onChange } = tabConfig[activeTab];

  const getSelected = (v, opts) => {
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return [...opts];
    if (Array.isArray(v)) return v;
    if (!v) return [];
    return [v];
  };

  const selected = getSelected(value, options);
  const filteredOptions = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggle = (opt) => {
    let next;
    if (selected.includes(opt)) {
      next = selected.filter(s => s !== opt && s !== "All");
    } else {
      next = [...selected.filter(s => s !== "All"), opt];
    }
    if (next.length === options.length && options.length > 0) onChange("All");
    else onChange(next);
  };

  const selectAll = () => onChange("All");
  const clearAll = () => onChange([]);

  const tabMeta = PERFORMANCE_FILTER_TABS.find(t => t.key === activeTab);

  const countFor = (key) => {
    const cfg = tabConfig[key];
    const v = cfg.value;
    const opts = cfg.options;
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return 0;
    if (Array.isArray(v) && v.length === opts.length && opts.length > 0) return 0;
    if (Array.isArray(v)) return v.length;
    if (v) return 1;
    return 0;
  };

  const handleApply = () => {
    setSelectedChannel(draftChannel);
    setPlatform(draftPlatform);
    setSelectedCategory(draftCategory);
    setSelectedBrand(draftBrand);
    setSelectedLocation(draftLocation);
    onClose();
  };

  const handleCancel = () => onClose();

  const handleResetAll = () => {
    setDraftChannel("All");
    setDraftPlatform("All");
    setDraftCategory("All");
    setDraftBrand("All");
    setDraftLocation("All");
  };

  const totalActiveCount = PERFORMANCE_FILTER_TABS.reduce((sum, t) => sum + countFor(t.key), 0);

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "18px", boxShadow: "0 30px 60px -15px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)", overflow: "hidden", height: "540px", display: "flex", flexDirection: "column", background: "#fff", } }}>
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Box sx={{ width: 230, flexShrink: 0, background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", }}>
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2, background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)", display: "flex", alignItems: "center", gap: 1.2, }}>
            <Box sx={{ width: 32, height: 32, borderRadius: "10px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", }}>
              <SlidersHorizontal size={16} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "white", fontFamily: "'Inter', 'Roboto', sans-serif", lineHeight: 1.2, }}>Filters</Typography>
              <Typography sx={{ fontSize: "0.65rem", fontWeight: 500, color: "rgba(255,255,255,0.7)", fontFamily: "'Inter', 'Roboto', sans-serif", }}>{totalActiveCount > 0 ? `${totalActiveCount} active` : "None active"}</Typography>
            </Box>
          </Box>
          <Box sx={{ pt: 1.5, pb: 1, flex: 1 }}>
            {PERFORMANCE_FILTER_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const cnt = countFor(tab.key);
              const TabIcon = tab.icon;
              return (
                <Box key={tab.key} onClick={() => setActiveTab(tab.key)} sx={{ mx: 1, mb: 0.5, px: 1.8, py: 1.3, cursor: "pointer", display: "flex", alignItems: "center", gap: 1.2, borderRadius: "10px", bgcolor: isActive ? "white" : "transparent", color: isActive ? "#1e3a5f" : "#64748b", fontWeight: isActive ? 700 : 500, fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: isActive ? "0 2px 8px rgba(37,99,235,0.10)" : "none", border: isActive ? "1px solid rgba(37,99,235,0.12)" : "1px solid transparent", "&:hover": { bgcolor: isActive ? "white" : "rgba(255,255,255,0.65)", transform: "translateX(2px)", }, }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: "8px", background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease", }}>
                    <TabIcon size={14} color={isActive ? "white" : "#94a3b8"} />
                  </Box>
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {cnt > 0 && (
                    <Box component="span" sx={{ background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#94a3b8", color: "white", borderRadius: "6px", px: 0.7, py: 0.15, fontSize: "0.6rem", fontWeight: 700, minWidth: 18, textAlign: "center", lineHeight: "16px", }}>{cnt}</Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5, position: "relative" }}>
            <IconButton onClick={handleCancel} sx={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, bgcolor: "#f1f5f9", "&:hover": { bgcolor: "#e2e8f0" }, transition: "all 0.15s ease", }}>
              <X size={16} color="#64748b" />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 5 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'Inter', 'Roboto', sans-serif", color: "#0f172a", letterSpacing: "-0.01em" }}>{tabMeta?.label}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", mt: 0.2, fontFamily: "'Inter', 'Roboto', sans-serif" }}>Select {tabMeta?.label.toLowerCase()}s to filter your dashboard</Typography>
              </Box>
              <Box sx={{ background: selected.length === options.length ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#f1f5f9", color: selected.length === options.length ? "white" : "#475569", borderRadius: "20px", px: 1.5, py: 0.4, fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.2s ease", }}>{selected.length === options.length ? "All" : selected.length} selected</Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 1.5 }}>
              <Button size="small" variant="outlined" onClick={selectAll} sx={{ textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#2563eb", color: "#2563eb", bgcolor: "#eff6ff" }, transition: "all 0.15s ease", }}>Select all</Button>
              <Button size="small" variant="outlined" onClick={clearAll} sx={{ textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#ef4444", color: "#ef4444", bgcolor: "#fef2f2" }, transition: "all 0.15s ease", }}>Clear</Button>
              <TextField size="small" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: <Search size={14} style={{ marginRight: 6, color: "#94a3b8" }} />, sx: { borderRadius: "10px", bgcolor: "#f8fafc", height: "32px", fontSize: "0.78rem", fontFamily: "'Inter', 'Roboto', sans-serif", "& fieldset": { borderColor: "#e2e8f0" }, "&:hover fieldset": { borderColor: "#cbd5e1 !important" }, "&.Mui-focused fieldset": { borderColor: "#2563eb !important", borderWidth: "1.5px !important" }, }, }} sx={{ ml: "auto", width: 190 }} />
            </Box>
          </Box>
          <Divider sx={{ borderColor: "#f1f5f9" }} />
          <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 0.5, "&::-webkit-scrollbar": { width: "5px" }, "&::-webkit-scrollbar-track": { bgcolor: "transparent" }, "&::-webkit-scrollbar-thumb": { bgcolor: "#d1d5db", borderRadius: "10px" }, "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#9ca3af" }, }}>
            {filteredOptions.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}><Search size={32} color="#cbd5e1" style={{ marginBottom: 8 }} /><Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif" }}>No results found</Typography></Box>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <Box key={opt} onClick={() => toggle(opt)} sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1, mx: 0.5, my: 0.3, cursor: "pointer", borderRadius: "10px", bgcolor: isChecked ? "#eff6ff" : "transparent", border: isChecked ? "1px solid #bfdbfe" : "1px solid transparent", transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)", "&:hover": { bgcolor: isChecked ? "#dbeafe" : "#f8fafc", transform: "translateX(2px)", }, }}>
                    <Checkbox size="small" checked={isChecked} sx={{ p: 0.3, color: "#cbd5e1", "&.Mui-checked": { color: "#2563eb" }, transition: "all 0.15s ease", }} />
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: isChecked ? 600 : 450, color: isChecked ? "#1e40af" : "#475569", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.15s ease", textTransform: 'capitalize' }}>{opt}</Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", px: 3, py: 1.8, background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)", }}>
        <Button variant="text" onClick={handleResetAll} startIcon={<X size={14} />} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem", color: "#ef4444", px: 1.5, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { bgcolor: "#fef2f2" }, transition: "all 0.15s ease", }}>Reset All</Button>
        <Box sx={{ display: "flex", gap: 1.2 }}>
          <Button variant="outlined" onClick={handleCancel} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem", borderColor: "#e2e8f0", color: "#64748b", px: 2.5, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" }, transition: "all 0.15s ease", }}>Cancel</Button>
          <Button variant="contained" onClick={handleApply} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.8rem", background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "white", px: 3.5, py: 0.8, fontFamily: "'Inter', 'Roboto', sans-serif", boxShadow: "0 4px 14px rgba(37,99,235,0.35)", "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37,99,235,0.45)", transform: "translateY(-1px)", }, transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", }}>Apply Filters</Button>
        </Box>
      </Box>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONTENT ANALYSIS FILTER MODAL — Channel, Platform, Category, Brand, Location
   ═══════════════════════════════════════════════════════════════════ */
const CONTENT_FILTER_TABS = [
  { key: "channel", label: "Channel", icon: Layers },
  { key: "category", label: "Category", icon: LayoutGrid },
  { key: "brand", label: "Brand", icon: Tag },
  { key: "location", label: "Location", icon: MapPin },
];

function ContentFilterModal({
  open, onClose,
  channels, selectedChannel, setSelectedChannel,
  platforms, platform, setPlatform,
  categories, selectedCategory, setSelectedCategory,
  brands, selectedBrand, setSelectedBrand,
  locations, selectedLocation, setSelectedLocation,
}) {
  const [activeTab, setActiveTab] = React.useState("channel");
  const [searchTerm, setSearchTerm] = React.useState("");

  const [draftChannel, setDraftChannel] = React.useState(selectedChannel);
  const [draftPlatform, setDraftPlatform] = React.useState(platform);
  const [draftCategory, setDraftCategory] = React.useState(selectedCategory);
  const [draftBrand, setDraftBrand] = React.useState(selectedBrand);
  const [draftLocation, setDraftLocation] = React.useState(selectedLocation);

  const [localPlatforms, setLocalPlatforms] = React.useState(platforms);
  const [localCategories, setLocalCategories] = React.useState(categories);
  const [localBrands, setLocalBrands] = React.useState(brands);

  React.useEffect(() => {
    if (open) {
      setDraftChannel(selectedChannel);
      setDraftPlatform(platform);
      setDraftCategory(selectedCategory);
      setDraftBrand(selectedBrand);
      setDraftLocation(selectedLocation);

      setLocalPlatforms(platforms);
      setLocalCategories(categories);
      setLocalBrands(brands);

      setActiveTab("channel");
      setSearchTerm("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // CASCADE: Channel -> Platforms
  React.useEffect(() => {
    if (!open) return;
    const channelParam = draftChannel === "All" ? undefined : (Array.isArray(draftChannel) ? draftChannel.join(",") : draftChannel);

    axiosInstance.get("/content-analysis/platforms", { params: { channel: channelParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalPlatforms(res.data);
          setDraftPlatform(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(p => res.data.includes(p));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftChannel, open]);

  // CASCADE: Platform -> Categories & Brands
  React.useEffect(() => {
    if (!open) return;
    if (draftPlatform === "All") return;
    const platformParam = Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform;

    // Categories
    axiosInstance.get("/content-analysis/categories", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const cats = res.data.filter(c => c !== "All");
          setLocalCategories(cats);
          setDraftCategory(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(c => cats.includes(c));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === cats.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });

    // Brands
    axiosInstance.get("/content-analysis/brands", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalBrands(res.data);
          setDraftBrand(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(b => res.data.includes(b));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftPlatform, open]);

  React.useEffect(() => { setSearchTerm(""); }, [activeTab]);

  const tabConfig = {
    channel: { options: channels, value: draftChannel, onChange: setDraftChannel },
    platform: { options: localPlatforms, value: draftPlatform, onChange: setDraftPlatform },
    category: { options: localCategories, value: draftCategory, onChange: setDraftCategory },
    brand: { options: localBrands, value: draftBrand, onChange: setDraftBrand },
    location: { options: locations, value: draftLocation, onChange: setDraftLocation },
  };

  const { options, value, onChange } = tabConfig[activeTab];

  const getSelected = (v, opts) => {
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return [...opts];
    if (Array.isArray(v)) return v;
    if (!v) return [];
    return [v];
  };

  const selected = getSelected(value, options);
  const filteredOptions = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggle = (opt) => {
    let next;
    if (selected.includes(opt)) {
      next = selected.filter(s => s !== opt && s !== "All");
    } else {
      next = [...selected.filter(s => s !== "All"), opt];
    }
    if (next.length === options.length && options.length > 0) onChange("All");
    else onChange(next);
  };

  const selectAll = () => onChange("All");
  const clearAll = () => onChange([]);

  const tabMeta = CONTENT_FILTER_TABS.find(t => t.key === activeTab);

  const countFor = (key) => {
    const cfg = tabConfig[key];
    const v = cfg.value;
    const opts = cfg.options;
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return 0;
    if (Array.isArray(v) && v.length === opts.length && opts.length > 0) return 0;
    if (Array.isArray(v)) return v.length;
    if (v) return 1;
    return 0;
  };

  const handleApply = () => {
    setSelectedChannel(draftChannel);
    setPlatform(draftPlatform);
    setSelectedCategory(draftCategory);
    setSelectedBrand(draftBrand);
    setSelectedLocation(draftLocation);
    onClose();
  };

  const handleCancel = () => onClose();

  const handleResetAll = () => {
    setDraftChannel("All");
    setDraftPlatform("All");
    setDraftCategory("All");
    setDraftBrand("All");
    setDraftLocation("All");
  };

  const totalActiveCount = CONTENT_FILTER_TABS.reduce((sum, t) => sum + countFor(t.key), 0);

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "18px", boxShadow: "0 30px 60px -15px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)", overflow: "hidden", height: "540px", display: "flex", flexDirection: "column", background: "#fff", } }}>
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Box sx={{ width: 230, flexShrink: 0, background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", }}>
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2, background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)", display: "flex", alignItems: "center", gap: 1.2, }}>
            <Box sx={{ width: 32, height: 32, borderRadius: "10px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", }}>
              <SlidersHorizontal size={16} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "white", fontFamily: "'Inter', 'Roboto', sans-serif", lineHeight: 1.2, }}>Filters</Typography>
              <Typography sx={{ fontSize: "0.65rem", fontWeight: 500, color: "rgba(255,255,255,0.7)", fontFamily: "'Inter', 'Roboto', sans-serif", }}>{totalActiveCount > 0 ? `${totalActiveCount} active` : "None active"}</Typography>
            </Box>
          </Box>
          <Box sx={{ pt: 1.5, pb: 1, flex: 1 }}>
            {CONTENT_FILTER_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const cnt = countFor(tab.key);
              const TabIcon = tab.icon;
              return (
                <Box key={tab.key} onClick={() => setActiveTab(tab.key)} sx={{ mx: 1, mb: 0.5, px: 1.8, py: 1.3, cursor: "pointer", display: "flex", alignItems: "center", gap: 1.2, borderRadius: "10px", bgcolor: isActive ? "white" : "transparent", color: isActive ? "#1e3a5f" : "#64748b", fontWeight: isActive ? 700 : 500, fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: isActive ? "0 2px 8px rgba(37,99,235,0.10)" : "none", border: isActive ? "1px solid rgba(37,99,235,0.12)" : "1px solid transparent", "&:hover": { bgcolor: isActive ? "white" : "rgba(255,255,255,0.65)", transform: "translateX(2px)", }, }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: "8px", background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease", }}>
                    <TabIcon size={14} color={isActive ? "white" : "#94a3b8"} />
                  </Box>
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {cnt > 0 && (
                    <Box component="span" sx={{ background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#94a3b8", color: "white", borderRadius: "6px", px: 0.7, py: 0.15, fontSize: "0.6rem", fontWeight: 700, minWidth: 18, textAlign: "center", lineHeight: "16px", }}>{cnt}</Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5, position: "relative" }}>
            <IconButton onClick={handleCancel} sx={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, bgcolor: "#f1f5f9", "&:hover": { bgcolor: "#e2e8f0" }, transition: "all 0.15s ease", }}>
              <X size={16} color="#64748b" />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 5 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'Inter', 'Roboto', sans-serif", color: "#0f172a", letterSpacing: "-0.01em" }}>{tabMeta?.label}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", mt: 0.2, fontFamily: "'Inter', 'Roboto', sans-serif" }}>Select {tabMeta?.label.toLowerCase()}s to filter your dashboard</Typography>
              </Box>
              <Box sx={{ background: selected.length === options.length ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#f1f5f9", color: selected.length === options.length ? "white" : "#475569", borderRadius: "20px", px: 1.5, py: 0.4, fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.2s ease", }}>{selected.length === options.length ? "All" : selected.length} selected</Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 1.5 }}>
              <Button size="small" variant="outlined" onClick={selectAll} sx={{ textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#2563eb", color: "#2563eb", bgcolor: "#eff6ff" }, transition: "all 0.15s ease", }}>Select all</Button>
              <Button size="small" variant="outlined" onClick={clearAll} sx={{ textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#ef4444", color: "#ef4444", bgcolor: "#fef2f2" }, transition: "all 0.15s ease", }}>Clear</Button>
              <TextField size="small" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: <Search size={14} style={{ marginRight: 6, color: "#94a3b8" }} />, sx: { borderRadius: "10px", bgcolor: "#f8fafc", height: "32px", fontSize: "0.78rem", fontFamily: "'Inter', 'Roboto', sans-serif", "& fieldset": { borderColor: "#e2e8f0" }, "&:hover fieldset": { borderColor: "#cbd5e1 !important" }, "&.Mui-focused fieldset": { borderColor: "#2563eb !important", borderWidth: "1.5px !important" }, }, }} sx={{ ml: "auto", width: 190 }} />
            </Box>
          </Box>
          <Divider sx={{ borderColor: "#f1f5f9" }} />
          <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 0.5, "&::-webkit-scrollbar": { width: "5px" }, "&::-webkit-scrollbar-track": { bgcolor: "transparent" }, "&::-webkit-scrollbar-thumb": { bgcolor: "#d1d5db", borderRadius: "10px" }, "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#9ca3af" }, }}>
            {filteredOptions.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}><Search size={32} color="#cbd5e1" style={{ marginBottom: 8 }} /><Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif" }}>No results found</Typography></Box>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <Box key={opt} onClick={() => toggle(opt)} sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1, mx: 0.5, my: 0.3, cursor: "pointer", borderRadius: "10px", bgcolor: isChecked ? "#eff6ff" : "transparent", border: isChecked ? "1px solid #bfdbfe" : "1px solid transparent", transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)", "&:hover": { bgcolor: isChecked ? "#dbeafe" : "#f8fafc", transform: "translateX(2px)", }, }}>
                    <Checkbox size="small" checked={isChecked} sx={{ p: 0.3, color: "#cbd5e1", "&.Mui-checked": { color: "#2563eb" }, transition: "all 0.15s ease", }} />
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: isChecked ? 600 : 450, color: isChecked ? "#1e40af" : "#475569", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.15s ease", textTransform: 'capitalize' }}>{opt}</Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", px: 3, py: 1.8, background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)", }}>
        <Button variant="text" onClick={handleResetAll} startIcon={<X size={14} />} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem", color: "#ef4444", px: 1.5, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { bgcolor: "#fef2f2" }, transition: "all 0.15s ease", }}>Reset All</Button>
        <Box sx={{ display: "flex", gap: 1.2 }}>
          <Button variant="outlined" onClick={handleCancel} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem", borderColor: "#e2e8f0", color: "#64748b", px: 2.5, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" }, transition: "all 0.15s ease", }}>Cancel</Button>
          <Button variant="contained" onClick={handleApply} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.8rem", background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "white", px: 3.5, py: 0.8, fontFamily: "'Inter', 'Roboto', sans-serif", boxShadow: "0 4px 14px rgba(37,99,235,0.35)", "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37,99,235,0.45)", transform: "translateY(-1px)", }, transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", }}>Apply Filters</Button>
        </Box>
      </Box>
    </Dialog>
  );
}

const INVENTORY_FILTER_TABS = [
  { key: "channel", label: "Channel", icon: Layers },
  { key: "category", label: "Category", icon: LayoutGrid },
  { key: "brand", label: "Brand", icon: Tag },
  { key: "location", label: "Location", icon: MapPin },
];

function InventoryFilterModal({
  open, onClose,
  channels, selectedChannel, setSelectedChannel,
  platforms, platform, setPlatform,
  categories, selectedCategory, setSelectedCategory,
  brands, selectedBrand, setSelectedBrand,
  locations, selectedLocation, setSelectedLocation,
}) {
  const [activeTab, setActiveTab] = React.useState("channel");
  const [searchTerm, setSearchTerm] = React.useState("");

  const [draftChannel, setDraftChannel] = React.useState(selectedChannel);
  const [draftPlatform, setDraftPlatform] = React.useState(platform);
  const [draftCategory, setDraftCategory] = React.useState(selectedCategory);
  const [draftBrand, setDraftBrand] = React.useState(selectedBrand);
  const [draftLocation, setDraftLocation] = React.useState(selectedLocation);

  const [localPlatforms, setLocalPlatforms] = React.useState(platforms);
  const [localCategories, setLocalCategories] = React.useState(categories);
  const [localBrands, setLocalBrands] = React.useState(brands);
  const [localLocations, setLocalLocations] = React.useState(locations);

  React.useEffect(() => {
    if (open) {
      setDraftChannel(selectedChannel);
      setDraftPlatform(platform);
      setDraftCategory(selectedCategory);
      setDraftBrand(selectedBrand);
      setDraftLocation(selectedLocation);

      setLocalPlatforms(platforms);
      setLocalCategories(categories);
      setLocalBrands(brands);
      setLocalLocations(locations);

      setActiveTab("channel");
      setSearchTerm("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // CASCADE: Channel -> Platforms
  React.useEffect(() => {
    if (!open) return;
    const channelParam = draftChannel === "All" ? undefined : (Array.isArray(draftChannel) ? draftChannel.join(",") : draftChannel);

    axiosInstance.get("/inventory-analysis/platforms", { params: { channel: channelParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalPlatforms(res.data);
          setDraftPlatform(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(p => res.data.includes(p));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftChannel, open]);

  // CASCADE: Platform -> Categories
  React.useEffect(() => {
    if (!open) return;
    const platformParam = draftPlatform === "All" ? undefined : (Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform);

    axiosInstance.get("/inventory-analysis/categories", { params: { platform: platformParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalCategories(res.data);
          setDraftCategory(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(c => res.data.includes(c));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftPlatform, open]);

  // CASCADE: Category -> Brands
  React.useEffect(() => {
    if (!open) return;
    const platformParam = draftPlatform === "All" ? undefined : (Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform);
    const categoryParam = draftCategory === "All" ? undefined : (Array.isArray(draftCategory) ? draftCategory.join(",") : draftCategory);

    axiosInstance.get("/inventory-analysis/brands", { params: { platform: platformParam, category: categoryParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalBrands(res.data);
          setDraftBrand(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(b => res.data.includes(b));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftCategory, draftPlatform, open]);

  // CASCADE: Brand -> Locations
  React.useEffect(() => {
    if (!open) return;
    const platformParam = draftPlatform === "All" ? undefined : (Array.isArray(draftPlatform) ? draftPlatform.join(",") : draftPlatform);
    const categoryParam = draftCategory === "All" ? undefined : (Array.isArray(draftCategory) ? draftCategory.join(",") : draftCategory);
    const brandParam = draftBrand === "All" ? undefined : (Array.isArray(draftBrand) ? draftBrand.join(",") : draftBrand);

    axiosInstance.get("/inventory-analysis/locations", { params: { platform: platformParam, brand: brandParam, category: categoryParam } })
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setLocalLocations(res.data);
          setDraftLocation(prev => {
            if (prev === "All") return "All";
            const currList = Array.isArray(prev) ? prev : [prev];
            const valid = currList.filter(l => res.data.includes(l));
            if (valid.length === 0) return (Array.isArray(prev) && prev.length === 0) ? [] : "All";
            return valid.length === res.data.length ? "All" : (valid.length === 1 ? valid[0] : valid);
          });
        }
      })
      .catch(() => { });
  }, [draftBrand, draftCategory, draftPlatform, open]);

  React.useEffect(() => { setSearchTerm(""); }, [activeTab]);

  const tabConfig = {
    channel: { options: channels, value: draftChannel, onChange: setDraftChannel },
    platform: { options: localPlatforms, value: draftPlatform, onChange: setDraftPlatform },
    category: { options: localCategories, value: draftCategory, onChange: setDraftCategory },
    brand: { options: localBrands, value: draftBrand, onChange: setDraftBrand },
    location: { options: localLocations, value: draftLocation, onChange: setDraftLocation },
  };

  const { options, value, onChange } = tabConfig[activeTab] || {};

  const getSelected = (v, opts) => {
    if (!opts) return [];
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return [...opts];
    if (Array.isArray(v)) return v;
    if (!v) return [];
    return [v];
  };

  const selected = getSelected(value, options);
  const filteredOptions = (options || []).filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggle = (opt) => {
    let next;
    if (selected.includes(opt)) {
      next = selected.filter(s => s !== opt && s !== "All");
    } else {
      next = [...selected.filter(s => s !== "All"), opt];
    }
    if (next.length === (options || []).length && (options || []).length > 0) onChange("All");
    else onChange(next);
  };

  const selectAll = () => onChange("All");
  const clearAll = () => onChange([]);

  const tabMeta = INVENTORY_FILTER_TABS.find(t => t.key === activeTab);

  const countFor = (key) => {
    const cfg = tabConfig[key];
    const v = cfg.value;
    const opts = cfg.options;
    if (v === "All" || (Array.isArray(v) && v.includes("All"))) return 0;
    if (Array.isArray(v) && v.length === (opts || []).length && (opts || []).length > 0) return 0;
    if (Array.isArray(v)) return v.length;
    if (v) return 1;
    return 0;
  };

  const handleApply = () => {
    setSelectedChannel(draftChannel);
    setPlatform(draftPlatform);
    setSelectedCategory(draftCategory);
    setSelectedBrand(draftBrand);
    setSelectedLocation(draftLocation);
    onClose();
  };

  const handleCancel = () => onClose();

  const handleResetAll = () => {
    setDraftChannel("All");
    setDraftPlatform("All");
    setDraftCategory("All");
    setDraftBrand("All");
    setDraftLocation("All");
  };

  const totalActiveCount = INVENTORY_FILTER_TABS.reduce((sum, t) => sum + countFor(t.key), 0);

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "18px", boxShadow: "0 30px 60px -15px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)", overflow: "hidden", height: "540px", display: "flex", flexDirection: "column", background: "#fff", } }}>
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Box sx={{ width: 230, flexShrink: 0, background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", }}>
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2, background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)", display: "flex", alignItems: "center", gap: 1.2, }}>
            <Box sx={{ width: 32, height: 32, borderRadius: "10px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", }}>
              <SlidersHorizontal size={16} color="white" />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "white", fontFamily: "'Inter', 'Roboto', sans-serif", lineHeight: 1.2, }}>Filters</Typography>
              <Typography sx={{ fontSize: "0.65rem", fontWeight: 500, color: "rgba(255,255,255,0.7)", fontFamily: "'Inter', 'Roboto', sans-serif", }}>{totalActiveCount > 0 ? `${totalActiveCount} active` : "None active"}</Typography>
            </Box>
          </Box>
          <Box sx={{ pt: 1.5, pb: 1, flex: 1 }}>
            {INVENTORY_FILTER_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const cnt = countFor(tab.key);
              const TabIcon = tab.icon;
              return (
                <Box key={tab.key} onClick={() => setActiveTab(tab.key)} sx={{ mx: 1, mb: 0.5, px: 1.8, py: 1.3, cursor: "pointer", display: "flex", alignItems: "center", gap: 1.2, borderRadius: "10px", bgcolor: isActive ? "white" : "transparent", color: isActive ? "#1e3a5f" : "#64748b", fontWeight: isActive ? 700 : 500, fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: isActive ? "0 2px 8px rgba(37,99,235,0.10)" : "none", border: isActive ? "1px solid rgba(37,99,235,0.12)" : "1px solid transparent", "&:hover": { bgcolor: isActive ? "white" : "rgba(255,255,255,0.65)", transform: "translateX(2px)", }, }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: "8px", background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease", }}>
                    <TabIcon size={14} color={isActive ? "white" : "#94a3b8"} />
                  </Box>
                  <span style={{ flex: 1 }}>{tab.label}</span>
                  {cnt > 0 && (
                    <Box component="span" sx={{ background: isActive ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#94a3b8", color: "white", borderRadius: "6px", px: 0.7, py: 0.15, fontSize: "0.6rem", fontWeight: 700, minWidth: 18, textAlign: "center", lineHeight: "16px", }}>{cnt}</Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box sx={{ px: 3, pt: 2.5, pb: 1.5, position: "relative" }}>
            <IconButton onClick={handleCancel} sx={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, bgcolor: "#f1f5f9", "&:hover": { bgcolor: "#e2e8f0" }, transition: "all 0.15s ease", }}>
              <X size={16} color="#64748b" />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 5 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'Inter', 'Roboto', sans-serif", color: "#0f172a", letterSpacing: "-0.01em" }}>{tabMeta?.label}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: "#94a3b8", mt: 0.2, fontFamily: "'Inter', 'Roboto', sans-serif" }}>Select {tabMeta?.label.toLowerCase()}s to filter your dashboard</Typography>
              </Box>
              <Box sx={{ background: selected.length === (options || []).length ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#f1f5f9", color: selected.length === (options || []).length ? "white" : "#475569", borderRadius: "20px", px: 1.5, py: 0.4, fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.2s ease", }}>{selected.length === (options || []).length ? "All" : selected.length} selected</Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 1.5 }}>
              <Button size="small" variant="outlined" onClick={selectAll} sx={{ textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#2563eb", color: "#2563eb", bgcolor: "#eff6ff" }, transition: "all 0.15s ease", }}>Select all</Button>
              <Button size="small" variant="outlined" onClick={clearAll} sx={{ textTransform: "none", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 600, borderColor: "#e2e8f0", color: "#334155", px: 1.5, py: 0.3, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#ef4444", color: "#ef4444", bgcolor: "#fef2f2" }, transition: "all 0.15s ease", }}>Clear</Button>
              <TextField size="small" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: <Search size={14} style={{ marginRight: 6, color: "#94a3b8" }} />, sx: { borderRadius: "10px", bgcolor: "#f8fafc", height: "32px", fontSize: "0.78rem", fontFamily: "'Inter', 'Roboto', sans-serif", "& fieldset": { borderColor: "#e2e8f0" }, "&:hover fieldset": { borderColor: "#cbd5e1 !important" }, "&.Mui-focused fieldset": { borderColor: "#2563eb !important", borderWidth: "1.5px !important" }, }, }} sx={{ ml: "auto", width: 190 }} />
            </Box>
          </Box>
          <Divider sx={{ borderColor: "#f1f5f9" }} />
          <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 0.5, "&::-webkit-scrollbar": { width: "5px" }, "&::-webkit-scrollbar-track": { bgcolor: "transparent" }, "&::-webkit-scrollbar-thumb": { bgcolor: "#d1d5db", borderRadius: "10px" }, "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#9ca3af" }, }}>
            {(filteredOptions || []).length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}><Search size={32} color="#cbd5e1" style={{ marginBottom: 8 }} /><Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", fontFamily: "'Inter', 'Roboto', sans-serif" }}>No results found</Typography></Box>
            ) : (
              (filteredOptions || []).map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <Box key={opt} onClick={() => toggle(opt)} sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1, mx: 0.5, my: 0.3, cursor: "pointer", borderRadius: "10px", bgcolor: isChecked ? "#eff6ff" : "transparent", border: isChecked ? "1px solid #bfdbfe" : "1px solid transparent", transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)", "&:hover": { bgcolor: isChecked ? "#dbeafe" : "#f8fafc", transform: "translateX(2px)", }, }}>
                    <Checkbox size="small" checked={isChecked} sx={{ p: 0.3, color: "#cbd5e1", "&.Mui-checked": { color: "#2563eb" }, transition: "all 0.15s ease", }} />
                    <Typography sx={{ fontSize: "0.84rem", fontWeight: isChecked ? 600 : 450, color: isChecked ? "#1e40af" : "#475569", fontFamily: "'Inter', 'Roboto', sans-serif", transition: "all 0.15s ease", textTransform: 'capitalize' }}>{opt}</Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", px: 3, py: 1.8, background: "linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)", }}>
        <Button variant="text" onClick={handleResetAll} startIcon={<X size={14} />} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem", color: "#ef4444", px: 1.5, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { bgcolor: "#fef2f2" }, transition: "all 0.15s ease", }}>Reset All</Button>
        <Box sx={{ display: "flex", gap: 1.2 }}>
          <Button variant="outlined" onClick={handleCancel} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem", borderColor: "#e2e8f0", color: "#64748b", px: 2.5, fontFamily: "'Inter', 'Roboto', sans-serif", "&:hover": { borderColor: "#cbd5e1", bgcolor: "#f8fafc" }, transition: "all 0.15s ease", }}>Cancel</Button>
          <Button variant="contained" onClick={handleApply} sx={{ textTransform: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.8rem", background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "white", px: 3.5, py: 0.8, fontFamily: "'Inter', 'Roboto', sans-serif", boxShadow: "0 4px 14px rgba(37,99,235,0.35)", "&:hover": { background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", boxShadow: "0 6px 20px rgba(37,99,235,0.45)", transform: "translateY(-1px)", }, transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)", }}>Apply Filters</Button>
        </Box>
      </Box>
    </Dialog>
  );
}

const Header = ({ title = "Business Overview", onMenuClick, hideFilters = false }) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [availFilterModalOpen, setAvailFilterModalOpen] = React.useState(false);
  const [visibilityFilterModalOpen, setVisibilityFilterModalOpen] = React.useState(false);
  const [pricingFilterModalOpen, setPricingFilterModalOpen] = React.useState(false);
  const [performanceFilterModalOpen, setPerformanceFilterModalOpen] = React.useState(false);
  const [marketShareFilterModalOpen, setMarketShareFilterModalOpen] = React.useState(false);
  const [contentFilterModalOpen, setContentFilterModalOpen] = React.useState(false);
  const [inventoryFilterModalOpen, setInventoryFilterModalOpen] = React.useState(false);
  const [osaFilterModalOpen, setOsaFilterModalOpen] = React.useState(false);

  const {
    channels,
    selectedChannel,
    setSelectedChannel,
    brands,
    selectedBrand,
    setSelectedBrand,
    keywords,
    selectedKeyword,
    setSelectedKeyword,
    keywordTypes,
    selectedKeywordType,
    setSelectedKeywordType,
    locations,
    selectedLocation,
    setSelectedLocation,
    platforms,
    platform,
    setPlatform,
    timeStart,
    setTimeStart,
    timeEnd,
    setTimeEnd,
    setUserSetDate,
    compareStart,
    setCompareStart,
    compareEnd,
    setCompareEnd,
    setComparisonLabel,
    categories,
    visibilityCategories,
    selectedCategory,
    setSelectedCategory,
    maxDate,
    datesFetched,
    visibilityMode,
    setVisibilityMode,
  } = React.useContext(FilterContext);

  const location = useLocation();

  // 🌗 Dark/Light Mode

  const isGeoPage = location.pathname === "/geo-intelligence";

  if (isGeoPage) {
    return (
      <Box
        sx={{
          display: { xs: "flex", sm: "none" },
          bgcolor: (theme) => theme.palette.background.paper,
          borderBottom: "1px solid",
          borderColor: "#e5e7eb",
          px: 2,
          py: 0.8,
          position: "sticky",
          top: 0,
          zIndex: 1200,
          alignItems: "center"
        }}
      >
        <IconButton
          onClick={onMenuClick}
          sx={{ display: "block", p: 0.5 }}
        >
          <MenuIcon />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: (theme) => theme.palette.background.paper,
        borderBottom: "1px solid",
        borderColor: "#e5e7eb",
        px: { xs: 2, sm: 3 },
        py: 0.8,
        position: "sticky",
        top: 0,
        zIndex: 1200,
        transition: "all 0.3s ease",
      }}
    >
      {/* ---------------- FIRST ROW ---------------- */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: { xs: "wrap", md: "nowrap" },
          gap: 1.5,
          alignItems: { xs: "flex-start", md: "center" },
          pb: 0.5,
        }}
      >
        {/* LEFT SIDE */}
        <Box sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          width: { xs: "100%", md: "auto" },
          justifyContent: { xs: "space-between", md: "flex-start" }
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              onClick={onMenuClick}
              sx={{ display: { xs: "block", sm: "none" }, p: 0.5 }}
            >
              <MenuIcon />
            </IconButton>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {!hideFilters && location.pathname !== "/scheduled-reports" && (
                <IconButton
                  size="small"
                  onClick={() => setIsExpanded(!isExpanded)}
                  sx={{
                    bgcolor: "#f1f5f9",
                    "&:hover": { bgcolor: "#e2e8f0" },
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.3s ease",
                  }}
                >
                  <ChevronDown size={18} />
                </IconButton>
              )}

              {title && (
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography
                    fontWeight="600"
                    sx={{ whiteSpace: "nowrap", lineHeight: 1.2, fontSize: { xs: "0.9rem", sm: "1.0rem" } }}
                  >
                    {title}
                  </Typography>
                  {title === "Availability Analysis" || title === "Visibility Analysis" ? (
                    <>
                      {/* Channel Switch Removed as per user request */}                      {/* SOS / BSR Toggle below Channel Switch */}
                      {title === "Visibility Analysis" && (['ecommerce', 'e-commerce', 'ecom'].includes(selectedChannel?.toLowerCase())) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Box sx={{ display: 'flex', bgcolor: '#f1f5f9', borderRadius: '8px', p: '3px', width: 'fit-content', border: '1px solid #e2e8f0' }}>
                            <Box
                              onClick={() => setVisibilityMode('sos')}
                              sx={{
                                px: 1.2, py: 0.2,
                                fontSize: '0.6rem',
                                fontWeight: visibilityMode === 'sos' ? 700 : 500,
                                color: visibilityMode === 'sos' ? '#ffffff' : '#64748b',
                                bgcolor: visibilityMode === 'sos' ? '#6366f1' : 'transparent',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontFamily: "'Inter', 'Roboto', sans-serif"
                              }}
                            >
                              Share of Shelf
                            </Box>
                            {(() => {
                              const isAmazon = platform === 'Amazon' || platform === 'amazon' || (Array.isArray(platform) && platform.some(p => p?.toLowerCase() === 'amazon'));
                              const isBsrDisabled = isAmazon;

                              return (
                                <Box
                                  onClick={() => {
                                    if (isBsrDisabled) return;
                                    setVisibilityMode('bsr');
                                  }}
                                  sx={{
                                    px: 1.2, py: 0.2,
                                    fontSize: '0.6rem',
                                    fontWeight: visibilityMode === 'bsr' ? 700 : 500,
                                    color: visibilityMode === 'bsr' ? '#ffffff' : (isBsrDisabled ? '#94a3b8' : '#64748b'),
                                    bgcolor: visibilityMode === 'bsr' ? '#6366f1' : 'transparent',
                                    borderRadius: '6px',
                                    cursor: isBsrDisabled ? 'not-allowed' : 'pointer',
                                    opacity: isBsrDisabled ? 0.5 : 1,
                                    transition: 'all 0.2s',
                                    fontFamily: "'Inter', 'Roboto', sans-serif"
                                  }}
                                >
                                  BSR
                                </Box>
                              );
                            })()}
                          </Box>

                          <Tooltip title="BSR page contains only Amazon platform data" arrow placement="top">
                            <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                              <Info size={14} />
                            </Box>
                          </Tooltip>
                        </Box>
                      )}
                    </>
                  ) : title !== "Performance Marketing" && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          bgcolor: "#22C55E",
                          flexShrink: 0
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          color: "#64748b",
                          maxWidth: { xs: "150px", sm: "none" },
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>

        </Box>

        {/* FILTERS CONTAINER */}
        <AnimatePresence>
          {!hideFilters && isExpanded && location.pathname !== "/scheduled-reports" && (
            <Box
              component={motion.div}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              sx={{
                display: "flex",
                gap: 1.5,
                flexWrap: { xs: "wrap", md: "nowrap" },
                width: { xs: "100%", md: "auto" },
                overflow: "visible",
              }}
            >

              {/* ============ WATCH TOWER / MARKET SHARE / PRICING ANALYSIS / INVENTORY ANALYSIS: SINGLE FILTER BUTTON ============ */}
              {(title === "Business Overview" || title === "Insights" || title === "Market Share" || title === "Market Coverage" || title === "Availability Analysis" || title === "Visibility Analysis" || title === "Pricing Analysis" || title === "Performance Marketing" || title === "Content Analysis" || title === "Inventory Analysis") ? (
                <>
                  <Box sx={{ display: "flex", alignItems: "flex-end" }}>
                    <Button
                      onClick={() => {
                        if (title === "Business Overview" || title === "Insights") setFilterModalOpen(true);
                        else if (title === "Market Share") setMarketShareFilterModalOpen(true);
                        else if (title === "Availability Analysis") setAvailFilterModalOpen(true);
                        else if (title === "Visibility Analysis") setVisibilityFilterModalOpen(true);
                        else if (title === "Pricing Analysis") setPricingFilterModalOpen(true);
                        else if (title === "Performance Marketing") setPerformanceFilterModalOpen(true);
                        else if (title === "Content Analysis") setContentFilterModalOpen(true);
                        else if (title === "Inventory Analysis") setInventoryFilterModalOpen(true);
                        else if (title === "Market Coverage") setOsaFilterModalOpen(true);
                      }}
                      variant="contained"
                      startIcon={<SlidersHorizontal size={14} strokeWidth={2.5} />}
                      sx={{
                        height: "36px",
                        textTransform: "none",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
                        color: "white",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        fontFamily: "'Inter', 'Roboto', sans-serif",
                        px: 2.2,
                        gap: 0.5,
                        letterSpacing: "0.01em",
                        boxShadow: "0 2px 8px rgba(37,99,235,0.25), 0 1px 3px rgba(0,0,0,0.08)",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        "&:hover": {
                          background: "linear-gradient(135deg, #172e4f 0%, #1d4ed8 100%)",
                          boxShadow: "0 4px 14px rgba(37,99,235,0.35), 0 2px 6px rgba(0,0,0,0.1)",
                          transform: "translateY(-1px)",
                        },
                      }}
                    >
                      Filters
                      {(() => {
                        let count = 0;
                        if (title !== "Business Overview") {
                          if (selectedChannel !== "All" && !(Array.isArray(selectedChannel) && selectedChannel.length === channels.length)) count++;
                          if (platform !== "All" && !(Array.isArray(platform) && platform.length === platforms.length)) count++;
                        }
                        if (selectedCategory !== "All" && !(Array.isArray(selectedCategory) && selectedCategory.length === categories.length)) count++;
                        if (title === "Availability Analysis") {
                          if (selectedBrand !== "All" && !(Array.isArray(selectedBrand) && selectedBrand.includes("All"))) count++;
                          if (selectedLocation !== "All" && !(Array.isArray(selectedLocation) && selectedLocation.length === locations.length)) count++;
                        } else if (title === "Visibility Analysis") {
                          if (selectedBrand !== "All" && !(Array.isArray(selectedBrand) && selectedBrand.includes("All"))) count++;
                          if (selectedKeywordType !== "All" && !(Array.isArray(selectedKeywordType) && selectedKeywordType.includes("All"))) count++;
                          if (selectedKeyword !== "All" && !(Array.isArray(selectedKeyword) && selectedKeyword.includes("All"))) count++;
                        } else if (title === "Pricing Analysis" || title === "Performance Marketing" || title === "Content Analysis" || title === "Inventory Analysis") {
                          if (selectedBrand !== "All" && !(Array.isArray(selectedBrand) && selectedBrand.includes("All"))) count++;
                          if (selectedLocation !== "All" && !(Array.isArray(selectedLocation) && selectedLocation.length === locations.length)) count++;
                        } else if (title !== "Market Share" && title !== "Market Coverage") {
                          if (selectedBrand !== "All" && !(Array.isArray(selectedBrand) && selectedBrand.length === brands.length)) count++;
                        }
                        return count > 0 ? (
                          <Box
                            component="span"
                            sx={{
                              ml: 0.5,
                              bgcolor: "rgba(255,255,255,0.25)",
                              backdropFilter: "blur(4px)",
                              color: "white",
                              borderRadius: "6px",
                              minWidth: 20,
                              height: 20,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              border: "1px solid rgba(255,255,255,0.3)",
                            }}
                          >
                            {count}
                          </Box>
                        ) : null;
                      })()}
                    </Button>
                  </Box>

                  {/* WATCH TOWER FILTER MODAL */}
                  {(title === "Business Overview" || title === "Insights") && (
                    <WatchTowerFilterModal
                      open={filterModalOpen}
                      onClose={() => setFilterModalOpen(false)}
                      hideChannelPlatform={title === "Business Overview"}
                      channels={channels}
                      selectedChannel={selectedChannel}
                      setSelectedChannel={setSelectedChannel}
                      platforms={platforms}
                      platform={platform}
                      setPlatform={setPlatform}
                      categories={categories}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                      brands={brands}
                      selectedBrand={selectedBrand}
                      setSelectedBrand={setSelectedBrand}
                      locations={title === "Insights" ? ['Chandigarh', 'Delhi', 'Gurugram', 'Faridabad', 'Lucknow', 'Kolkata', 'Ahmedabad', 'Mumbai', 'Pune', 'Hyderabad', 'Bengaluru', 'Chennai'] : locations}
                      selectedLocation={selectedLocation}
                      setSelectedLocation={setSelectedLocation}
                    />
                  )}

                  {/* MARKET SHARE FILTER MODAL */}
                  {title === "Market Share" && (
                    <MarketShareFilterModal
                      open={marketShareFilterModalOpen}
                      onClose={() => setMarketShareFilterModalOpen(false)}
                      channels={channels}
                      selectedChannel={selectedChannel}
                      setSelectedChannel={setSelectedChannel}
                      platforms={platforms}
                      platform={platform}
                      setPlatform={setPlatform}
                      categories={categories}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                    />
                  )}

                  {/* MARKET COVERAGE FILTER MODAL */}
                  {title === "Market Coverage" && (
                    <MarketShareFilterModal
                      open={osaFilterModalOpen}
                      onClose={() => setOsaFilterModalOpen(false)}
                      channels={channels}
                      selectedChannel={selectedChannel}
                      setSelectedChannel={setSelectedChannel}
                      platforms={platforms}
                      platform={platform}
                      setPlatform={setPlatform}
                      categories={categories}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                    />
                  )}

                  {/* AVAILABILITY ANALYSIS FILTER MODAL */}
                  {title === "Availability Analysis" && (
                    <AvailabilityFilterModal
                      open={availFilterModalOpen}
                      onClose={() => setAvailFilterModalOpen(false)}
                      channels={channels}
                      selectedChannel={selectedChannel}
                      setSelectedChannel={setSelectedChannel}
                      platforms={platforms}
                      platform={platform}
                      setPlatform={setPlatform}
                      categories={categories}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                      locations={locations}
                      selectedLocation={selectedLocation}
                      setSelectedLocation={setSelectedLocation}
                      brands={brands}
                      selectedBrand={selectedBrand}
                      setSelectedBrand={setSelectedBrand}
                    />
                  )}

                  {/* VISIBILITY ANALYSIS FILTER MODAL */}
                  {title === "Visibility Analysis" && (
                    <VisibilityFilterModal
                      open={visibilityFilterModalOpen}
                      onClose={() => setVisibilityFilterModalOpen(false)}
                      selectedChannel={selectedChannel}
                      platforms={platforms}
                      platform={platform}
                      setPlatform={setPlatform}
                      categories={visibilityCategories}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                      brands={brands}
                      selectedBrand={selectedBrand}
                      setSelectedBrand={setSelectedBrand}
                      locations={locations}
                      selectedLocation={selectedLocation}
                      setSelectedLocation={setSelectedLocation}
                      keywordTypes={keywordTypes}
                      selectedKeywordType={selectedKeywordType}
                      setSelectedKeywordType={setSelectedKeywordType}
                      keywords={keywords}
                      selectedKeyword={selectedKeyword}
                      setSelectedKeyword={setSelectedKeyword}
                    />
                  )}

                  {/* PRICING ANALYSIS FILTER MODAL */}
                  {title === "Pricing Analysis" && (
                    <PricingFilterModal
                      open={pricingFilterModalOpen}
                      onClose={() => setPricingFilterModalOpen(false)}
                      channels={channels}
                      selectedChannel={selectedChannel}
                      setSelectedChannel={setSelectedChannel}
                      platforms={platforms}
                      platform={platform}
                      setPlatform={setPlatform}
                      categories={categories}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                      brands={brands}
                      selectedBrand={selectedBrand}
                      setSelectedBrand={setSelectedBrand}
                      locations={locations}
                      selectedLocation={selectedLocation}
                      setSelectedLocation={setSelectedLocation}
                    />
                  )}

                  {/* PERFORMANCE MARKETING FILTER MODAL */}
                  {title === "Performance Marketing" && (
                    <PerformanceFilterModal
                      open={performanceFilterModalOpen}
                      onClose={() => setPerformanceFilterModalOpen(false)}
                      channels={channels}
                      selectedChannel={selectedChannel}
                      setSelectedChannel={setSelectedChannel}
                      platforms={platforms}
                      platform={platform}
                      setPlatform={setPlatform}
                      categories={categories}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                      brands={brands}
                      selectedBrand={selectedBrand}
                      setSelectedBrand={setSelectedBrand}
                      locations={locations}
                      selectedLocation={selectedLocation}
                      setSelectedLocation={setSelectedLocation}
                    />
                  )}

                  {/* CONTENT ANALYSIS FILTER MODAL */}
                  {title === "Content Analysis" && (
                    <ContentFilterModal
                      open={contentFilterModalOpen}
                      onClose={() => setContentFilterModalOpen(false)}
                      channels={channels}
                      selectedChannel={selectedChannel}
                      setSelectedChannel={setSelectedChannel}
                      platforms={platforms}
                      platform={platform}
                      setPlatform={setPlatform}
                      categories={categories}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                      brands={brands}
                      selectedBrand={selectedBrand}
                      setSelectedBrand={setSelectedBrand}
                      locations={locations}
                      selectedLocation={selectedLocation}
                      setSelectedLocation={setSelectedLocation}
                    />
                  )}

                  {/* INVENTORY ANALYSIS FILTER MODAL */}
                  {title === "Inventory Analysis" && (
                    <InventoryFilterModal
                      open={inventoryFilterModalOpen}
                      onClose={() => setInventoryFilterModalOpen(false)}
                      channels={channels}
                      selectedChannel={selectedChannel}
                      setSelectedChannel={setSelectedChannel}
                      platforms={platforms}
                      platform={platform}
                      setPlatform={setPlatform}
                      categories={categories}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={setSelectedCategory}
                      brands={brands}
                      selectedBrand={selectedBrand}
                      setSelectedBrand={setSelectedBrand}
                      locations={locations}
                      selectedLocation={selectedLocation}
                      setSelectedLocation={setSelectedLocation}
                    />
                  )}
                </>
              ) : (
                /* ============ OTHER PAGES: ORIGINAL DROPDOWNS ============ */
                <>
                  {/* CHANNEL SELECTION */}
                  <CustomHeaderDropdown
                    label="CHANNEL"
                    options={channels}
                    value={selectedChannel}
                    onChange={(newValue) => setSelectedChannel(newValue)}
                    width={{ xs: "calc(50% - 6px)", sm: 130 }}
                    multiSelect={true}
                  />


                  {/* CATEGORY SELECTION */}
                  <CustomHeaderDropdown
                    label="CATEGORY"
                    options={location.pathname.includes("visibility") ? visibilityCategories : categories}
                    value={selectedCategory}
                    onChange={(newValue) => setSelectedCategory(newValue)}
                    width={{ xs: "calc(50% - 6px)", sm: 115 }}
                    multiSelect={true}
                  />

                  {title !== "Business Overview" &&
                    !location.pathname.includes("market-share") &&
                    !location.pathname.includes("content-score") && (
                      <CustomHeaderDropdown
                        label="LOCATION"
                        options={locations}
                        value={selectedLocation}
                        onChange={(newValue) => setSelectedLocation(newValue)}
                        width={{ xs: "calc(50% - 6px)", sm: 115 }}
                        multiSelect={true}
                      />
                    )}

                  {location.pathname.includes("visibility") && (
                    <CustomHeaderDropdown
                      label="KEYWORD TYPE"
                      options={keywordTypes}
                      value={selectedKeywordType}
                      onChange={setSelectedKeywordType}
                      width={{ xs: "calc(100%)", sm: 140 }}
                      multiSelect={true}
                    />
                  )}

                  {location.pathname.includes("visibility") && (
                    <CustomHeaderDropdown
                      label="KEYWORD"
                      options={keywords}
                      value={selectedKeyword}
                      onChange={setSelectedKeyword}
                      width={{ xs: "calc(100%)", sm: 130 }}
                      multiSelect={true}
                    />
                  )}
                </>
              )}

              {/* TIME PERIOD & COMPARE WITH INTEGRATED */}
              <Box sx={{ width: { xs: "100%", sm: 200 }, flexShrink: 0 }}>
                <Typography
                  sx={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    mb: 0.4,
                    opacity: 0.8,
                    textTransform: "uppercase",
                    letterSpacing: '0.05em',
                    fontFamily: 'Roboto, sans-serif',
                    color: '#64748b'
                  }}
                >
                  TIME PERIOD
                </Typography>
                {!datesFetched ? (
                  <Skeleton
                    variant="rounded"
                    width="100%"
                    height={36}
                    sx={{
                      borderRadius: "10px",
                      bgcolor: "rgba(0,0,0,0.05)"
                    }}
                  />
                ) : (
                  <DateRangeComparePicker
                    timeStart={timeStart}
                    timeEnd={timeEnd}
                    compareStart={compareStart}
                    compareEnd={compareEnd}
                    maxDate={maxDate}
                    onApply={(start, end, cStart, cEnd, compareOn, label) => {
                      setTimeStart(start);
                      setTimeEnd(end);
                      setUserSetDate(true);

                      // Format label for KPI cards
                      let formattedLabel = "VS PREV. PERIOD";
                      if (label) {
                        const up = label.toUpperCase();
                        if (up === "TODAY") formattedLabel = "VS YESTERDAY";
                        else if (up === "YESTERDAY") formattedLabel = "VS DAY BEFORE";
                        else if (up === "THIS MONTH") formattedLabel = "VS PREV. MONTH";
                        else if (up.includes("LAST")) formattedLabel = up.replace("LAST", "VS PREV.");
                        else formattedLabel = `VS ${up}`;
                      }
                      setComparisonLabel(formattedLabel);

                      if (compareOn) {
                        setCompareStart(cStart);
                        setCompareEnd(cEnd);
                      } else {
                        setCompareStart(null);
                        setCompareEnd(null);
                      }
                    }}
                  />
                )}
              </Box>
            </Box>
          )}
        </AnimatePresence>
      </Box>

      {/* ---------------- SECOND ROW ---------------- */}
      <AnimatePresence>
        {!hideFilters && isExpanded && location.pathname !== "/scheduled-reports" && (
          <Box
            component={motion.div}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            sx={{
              display: "flex",
              gap: 2,
              justifyContent: "flex-end",
              flexWrap: "wrap",
              mt: 2,
              alignItems: "center",
              overflow: "visible",
            }}
          >
            {/* DATE INFO
            <Button
              variant="outlined"
              sx={{
                borderColor: "#d1d5db",
                textTransform: "none",
                fontSize: "0.75rem",
              }}
            >
              Data till {timeEnd.format("DD MMM YY")}
            </Button> */}

            {/* PRICE MODE SWITCH */}
            {/* <Box sx={{ display: "flex", gap: 1 }}>
              {["MRP", "SP"].map((label) => (
                <Button
                  key={label}
                  variant={priceMode === label ? "contained" : "outlined"}
                  onClick={() => setPriceMode(label)}
                  sx={{
                    textTransform: "none",
                    fontSize: "0.75rem",
                    background:
                      priceMode === label ? "#059669" : "transparent",
                    borderColor: "#d1d5db",
                  }}
                >
                  {label}
                </Button>
              ))}
            </Box> */}
          </Box>
        )}
      </AnimatePresence>

      {/* 🌗 THEME TOGGLE */}
      {/* 🌗 THEME TOGGLE REMOVED - Static Light Mode Enforced */}
    </Box>
  );
};

export default Header;
