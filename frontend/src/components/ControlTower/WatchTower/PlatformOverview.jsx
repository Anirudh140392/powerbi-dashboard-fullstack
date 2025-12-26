import React from "react";
import { BsGrid3X3GapFill, BsSearch } from "react-icons/bs";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tooltip,
  useTheme,
  Select,
  MenuItem,
  IconButton,
  Skeleton,
} from "@mui/material";
import CategoryTable from "./CategoryTable";
import { TrendingUp, Monitor, Calendar, Grid3x3, Tag, Package, Search } from "lucide-react";
import { allProducts } from "../../../utils/DataCenter";
import { LightbulbCogRCAIcon } from "../../Analytics/CategoryRca/RcaIcons";

/* ---------------- SMALL KPI CARD with Skeleton Loader ---------------- */
const SmallCard = ({ item }) => {
  const theme = useTheme();
  const { title, value, meta } = item || {};

  // Check if data is still loading (value is undefined, null, or "—")
  const isLoading = value === undefined || value === null || value === "—" || value === "";

  const isPositive = meta?.change?.includes("▲");

  // Format value based on title
  const formatValue = (val, colTitle) => {
    if (colTitle === "Doi" || colTitle === "DOI") {
      return val?.toString().replace("%", "") || "—";
    }
    return val ?? "—";
  };

  // Format change to add % symbol if not already present
  const formatChange = (changeVal) => {
    if (!changeVal) return changeVal;
    const changeStr = changeVal.toString();
    if (!changeStr.includes("%")) {
      return changeStr + "%";
    }
    return changeStr;
  };

  // Skeleton Card - fancy shimmer loading state
  if (isLoading) {
    return (
      <Card
        sx={{
          mb: 1.5,
          borderRadius: 2,
          boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
          background: theme.palette.background.paper,
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ py: 1.2, px: 1.5 }}>
          {/* Title skeleton */}
          <Skeleton
            variant="text"
            width="60%"
            height={16}
            animation="wave"
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
              borderRadius: 1,
            }}
          />

          {/* Value skeleton - larger */}
          <Skeleton
            variant="text"
            width="80%"
            height={24}
            animation="wave"
            sx={{
              mt: 0.5,
              bgcolor: theme.palette.mode === 'dark' ? 'grey.700' : 'grey.300',
              borderRadius: 1,
            }}
          />

          {/* Meta skeleton - units and change */}
          <Box display="flex" alignItems="center" gap={1} mt={0.4}>
            <Skeleton
              variant="text"
              width={40}
              height={14}
              animation="wave"
              sx={{
                bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
                borderRadius: 0.5,
              }}
            />
            <Skeleton
              variant="text"
              width={50}
              height={14}
              animation="wave"
              sx={{
                bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
                borderRadius: 0.5,
              }}
            />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        mb: 1.5,
        borderRadius: 2,
        boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
        background: theme.palette.background.paper,
      }}
    >
      <CardContent sx={{ py: 1.2, px: 1.5 }}>
        <Typography fontSize="0.75rem" fontWeight={400} color="text.secondary" fontFamily="Roboto, sans-serif">
          {title}
        </Typography>

        <Typography fontWeight={700} fontSize="0.95rem" mt={0.3} fontFamily="Roboto, sans-serif">
          {formatValue(value, title)}
        </Typography>

        {meta && (
          <Box display="flex" alignItems="center" gap={1} mt={0.4}>
            <Typography fontSize="0.75rem" color="text.secondary" fontFamily="Roboto, sans-serif" fontWeight={400}>
              #{meta.units}
            </Typography>
            <Typography
              fontSize="0.75rem"
              fontFamily="Roboto, sans-serif"
              fontWeight={400}
              sx={{
                color: isPositive
                  ? theme.palette.success.main
                  : theme.palette.error.main,
              }}
            >
              {formatChange(meta.change)}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/* ---------------- SKELETON PLATFORM COLUMN - Loading State ---------------- */
const SkeletonPlatformColumn = () => {
  return (
    <Box sx={{ minWidth: 280 }}>
      <Card
        sx={{
          p: 2,
          borderRadius: 3,
          background: "#fafafa",
          boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        {/* Header skeleton */}
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 1 }}>
            <Skeleton variant="circular" width={34} height={34} animation="wave" />
            <Box>
              <Skeleton variant="text" width={100} height={20} animation="wave" sx={{ borderRadius: 1 }} />
              <Skeleton variant="text" width={60} height={14} animation="wave" sx={{ borderRadius: 1 }} />
            </Box>
          </Box>
        </Box>

        {/* KPI cards skeleton - 8 cards */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card
            key={i}
            sx={{
              mb: 1.5,
              borderRadius: 2,
              boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
              background: "#fff",
            }}
          >
            <CardContent sx={{ py: 1.2, px: 1.5 }}>
              <Skeleton variant="text" width="60%" height={16} animation="wave" sx={{ borderRadius: 1 }} />
              <Skeleton variant="text" width="80%" height={24} animation="wave" sx={{ mt: 0.5, borderRadius: 1 }} />
              <Box display="flex" alignItems="center" gap={1} mt={0.4}>
                <Skeleton variant="text" width={40} height={14} animation="wave" sx={{ borderRadius: 0.5 }} />
                <Skeleton variant="text" width={50} height={14} animation="wave" sx={{ borderRadius: 0.5 }} />
              </Box>
            </CardContent>
          </Card>
        ))}
      </Card>
    </Box>
  );
};

/* ---------------- MAIN COMPONENT ---------------- */
const PlatformOverview = ({
  data = [],
  onViewTrends = () => { },
  onViewRca = () => { },
  activeKpisTab = "Platform Overview",
  // Month Overview props
  monthOverviewPlatform,
  onMonthPlatformChange,
  // Category Overview props
  categoryOverviewPlatform,
  onCategoryPlatformChange,
  // Brands Overview props
  brandsOverviewPlatform,
  onBrandsPlatformChange,
  brandsOverviewCategory,
  onBrandsCategoryChange,
  // Filters prop for SKU data
  filters = {},
}) => {
  const theme = useTheme();

  const [sortType, setSortType] = React.useState("default");
  const [searchTerm, setSearchTerm] = React.useState("");

  const [platformFilter, setPlatformFilter] = React.useState({
    platform: "blinkit",
    category: "Core Tub",
    brand: "Amul",
  });

  /* ---------------- SORT + SEARCH LOGIC ---------------- */
  const sortedPlatforms = React.useMemo(() => {
    let formatted = data.map((p) => ({
      ...p,
      columns: [...p.columns],
    }));

    formatted = formatted.map((platform) => {
      let sortedCols = [...platform.columns];

      if (sortType === "asc") sortedCols.sort((a, b) => a.title.localeCompare(b.title));
      if (sortType === "desc") sortedCols.sort((a, b) => b.title.localeCompare(a.title));

      return { ...platform, columns: sortedCols };
    });

    if (searchTerm.trim() !== "") {
      formatted = formatted.filter((p) =>
        p.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return formatted;
  }, [sortType, searchTerm, data]);

  /* ---------------- ICON MAPPING ---------------- */
  const getTabIcon = () => {
    switch (activeKpisTab) {
      case "Platform Overview":
        return <Monitor size={18} color={theme.palette.primary.main} />;
      case "Month Overview":
        return <Calendar size={18} color={theme.palette.primary.main} />;
      case "Category Overview":
        return <Grid3x3 size={18} color={theme.palette.primary.main} />;
      case "Brands Overview":
        return <Tag size={18} color={theme.palette.primary.main} />;
      case "Skus Overview":
        return <Package size={18} color={theme.palette.primary.main} />;
      default:
        return <BsGrid3X3GapFill size={18} color={theme.palette.primary.main} />;
    }
  };

  return (
    <Box>
      {activeKpisTab !== "Skus Overview" ? (
        <Card
          sx={{
            p: 3,
            borderRadius: 4,
            boxShadow: 3,
            background: theme.palette.background.paper,
          }}
        >
          {/* ---------------- HEADER ---------------- */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            mb={3}
            gap={2}
          >
            {/* Left Title */}
            <Box display="flex" alignItems="center">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: theme.palette.action.hover,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {getTabIcon()}
              </Box>

              <Typography ml={1.2} fontWeight={700} fontSize="1.2rem" fontFamily="Roboto, sans-serif">
                {activeKpisTab}
              </Typography>
            </Box>

            {/* FILTERS + SEARCH + SORT */}
            <Box display="flex" alignItems="center" gap={1.2}>
              {activeKpisTab === "Month Overview" && (
                <Select
                  size="small"
                  value={monthOverviewPlatform}
                  onChange={(e) => onMonthPlatformChange(e.target.value)}
                  sx={{
                    minWidth: 130,
                    height: 36,
                    fontSize: "0.85rem",
                    background: "#f3f4f6",
                  }}
                >
                  <MenuItem value="Blinkit">Blinkit</MenuItem>
                  <MenuItem value="Zepto">Zepto</MenuItem>
                </Select>
              )}

              {activeKpisTab === "Category Overview" && (
                <Select
                  size="small"
                  value={categoryOverviewPlatform}
                  onChange={(e) => onCategoryPlatformChange(e.target.value)}
                  sx={{
                    minWidth: 130,
                    height: 36,
                    fontSize: "0.85rem",
                    background: "#f3f4f6",
                  }}
                >
                  <MenuItem value="Blinkit">Blinkit</MenuItem>
                  <MenuItem value="Zepto">Zepto</MenuItem>
                </Select>
              )}

              {activeKpisTab === "Brands Overview" && (
                <>
                  <Select
                    size="small"
                    value={brandsOverviewPlatform}
                    onChange={(e) => onBrandsPlatformChange(e.target.value)}
                    sx={{
                      minWidth: 130,
                      height: 36,
                      fontSize: "0.85rem",
                      background: "#f3f4f6",
                    }}
                  >
                    <MenuItem value="Blinkit">Blinkit</MenuItem>
                    <MenuItem value="Zepto">Zepto</MenuItem>
                  </Select>
                  <Select
                    size="small"
                    value={brandsOverviewCategory}
                    onChange={(e) => onBrandsCategoryChange(e.target.value)}
                    sx={{
                      minWidth: 130,
                      height: 36,
                      fontSize: "0.85rem",
                      background: "#f3f4f6",
                    }}
                  >
                    <MenuItem value="All">All Categories</MenuItem>
                    <MenuItem value="Core Tub">Core Tub</MenuItem>
                  </Select>
                </>
              )}

              {activeKpisTab === "Skus Overview" && (
                <>
                  <Select
                    size="small"
                    value={platformFilter.category}
                    onChange={(e) =>
                      setPlatformFilter((p) => ({ ...p, category: e.target.value }))
                    }
                    sx={{
                      minWidth: 130,
                      height: 36,
                      fontSize: "1.85rem",
                      background: "#f3f4f6",
                    }}
                  >
                    <MenuItem value="Core Tub">Core Tub</MenuItem>
                  </Select>

                  <Select
                    size="small"
                    value={platformFilter.brand}
                    onChange={(e) =>
                      setPlatformFilter((p) => ({ ...p, brand: e.target.value }))
                    }
                    sx={{
                      minWidth: 130,
                      height: 36,
                      fontSize: "0.85rem",
                      background: "#f3f4f6",
                    }}
                  >
                    <MenuItem value="Amul">Amul</MenuItem>
                  </Select>
                </>
              )}

              {/* SEARCH */}
              <Box
                display="flex"
                alignItems="center"
                px={1.5}
                sx={{
                  width: 220,
                  height: 36,
                  background: "#f3f4f6",
                  borderRadius: 5,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: "0.85rem",
                  }}
                />
                <BsSearch size={15} color={theme.palette.text.secondary} />
              </Box>



            </Box>
          </Box>

          {/* ---------------- PLATFORM CARDS ---------------- */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              overflowX: "auto",
              overflowY: "auto",
              pb: 2,
              height: "800px",
            }}
          >
            {sortedPlatforms.length === 0 ? (
              // Show skeleton columns while loading
              [1, 2, 3].map((i) => <SkeletonPlatformColumn key={i} />)
            ) : (
              sortedPlatforms.map((platform) => (
                <Box key={platform.key} sx={{ minWidth: 280 }}>
                  <Card
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      background: theme.palette.background.default,
                      boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
                    }}
                  >

                    {/* ---------------- PREMIUM INLINE HEADER ---------------- */}
                    <Box sx={{ mb: 1.5 }}>
                      {/* First Row: Logo + Title + Inline Buttons */}
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        {/* Left: Icon + Name */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                          {activeKpisTab === "Brands Overview" ? (
                            <Box
                              sx={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: `1px solid ${theme.palette.divider}`,
                              }}
                            >
                              <Tag size={18} color={theme.palette.primary.main} />
                            </Box>
                          ) : (
                            <img
                              src={platform.logo}
                              alt={platform.label}
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: "#fff",
                                padding: 3,
                                objectFit: "contain",
                              }}
                            />
                          )}

                          <Box
                            onClick={() => {
                              if (sortType === "default") setSortType("asc");
                              else if (sortType === "asc") setSortType("desc");
                              else setSortType("default");
                            }}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                              cursor: "pointer",
                              "&:hover": {
                                opacity: 0.7
                              }
                            }}
                          >
                            <Typography fontWeight={700} fontSize="0.95rem" fontFamily="Roboto, sans-serif">
                              {platform.label}
                            </Typography>
                            {sortType !== "default" && (
                              <Box sx={{ display: "flex", flexDirection: "column", ml: 0.3 }}>
                                {sortType === "asc" ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 19V5M5 12l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 5v14M5 12l7 7 7-7" />
                                  </svg>
                                )}
                              </Box>
                            )}
                          </Box>
                        </Box>

                        {/* Right: Inline Buttons */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Tooltip title="trend performance" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onViewTrends(platform.label)}
                              className="trend-icon"
                              sx={{
                                borderRadius: 2,
                                border: "1px solid #e5e7eb",
                                background:
                                  "#EEF2F7",
                                width: 32,
                                height: 32,
                              }}
                            >
                              <TrendingUp size={17} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="RCA" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onViewRca(platform.label)}
                              className="trend-icon"
                              sx={{
                                borderRadius: 2,
                                border: "1px solid #e5e7eb",
                                background: "#EEF2F7",
                                width: 32,
                                height: 32,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                "&:hover": {
                                  background: "#DBEAFE",
                                },
                              }}
                            >
                              <LightbulbCogRCAIcon size={18} color="#000000" glow="#fde68a" />
                            </IconButton>
                          </Tooltip>

                          {/* Competition button stays same */}
                          {/* <Tooltip title="Compare performance with competitors" arrow>
    <Button
      variant="text"
      size="small"
      sx={{
        textTransform: "none",
        fontSize: "9px",
        fontWeight: 600,
        color: "#2563eb",
        display: "flex",
        alignItems: "center",
        gap: 0.3,
        "&:hover": { background: "transparent", textDecoration: "underline" },
      }}
    >
      Competition <span style={{ fontSize: "1rem" }}>›</span>
    </Button>
  </Tooltip> */}
                        </Box>

                      </Box>

                      {/* Second Row: Platform Type */}
                      <Typography
                        color="text.secondary"
                        fontSize="0.75rem"
                        fontWeight={400}
                        fontFamily="Roboto, sans-serif"
                        sx={{ mt: 0.5, ml: 5.5 }}
                      >
                        {platform.type}
                      </Typography>
                    </Box>

                    {/* KPI CARDS */}
                    {platform.columns.map((col, i) => (
                      <SmallCard key={i} item={col} />
                    ))}

                  </Card>
                </Box>
              ))
            )}
          </Box>
        </Card>
      ) : (
        <CategoryTable categories={allProducts} activeTab={activeKpisTab} filters={filters} />
      )}
    </Box>
  );
};

export default PlatformOverview;