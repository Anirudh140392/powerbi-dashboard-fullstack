// --------------------------------------------------------------
//  PRICE TRACKING PRO — WOW UI with Floating Filter Popup Bar
//  + Apple-Style SuperTable, Advanced Chart Toolbar
//  + ECP by Brand + Weekday/Weekend + Discount Trend Drilldown
//  + GLOBAL BRAND FILTER (Option A) + SKU CLICK FILTER
//  + TREND / RPI TABS with Dual RPI Charts
//  + ECP COMPARISON API INTEGRATION
// --------------------------------------------------------------

import React, { useMemo, useState, useRef, useEffect, useContext } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Stack,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Slider,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Toolbar,
  Button,
  Fab,
  Modal,
  Fade,
  Checkbox,
  Menu,
  ListItemIcon,
  ListItemText,
  TableSortLabel,
  TablePagination,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  CircularProgress,
  Skeleton,
} from "@mui/material";

import {
  FilterList,
  Refresh,
  Download,
  CalendarMonth,
  Close,
  ArrowUpward,
  ArrowDownward,
  ViewColumn,
  Search,
  DensitySmall,
  DensityMedium,
  DensityLarge,
  ExpandMore,
  ExpandLess,
  ZoomIn,
  ZoomOut,
  RestartAlt,
  PanTool,
  ShowChart,
  BarChart,
  DarkMode,
  LightMode,
  Gradient,
  RadioButtonChecked,
  RadioButtonUnchecked,
  LegendToggle,
  Tune,
  StackedBarChart,
  TrendingUp,
  MonetizationOn,
  Discount,
} from "@mui/icons-material";

import EChartsWrapper from "../EChartsWrapper";
import axiosInstance from "../../api/axiosInstance";
import axios from "axios";
import LatestOverivewCatCity from "./LatestOverivewCatCity";
import SnapshotOverview from "../CommonLayout/SnapshotOverview";
import { LayoutGrid, Monitor, PieChart, Target, TrendingUp as TrendingUpLucide } from "lucide-react";
import { getLogicalKpiTrend, getLogicalKpiValue } from "../AllAvailablityAnalysis/availablityDataCenter";
import { FilterContext } from "@/utils/FilterContext";
import InsightsPricingView from "./InsightsPricingView";
import TrendsCompetitionDrawer from "../AllAvailablityAnalysis/TrendsCompetitionDrawer";
import PricingRcaDrawer from "./PricingRcaDrawer";

// ----------------------------------------------------------------------
// MOCK DATA
// ----------------------------------------------------------------------

// RPI mock data for the RPI tab
const RPI_FORMAT_DATA = [
  { format: "Cup", rpi: 0.72 },
  { format: "Cone", rpi: 0.85 },
  { format: "Tubs", rpi: 0.96 },
  { format: "Cassata", rpi: 0.88 },
  { format: "Sandwich", rpi: 1.02 },
  { format: "Sticks", rpi: 1.01 },
];

const RPI_BRAND_DATA = [
  { brand: "I'm Lite", rpi: 0.06 },
  { brand: "Call Me", rpi: 0.09 },
  { brand: "So Good", rpi: 0.11 },
  { brand: "Caketale", rpi: 0.13 },
  { brand: "Cadbury", rpi: 0.15 },
  { brand: "Britannia", rpi: 0.17 },
  { brand: "RiteBite", rpi: 0.19 },
  { brand: "Yogabar", rpi: 0.21 },
  { brand: "Ibaco", rpi: 0.27 },
  { brand: "Frubon", rpi: 0.3 },
  { brand: "Mimo", rpi: 0.33 },
  { brand: "Minus Thirty", rpi: 0.36 },
  { brand: "Naturals", rpi: 0.39 },
  { brand: "Noto", rpi: 0.41 },
  { brand: "Hangyo", rpi: 0.44 },
];

// You can replace these with real data later
const BRANDS = [
  "Dairy Day",
  "Amul",
  "Mother Dairy",
  "Kwality Walls",
  "Vadilal",
  "Naturals",
];
const PLATFORMS = ["Blinkit", "Instamart", "Zepto"];
const FORMATS = ["Tubs", "Cones", "Bars", "Family Pack", "Sticks"];
const DATE_OPTIONS = [
  "Nov 2025",
  "Oct 2025",
  "Sep 2025",
  "Aug 2025",
  "Jul 2025",
];

const makeRandom = (a, b, decimals = 1) =>
  Number((Math.random() * (b - a) + a).toFixed(decimals));

// Base price rows
const PRICE_ROWS = Array.from({ length: 18 }).map((_, i) => ({
  id: i + 1,
  brand: BRANDS[i % BRANDS.length],
  platform: PLATFORMS[i % PLATFORMS.length],
  ecp: makeRandom(120, 260),
  wo: makeRandom(160, 280),
  disc: makeRandom(5, 40),
  trend: Math.random() > 0.5 ? "up" : "down",
}));

// Detailed SKU rows
const SKU_ROWS = Array.from({ length: 60 }).map((_, i) => ({
  id: i + 1,
  date: `2${(i % 9) + 1} Nov 2025`,
  platform: PLATFORMS[i % PLATFORMS.length],
  brand: BRANDS[i % BRANDS.length],
  product: `${BRANDS[i % BRANDS.length]} ${["Mango", "Chocolate", "Vanilla", "Kesar"][i % 4]
    } Tub`,
  skuType: i % 2 === 0 ? "Own" : "Competition",
  format: FORMATS[i % FORMATS.length],
  flavour: ["Mango", "Chocolate", "Vanilla", "Kesar"][i % 4],
  ml: [450, 700, 900][i % 3],
  mrp: makeRandom(180, 420, 0),
  base: makeRandom(160, 360, 0),
  disc: makeRandom(5, 50, 1),
  ecp: makeRandom(120, 260, 1),
}));

// Chart data
const DISCOUNT_SERIES = BRANDS.map((b) => ({
  name: b,
  type: "line",
  smooth: true,
  data: DATE_OPTIONS.map(() => makeRandom(5, 35)),
}));

// ECP by Brand table data (for the Power BI-style table)
const ECP_BRAND_ROWS = BRANDS.map((brand, i) => ({
  id: i + 1,
  brand,
  mrp: makeRandom(130, 520, 0),
  ecp: makeRandom(110, 420, 0),
  ecpPerUnit: makeRandom(0.2, 2.5, 2),
  rpi: makeRandom(0.1, 1.5, 2), // Relative Price Index mock
}));

// Weekday / Weekend ECP by brand (mock)
const WEEKDAY_WEEKEND_ECP = BRANDS.map((brand) => ({
  brand,
  weekday: makeRandom(70, 120, 2),
  weekend: makeRandom(70, 120, 2),
}));

// Discount Trend drilldown data (SKU Type -> Brand + platform %)
const DISCOUNT_TREND_GROUPS = [
  {
    skuType: "Butterscotch Cones",
    rows: [
      {
        id: "Butterscotch Cones_Dairy Day",
        brand: "Dairy Day",
        blinkit: 0,
        instamart: 14,
        zepto: 0,
      },
      {
        id: "Butterscotch Cones_Total",
        brand: "Total",
        blinkit: 0,
        instamart: 14,
        zepto: 2,
      },
    ],
  },
  {
    skuType: "ButterScotch Tubs",
    rows: [
      {
        id: "ButterScotch Tubs_Dairy Day",
        brand: "Dairy Day",
        blinkit: 20,
        instamart: 20,
        zepto: 0,
      },
      {
        id: "ButterScotch Tubs_Total",
        brand: "Total",
        blinkit: 20,
        instamart: 20,
        zepto: 5,
      },
    ],
  },
  {
    skuType: "Cakes",
    rows: [
      {
        id: "Cakes_Dairy Day",
        brand: "Dairy Day",
        blinkit: 15,
        instamart: 10,
        zepto: 0,
      },
      {
        id: "Cakes_Total",
        brand: "Total",
        blinkit: 15,
        instamart: 10,
        zepto: 5,
      },
    ],
  },
  {
    skuType: "Cassata",
    rows: [
      {
        id: "Cassata_Dairy Day",
        brand: "Dairy Day",
        blinkit: 5,
        instamart: 0,
        zepto: 0,
      },
      {
        id: "Cassata_Total",
        brand: "Total",
        blinkit: 5,
        instamart: 0,
        zepto: 2,
      },
    ],
  },
];

// ----------------------------------------------------------------------
// FILTER DEFAULTS
// ----------------------------------------------------------------------
const defaultFilters = {
  platform: "All",
  brand: "All",
  format: "All",
  date: "Nov 2025",
  range: [0, 60],
};

// OWN VS COMPETITION COLUMNS + DATA
const ownVsCompColumns = [
  { id: "brandOwn", label: "Own Brand", sortable: true },
  { id: "brandComp", label: "Competitor", sortable: true },
  { id: "product", label: "Product", sortable: true },
  { id: "platform", label: "Platform", sortable: true },
  { id: "ownMRP", label: "Own MRP", sortable: true, numeric: true },
  { id: "compMRP", label: "Comp MRP", sortable: true, numeric: true },
  { id: "ownECP", label: "Own ECP", sortable: true, numeric: true },
  { id: "compECP", label: "Comp ECP", sortable: true, numeric: true },
  {
    id: "diff",
    label: "ECP Diff",
    sortable: true,
    numeric: true,
    render: (value) => (
      <Chip
        size="small"
        label={`${value > 0 ? "+" : ""}${value}`}
        color={value < 0 ? "success" : value > 0 ? "error" : "default"}
        variant={value < 0 ? "filled" : "outlined"}
      />
    ),
  },
  { id: "format", label: "Category", sortable: true },
  { id: "ml", label: "ML", sortable: true, numeric: true },
];

const OWN_VS_COMP_ROWS = Array.from({ length: 10 }).map((_, i) => ({
  id: i + 1,
  brandOwn: BRANDS[i % BRANDS.length],
  brandComp: BRANDS.slice().reverse()[i % BRANDS.length],
  product: `${BRANDS[i % BRANDS.length]} ${["Mango", "Chocolate", "Vanilla", "Kesar"][i % 4]
    } Tub`,
  platform: PLATFORMS[i % PLATFORMS.length],
  ownECP: makeRandom(120, 240),
  compECP: makeRandom(130, 260),
  diff: makeRandom(-20, 20),
  compMRP: makeRandom(160, 380),
  ownMRP: makeRandom(150, 360),
  format: FORMATS[i % FORMATS.length],
  ml: [450, 700, 900][i % 3],
}));

// ----------------------------------------------------------------------
// APPLE-STYLE SUPERTABLE COMPONENT
// ----------------------------------------------------------------------

const SuperTable = ({
  title,
  columns,
  rows,
  getRowId = (row) => row.id,
  initialDensity = "comfortable", // "comfortable" | "compact" | "dense"
  enableSelection = true,
  enableGlobalSearch = true,
  enableExport = true,
  enableColumnManager = true,
  enableRowExpansion = false,
  searchPlaceholder = "Search in table…", // Customizable search placeholder
  renderDetail, // (row) => ReactNode
  onRowClick, // (row) => void
}) => {
  const [globalSearch, setGlobalSearch] = useState("");
  const [visibleColumns, setVisibleColumns] = useState(() =>
    columns.reduce((acc, col) => {
      acc[col.id] = col.visible !== false;
      return acc;
    }, {})
  );
  const [sortConfig, setSortConfig] = useState(null); // { id, direction }
  const [page, setPage] = useState(1); // 1-indexed instead of 0
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [density, setDensity] = useState(initialDensity);
  const [anchorElColumns, setAnchorElColumns] = useState(null);
  const [selected, setSelected] = useState([]);
  const [expanded, setExpanded] = useState({});



  const handleSort = (col) => {
    if (!col.sortable) return;
    setSortConfig((prev) => {
      if (!prev || prev.id !== col.id) {
        return { id: col.id, direction: "asc" };
      }
      if (prev.direction === "asc") return { id: col.id, direction: "desc" };
      return null; // remove sort
    });
  };

  const handleToggleColumn = (id) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(1); // Reset to page 1 when changing rows per page
  };

  const handleSelectAllClick = (event, processedRows) => {
    if (event.target.checked) {
      const newSelected = processedRows.map((r) => getRowId(r));
      setSelected(newSelected);
    } else {
      setSelected([]);
    }
  };

  const handleRowCheckboxClick = (rowId) => {
    setSelected((prev) =>
      prev.includes(rowId)
        ? prev.filter((id) => id !== rowId)
        : [...prev, rowId]
    );
  };

  const handleExportCSV = () => {
    const visibleCols = columns.filter((c) => visibleColumns[c.id]);
    const header = visibleCols.map((c) => `"${c.label}"`).join(",");
    const csvRows = processedRows.map((row) =>
      visibleCols
        .map((c) => {
          const value = row[c.id];
          return `"${value != null ? String(value).replace(/"/g, '""') : ""}"`;
        })
        .join(",")
    );
    const csvContent = [header, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "table-export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpand = (rowId) => {
    setExpanded((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  };

  // density -> size & padding
  const tableSize = density === "dense" ? "small" : "medium";
  const rowPaddingY =
    density === "comfortable" ? 1.4 : density === "compact" ? 0.9 : 0.4;

  // filter + sort
  const processedRows = useMemo(() => {
    let data = [...rows];

    if (globalSearch.trim() !== "") {
      const search = globalSearch.toLowerCase();
      data = data.filter((row) =>
        columns.some((col) => {
          if (!visibleColumns[col.id]) return false;
          const value = row[col.id];
          if (value == null) return false;
          return String(value).toLowerCase().includes(search);
        })
      );
    }

    if (sortConfig) {
      const { id, direction } = sortConfig;
      data.sort((a, b) => {
        const aVal = a[id];
        const bVal = b[id];

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        if (typeof aVal === "number" && typeof bVal === "number") {
          return direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (aStr < bStr) return direction === "asc" ? -1 : 1;
        if (aStr > bStr) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [rows, globalSearch, sortConfig, columns, visibleColumns]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage; // 1-indexed page
    return processedRows.slice(start, start + rowsPerPage);
  }, [processedRows, page, rowsPerPage]);

  const numSelected = selected.length;
  const rowCount = processedRows.length;
  const visibleCols = columns.filter((c) => visibleColumns[c.id]);

  const totalPages = Math.max(1, Math.ceil(rowCount / rowsPerPage));
  const safePage = Math.max(1, Math.min(page, totalPages));

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: 4,
        overflow: "hidden",
        mb: 3,
      }}
    >
      <Toolbar
        sx={{
          px: 2,
          py: 1.2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(250,250,252,0.9)",
        }}
      >
        <Box>
          {title && (
            <Typography variant="subtitle1" fontWeight={700}>
              {title}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {rowCount} records • interactive table
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          {enableGlobalSearch && (
            <TextField
              size="small"
              placeholder={searchPlaceholder}
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setPage(1); // Reset to page 1 when searching
              }}
              InputProps={{
                startAdornment: <Search sx={{ fontSize: 18, mr: 1 }} />,
              }}
            />
          )}

          <ToggleButtonGroup
            size="small"
            value={density}
            exclusive
            onChange={(_, val) => val && setDensity(val)}
          >
            <ToggleButton value="comfortable">
              <DensityMedium fontSize="small" />
            </ToggleButton>
            <ToggleButton value="compact">
              <DensitySmall fontSize="small" />
            </ToggleButton>
            <ToggleButton value="dense">
              <DensityLarge fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          {enableExport && (
            <Tooltip title="Export CSV">
              <span>
                <IconButton size="small" onClick={handleExportCSV}>
                  <Download fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {enableColumnManager && (
            <>
              <Tooltip title="Manage columns">
                <IconButton
                  size="small"
                  onClick={(e) => setAnchorElColumns(e.currentTarget)}
                >
                  <ViewColumn fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorElColumns}
                open={Boolean(anchorElColumns)}
                onClose={() => setAnchorElColumns(null)}
                keepMounted
              >
                {columns.map((col) => (
                  <MenuItem
                    key={col.id}
                    onClick={() => handleToggleColumn(col.id)}
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        size="small"
                        checked={visibleColumns[col.id]}
                        tabIndex={-1}
                      />
                    </ListItemIcon>
                    <ListItemText primary={col.label} />
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </Stack>
      </Toolbar>

      <TableContainer
        component={Paper}
        sx={{
          maxHeight: 360,
          borderRadius: 0,
        }}
      >
        <Table stickyHeader size={tableSize}>
          <TableHead>
            <TableRow
              sx={{
                "& th": {
                  bgcolor: "rgba(245,247,252,0.98)",
                  fontWeight: 600,
                  borderBottomWidth: 1,
                },
              }}
            >
              {enableSelection && (
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    indeterminate={numSelected > 0 && numSelected < rowCount}
                    checked={rowCount > 0 && numSelected === rowCount}
                    onChange={(e) => handleSelectAllClick(e, processedRows)}
                  />
                </TableCell>
              )}

              {enableRowExpansion && (
                <TableCell padding="checkbox" sx={{ width: 40 }} />
              )}

              {visibleCols.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.numeric ? "right" : "left"}
                  sortDirection={
                    sortConfig?.id === col.id ? sortConfig.direction : false
                  }
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {col.sortable ? (
                    <TableSortLabel
                      active={sortConfig?.id === col.id}
                      direction={
                        sortConfig?.id === col.id ? sortConfig.direction : "asc"
                      }
                      onClick={() => handleSort(col)}
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : (
                    col.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {paginatedRows.map((row) => {
              const rowId = getRowId(row);
              const isSelected = selected.includes(rowId);
              const isExpanded = expanded[rowId];

              return (
                <React.Fragment key={rowId}>
                  <TableRow
                    hover
                    selected={isSelected}
                    onClick={() => onRowClick && onRowClick(row)}
                    sx={{
                      cursor:
                        enableRowExpansion || onRowClick
                          ? "pointer"
                          : "default",
                      "& td": { py: rowPaddingY },
                    }}
                  >
                    {enableSelection && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          onChange={() => handleRowCheckboxClick(rowId)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    )}

                    {enableRowExpansion && (
                      <TableCell
                        padding="checkbox"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(rowId);
                        }}
                      >
                        <IconButton size="small">
                          {isExpanded ? (
                            <ExpandLess fontSize="small" />
                          ) : (
                            <ExpandMore fontSize="small" />
                          )}
                        </IconButton>
                      </TableCell>
                    )}

                    {visibleCols.map((col) => (
                      <TableCell
                        key={col.id}
                        align={col.numeric ? "right" : "left"}
                      >
                        {col.render
                          ? col.render(row[col.id], row)
                          : row[col.id]}
                      </TableCell>
                    ))}
                  </TableRow>

                  {enableRowExpansion && isExpanded && renderDetail && (
                    <TableRow>
                      <TableCell
                        colSpan={
                          visibleCols.length +
                          (enableSelection ? 1 : 0) +
                          (enableRowExpansion ? 1 : 0)
                        }
                        sx={{
                          bgcolor: "rgba(244,246,252,0.9)",
                          borderTop: "1px dashed rgba(0,0,0,0.08)",
                        }}
                      >
                        {renderDetail(row)}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}

            {paginatedRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={
                    visibleCols.length +
                    (enableSelection ? 1 : 0) +
                    (enableRowExpansion ? 1 : 0)
                  }
                  align="center"
                  sx={{ py: 4, color: "text.secondary" }}
                >
                  No records found with current filters/search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination - OSA% Detail View Style */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "rgba(250,250,252,0.9)",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <button
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              fontSize: "11px",
              padding: "4px 12px",
              borderRadius: "9999px",
              border: "1px solid rgb(226, 232, 240)",
              background: "white",
              color: "rgb(51, 65, 85)",
              cursor: safePage === 1 ? "not-allowed" : "pointer",
              opacity: safePage === 1 ? 0.4 : 1,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) =>
              safePage !== 1 && (e.target.style.background = "rgb(248, 250, 252)")
            }
            onMouseLeave={(e) => (e.target.style.background = "white")}
          >
            Prev
          </button>

          <Typography variant="caption" sx={{ fontSize: "11px", color: "rgb(100, 116, 139)" }}>
            Page <strong style={{ color: "rgb(15, 23, 42)" }}>{safePage}</strong> /{" "}
            {totalPages}
          </Typography>

          <button
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{
              fontSize: "11px",
              padding: "4px 12px",
              borderRadius: "9999px",
              border: "1px solid rgb(226, 232, 240)",
              background: "white",
              color: "rgb(51, 65, 85)",
              cursor: safePage >= totalPages ? "not-allowed" : "pointer",
              opacity: safePage >= totalPages ? 0.4 : 1,
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) =>
              safePage < totalPages &&
              (e.target.style.background = "rgb(248, 250, 252)")
            }
            onMouseLeave={(e) => (e.target.style.background = "white")}
          >
            Next
          </button>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="caption" sx={{ fontSize: "11px", color: "rgb(100, 116, 139)" }}>
            Rows/page
          </Typography>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setPage(1);
              setRowsPerPage(Number(e.target.value));
            }}
            style={{
              fontSize: "11px",
              padding: "4px 8px",
              borderRadius: "9999px",
              border: "1px solid rgb(226, 232, 240)",
              background: "white",
              color: "rgb(51, 65, 85)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value={5}>5</option>
            <option value={7}>7</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </Stack>
      </Box>
    </Card>
  );
};

// ----------------------------------------------------------------------
// DISCOUNT TREND DRILLDOWN TABLE (SKU Type -> Brand)
//    + onBrandClick to drive global filter
// ----------------------------------------------------------------------

const getHeatColor = (value) => {
  if (value == null) return "transparent";
  if (value >= 20) return "rgba(74, 222, 128, 0.6)"; // green
  if (value >= 10) return "rgba(250, 204, 21, 0.6)"; // yellow
  if (value > 0) return "rgba(248, 113, 113, 0.6)"; // red-ish
  return "rgba(229, 231, 235, 0.6)"; // grey for 0
};

const DiscountTrendDrillTable = ({ groups, platforms = [], selectedBrand, onBrandClick, onCategoryExpand }) => {
  // Default platforms if none provided (fallback for mock data)
  const displayPlatforms = platforms.length > 0 ? platforms : ['Blinkit', 'Instamart', 'Zepto'];

  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (skuType) => {
    const isExpanding = !expandedGroups[skuType];
    setExpandedGroups((prev) => ({
      ...prev,
      [skuType]: isExpanding,
    }));

    // Fetch brand data when expanding a category
    if (isExpanding && onCategoryExpand) {
      onCategoryExpand(skuType);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!selectedBrand) return groups;
    return groups.map((g) => ({
      ...g,
      rows: g.rows.filter(
        (r) => r.brand === selectedBrand || r.brand === "All Brands"
      ),
    }));
  }, [groups, selectedBrand]);

  // Calculate grand total dynamically based on platforms
  const grandTotal = useMemo(() => {
    const init = {};
    displayPlatforms.forEach(p => { init[p] = 0; });

    filteredGroups.forEach((g) => {
      g.rows.forEach((r) => {
        if (r.brand === "All Brands") {
          displayPlatforms.forEach(p => {
            init[p] += r[p] || 0;
          });
        }
      });
    });
    const count = filteredGroups.length || 1;
    const result = {};
    displayPlatforms.forEach(p => {
      result[p] = Number((init[p] / count).toFixed(1));
    });
    return result;
  }, [filteredGroups, displayPlatforms]);

  // Helper to calculate row total (average across platforms)
  const calcRowTotal = (row) => {
    const values = displayPlatforms.map(p => row[p] || 0);
    return values.length > 0
      ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1))
      : 0;
  };

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: 4,
        mb: 3,
      }}
    >
      <Toolbar
        sx={{
          px: 2,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(250,250,252,0.9)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Discount Trend
          </Typography>
          <Typography variant="caption" color="text.secondary">
            SKU Type drilldown • platform discount % heatmap
          </Typography>
        </Box>
        {selectedBrand && (
          <Chip
            size="small"
            label={`Brand filter: ${selectedBrand}`}
            variant="outlined"
          />
        )}
      </Toolbar>

      <TableContainer sx={{ maxHeight: 320 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow
              sx={{
                "& th": {
                  bgcolor: "rgba(245,247,252,0.98)",
                  fontWeight: 600,
                  borderBottomWidth: 1,
                },
              }}
            >
              <TableCell>SKU Type</TableCell>
              <TableCell>Brand</TableCell>
              {displayPlatforms.map(platform => (
                <TableCell key={platform} align="right">{platform}</TableCell>
              ))}
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredGroups.map((g) => {
              // Get the "All Brands" row for group totals
              const allBrandsRow = g.rows.find(r => r.brand === "All Brands") || {};
              const groupTotal = calcRowTotal(allBrandsRow);

              return (
                <React.Fragment key={g.skuType}>
                  {/* Group row */}
                  <TableRow
                    sx={{
                      bgcolor: "rgba(249,250,251,0.9)",
                      "& td": { borderBottom: "1px solid #e5e7eb" },
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <IconButton
                          size="small"
                          onClick={() => toggleGroup(g.skuType)}
                        >
                          {expandedGroups[g.skuType] ? (
                            <ExpandLess fontSize="small" />
                          ) : (
                            <ExpandMore fontSize="small" />
                          )}
                        </IconButton>
                        <Typography variant="body2" fontWeight={600}>
                          {g.skuType}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label="All Brands"
                        variant="outlined"
                        sx={{ fontSize: 11, cursor: 'pointer' }}
                        icon={g.loading ? <CircularProgress size={12} color="inherit" /> : null}
                        onClick={() => toggleGroup(g.skuType)}
                        disabled={g.loading}
                      />
                    </TableCell>
                    {displayPlatforms.map(platform => (
                      <TableCell
                        key={platform}
                        align="right"
                        sx={{ bgcolor: getHeatColor(allBrandsRow[platform] || 0) }}
                      >
                        {allBrandsRow[platform] || 0}%
                      </TableCell>
                    ))}
                    <TableCell
                      align="right"
                      sx={{ bgcolor: getHeatColor(groupTotal) }}
                    >
                      {groupTotal}%
                    </TableCell>
                  </TableRow>

                  {/* Child rows */}
                  {expandedGroups[g.skuType] &&
                    g.rows.map((r) => {
                      const rowTotal = calcRowTotal(r);
                      return (
                        <TableRow key={r.id}>
                          <TableCell />
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: r.brand === "All Brands" ? 700 : 500,
                                color:
                                  r.brand === "All Brands"
                                    ? "text.secondary"
                                    : "text.primary",
                                cursor:
                                  r.brand !== "All Brands" && onBrandClick
                                    ? "pointer"
                                    : "default",
                              }}
                              onClick={() =>
                                r.brand !== "All Brands" &&
                                onBrandClick &&
                                onBrandClick(r.brand)
                              }
                            >
                              {r.brand}
                            </Typography>
                          </TableCell>
                          {displayPlatforms.map(platform => (
                            <TableCell
                              key={platform}
                              align="right"
                              sx={{ bgcolor: getHeatColor(r[platform] || 0) }}
                            >
                              {r[platform] || 0}%
                            </TableCell>
                          ))}
                          <TableCell
                            align="right"
                            sx={{ bgcolor: getHeatColor(rowTotal) }}
                          >
                            {rowTotal}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </React.Fragment>
              );
            })}

            {/* Grand total */}
            <TableRow
              sx={{
                bgcolor: "rgba(15,23,42,0.96)",
                "& td": { color: "#e5e7eb" },
              }}
            >
              <TableCell colSpan={2}>
                <Typography variant="caption" fontWeight={600}>
                  Overall Avg Discount
                </Typography>
              </TableCell>
              {displayPlatforms.map(platform => (
                <TableCell key={platform} align="right">{grandTotal[platform]}%</TableCell>
              ))}
              <TableCell align="right">
                {calcRowTotal(grandTotal)}%
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
};

// ----------------------------------------------------------------------
// MAIN DASHBOARD COMPONENT
// ----------------------------------------------------------------------

export default function PricingAnalysisData() {
  const [chartTab, setChartTab] = useState("discount");

  // Get global filters from FilterContext
  const {
    platform: globalPlatform,
    selectedBrand,
    selectedCategory,
    selectedChannel,
    selectedLocation,
    timeStart,
    timeEnd,
    compareStart,
    compareEnd,
    datesInitialized,
  } = useContext(FilterContext);

  const [filters, setFilters] = useState({ brand: selectedBrand || 'All', range: [0, 100], format: 'All' });

  // Helper: convert array or string filter to comma-separated string for API
  const toFilterString = (val) => Array.isArray(val) ? val.join(',') : val;

  // Centralized query params builder
  const buildQueryParams = (includeCompare = false) => {
    const params = {
      startDate: timeStart?.format('YYYY-MM-DD'),
      endDate: timeEnd?.format('YYYY-MM-DD'),
    };
    if (includeCompare) {
      params.compareStartDate = compareStart?.format('YYYY-MM-DD');
      params.compareEndDate = compareEnd?.format('YYYY-MM-DD');
    }
    if (globalPlatform && globalPlatform !== 'All') params.platform = toFilterString(globalPlatform);
    if (selectedLocation && selectedLocation !== 'All') params.location = toFilterString(selectedLocation);
    if (selectedCategory && selectedCategory !== 'All') params.category = toFilterString(selectedCategory);

    const brandFilter = selectedBrand || filters.brand;
    if (brandFilter && brandFilter !== 'All') params.brand = toFilterString(brandFilter);

    if (selectedChannel && selectedChannel !== 'All') params.channel = toFilterString(selectedChannel);

    return params;
  };

  // Refs for tracking and cancelling requests
  const abortControllerRef = useRef(null);
  const lastFetchedFiltersRef = useRef(null);


  // ECP Comparison state
  const [ecpData, setEcpData] = useState([]);
  const [ecpLoading, setEcpLoading] = useState(true); // Start with loading state

  // ECP by Brand state
  const [ecpByBrandData, setEcpByBrandData] = useState([]);
  const [ecpByBrandLoading, setEcpByBrandLoading] = useState(true);

  // Brand Price Overview state
  const [brandPriceOverviewData, setBrandPriceOverviewData] = useState([]);
  const [brandPriceOverviewLoading, setBrandPriceOverviewLoading] = useState(true);

  // One View Price Grid state
  const [oneViewPriceGridData, setOneViewPriceGridData] = useState([]);
  const [oneViewPriceGridLoading, setOneViewPriceGridLoading] = useState(true);

  // Brand Discount Trend state (for Price Intelligence chart)
  const [brandDiscountTrendData, setBrandDiscountTrendData] = useState({ months: [], series: [] });
  const [brandDiscountTrendLoading, setBrandDiscountTrendLoading] = useState(true);

  // ECP by City state
  const [ecpByCityData, setEcpByCityData] = useState([]);
  const [ecpByCityLoading, setEcpByCityLoading] = useState(true);

  // Pricing KPIs state
  const [pricingKpiData, setPricingKpiData] = useState(null);
  const [pricingKpiLoading, setPricingKpiLoading] = useState(true);

  // Discount Trend state
  const [discountTrendData, setDiscountTrendData] = useState([]);
  const [discountTrendLoading, setDiscountTrendLoading] = useState(true);
  const [discountBrandData, setDiscountBrandData] = useState({}); // { [category]: brandRows }
  const [categoryLoading, setCategoryLoading] = useState({}); // { [category]: boolean }
  const [discountPlatforms, setDiscountPlatforms] = useState([]); // Dynamic platforms from API

  // Filter Dependency Array Helper
  const filterDeps = [globalPlatform, selectedLocation, selectedCategory, selectedChannel, selectedBrand, filters.brand, timeStart, timeEnd, datesInitialized];
  const compareFilterDeps = [...filterDeps, compareStart, compareEnd];

  // Unified Fetcher for all segments to prevent race conditions and redundant renders
  useEffect(() => {
    if (!datesInitialized) return;

    // Build the query params and a stable key for dependency tracking
    const params = buildQueryParams(true);
    const filterKey = JSON.stringify(params);

    // Skip if we already fetched with these exact filters
    if (lastFetchedFiltersRef.current === filterKey) return;

    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    lastFetchedFiltersRef.current = filterKey;

    const fetchData = async () => {
      // Set all loading states
      setPricingKpiLoading(true);
      setEcpLoading(true);
      setEcpByBrandLoading(true);
      setBrandPriceOverviewLoading(true);
      setOneViewPriceGridLoading(true);
      setBrandDiscountTrendLoading(true);
      setEcpByCityLoading(true);
      setDiscountTrendLoading(true);

      const signal = abortController.signal;

      try {
        console.log("[PricingAnalysisData] Fetching all segments in parallel...");
        
        const fetchers = [
          // 0: KPIs
          axiosInstance.get('/pricing-analysis/kpis', { params, signal }),
          // 1: ECP Comparison
          axiosInstance.get('/pricing-analysis/ecp-comparison', { params, signal }),
          // 2: ECP by Brand
          axiosInstance.get('/pricing-analysis/ecp-by-brand', { params: buildQueryParams(false), signal }),
          // 3: Brand Price Overview
          axiosInstance.get('/pricing-analysis/brand-price-overview', { params: buildQueryParams(false), signal }),
          // 4: One View Grid
          axiosInstance.get('/pricing-analysis/one-view-price-grid', { params: buildQueryParams(false), signal }),
          // 5: Brand Discount Trend
          axiosInstance.get('/pricing-analysis/brand-discount-trend', { params: buildQueryParams(false), signal }),
          // 6: ECP by City
          axiosInstance.get('/pricing-analysis/ecp-by-city', { params: buildQueryParams(false), signal }),
          // 7: Discount by Category
          axiosInstance.get('/pricing-analysis/discount-by-category', { params: buildQueryParams(false), signal })
        ];

        const results = await Promise.allSettled(fetchers);

        // Process results
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            if (axios.isCancel(result.reason)) return;
            console.error(`Error fetching segment ${idx}:`, result.reason);
          }

          const data = result.value?.data;
          
          switch(idx) {
            case 0: // KPIs
              setPricingKpiData(data?.success ? data.data : null);
              setPricingKpiLoading(false);
              break;
            case 1: // ECP Comparison
              setEcpData(data?.success ? data.data : []);
              setEcpLoading(false);
              break;
            case 2: // ECP by Brand
              setEcpByBrandData(data?.success ? data.data : []);
              setEcpByBrandLoading(false);
              break;
            case 3: // Brand Price Overview
              setBrandPriceOverviewData(data?.success ? data.data : []);
              setBrandPriceOverviewLoading(false);
              break;
            case 4: // One View Grid
              setOneViewPriceGridData(data?.success ? data.data : []);
              setOneViewPriceGridLoading(false);
              break;
            case 5: // Brand Discount Trend
              setBrandDiscountTrendData(data?.success ? data.data : { months: [], series: [] });
              setBrandDiscountTrendLoading(false);
              break;
            case 6: // ECP by City
              setEcpByCityData(data?.success ? data.data : []);
              setEcpByCityLoading(false);
              break;
            case 7: // Discount by Category
              if (data?.success) {
                setDiscountTrendData(data.data || []);
                setDiscountPlatforms(data.platforms || []);
              } else {
                setDiscountTrendData([]);
                setDiscountPlatforms([]);
              }
              setDiscountTrendLoading(false);
              break;
          }
        });
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.error("Critical error in Pricing parallel fetch:", error);
          lastFetchedFiltersRef.current = null;
        }
      }
    };

    fetchData();

    return () => {
      // Logic handled via ref for stability across fast interactions
    };
  }, compareFilterDeps);


  // Fetch brand-level discount data for a specific category
  const fetchDiscountByBrand = async (category) => {
    if (discountBrandData[category]) return; // Already fetched

    setCategoryLoading(prev => ({ ...prev, [category]: true }));
    try {
      const params = { ...buildQueryParams(false), category };

      console.log("[PricingAnalysisData] Fetching discount by brand for category:", category);
      const response = await axiosInstance.get('/pricing-analysis/discount-by-brand', { params });

      if (response.data?.success && response.data?.data) {
        setDiscountBrandData(prev => ({
          ...prev,
          [category]: response.data.data
        }));
      }
    } catch (error) {
      console.error("Error fetching discount by brand data:", error);
    } finally {
      setCategoryLoading(prev => ({ ...prev, [category]: false }));
    }
  };

  // Transform API data to match DiscountTrendDrillTable expected format
  const discountTrendGroups = useMemo(() => {
    if (discountTrendLoading || discountTrendData.length === 0) {
      return DISCOUNT_TREND_GROUPS; // Fallback to mock data
    }

    return discountTrendData.map(cat => {
      const brandRows = discountBrandData[cat.category] || [];

      // Create rows: brands + All Brands row (category totals)
      const rows = [
        ...brandRows.map(b => {
          const row = {
            id: `${cat.category}_${b.brand}`,
            brand: b.brand,
          };
          // Add dynamic platform values
          discountPlatforms.forEach(p => {
            row[p] = b[p] || 0;
          });
          return row;
        }),
        {
          id: `${cat.category}_AllBrands`,
          brand: "All Brands",
          // Add dynamic platform values from category data
          ...discountPlatforms.reduce((acc, p) => {
            acc[p] = cat[p] || 0;
            return acc;
          }, {}),
        }
      ];

      return {
        skuType: cat.category,
        rows,
        loading: !!categoryLoading[cat.category],
        onExpand: () => fetchDiscountByBrand(cat.category) // Fetch brands when expanded
      };
    });
  }, [discountTrendData, discountBrandData, discountTrendLoading, discountPlatforms]);

  // Weekday/Weekend ECP state
  const [ecpWeekdayWeekendData, setEcpWeekdayWeekendData] = useState([]);
  const [ecpWeekdayWeekendSummary, setEcpWeekdayWeekendSummary] = useState({ brand: 'All Brands', weekday: 0, weekend: 0 });
  const [ecpWeekdayWeekendLoading, setEcpWeekdayWeekendLoading] = useState(false);

  const [openPopup, setOpenPopup] = useState(false);
  const [tab, setTab] = useState("overview");

  // Advanced chart controls
  const [chartType, setChartType] = useState("line"); // line | area | bar | spline
  const [chartSmooth, setChartSmooth] = useState(true);
  const [chartPanMode, setChartPanMode] = useState(false);
  const [chartGradient, setChartGradient] = useState(true);
  const [chartPoints, setChartPoints] = useState(true);
  const [chartThemeMode, setChartThemeMode] = useState("light");
  const [chartLegendVisible, setChartLegendVisible] = useState(true);
  const [chartSeriesSelection, setChartSeriesSelection] = useState(() =>
    BRANDS.reduce((acc, name) => {
      acc[name] = true;
      return acc;
    }, {})
  );
  const [seriesMenuAnchor, setSeriesMenuAnchor] = useState(null);
  const chartRef = useRef(null);

  // Update series selection when API data arrives with new brands
  useEffect(() => {
    if (brandDiscountTrendData.series && brandDiscountTrendData.series.length > 0) {
      setChartSeriesSelection(prev => {
        const newSelection = { ...prev };
        brandDiscountTrendData.series.forEach(s => {
          if (!(s.name in newSelection)) {
            newSelection[s.name] = true; // Enable new brands by default
          }
        });
        return newSelection;
      });
    }
  }, [brandDiscountTrendData]);

  const handleChangeFilter = (key) => (e, v) => {
    if (key === "range") setFilters({ ...filters, range: v });
    else setFilters({ ...filters, [key]: e.target.value });
  };

  const filteredSKUs = useMemo(() => {
    return SKU_ROWS.filter((x) => {
      const p = filters.platform === "All" || x.platform === filters.platform;
      const b = filters.brand === "All" || x.brand === filters.brand;
      const f = filters.format === "All" || x.format === filters.format;
      const d = x.disc >= filters.range[0] && x.disc <= filters.range[1];
      return p && b && f && d;
    });
  }, [filters]);

  const filteredPrice = useMemo(
    () =>
      PRICE_ROWS.filter((x) => {
        const p = filters.platform === "All" || x.platform === filters.platform;
        const b = filters.brand === "All" || x.brand === filters.brand;
        return p && b;
      }),
    [filters]
  );

  // Use only API data for ECP by Brand table (no mock data fallback)
  const filteredEcpBrandRows = useMemo(() => {
    const brandFilter = selectedBrand || filters.brand;

    // Use only API data
    const data = ecpByBrandData;

    // If no brand filter, return all data
    if (!brandFilter || brandFilter === "All" || (Array.isArray(brandFilter) && brandFilter.includes("All"))) {
      return data;
    }

    // Filter by brand (case-insensitive)
    const filtered = data.filter((r) => {
      const rowBrand = String(r.brand || '').toLowerCase();
      if (Array.isArray(brandFilter)) {
        return brandFilter.map(b => String(b).toLowerCase()).includes(rowBrand);
      }
      return rowBrand === String(brandFilter).toLowerCase();
    });

    return filtered;
  }, [filters.brand, selectedBrand, ecpByBrandData]);

  const activeBrand =
    selectedBrand || (filters.brand !== "All" ? filters.brand : null);

  // Fetch weekday/weekend ECP data when dates or brand changes
  useEffect(() => {
    if (!datesInitialized) return;

    const fetchEcpWeekdayWeekend = async () => {
      setEcpWeekdayWeekendLoading(true);
      try {
        const params = buildQueryParams(false);

        console.log("[PricingAnalysisData] Fetching ECP weekday/weekend with params:", params);
        const response = await axiosInstance.get('/pricing-analysis/ecp-weekday-weekend', { params });

        if (response.data?.success) {
          console.log("[PricingAnalysisData] ECP weekday/weekend data received:", response.data.data?.length, "brands");
          setEcpWeekdayWeekendData(response.data.data || []);
          setEcpWeekdayWeekendSummary(response.data.summary || { brand: 'All Brands', weekday: 0, weekend: 0 });
        } else {
          setEcpWeekdayWeekendData([]);
          setEcpWeekdayWeekendSummary({ brand: 'All Brands', weekday: 0, weekend: 0 });
        }
      } catch (error) {
        console.error("Error fetching ECP weekday/weekend data:", error);
        setEcpWeekdayWeekendData([]);
        setEcpWeekdayWeekendSummary({ brand: 'All Brands', weekday: 0, weekend: 0 });
      } finally {
        setEcpWeekdayWeekendLoading(false);
      }
    };

    fetchEcpWeekdayWeekend();
  }, filterDeps);

  const renderTrendChip = (trend) => (
    <Chip
      size="small"
      label={trend === "up" ? "Up" : "Down"}
      icon={trend === "up" ? <ArrowUpward /> : <ArrowDownward />}
      color={trend === "up" ? "success" : "error"}
      variant={trend === "up" ? "filled" : "outlined"}
    />
  );

  const getChartInstance = () => {
    if (!chartRef.current) return null;
    if (chartRef.current.getEchartsInstance) {
      return chartRef.current.getEchartsInstance();
    }
    return null;
  };

  const handleChartZoom = (direction) => {
    const instance = getChartInstance();
    if (!instance) return;
    const options = instance.getOption();
    const dz = (options.dataZoom && options.dataZoom[0]) || {
      start: 0,
      end: 100,
    };
    const range = dz.end - dz.start;
    const step = range * 0.25;
    let start = dz.start;
    let end = dz.end;

    if (direction === "in") {
      start = Math.min(start + step / 2, 100);
      end = Math.max(end - step / 2, 0);
    } else {
      start = Math.max(start - step / 2, 0);
      end = Math.min(end + step / 2, 100);
    }
    if (end - start < 5) return;

    instance.dispatchAction({
      type: "dataZoom",
      start,
      end,
    });
  };

  const handleChartResetZoom = () => {
    const instance = getChartInstance();
    if (!instance) return;
    instance.dispatchAction({
      type: "dataZoom",
      start: 0,
      end: 100,
    });
  };

  const handleDownloadChart = (format) => {
    const instance = getChartInstance();
    if (!instance) return;
    const type = format === "svg" ? "svg" : "png";
    const dataURL = instance.getDataURL({
      type,
      pixelRatio: 2,
      backgroundColor: chartThemeMode === "light" ? "#ffffff" : "#020617",
    });
    const link = document.createElement("a");
    link.href = dataURL;
    link.download =
      format === "svg" ? "discount-tracking.svg" : "discount-tracking.png";
    link.click();
  };

  const handleToggleSeries = (name) => {
    setChartSeriesSelection((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Use API data for chart, fallback to mock data if loading or empty
  // Defined before handler functions that use it
  const chartDataSource = useMemo(() => {
    if (brandDiscountTrendLoading || !brandDiscountTrendData.series || brandDiscountTrendData.series.length === 0) {
      // Fallback to mock data
      return {
        months: DATE_OPTIONS,
        series: DISCOUNT_SERIES
      };
    }
    return brandDiscountTrendData;
  }, [brandDiscountTrendData, brandDiscountTrendLoading]);

  const handleToggleAllSeries = () => {
    // Use dynamic brands from API data or fallback
    const dynamicBrands = (chartDataSource.series || []).map(s => s.name);
    const brandsToUse = dynamicBrands.length > 0 ? dynamicBrands : BRANDS;

    setChartSeriesSelection((prev) => {
      const allOn = brandsToUse.every((b) => prev[b]);
      const next = {};
      brandsToUse.forEach((b) => {
        next[b] = !allOn;
      });
      return next;
    });
  };

  // GLOBAL BRAND FILTER — OPTION A
  const applyGlobalBrandSelection = (brand) => {
    // Use dynamic brands from API data or fallback
    const dynamicBrands = (chartDataSource.series || []).map(s => s.name);
    const brandsToUse = dynamicBrands.length > 0 ? dynamicBrands : BRANDS;

    // Toggle behaviour: clicking same brand again clears filter
    const nextBrand = brand && activeBrand === brand ? "All" : brand || "All";

    if (!nextBrand || nextBrand === "All") {
      setFilters((prev) => ({ ...prev, brand: "All" }));
      setSelectedBrand(null);
      // reset chart series to all ON
      setChartSeriesSelection(() =>
        brandsToUse.reduce((acc, name) => {
          acc[name] = true;
          return acc;
        }, {})
      );
    } else {
      setFilters((prev) => ({ ...prev, brand: nextBrand }));
      setSelectedBrand(nextBrand);
      // chart highlight only selected brand by default
      setChartSeriesSelection(() => {
        const next = {};
        brandsToUse.forEach((b) => {
          next[b] = b === nextBrand;
        });
        return next;
      });
    }
  };

  const discountChart = useMemo(() => {
    const baseTextColor = chartThemeMode === "light" ? "#4b5563" : "#e5e7eb";
    const gridColor = chartThemeMode === "light" ? "#e5e7eb" : "#374151";
    const bgColor = chartThemeMode === "light" ? "#ffffff" : "#020617";

    // Use API data or fallback
    const sourceData = chartDataSource.series || [];
    const months = chartDataSource.months || DATE_OPTIONS;

    const series = sourceData.filter(
      (s) => chartSeriesSelection[s.name]
    ).map((s) => {
      const isBar = chartType === "bar";
      const type = isBar ? "bar" : "line";
      const smooth = chartType === "spline" || (!isBar && chartSmooth);
      const showSymbol = chartPoints;
      const areaStyle =
        chartGradient && (chartType === "area" || chartType === "line")
          ? {
            opacity: 0.18,
          }
          : undefined;

      return {
        ...s,
        type,
        smooth,
        showSymbol,
        symbolSize: showSymbol ? 6 : 0,
        areaStyle,
        lineStyle: {
          width: 2.2,
        },
      };
    });

    return {
      backgroundColor: bgColor,
      tooltip: {
        trigger: "axis",
        backgroundColor:
          chartThemeMode === "light"
            ? "rgba(15,23,42,0.9)"
            : "rgba(15,23,42,0.95)",
        borderWidth: 0,
        textStyle: { color: "#f9fafb" },
        axisPointer: {
          type: "cross",
          label: {
            backgroundColor: "#0f172a",
          },
        },
      },
      legend: {
        show: chartLegendVisible,
        top: 0,
        type: "scroll",
        textStyle: { color: baseTextColor, fontSize: 11 },
        selected: chartSeriesSelection,
      },
      grid: {
        left: "3%",
        right: "3%",
        top: "20%",
        bottom: 40,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: chartType === "bar",
        data: months,
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: baseTextColor },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
        axisLabel: {
          color: baseTextColor,
          formatter: "{value}%",
        },
      },
      dataZoom: [
        {
          type: "inside",
          zoomOnMouseWheel: chartPanMode ? false : true,
          moveOnMouseWheel: chartPanMode ? true : false,
          moveOnMouseMove: chartPanMode,
          filterMode: "none",
        },
        {
          type: "slider",
          height: 14,
          bottom: 10,
        },
      ],
      series,
    };
  }, [
    chartType,
    chartSmooth,
    chartGradient,
    chartPoints,
    chartThemeMode,
    chartLegendVisible,
    chartPanMode,
    chartSeriesSelection,
    chartDataSource,
  ]);

  // RPI charts for RPI tab
  const rpiFormatChart = useMemo(() => {
    const baseTextColor = chartThemeMode === "light" ? "#4b5563" : "#e5e7eb";
    const gridColor = chartThemeMode === "light" ? "#e5e7eb" : "#374151";
    const bgColor = chartThemeMode === "light" ? "#ffffff" : "#020617";

    return {
      backgroundColor: bgColor,
      title: {
        text: "RPI Across Format",
        left: 0,
        top: 4,
        textStyle: { color: baseTextColor, fontSize: 13, fontWeight: 600 },
      },
      grid: { left: 60, right: 40, top: 40, bottom: 40 },
      xAxis: {
        type: "value",
        min: 0,
        max: 1.2,
        axisLine: { lineStyle: { color: gridColor } },
        splitLine: { lineStyle: { color: gridColor, type: "dotted" } },
        axisLabel: { color: baseTextColor },
        name: "RPI",
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: { color: baseTextColor, fontSize: 11 },
      },
      yAxis: {
        type: "category",
        data: RPI_FORMAT_DATA.map((d) => d.format),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: baseTextColor },
      },
      series: [
        {
          type: "bar",
          data: RPI_FORMAT_DATA.map((d) => d.rpi),
          barWidth: "40%",
          itemStyle: {
            opacity: 0.9,
          },
          label: {
            show: true,
            position: "right",
            fontSize: 11,
          },
        },
      ],
      markLine: {
        symbol: "none",
        label: {
          formatter: "1.0",
          position: "end",
          color: "#1d4ed8",
        },
        lineStyle: {
          type: "dashed",
          color: "#1d4ed8",
        },
        data: [{ xAxis: 1 }],
      },
    };
  }, [chartThemeMode]);

  const rpiBrandChart = useMemo(() => {
    const baseTextColor = chartThemeMode === "light" ? "#4b5563" : "#e5e7eb";
    const gridColor = chartThemeMode === "light" ? "#e5e7eb" : "#374151";
    const bgColor = chartThemeMode === "light" ? "#ffffff" : "#020617";

    // Use live API data from ecpByBrandData or fallback to mock
    const liveData = ecpByBrandData.length > 0
      ? [...ecpByBrandData].sort((a, b) => (a.rpi || 0) - (b.rpi || 0))
      : RPI_BRAND_DATA;

    const categories = liveData.map((d) => d.brand);
    const seriesData = liveData.map((d) => Number(d.rpi || 0).toFixed(2));

    return {
      backgroundColor: bgColor,
      title: {
        text: "RPI Across Brands",
        left: 0,
        top: 4,
        textStyle: { color: baseTextColor, fontSize: 13, fontWeight: 600 },
      },
      grid: { left: 80, right: 40, top: 40, bottom: 40 },
      xAxis: {
        type: "value",
        min: 0,
        max: 1.8,
        axisLine: { lineStyle: { color: gridColor } },
        splitLine: { lineStyle: { color: gridColor, type: "dotted" } },
        axisLabel: { color: baseTextColor },
        name: "RPI",
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: { color: baseTextColor, fontSize: 11 },
      },
      yAxis: {
        type: "category",
        data: categories,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: baseTextColor,
          fontSize: 10,
        },
      },
      series: [
        {
          type: "bar",
          data: seriesData,
          barWidth: "45%",
          itemStyle: {
            opacity: 0.9,
          },
          label: {
            show: true,
            position: "right",
            fontSize: 11,
            formatter: "{c}",
          },
        },
      ],
      markLine: {
        symbol: "none",
        label: {
          formatter: "1.0",
          position: "end",
          color: "#1d4ed8",
        },
        lineStyle: {
          type: "dashed",
          color: "#1d4ed8",
        },
        data: [{ xAxis: 1 }],
      },
    };
  }, [chartThemeMode, ecpByBrandData]);

  // Popup filter UI
  const FilterPopup = (
    <Modal open={openPopup} onClose={() => setOpenPopup(false)}>
      <Fade in={openPopup}>
        <Box
          sx={{
            position: "fixed",
            right: 0,
            top: 0,
            width: 380,
            height: "100vh",
            p: 3,
            bgcolor: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(22px)",
            borderLeft: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "-6px 0 30px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            animation: "slideIn 0.35s ease",
            "@keyframes slideIn": {
              from: { transform: "translateX(100%)" },
              to: { transform: "translateX(0)" },
            },
          }}
        >
          {/* HEADER */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h6" fontWeight={700}>
              Filters
            </Typography>
            <IconButton onClick={() => setOpenPopup(false)}>
              <Close />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Stack spacing={2.5} sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
            {/* Platform */}
            <FormControl size="small" fullWidth>
              <InputLabel>Platform</InputLabel>
              <Select
                value={filters.platform}
                label="Platform"
                onChange={handleChangeFilter("platform")}
              >
                <MenuItem value="All">All</MenuItem>
                {PLATFORMS.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Brand */}
            <FormControl size="small" fullWidth>
              <InputLabel>Brand</InputLabel>
              <Select
                value={filters.brand}
                label="Brand"
                onChange={handleChangeFilter("brand")}
              >
                <MenuItem value="All">All</MenuItem>
                {BRANDS.map((b) => (
                  <MenuItem key={b} value={b}>
                    {b}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Format */}
            <FormControl size="small" fullWidth>
              <InputLabel>Format</InputLabel>
              <Select
                value={filters.format}
                label="Format"
                onChange={handleChangeFilter("format")}
              >
                <MenuItem value="All">All</MenuItem>
                {FORMATS.map((f) => (
                  <MenuItem key={f} value={f}>
                    {f}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Month */}
            <FormControl size="small" fullWidth>
              <InputLabel>Month</InputLabel>
              <Select
                value={filters.date}
                label="Month"
                onChange={handleChangeFilter("date")}
              >
                {DATE_OPTIONS.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Discount Slider */}
            <Box>
              <Typography variant="caption" fontWeight={600}>
                Discount Range (%)
              </Typography>
              <Slider
                value={filters.range}
                onChange={handleChangeFilter("range")}
                min={0}
                max={60}
                step={2}
                valueLabelDisplay="auto"
                sx={{
                  "& .MuiSlider-thumb": {
                    backdropFilter: "blur(4px)",
                  },
                  "& .MuiSlider-track": {
                    background: "linear-gradient(90deg,#1976d2,#42a5f5)",
                  },
                }}
              />
            </Box>
          </Stack>

          <Divider sx={{ mt: 2, mb: 2 }} />

          <Button
            fullWidth
            variant="contained"
            sx={{ py: 1.3, borderRadius: 2 }}
            startIcon={<Refresh />}
            onClick={() => {
              setFilters(defaultFilters);
              setSelectedBrand(null);
            }}
          >
            Reset Filters
          </Button>
        </Box>
      </Fade>
    </Modal>
  );

  // SUPER TABLE COLUMN DEFINITIONS
  const brandColumns = [
    {
      id: "brand",
      label: "Brand",
      sortable: true,
    },
    {
      id: "platform",
      label: "Platform",
      sortable: true,
    },
    {
      id: "ecp",
      label: "ECP (₹)",
      sortable: true,
      numeric: true,
    },
    {
      id: "wo",
      label: "ECP w/o Disc (₹)",
      sortable: true,
      numeric: true,
    },
    {
      id: "disc",
      label: "Disc %",
      sortable: true,
      numeric: true,
    },
    {
      id: "trend",
      label: "Trend",
      sortable: false,
      render: (value) => renderTrendChip(value),
    },
  ];

  const skuColumns = [
    { id: "date", label: "Date", sortable: true },
    { id: "platform", label: "Platform", sortable: true },
    { id: "brand", label: "Brand", sortable: true },
    { id: "product", label: "Product", sortable: true },
    { id: "skuType", label: "SKU Type", sortable: true },
    { id: "format", label: "Category", sortable: true },
    { id: "flavour", label: "Flavour", sortable: true },
    { id: "ml", label: "ML", sortable: true, numeric: true },
    { id: "mrp", label: "MRP (₹)", sortable: true, numeric: true },
    { id: "base", label: "Base Price (₹)", sortable: true, numeric: true },
    { id: "disc", label: "Disc %", sortable: true, numeric: true },
    { id: "ecp", label: "ECP (₹)", sortable: true, numeric: true },
  ];

  const ecpByBrandColumns = [
    { id: "brand", label: "Brand", sortable: true },
    { id: "mrp", label: "MRP", sortable: true, numeric: true },
    { id: "ecp", label: "ECP", sortable: true, numeric: true },
    {
      id: "ecpPerUnit",
      label: "ECP Per Unit",
      sortable: true,
      numeric: true,
    },
    { id: "rpi", label: "RPI", sortable: true, numeric: true },
  ];

  // Brand Price Overview columns
  const brandPriceOverviewColumns = [
    { id: "brand", label: "Brand", sortable: true },
    { id: "platform", label: "Platform", sortable: true },
    {
      id: "ecp",
      label: "ECP (₹)",
      sortable: true,
      numeric: true,
      render: (val) => val || 0
    },
    {
      id: "ecpWithoutDisc",
      label: "ECP w/o Disc (₹)",
      sortable: true,
      numeric: true,
      render: (val) => val || 0
    },
    {
      id: "discount",
      label: "Disc %",
      sortable: true,
      numeric: true,
      render: (val) => val || 0
    },
    {
      id: "trend",
      label: "Trend",
      sortable: false,
      render: (val) => (
        <Chip
          size="small"
          label={val === "up" ? "Up" : "Down"}
          icon={val === "up" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          color={val === "up" ? "success" : "error"}
          sx={{ fontWeight: 600 }}
        />
      )
    },
  ];

  // One View Price Grid columns
  const oneViewPriceGridColumns = [
    { id: "date", label: "Date", sortable: true },
    { id: "platform", label: "Platform", sortable: true },
    { id: "brand", label: "Brand", sortable: true },
    { id: "product", label: "Product", sortable: true },
    { id: "skuType", label: "SKU Type", sortable: true },
    { id: "format", label: "Category", sortable: true },
    { id: "ml", label: "ML", sortable: true, numeric: true },
    {
      id: "mrp",
      label: "MRP (₹)",
      sortable: true,
      numeric: true,
      render: (val) => val || 0
    },
    {
      id: "basePrice",
      label: "Base Price (₹)",
      sortable: true,
      numeric: true,
      render: (val) => val || 0
    },
    {
      id: "discount",
      label: "Disc %",
      sortable: true,
      numeric: true,
      render: (val) => val || 0
    },
    {
      id: "ecp",
      label: "ECP (₹)",
      sortable: true,
      numeric: true,
      render: (val) => val || 0
    },
  ];


  const weekdayWeekendRow = useMemo(() => {
    // If API data is available, use it
    if (ecpWeekdayWeekendData.length > 0 || ecpWeekdayWeekendSummary.weekday > 0) {
      if (!activeBrand) {
        // Return summary (All Brands average)
        return ecpWeekdayWeekendSummary;
      }
      // Find specific brand data
      const brandRow = ecpWeekdayWeekendData.find((r) => r.brand === activeBrand);
      return brandRow || ecpWeekdayWeekendSummary;
    }

    // Fallback to mock data if API not yet loaded
    if (!activeBrand) {
      const avg = WEEKDAY_WEEKEND_ECP.reduce(
        (acc, r) => {
          acc.weekday += r.weekday;
          acc.weekend += r.weekend;
          return acc;
        },
        { weekday: 0, weekend: 0 }
      );
      const n = WEEKDAY_WEEKEND_ECP.length || 1;
      return {
        brand: "All Brands",
        weekday: Number((avg.weekday / n).toFixed(2)),
        weekend: Number((avg.weekend / n).toFixed(2)),
      };
    }
    const row =
      WEEKDAY_WEEKEND_ECP.find((r) => r.brand === activeBrand) ||
      WEEKDAY_WEEKEND_ECP[0];
    return row;
  }, [activeBrand, ecpWeekdayWeekendData, ecpWeekdayWeekendSummary]);

  // TABS for Gainer/Drainer
  const pricingGainerDrainerTabs = [
    { key: "ecp", label: "ECP" },
    { key: "discount", label: "Discount" },
    { key: "rpi", label: "RPI" },
  ];

  // Transform ECP comparison data for top gainers and drainers
  const pricingGainerDrainerData = useMemo(() => {
    if (ecpLoading || ecpData.length === 0) {
      return {
        ecp: { gainer: [], drainer: [] },
        discount: { gainer: [], drainer: [] },
        rpi: { gainer: [], drainer: [] }
      };
    }

    // Filter out items with meaningful shifts in any of the three metrics
    const validData = ecpData.filter(item =>
      Math.abs(item.changePercent) > 0.05 ||
      Math.abs(item.discountChange) > 0.05 ||
      Math.abs(item.rpiChange) > 0.005
    );

    // Map to component format
    const mapToGainerDrainer = (item, idx, prefix, metricType = 'ecp') => {
      const name = item.product || item.brand;
      const packSize = item.packSize || "N/A";

      let impactValue = Number(item.changePercent) || 0;
      let impactPrefix = impactValue > 0 ? '+' : '';
      let impactSuffix = '%';

      if (metricType === 'discount') {
        impactValue = Number(item.discountChange) || 0;
        impactPrefix = impactValue > 0 ? '+' : '';
        impactSuffix = '%';
      } else if (metricType === 'rpi') {
        impactValue = Number(item.rpiChange) || 0;
        impactPrefix = impactValue > 0 ? '+' : '';
        impactSuffix = '';
      }

      const ecp = Number(item.ecp_curr) || 0;
      const mrp = Number(item.mrp_curr) || 0;
      const discount = Number(item.discount_curr) || 0;
      const rpi = Number(item.rpi_curr) || 0;
      const change = Number(item.change) || 0;

      return {
        id: `${prefix}-${idx}-${item.brand}-${item.product || idx}`,
        skuCode: item.product ? item.product.substring(0, 8).toUpperCase() : item.brand,
        skuName: name,
        packSize: packSize,
        platform: item.platform,
        categoryTag: item.brand,
        ecpValue: `₹${ecp.toFixed(0)}`,
        discountValue: `${discount.toFixed(1)}%`,
        rpiValue: rpi.toFixed(2),
        impact: `${impactPrefix}${impactValue.toFixed(metricType === 'rpi' ? 2 : 1)}${impactSuffix}`,
        kpis: {
          ecp: `₹${ecp.toFixed(0)}`,
          mrp: `₹${mrp.toFixed(0)}`,
          discount: `${discount.toFixed(1)}%`,
          rpi: rpi.toFixed(2),
          prevEcp: `₹${(Number(item.ecp_prev) || 0).toFixed(0)}`,
          change: `${change > 0 ? '+' : ''}${change.toFixed(1)}`
        },
        topCities: item.topCities || []
      };
    };

    const sortedByEcp = [...validData].sort((a, b) => b.changePercent - a.changePercent);
    const sortedByDiscount = [...validData].sort((a, b) => b.discountChange - a.discountChange);
    const sortedByRpi = [...validData].sort((a, b) => b.rpiChange - a.rpiChange);

    return {
      ecp: {
        gainer: sortedByEcp.slice(0, 5).map((item, i) => mapToGainerDrainer(item, i, 'E-G', 'ecp')),
        drainer: sortedByEcp.slice(-5).reverse().map((item, i) => mapToGainerDrainer(item, i, 'E-D', 'ecp'))
      },
      discount: {
        gainer: sortedByDiscount.slice(0, 5).map((item, i) => mapToGainerDrainer(item, i, 'D-G', 'discount')),
        drainer: sortedByDiscount.slice(-5).reverse().map((item, i) => mapToGainerDrainer(item, i, 'D-D', 'discount'))
      },
      rpi: {
        gainer: sortedByRpi.slice(0, 5).map((item, i) => mapToGainerDrainer(item, i, 'R-G', 'rpi')),
        drainer: sortedByRpi.slice(-5).reverse().map((item, i) => mapToGainerDrainer(item, i, 'R-D', 'rpi'))
      }
    };
  }, [ecpData, ecpLoading]);

  // Overall ECP Delta calculation
  const overallEcpDelta = useMemo(() => {
    if (ecpData.length === 0) return 0;
    const totalCurr = ecpData.reduce((sum, item) => sum + item.ecp_curr, 0);
    const totalPrev = ecpData.reduce((sum, item) => sum + item.ecp_prev, 0);
    if (totalPrev === 0) return 0;
    return parseFloat(((totalCurr - totalPrev) / totalPrev * 100).toFixed(1));
  }, [ecpData]);


  const pricingKpis = useMemo(() => {
    const icons = [Discount, PieChart, Target];
    const gradients = [
      ['#6366f1', '#8b5cf6'],
      ['#14b8a6', '#06b6d4'],
      ['#f43f5e', '#ec4899']
    ];

    if (!pricingKpiData) {
      return [
        { id: 'vis-0', title: 'Discount', value: '-', subtitle: 'Loading...', icon: icons[0], gradient: gradients[0] },
        { id: 'vis-1', title: 'Weighted Discount', value: '-', subtitle: 'Loading...', icon: icons[1], gradient: gradients[1] },
        { id: 'vis-2', title: 'Average selling price', value: '-', subtitle: 'Loading...', icon: icons[2], gradient: gradients[2] },
      ];
    }

    const d = pricingKpiData;

    return [
      {
        id: 'vis-0',
        title: 'Discount',
        value: `${(d.discount?.value || 0).toFixed(1)}%`,
        subtitle: 'Average discount across active SKUs',
        delta: Math.abs(d.discount?.change || 0),
        deltaLabel: `${(d.discount?.change || 0) >= 0 ? '▲' : '▼'} ${Math.abs(d.discount?.change || 0).toFixed(1)}%`,
        icon: icons[0],
        gradient: gradients[0],
        trend: d.discount?.sparklineData || [],
        trendDir: (d.discount?.change || 0) >= 0 ? 'up' : 'down',
        prevText: 'vs Previous Period',
        infoTooltip: 'Weighted Discount % represents the average discount across all SKUs within a specific BGR or Ptype, weighted by each SKU’s sales in the current period on the platform.'
      },
      {
        id: 'vis-1',
        title: 'Weighted Discount',
        value: `${(d.weightedDiscount?.value || 0).toFixed(1)}%`,
        subtitle: 'Discount weighted by sales',
        delta: Math.abs(d.weightedDiscount?.change || 0),
        deltaLabel: `${(d.weightedDiscount?.change || 0) >= 0 ? '▲' : '▼'} ${Math.abs(d.weightedDiscount?.change || 0).toFixed(1)}%`,
        icon: icons[1],
        gradient: gradients[1],
        trend: d.weightedDiscount?.sparklineData || [],
        trendDir: (d.weightedDiscount?.change || 0) >= 0 ? 'up' : 'down',
        prevText: 'vs Previous Period',
        infoTooltip: 'Weighted Discount % represents the average discount across all SKUs within a specific BGR or Ptype, weighted by each SKU’s sales in the current period on the platform.'
      },
      {
        id: 'vis-2',
        title: 'Average selling price',
        value: `₹${(d.asp?.value || 0).toFixed(2)}`,
        subtitle: 'Average selling price of SKUs',
        delta: Math.abs(d.asp?.change || 0),
        deltaLabel: `${(d.asp?.change || 0) >= 0 ? '▲' : '▼'} ${Math.abs(d.asp?.change || 0).toFixed(1)}%`,
        icon: icons[2],
        gradient: gradients[2],
        trend: d.asp?.sparklineData || [],
        trendDir: (d.asp?.change || 0) >= 0 ? 'up' : 'down',
        prevText: 'vs Previous Period'
      }
    ];
  }, [pricingKpiData, pricingKpiLoading]);

  // ── Drawer state for LatestOverivewCatCity ──────────────────────────────
  const [trendsDrawer, setTrendsDrawer] = useState({ open: false, entity: '', dimension: '' });
  const [rcaDrawer, setRcaDrawer] = useState({ open: false, entity: '', dimension: '' });

  const handleViewTrends = (entityName, dimensionLabel, dimensionType) => {
    setTrendsDrawer({ open: true, entity: entityName, dimension: dimensionLabel, dimensionType: dimensionType || 'category' });
  };

  const handleViewRca = (entityName, dimensionLabel) => {
    setRcaDrawer({ open: true, entity: entityName, dimension: dimensionLabel });
  };

  // MAIN RETURN
  return (
    <Box sx={{ p: 3, bgcolor: "white", minHeight: "100vh" }}>
      {/* KPIs Section */}
      <SnapshotOverview
        title="Pricing Overview"
        icon={LayoutGrid}

        headerRight={
          <span className="px-4 py-1.5 text-xs font-bold text-slate-500 bg-slate-50/50 rounded-xl border border-slate-100 uppercase tracking-tight">
            vs Previous Period
          </span>
        }
        kpis={pricingKpis}
        variant="detailed"
        helpMenu="Pricing Analysis"
        loading={pricingKpiLoading}
      />

      {/* Insights Section */}
      <Card
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 8,
          boxShadow: 4,
          background: "linear-gradient(120deg,#ffffff,#f3f5ff)",
          minHeight: 300
        }}
      >
        <InsightsPricingView loading={ecpLoading} />
      </Card>

      {/* ECP Comparison Section */}
      <Card
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 8,
          boxShadow: 4,
          background: "linear-gradient(120deg,#ffffff,#f3f5ff)",
          minHeight: 400
        }}
      >
        <LatestOverivewCatCity
          loading={ecpLoading}
          onViewTrends={handleViewTrends}
          onViewRca={handleViewRca}
        />
      </Card>

      {/* Pricing Trends Drawer */}
      <TrendsCompetitionDrawer
        dynamicKey="pricing"
        open={trendsDrawer.open}
        onClose={() => setTrendsDrawer({ open: false, entity: '', dimension: '', dimensionType: '' })}
        selectedColumn={trendsDrawer.entity}
        selectedLevel={trendsDrawer.dimension}
        dimensionType={trendsDrawer.dimensionType}
      />

      {/* Pricing RCA Drawer */}
      <PricingRcaDrawer
        entityName={rcaDrawer.open ? rcaDrawer.entity : null}
        dimensionType={rcaDrawer.dimension}
        onClose={() => setRcaDrawer({ open: false, entity: '', dimension: '' })}
      />
    </Box>
  );
}
