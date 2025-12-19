// import React from "react";
// import { BsGrid3X3GapFill, BsSearch, BsInfoCircle } from "react-icons/bs";
// import {
//   Box,
//   Card,
//   CardContent,
//   Typography,
//   Button,
//   Chip,
//   useTheme,
// } from "@mui/material";

// /* ------------------- SMALL METRIC CARD (RIGHT SIDE) ------------------- */

// const SmallCard = ({ item }) => {
//   const theme = useTheme();
//   const { title, value, meta } = item;
//   const hasValue = value !== null && value !== undefined;

//   const cardBg =
//     theme.palette.mode === "dark" ? theme.palette.background.paper : "#ffffff";

//   const muted = theme.palette.text.secondary;
//   const positive = theme.palette.success.main;
//   const negative = theme.palette.error.main;

//   const isPositive = meta?.change?.includes("▲");

//   return (
//     <Card
//       sx={{
//         mb: 1.5,
//         borderRadius: 2,
//         boxShadow:
//           theme.palette.mode === "dark"
//             ? "0 1px 3px rgba(0,0,0,0.6)"
//             : "0px 1px 3px rgba(15,23,42,0.08)",
//         background: cardBg,
//         height: 96,
//       }}
//     >
//       <CardContent sx={{ py: 1.25, px: 1.75 }}>
//         <Typography
//           fontSize="0.78rem"
//           fontWeight={500}
//           color="text.secondary"
//           gutterBottom
//         >
//           {title}
//         </Typography>

//         <Typography fontWeight="bold" fontSize="1.05rem" color="text.primary">
//           {hasValue ? (
//             value
//           ) : (
//             <span style={{ color: muted, fontSize: "0.8rem" }}>
//               No Data Available
//             </span>
//           )}
//         </Typography>

//         {hasValue && meta && (
//           <Box mt={0.4} display="flex" alignItems="center" gap={0.75}>
//             <Typography fontSize="0.75rem" color="text.secondary">
//               #{meta.units}
//             </Typography>
//             <Typography
//               fontSize="0.75rem"
//               sx={{ color: isPositive ? positive : negative }}
//             >
//               {meta.change}
//             </Typography>
//           </Box>
//         )}
//       </CardContent>
//     </Card>
//   );
// };

// /* ------------------- MAIN COMPONENT ------------------- */

// const PlatformOverview = ({
//   data = defaultPlatforms,
//   onViewTrends = () => {},
//   activeKpisTab = "Platform Overview",
// }) => {
//   const theme = useTheme();

//   const [sortType, setSortType] = React.useState("default");

//   // sort platforms by label
//   const sortedData = React.useMemo(() => {
//     let list = [...data];
//     if (sortType === "asc") {
//       return list.sort((a, b) => a.label.localeCompare(b.label));
//     }
//     if (sortType === "desc") {
//       return list.sort((a, b) => b.label.localeCompare(a.label));
//     }
//     return list;
//   }, [sortType, data]);

//   return (
//     <Box sx={{ 
//       mb: 4,
//       maxHeight: 'calc(100vh - 200px)', // ADDED: Limit height to enable scrolling
//       overflowY: 'auto', // ADDED: Enable vertical scrolling
//       '&::-webkit-scrollbar': { width: 8 }, // ADDED: Custom scrollbar styling
//       '&::-webkit-scrollbar-thumb': {
//         background: '#cbd5e1',
//         borderRadius: 10,
//       },
//     }}>
//       <Card
//         sx={{
//           p: 3,
//           borderRadius: 4,
//           boxShadow: 4,
//           height: 740,
//           background: theme.palette.background.paper,
//         }}
//       >
//         {/* HEADER */}
//         <Box
//           display="flex"
//           justifyContent="space-between"
//           alignItems="center"
//           flexWrap="wrap"
//           gap={2}
//           mb={3}
//         >
//           <Box display="flex" alignItems="center">
//             <Box
//               sx={{
//                 width: 40,
//                 height: 40,
//                 borderRadius: "50%",
//                 backgroundColor:
//                   theme.palette.mode === "dark"
//                     ? theme.palette.background.default
//                     : "#f8f9fa",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//               }}
//             >
//               <BsGrid3X3GapFill size={20} color={theme.palette.primary.main} />
//             </Box>

//             <Typography ml={1.2} fontWeight={600} fontSize="1.1rem">
//               {activeKpisTab}
//             </Typography>
//           </Box>

//           <Box display="flex" alignItems="center" gap={2}>
//             {/* Search Box */}
//             <Box
//               display="flex"
//               alignItems="center"
//               px={1.5}
//               sx={{
//                 borderRadius: 5,
//                 width: 220,
//                 height: 36,
//                 border: `1px solid ${theme.palette.divider}`,
//                 background:
//                   theme.palette.mode === "dark"
//                     ? theme.palette.background.paper
//                     : "#f2f6fb",
//               }}
//             >
//               <input
//                 type="text"
//                 placeholder="Search"
//                 style={{
//                   flex: 1,
//                   border: "none",
//                   background: "transparent",
//                   outline: "none",
//                   fontSize: "0.85rem",
//                 }}
//               />
//               <BsSearch size={15} color={theme.palette.text.secondary} />
//             </Box>
//           </Box>
//         </Box>

//         {/* SORT BUTTONS */}
//         <Box display="flex" justifyContent="flex-end" gap={1} mb={2}>
//           <Button
//             variant={sortType === "asc" ? "contained" : "outlined"}
//             size="small"
//             onClick={() => setSortType("asc")}
//             sx={{ textTransform: "none" }}
//           >
//             A → Z
//           </Button>

//           <Button
//             variant={sortType === "desc" ? "contained" : "outlined"}
//             size="small"
//             onClick={() => setSortType("desc")}
//             sx={{ textTransform: "none" }}
//           >
//             Z → A
//           </Button>

//           <Button
//             variant={sortType === "default" ? "contained" : "outlined"}
//             size="small"
//             onClick={() => setSortType("default")}
//             sx={{ textTransform: "none" }}
//           >
//             Default
//           </Button>
//         </Box>

//         {/* HORIZONTAL SCROLL SECTION */}
//         <Box
//           sx={{
//             overflowX: "auto",
//             pb: 1,
//             WebkitOverflowScrolling: "touch",
//           }}
//         >
//           <Box
//             display="flex"
//             flexWrap="nowrap"
//             alignItems="flex-start"
//             height="612px"
//             sx={{ gap: 2, minWidth: "100%" }}
//           >
//             {/* LEFT STICKY METRIC LIST */}
//             <Box
//               sx={{
//                 width: 160,
//                 minWidth: 140,
//                 flexShrink: 0,
//                 position: "sticky",
//                 left: 0,
//                 top: 0,
//                 background:
//                   theme.palette.mode === "dark"
//                     ? theme.palette.background.paper
//                     : "#ffffff",
//                 zIndex: 5,
//                 height: "620px",
//                 boxShadow: "4px 0 6px -3px rgba(0,0,0,0.1)",
//                 pb: 2,
//               }}
//             >
//               <Box display="grid" gap={1.4}>
//                 {/* Sticky Icon */}
//                 <Box
//                   sx={{
//                     width: 42,
//                     height: 34,
//                     borderRadius: "50%",
//                     background: theme.palette.background.paper,
//                     display: "flex",
//                     alignItems: "center",
//                     justifyContent: "center",
//                     position: "sticky",
//                     top: 28,
//                     zIndex: 4,
//                     mx: "auto",
//                     boxShadow:
//                       theme.palette.mode === "dark"
//                         ? "0 2px 4px rgba(0,0,0,0.6)"
//                         : "0 2px 4px rgba(0,0,0,0.05)",
//                   }}
//                 >
//                   <BsGrid3X3GapFill
//                     size={18}
//                     color={theme.palette.text.secondary}
//                   />
//                 </Box>

//                 {data[0]?.columns.map((metric, i) => (
//                   <Button
//                     key={i}
//                     sx={{
//                       borderRadius: 2,
//                       padding: "0.65rem 0.75rem",
//                       pt: 2,
//                       pl: 2.5,
//                       height: 85,
//                       display: "flex",
//                       alignItems: "center",
//                       justifyContent: "space-between",
//                       background: "#f2f6fb",
//                       color: theme.palette.text.primary,
//                       border: `1px solid ${theme.palette.divider}`,
//                       width: "100%",
//                       mb: 1.5,
//                       textTransform: "none",
//                     }}
//                   >
//                     {metric.title}
//                     <BsInfoCircle
//                       size={14}
//                       color={theme.palette.text.secondary}
//                     />
//                   </Button>
//                 ))}
//               </Box>
//             </Box>

//             {/* PLATFORM COLUMNS - RIGHT SIDE UI */}
//             {sortedData.map((platform) => (
//               <Box
//                 key={platform.key}
//                 sx={{
//                   width: "min(260px, 45vw)",
//                   minWidth: 220,
//                   flexShrink: 0,
//                   display: "flex",
//                   flexDirection: "column",
//                   gap: 1,
//                 }}
//               >
//                 <Box
//                   sx={{
//                     p: 2,
//                     borderRadius: 3,
//                     background:
//                       theme.palette.mode === "dark" ? "#0b1120" : "#f9fafb",
//                     border: `1px solid ${theme.palette.divider}`,
//                     mr: 1,
//                     overflowY: "auto",
//                     height: "100%",
//                   }}
//                 >
//                   {/* PLATFORM HEADER (same style as screenshot) */}
//                   <Box
//                     sx={{
//                       mb: 2,
//                       display: "flex",
//                       justifyContent: "space-between",
//                       alignItems: "center",
//                     }}
//                   >
//                     <Box display="flex" alignItems="center" gap={1.2}>
//                       <Box
//                         sx={{
//                           width: 32,
//                           height: 32,
//                           borderRadius: "50%",
//                           background:
//                             theme.palette.mode === "dark"
//                               ? theme.palette.background.default
//                               : "#e5e7eb",
//                           display: "flex",
//                           alignItems: "center",
//                           justifyContent: "center",
//                           overflow: "hidden",
//                         }}
//                       >
//                         <img
//                           src={platform.logo}
//                           alt={platform.label}
//                           style={{
//                             width: 26,
//                             height: 26,
//                             objectFit: "contain",
//                             background: "#ffffff",
//                             borderRadius: "50%",
//                             padding: 3,
//                           }}
//                         />
//                       </Box>
//                       <Box>
//                         <Typography fontWeight={600} fontSize="0.92rem">
//                           {platform.label}
//                         </Typography>
//                         <Typography
//                           fontSize="0.75rem"
//                           color="text.secondary"
//                           mt={-0.2}
//                         >
//                           {platform.type}
//                         </Typography>
//                       </Box>
//                     </Box>

//                     <Chip
//                       size="small"
//                       label="Live"
//                       sx={{
//                         fontSize: "0.7rem",
//                         height: 22,
//                         borderRadius: 2,
//                         backgroundColor: "#e0fce5",
//                         color: "#15803d",
//                         fontWeight: 600,
//                       }}
//                     />
//                   </Box>

//                   {/* METRIC CARDS */}
//                   {platform.columns.map((column, i) => (
//                     <SmallCard key={i} item={column} />
//                   ))}

//                   {/* FOOTER BUTTONS */}
//                   <Box display="flex" gap={1.2} mt={1}>
//                     <Button
//                       variant="text"
//                       size="small"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         onViewTrends(platform.label);
//                       }}
//                       sx={{
//                         flex: 1,
//                         textTransform: "none",
//                         fontSize: "13px",
//                         fontWeight: 600,
//                         color: "#2563eb",
//                         "&:hover": { background: "#eff6ff" },
//                       }}
//                     >
//                       My Trends <span style={{ fontSize: 10 }}>▶</span>
//                     </Button>

//                     <Button
//                       variant="text"
//                       size="small"
//                       sx={{
//                         flex: 1,
//                         textTransform: "none",
//                         fontSize: "13px",
//                         fontWeight: 600,
//                         color: "#2563eb",
//                         "&:hover": { background: "#eff6ff" },
//                       }}
//                     >
//                       Competition <span style={{ fontSize: 10 }}>▶</span>
//                     </Button>
//                   </Box>
//                 </Box>
//               </Box>
//             ))}
//           </Box>
//         </Box>
//       </Card>
//     </Box>
//   );
// };

// export default PlatformOverview;
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
import { TrendingUp } from "lucide-react";
import { allProducts } from "../../../utils/DataCenter";

/* SMALL KPI CARD */
const SmallCard = ({ item }) => {
  const theme = useTheme();
  const { title, value, meta } = item;
  const isPositive = meta?.change?.includes("▲");

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
        <Typography fontSize="0.8rem" fontWeight={500} color="text.secondary">
          {title}
        </Typography>

        <Typography fontWeight={700} fontSize="1.05rem" mt={0.3}>
          {value}
        </Typography>

        <Box display="flex" alignItems="center" gap={1} mt={0.4}>
          <Typography fontSize="0.75rem" color="text.secondary">
            #{meta.units}
          </Typography>
          <Typography
            fontSize="0.75rem"
            sx={{
              color: isPositive
                ? theme.palette.success.main
                : theme.palette.error.main,
            }}
          >
            {meta.change}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

import axiosInstance from "../../../api/axiosInstance";

/* MAIN COMPONENT */
const PlatformOverview = ({
  data = [],
  onViewTrends = () => { },
  activeKpisTab = "Platform Overview",
  monthOverviewPlatform,
  onPlatformChange,
  categoryOverviewPlatform,
  onCategoryPlatformChange,
  brandsOverviewPlatform,
  onBrandsPlatformChange,
  brandsOverviewCategory,
  onBrandsCategoryChange,
  filters = {} // Accept filters from parent
}) => {
  const theme = useTheme();

  /* VERTICAL SORT */
  const [sortType, setSortType] = React.useState("default");
  const [platformFilter, setPlatformFilter] = React.useState({
    platform: "blinkit",
    category: "", // Will be set when metrics load
    brand: "Amul",
  });

  const [platformList, setPlatformList] = React.useState([]);
  const [categoryList, setCategoryList] = React.useState([]);
  const [metricsList, setMetricsList] = React.useState([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [skuData, setSkuData] = React.useState([]);
  const [loadingSkuData, setLoadingSkuData] = React.useState(false);
  const [selectedSkuMetric, setSelectedSkuMetric] = React.useState("");

  // Fetch Platforms
  React.useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await axiosInstance.get("/watchtower/platforms");
        if (response.data) {
          setPlatformList(response.data);
        }
      } catch (error) {
        console.error("Error fetching platforms:", error);
      }
    };
    fetchPlatforms();
  }, []);

  // Fetch Categories when brandsOverviewPlatform changes
  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axiosInstance.get("/watchtower/categories", {
          params: { platform: brandsOverviewPlatform }
        });
        if (response.data) {
          setCategoryList(response.data);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    if (activeKpisTab === "Brands Overview") {
      fetchCategories();
    }
  }, [brandsOverviewPlatform, activeKpisTab]);

  // Fetch Metrics for Skus Overview dropdown
  React.useEffect(() => {
    const fetchMetrics = async () => {
      try {
        console.log('[SKU Metrics] Fetching metrics list...');
        const response = await axiosInstance.get("/watchtower/metrics");
        if (response.data && response.data.length > 0) {
          console.log('[SKU Metrics] Received metrics:', response.data);
          setMetricsList(response.data);
          // Set first metric as default for Skus Overview
          if (!selectedSkuMetric) {
            console.log('[SKU Metrics] Setting default metric to:', response.data[0]);
            setSelectedSkuMetric(response.data[0]);
          }
        } else {
          console.warn('[SKU Metrics] No metrics received from API');
        }
      } catch (error) {
        console.error("[SKU Metrics] Error fetching metrics:", error);
      }
    };
    fetchMetrics();
  }, []); // Fetch once on mount

  // Fetch SKU data when metric changes
  React.useEffect(() => {
    const fetchSkuData = async () => {
      console.log('[SKU Data] Effect triggered. selectedSkuMetric:', selectedSkuMetric, 'activeKpisTab:', activeKpisTab);

      if (!selectedSkuMetric || activeKpisTab !== "Skus Overview") {
        console.log('[SKU Data] Skipping fetch. Metric:', selectedSkuMetric, 'Tab:', activeKpisTab);
        return;
      }

      setLoadingSkuData(true);
      try {
        // Build params object with all active filters
        const params = {
          metric: selectedSkuMetric
        };

        // Add filters if they exist
        if (filters.platform) params.platform = filters.platform;
        if (filters.brand) params.brand = filters.brand;
        if (filters.location) params.location = filters.location;
        if (filters.startDate) params.dateFrom = filters.startDate;
        if (filters.endDate) params.dateTo = filters.endDate;

        console.log('[SKU Data] Fetching SKU metrics with params:', params);

        const response = await axiosInstance.get("/watchtower/sku-metrics", {
          params
        });
        console.log('[SKU Data] Received response:', response.data?.length, 'SKUs');
        if (response.data) {
          setSkuData(response.data);
        }
      } catch (error) {
        console.error("[SKU Data] Error fetching SKU metrics data:", error);
        setSkuData([]);
      } finally {
        setLoadingSkuData(false);
      }
    };

    fetchSkuData();
  }, [selectedSkuMetric, activeKpisTab, filters]);



  const sortedPlatforms = React.useMemo(() => {
    let filteredData = data;

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filteredData = data.filter(item =>
        (item.label || "").toLowerCase().includes(lowerTerm)
      );
    }

    return filteredData.map((platform) => {
      let sortedColumns = [...platform.columns];

      if (sortType === "asc") {
        sortedColumns.sort((a, b) => a.title.localeCompare(b.title));
      }
      if (sortType === "desc") {
        sortedColumns.sort((a, b) => b.title.localeCompare(a.title));
      }

      return { ...platform, columns: sortedColumns };
    });
  }, [sortType, data, searchTerm]);

  return (
    <Box sx={{
      maxHeight: 'calc(100vh - 200px)', // ADDED: Limit height to enable scrolling
      overflowY: 'auto', // ADDED: Enable vertical scrolling
      '&::-webkit-scrollbar': { width: 8 }, // ADDED: Custom scrollbar styling
      '&::-webkit-scrollbar-thumb': {
        background: '#cbd5e1',
        borderRadius: 10,
      },
    }}>
      {activeKpisTab !== "Skus Overview" ? (
        <Card
          sx={{
            p: 3,
            borderRadius: 4,
            boxShadow: 3,
            background: theme.palette.background.paper,
          }}
        >
          {/* HEADER */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            mb={3}
            gap={2}
          >
            {/* LEFT TITLE */}
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
                <BsGrid3X3GapFill
                  size={18}
                  color={theme.palette.primary.main}
                />
              </Box>

              <Typography ml={1.2} fontWeight={700} fontSize="1.2rem">
                {activeKpisTab}
              </Typography>
            </Box>

            {/* RIGHT SECTION — SEARCH + SORTING */}
            <Box display="flex" alignItems="center" gap={1.2}>
              {/* FILTER DROPDOWN */}
              {activeKpisTab === "Month Overview" && (
                <Select
                  size="small"
                  value={monthOverviewPlatform || "Blinkit"}
                  onChange={(e) => onPlatformChange && onPlatformChange(e.target.value)}
                  sx={{
                    minWidth: 130,
                    height: 36,
                    fontSize: "0.85rem",
                    background: "#f3f4f6",
                    borderRadius: 1.5,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: theme.palette.divider,
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: theme.palette.text.primary,
                    },
                  }}
                >
                  <MenuItem value="Zepto">Zepto</MenuItem>
                  <MenuItem value="Blinkit">Blinkit</MenuItem>
                  <MenuItem value="Swiggy">Swiggy</MenuItem>
                  <MenuItem value="Amazon">Amazon</MenuItem>
                </Select>
              )}

              {/* Category Overview Platform Filter */}
              {activeKpisTab === "Category Overview" && (
                <Select
                  size="small"
                  value={categoryOverviewPlatform || "Zepto"}
                  onChange={(e) => onCategoryPlatformChange && onCategoryPlatformChange(e.target.value)}
                  sx={{
                    minWidth: 130,
                    height: 36,
                    fontSize: "0.85rem",
                    background: "#f3f4f6",
                    borderRadius: 1.5,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: theme.palette.divider,
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: theme.palette.text.primary,
                    },
                  }}
                >
                  <MenuItem value="Zepto">Zepto</MenuItem>
                  <MenuItem value="Blinkit">Blinkit</MenuItem>
                  <MenuItem value="Swiggy">Swiggy</MenuItem>
                  <MenuItem value="Amazon">Amazon</MenuItem>
                </Select>
              )}

              {activeKpisTab !== "Platform Overview" && activeKpisTab !== "Month Overview" && activeKpisTab !== "Category Overview" && activeKpisTab !== "Skus Overview" && (
                <>
                  {/* Platform Filter */}
                  <Select
                    size="small"
                    value={activeKpisTab === "Brands Overview" ? (brandsOverviewPlatform || "") : platformFilter.platform}
                    onChange={(e) => {
                      if (activeKpisTab === "Brands Overview") {
                        onBrandsPlatformChange && onBrandsPlatformChange(e.target.value);
                      } else {
                        setPlatformFilter((p) => ({
                          ...p,
                          platform: e.target.value,
                        }));
                      }
                    }}
                    sx={{
                      minWidth: 130,
                      height: 36,
                      fontSize: "1.85rem",
                      background: "#f3f4f6",
                      borderRadius: 1.5,
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: theme.palette.divider,
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: theme.palette.text.primary,
                      },
                    }}
                  >
                    {activeKpisTab === "Brands Overview" ? (
                      platformList.map((p) => (
                        <MenuItem key={p} value={p}>{p}</MenuItem>
                      ))
                    ) : (
                      <MenuItem value="blinkit">Blinkit</MenuItem>
                    )}
                  </Select>

                  {/* Category Filter – only in Brands Overview */}
                  {activeKpisTab === "Brands Overview" && (
                    <Select
                      size="small"
                      value={brandsOverviewCategory || "All"}
                      onChange={(e) => onBrandsCategoryChange && onBrandsCategoryChange(e.target.value)}
                      sx={{
                        minWidth: 130,
                        height: 36,
                        fontSize: "0.85rem",
                        background: "#f3f4f6",
                        borderRadius: 1.5,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: theme.palette.divider,
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: theme.palette.text.primary,
                        },
                      }}
                    >
                      <MenuItem value="All">All Categories</MenuItem>
                      {categoryList.map((c) => (
                        <MenuItem key={c} value={c}>{c}</MenuItem>
                      ))}
                    </Select>
                  )}
                  {activeKpisTab === "Skus Overview" && (
                    <>
                      <Select
                        size="small"
                        value={selectedSkuMetric || ""}
                        onChange={(e) => setSelectedSkuMetric(e.target.value)}
                        sx={{
                          minWidth: 130,
                          height: 36,
                          fontSize: "0.85rem",
                          background: "#f3f4f6",
                          borderRadius: 1.5,
                          "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: theme.palette.divider,
                          },
                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: theme.palette.text.primary,
                          },
                        }}
                      >
                        {metricsList && metricsList.length > 0 ? (
                          metricsList.map((metric) => (
                            <MenuItem key={metric} value={metric}>
                              {metric}
                            </MenuItem>
                          ))
                        ) : (
                          <MenuItem value="">Loading...</MenuItem>
                        )}
                      </Select>
                    </>
                  )}
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
              {/* SORT BUTTONS */}
              <Button
                size="small"
                variant={sortType === "asc" ? "contained" : "outlined"}
                sx={{ textTransform: "none" }}
                onClick={() => setSortType("asc")}
              >
                A → Z
              </Button>
              <Button
                size="small"
                variant={sortType === "desc" ? "contained" : "outlined"}
                sx={{ textTransform: "none" }}
                onClick={() => setSortType("desc")}
              >
                Z → A
              </Button>
              <Button
                size="small"
                variant={sortType === "default" ? "contained" : "outlined"}
                sx={{ textTransform: "none" }}
                onClick={() => setSortType("default")}
              >
                Default
              </Button>
            </Box>
          </Box>

          <Box
            sx={{
              display: "flex",
              gap: 2,
              overflowX: "auto",
              overflowY: "hidden",
              maxHeight: "1460px", // UPDATED: Increased from 755px to accommodate all 12 columns
              pb: 2,
              scrollBehavior: "smooth",
              flexWrap: "nowrap",
              maxWidth: "100%",

              "&::-webkit-scrollbar": { width: 8, height: 8 },
              "&::-webkit-scrollbar-thumb": {
                background: "#cbd5e1",
                borderRadius: 10,
              },
            }}
          >
            {sortedPlatforms.length === 0 ? (
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "400px",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Typography
                  variant="h6"
                  color="text.secondary"
                  sx={{ fontWeight: 500 }}
                >
                  No {activeKpisTab.toLowerCase()} data available
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: "center", maxWidth: 500 }}
                >
                  {activeKpisTab === "Brands Overview"
                    ? "No brands found for the selected platform and category. Try adjusting your filter selections or selecting a different platform/category combination."
                    : "No data available for the selected filters. Please adjust your filter selections."}
                </Typography>
              </Box>
            ) : (
              sortedPlatforms.map((platform) => (
                <Box sx={{ minWidth: 280 }} key={platform.key}>
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
                        {/* Left: Logo + Name */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                          {platform.logo && (
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

                          <Typography fontWeight={700} fontSize="0.95rem">
                            {platform.label}
                          </Typography>
                        </Box>

                        {/* Right: Inline Buttons */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Tooltip title="View platform trend performance" arrow>
                            <IconButton
                              size="small"
                              onClick={() => onViewTrends(platform.label)}
                              sx={{
                                borderRadius: 2,
                                border: "1px solid #e5e7eb",
                                background:
                                  "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(56,189,248,0.08))",
                                width: 32,
                                height: 32,
                              }}
                            >
                              <TrendingUp size={17} />
                            </IconButton>
                          </Tooltip>
                        </Box>

                      </Box>

                      {/* Right: Inline Buttons */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      </Box>

                      {/* Second Row: Platform Type */}
                      <Typography
                        color="text.secondary"
                        fontSize="0.75rem"
                        sx={{ mt: 0.5, ml: 5.5 }}
                      >
                        {platform.type}
                      </Typography>
                    </Box>

                    {/* SORTED KPI CARDS (VERTICAL) */}
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
        <CategoryTable
          categories={skuData}
          activeTab={activeKpisTab}
          selectedMetric={selectedSkuMetric}
          onMetricChange={(metric) => setSelectedSkuMetric(metric)}
          loading={loadingSkuData}
        />
      )}
    </Box>
  );
};

export default PlatformOverview;
