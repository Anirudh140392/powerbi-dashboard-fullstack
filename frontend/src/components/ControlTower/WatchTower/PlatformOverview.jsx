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
} from "@mui/material";
import CategoryTable from "./CategoryTable";
import { allProducts } from "../../../utils/DataCenter";

/* ---------------- SMALL KPI CARD ---------------- */
const SmallCard = ({ item }) => {
  const theme = useTheme();
  const { title, value, meta } = item || {};
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
          {value ?? "—"}
        </Typography>

        {meta && (
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
        )}
      </CardContent>
    </Card>
  );
};

/* ---------------- MAIN COMPONENT ---------------- */
const PlatformOverview = ({
  data = [],
  onViewTrends = () => { },
  activeKpisTab = "Platform Overview",
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
                  background: "#f3f4f6",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <BsGrid3X3GapFill size={18} color={theme.palette.primary.main} />
              </Box>

              <Typography ml={1.2} fontWeight={700} fontSize="1.15rem">
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
                    setPlatformFilter((p) => ({ ...p, platform: e.target.value }))
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
                    setPlatformFilter((p) => ({ ...p, category: e.target.value }))
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
                      setPlatformFilter((p) => ({ ...p, category: e.target.value }))
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

              {/* SORT BUTTONS */}
              <Button size="small" variant={sortType === "asc" ? "contained" : "outlined"} onClick={() => setSortType("asc")}>A → Z</Button>
              <Button size="small" variant={sortType === "desc" ? "contained" : "outlined"} onClick={() => setSortType("desc")}>Z → A</Button>
              <Button size="small" variant={sortType === "default" ? "contained" : "outlined"} onClick={() => setSortType("default")}>Default</Button>
            </Box>
          </Box>

          {/* ---------------- PLATFORM CARDS ---------------- */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              overflowX: "auto",
              pb: 2,
            }}
          >
            {sortedPlatforms.map((platform) => (
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
                      {/* Left: Logo + Name */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
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

                        <Typography fontWeight={700} fontSize="0.95rem">
                          {platform.label}
                        </Typography>
                      </Box>

                      {/* Right: Inline Buttons */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Tooltip title="View platform trend performance" arrow>
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
                            onClick={() => onViewTrends(platform.label)}
                          >
                            Trends <span style={{ fontSize: "1rem" }}>›</span>
                          </Button>
                        </Tooltip>

                        <Tooltip title="Compare performance with competitors" arrow>
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
                        </Tooltip>
                      </Box>
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

                  {/* KPI CARDS */}
                  {platform.columns.map((col, i) => (
                    <SmallCard key={i} item={col} />
                  ))}

                </Card>
              </Box>
            ))}
          </Box>
        </Card>
      ) : (
        <CategoryTable categories={allProducts} activeTab={activeKpisTab} />
      )}
    </Box>
  );
};

export default PlatformOverview;
