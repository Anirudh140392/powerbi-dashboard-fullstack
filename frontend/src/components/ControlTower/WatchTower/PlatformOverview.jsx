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
} from "@mui/material";
import CategoryTable from "./CategoryTable";
import {
  TrendingUp,
  Monitor,
  Calendar,
  Grid3x3,
  Tag,
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { allProducts } from "../../../utils/DataCenter";
import { LightbulbCogRCAIcon } from "../../Analytics/CategoryRca/RcaIcons";

/* ---------------- SMALL KPI CARD ---------------- */
const SmallCard = ({ item }) => {
  const theme = useTheme();
  const { title, value, meta } = item || {};
  const isPositive = meta?.change?.includes("▲");

  const formatValue = (val, colTitle) => {
    if (colTitle === "Doi" || colTitle === "DOI") {
      return val?.toString().replace("%", "") || "—";
    }
    return val ?? "—";
  };

  const formatChange = (changeVal) => {
    if (!changeVal) return changeVal;
    const changeStr = changeVal.toString();
    if (!changeStr.includes("%")) {
      return changeStr + "%";
    }
    return changeStr;
  };

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
        <Typography
          fontSize="0.75rem"
          fontWeight={400}
          color="text.secondary"
          fontFamily="Roboto, sans-serif"
        >
          {title}
        </Typography>

        <Typography
          fontWeight={700}
          fontSize="0.95rem"
          mt={0.3}
          fontFamily="Roboto, sans-serif"
        >
          {formatValue(value, title)}
        </Typography>

        {meta && (
          <Box display="flex" alignItems="center" gap={1} mt={0.4}>
            <Typography
              fontSize="0.75rem"
              color="text.secondary"
              fontFamily="Roboto, sans-serif"
              fontWeight={400}
            >
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

/* ---------------- PLATFORM LOGO WITH ERROR HANDLING ---------------- */
const PlatformLogo = ({ src, alt, theme }) => {
  const [error, setError] = React.useState(false);

  if (error || !src) {
    return (
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
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "#fff",
        padding: 3,
        objectFit: "contain",
      }}
    />
  );
};

/* ---------------- MAIN COMPONENT ---------------- */
const PlatformOverview = ({
  data = [],
  onViewTrends = () => { },
  onViewRca = () => { },
  activeKpisTab = "Platform Overview",
  currentPage,
  setCurrentPage = () => { },
}) => {
  const theme = useTheme();

  const [sortType, setSortType] = React.useState("default");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isPagination, setIsPagination] = React.useState(true);

  const [platformFilter, setPlatformFilter] = React.useState({
    platform: "blinkit",
    category: "Core Tub",
    brand: "Amul",
  });

  const CARDS_PER_PAGE = 5;

  /* ---------------- SORT + SEARCH LOGIC ---------------- */
  const sortedPlatforms = React.useMemo(() => {
    let formatted = data.map((p) => ({
      ...p,
      columns: [...p.columns],
    }));

    formatted = formatted.map((platform) => {
      let sortedCols = [...platform.columns];

      if (sortType === "asc")
        sortedCols.sort((a, b) => a.title.localeCompare(b.title));
      if (sortType === "desc")
        sortedCols.sort((a, b) => b.title.localeCompare(a.title));

      return { ...platform, columns: sortedCols };
    });

    if (searchTerm.trim() !== "") {
      formatted = formatted.filter((p) =>
        p.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return formatted;
  }, [sortType, searchTerm, data]);

  // Pagination logic
  const totalPages = Math.ceil(sortedPlatforms.length / CARDS_PER_PAGE);
  const paginatedPlatforms = isPagination
    ? sortedPlatforms.slice(
      currentPage * CARDS_PER_PAGE,
      (currentPage + 1) * CARDS_PER_PAGE
    )
    : sortedPlatforms;

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Reset page when search or sort changes
  React.useEffect(() => {
    setCurrentPage(0);
  }, [sortType, searchTerm]);

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
        return (
          <BsGrid3X3GapFill size={18} color={theme.palette.primary.main} />
        );
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

              <Typography
                ml={1.2}
                fontWeight={700}
                fontSize="1.2rem"
                fontFamily="Roboto, sans-serif"
              >
                {activeKpisTab}
              </Typography>
            </Box>

            {/* FILTERS + SEARCH + SORT */}
            <Box display="flex" alignItems="center" gap={1.2}>
              {activeKpisTab !== "Platform Overview" && (
                <Select
                  size="small"
                  value={platformFilter.platform}
                  onChange={(e) =>
                    setPlatformFilter((p) => ({
                      ...p,
                      platform: e.target.value,
                    }))
                  }
                  sx={{
                    minWidth: 130,
                    height: 36,
                    fontSize: "0.85rem",
                    background: "#f3f4f6",
                  }}
                >
                  <MenuItem value="blinkit">Blinkit</MenuItem>
                </Select>
              )}

              {activeKpisTab === "Brands Overview" && (
                <Select
                  size="small"
                  value={platformFilter.category}
                  onChange={(e) =>
                    setPlatformFilter((p) => ({
                      ...p,
                      category: e.target.value,
                    }))
                  }
                  sx={{
                    minWidth: 130,
                    height: 36,
                    fontSize: "0.85rem",
                    background: "#f3f4f6",
                  }}
                >
                  <MenuItem value="Core Tub">Core Tub</MenuItem>
                </Select>
              )}

              {activeKpisTab === "Skus Overview" && (
                <>
                  <Select
                    size="small"
                    value={platformFilter.category}
                    onChange={(e) =>
                      setPlatformFilter((p) => ({
                        ...p,
                        category: e.target.value,
                      }))
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
                      setPlatformFilter((p) => ({
                        ...p,
                        brand: e.target.value,
                      }))
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

          <Box
            sx={{
              display: "flex",
              gap: 2,
              overflow: "auto",
              pb: 2,
              height: "650px",
              /* Custom Scrollbar for Premium Feel */
              "&::-webkit-scrollbar": {
                width: "6px",
                height: "6px",
              },
              "&::-webkit-scrollbar-track": {
                background: "rgba(0,0,0,0.02)",
                borderRadius: "10px",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "rgba(0,0,0,0.1)",
                borderRadius: "10px",
                transition: "all 0.3s ease",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                background: "rgba(0,0,0,0.2)",
              },
            }}
          >
            {paginatedPlatforms.map((platform) => (
              <Box key={platform.key} sx={{ minWidth: 280 }}>
                <Card
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    background: theme.palette.background.default,
                    boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
                    height: "fit-content",
                    minHeight: "100%", // Stretch to container height if short
                  }}
                >
                  {/* PREMIUM INLINE HEADER */}
                  <Box sx={{ mb: 1.5 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      {/* Left: Icon + Name */}
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.2 }}
                      >
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
                          <PlatformLogo
                            src={platform.logo}
                            alt={platform.label}
                            theme={theme}
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
                              opacity: 0.7,
                            },
                          }}
                        >
                          <Typography
                            fontWeight={700}
                            fontSize="0.95rem"
                            fontFamily="Roboto, sans-serif"
                          >
                            {platform.label}
                          </Typography>
                          {sortType !== "default" && (
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                ml: 0.3,
                              }}
                            >
                              {sortType === "asc" ? (
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M12 19V5M5 12l7-7 7 7" />
                                </svg>
                              ) : (
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M12 5v14M5 12l7 7 7-7" />
                                </svg>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* Right: Inline Buttons */}
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                      >
                        <Tooltip title="trend performance" arrow>
                          <IconButton
                            size="small"
                            onClick={() => onViewTrends(platform.label, activeKpisTab.split(' ')[0])}
                            className="trend-icon"
                            sx={{
                              borderRadius: 2,
                              border: "1px solid #e5e7eb",
                              background: "#EEF2F7",
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
                            <LightbulbCogRCAIcon
                              size={18}
                              color="#000000"
                              glow="#fde68a"
                            />
                          </IconButton>
                        </Tooltip>
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
            ))}
          </Box>

          {/* GLASSMORPHISM PAGINATION */}
          {isPagination && (
            <Box
              sx={{
                mt: 1,
                display: "flex",
                justifyContent: "right",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.2,
                  px: 2.5,
                  py: 1.2,
                  borderRadius: "999px",
                  backdropFilter: "blur(14px)",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.25))",
                  border: "1px solid rgba(255,255,255,0.35)",
                  boxShadow:
                    "0 10px 30px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.6)",
                }}
              >
                {/* PREV */}
                <IconButton
                  size="small"
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    backdropFilter: "blur(8px)",
                    background: "rgba(255,255,255,0.35)",
                    border: "1px solid rgba(255,255,255,0.4)",
                    transition: "all .25s ease",
                    "&:hover": {
                      background: "rgba(255,255,255,0.6)",
                      transform: "translateY(-1px)",
                    },
                    "&.Mui-disabled": {
                      opacity: 0.35,
                    },
                  }}
                >
                  <ChevronLeft size={16} />
                </IconButton>

                {/* PAGE NUMBERS */}
                <Box sx={{ display: "flex", gap: 0.6 }}>
                  {Array.from({ length: totalPages }, (_, i) => {
                    const active = currentPage === i;

                    return (
                      <Button
                        key={i}
                        size="small"
                        onClick={() => setCurrentPage(i)}
                        sx={{
                          minWidth: 34,
                          height: 34,
                          borderRadius: "50%",
                          fontSize: "0.75rem",
                          fontWeight: active ? 700 : 500,
                          color: active ? "#1f2937" : theme.palette.text.primary,
                          background: active
                            ? "linear-gradient(135deg, #f8fafc, #e2e8f0)"
                            : "rgba(255,255,255,0.35)",
                          backdropFilter: "blur(10px)",
                          border: active
                            ? "1.5px solid #cbd5e1"
                            : "1px solid rgba(255,255,255,0.4)",
                          boxShadow: active
                            ? "0 6px 18px rgba(148, 163, 184, 0.35), inset 0 1px 1px rgba(255,255,255,0.8)"
                            : "none",
                          transition: "all .25s ease",
                          "&:hover": {
                            background: active
                              ? "linear-gradient(135deg, #f1f5f9, #cbd5e1)"
                              : "rgba(255,255,255,0.6)",
                            transform: "translateY(-1px)",
                          },
                        }}
                      >
                        {i + 1}
                      </Button>
                    );
                  })}
                </Box>

                {/* NEXT */}
                <IconButton
                  size="small"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages - 1}
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    backdropFilter: "blur(8px)",
                    background: "rgba(255,255,255,0.35)",
                    border: "1px solid rgba(255,255,255,0.4)",
                    transition: "all .25s ease",
                    "&:hover": {
                      background: "rgba(255,255,255,0.6)",
                      transform: "translateY(-1px)",
                    },
                    "&.Mui-disabled": {
                      opacity: 0.35,
                    },
                  }}
                >
                  <ChevronRight size={16} />
                </IconButton>
              </Box>
            </Box>
          )}
        </Card>
      ) : (
        <CategoryTable categories={allProducts} activeTab={activeKpisTab} />
      )}
    </Box>
  );
};

export default PlatformOverview;
