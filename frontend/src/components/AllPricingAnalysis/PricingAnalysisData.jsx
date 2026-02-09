// --------------------------------------------------------------
//  PRICE TRACKING PRO — WOW UI with Floating Filter Popup Bar
//  + Apple-Style SuperTable, Advanced Chart Toolbar
//  + ECP by Brand + Weekday/Weekend + Discount Trend Drilldown
//  + GLOBAL BRAND FILTER (Option A) + SKU CLICK FILTER
//  + TREND / RPI TABS with Dual RPI Charts
//  + ECP COMPARISON API INTEGRATION
// --------------------------------------------------------------

import React, { useMemo, useState, useRef, useEffect, useContext } from "react";
import SnapshotOverview from "../CommonLayout/SnapShotOverview";
import SalesGainerDrainerWrapper from "../../pages/Sales/SalesGainerDrainerWrapper";
import { FilterContext } from "../../utils/FilterContext";
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
import DiscountEcpPricing from "./discountEcpPricing";
import { DiscountDrilldownDate } from "./DiscountDrilldownDate";
import DiscountDrilldownCity from "./DiscountDrilldownCity";

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
  { id: "format", label: "Format", sortable: true },
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
    selectedLocation,
    timeStart,
    timeEnd,
    compareStart,
    compareEnd,
    datesInitialized,
  } = useContext(FilterContext);

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

  // Fetch ECP comparison data when filters change
  useEffect(() => {
    if (!datesInitialized) return;

    const fetchEcpComparison = async () => {
      setEcpLoading(true);
      try {
        const params = {
          startDate: timeStart?.format('YYYY-MM-DD'),
          endDate: timeEnd?.format('YYYY-MM-DD'),
          compareStartDate: compareStart?.format('YYYY-MM-DD'),
          compareEndDate: compareEnd?.format('YYYY-MM-DD'),
        };

        if (globalPlatform && globalPlatform !== 'All') {
          params.platform = globalPlatform;
        }
        if (selectedLocation && selectedLocation !== 'All') {
          params.location = selectedLocation;
        }

        console.log("[PricingAnalysisData] Fetching ECP comparison with params:", params);
        const response = await axiosInstance.get('/pricing-analysis/ecp-comparison', { params });

        if (response.data?.success && response.data?.data) {
          console.log("[PricingAnalysisData] ECP data received:", response.data.data.length, "items");
          setEcpData(response.data.data);
        } else {
          setEcpData([]);
        }
      } catch (error) {
        console.error("Error fetching ECP comparison data:", error);
        setEcpData([]);
      } finally {
        setEcpLoading(false);
      }
    };

    fetchEcpComparison();
  }, [globalPlatform, selectedLocation, timeStart, timeEnd, compareStart, compareEnd, datesInitialized]);

  // Fetch ECP by Brand data when filters change
  useEffect(() => {
    if (!datesInitialized) return;

    const fetchEcpByBrand = async () => {
      setEcpByBrandLoading(true);
      try {
        const params = {
          startDate: timeStart?.format('YYYY-MM-DD'),
          endDate: timeEnd?.format('YYYY-MM-DD'),
        };

        if (globalPlatform && globalPlatform !== 'All') {
          params.platform = globalPlatform;
        }
        if (selectedLocation && selectedLocation !== 'All') {
          params.location = selectedLocation;
        }

        console.log("[PricingAnalysisData] Fetching ECP by Brand with params:", params);
        const response = await axiosInstance.get('/pricing-analysis/ecp-by-brand', { params });

        if (response.data?.success && response.data?.data) {
          console.log("[PricingAnalysisData] ECP by Brand data received:", response.data.data.length, "items");
          setEcpByBrandData(response.data.data);
        } else {
          setEcpByBrandData([]);
        }
      } catch (error) {
        console.error("Error fetching ECP by Brand data:", error);
        setEcpByBrandData([]);
      } finally {
        setEcpByBrandLoading(false);
      }
    };

    fetchEcpByBrand();
  }, [globalPlatform, selectedLocation, timeStart, timeEnd, datesInitialized]);

  // Fetch Brand Price Overview data when page loads/dates change or platform filter changes
  useEffect(() => {
    if (!datesInitialized) return;

    const fetchBrandPriceOverview = async () => {
      setBrandPriceOverviewLoading(true);
      try {
        const params = {
          startDate: timeStart?.format('YYYY-MM-DD'),
          endDate: timeEnd?.format('YYYY-MM-DD'),
        };

        // Add platform filter if a specific platform is selected
        if (globalPlatform && globalPlatform !== 'All') {
          params.platform = globalPlatform;
        }

        console.log("[PricingAnalysisData] Fetching Brand Price Overview with params:", params);
        const response = await axiosInstance.get('/pricing-analysis/brand-price-overview', { params });

        if (response.data?.success && response.data?.data) {
          console.log("[PricingAnalysisData] Brand Price Overview data received:", response.data.data.length, "items");
          setBrandPriceOverviewData(response.data.data);
        } else {
          setBrandPriceOverviewData([]);
        }
      } catch (error) {
        console.error("Error fetching Brand Price Overview data:", error);
        setBrandPriceOverviewData([]);
      } finally {
        setBrandPriceOverviewLoading(false);
      }
    };

    fetchBrandPriceOverview();
  }, [timeStart, timeEnd, datesInitialized, globalPlatform]);

  // Fetch One View Price Grid data when page loads/dates/platform change
  useEffect(() => {
    if (!datesInitialized) return;

    const fetchOneViewPriceGrid = async () => {
      setOneViewPriceGridLoading(true);
      try {
        const params = {
          startDate: timeStart?.format('YYYY-MM-DD'),
          endDate: timeEnd?.format('YYYY-MM-DD'),
        };

        // Add platform filter if a specific platform is selected
        if (globalPlatform && globalPlatform !== 'All') {
          params.platform = globalPlatform;
        }

        console.log("[PricingAnalysisData] Fetching One View Price Grid with params:", params);
        const response = await axiosInstance.get('/pricing-analysis/one-view-price-grid', { params });

        if (response.data?.success && response.data?.data) {
          console.log("[PricingAnalysisData] One View Price Grid data received:", response.data.data.length, "items");
          setOneViewPriceGridData(response.data.data);
        } else {
          setOneViewPriceGridData([]);
        }
      } catch (error) {
        console.error("Error fetching One View Price Grid data:", error);
        setOneViewPriceGridData([]);
      } finally {
        setOneViewPriceGridLoading(false);
      }
    };

    fetchOneViewPriceGrid();
  }, [timeStart, timeEnd, datesInitialized, globalPlatform]);

  // Fetch Brand Discount Trend data for Price Intelligence chart
  useEffect(() => {
    if (!datesInitialized) return;

    const fetchBrandDiscountTrend = async () => {
      setBrandDiscountTrendLoading(true);
      try {
        const params = {
          startDate: timeStart?.format('YYYY-MM-DD'),
          endDate: timeEnd?.format('YYYY-MM-DD'),
        };

        // Add platform filter if a specific platform is selected
        if (globalPlatform && globalPlatform !== 'All') {
          params.platform = globalPlatform;
        }

        console.log("[PricingAnalysisData] Fetching Brand Discount Trend with params:", params);
        const response = await axiosInstance.get('/pricing-analysis/brand-discount-trend', { params });

        if (response.data?.success && response.data?.data) {
          console.log("[PricingAnalysisData] Brand Discount Trend data received:", response.data.data);
          setBrandDiscountTrendData(response.data.data);
        } else {
          setBrandDiscountTrendData({ months: [], series: [] });
        }
      } catch (error) {
        console.error("Error fetching Brand Discount Trend data:", error);
        setBrandDiscountTrendData({ months: [], series: [] });
      } finally {
        setBrandDiscountTrendLoading(false);
      }
    };

    fetchBrandDiscountTrend();
  }, [timeStart, timeEnd, datesInitialized, globalPlatform]);

  // Discount Trend state
  const [discountTrendData, setDiscountTrendData] = useState([]);
  const [discountTrendLoading, setDiscountTrendLoading] = useState(true);
  const [discountBrandData, setDiscountBrandData] = useState({}); // { [category]: brandRows }
  const [categoryLoading, setCategoryLoading] = useState({}); // { [category]: boolean }
  const [discountPlatforms, setDiscountPlatforms] = useState([]); // Dynamic platforms from API

  // Fetch discount by category data when page loads
  useEffect(() => {
    if (!datesInitialized) return;

    const fetchDiscountByCategory = async () => {
      setDiscountTrendLoading(true);
      try {
        const params = {
          startDate: timeStart?.format('YYYY-MM-DD'),
          endDate: timeEnd?.format('YYYY-MM-DD'),
        };

        console.log("[PricingAnalysisData] Fetching discount by category with params:", params);
        const response = await axiosInstance.get('/pricing-analysis/discount-by-category', { params });

        if (response.data?.success && response.data?.data) {
          console.log("[PricingAnalysisData] Discount by category data received:", response.data.data.length, "items");
          console.log("[PricingAnalysisData] Available platforms:", response.data.platforms);
          setDiscountTrendData(response.data.data);
          setDiscountPlatforms(response.data.platforms || []);
        } else {
          setDiscountTrendData([]);
          setDiscountPlatforms([]);
        }
      } catch (error) {
        console.error("Error fetching discount by category data:", error);
        setDiscountTrendData([]);
        setDiscountPlatforms([]);
      } finally {
        setDiscountTrendLoading(false);
      }
    };

    fetchDiscountByCategory();
  }, [timeStart, timeEnd, datesInitialized]);

  // Fetch brand-level discount data for a specific category
  const fetchDiscountByBrand = async (category) => {
    if (discountBrandData[category]) return; // Already fetched

    setCategoryLoading(prev => ({ ...prev, [category]: true }));
    try {
      const params = {
        category,
        startDate: timeStart?.format('YYYY-MM-DD'),
        endDate: timeEnd?.format('YYYY-MM-DD'),
      };

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

  const [filters, setFilters] = useState(defaultFilters);
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

  // Brand selected from ECP-by-Brand or anywhere (GLOBAL)
  const [selectedBrand, setSelectedBrand] = useState(null);

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
    if (!brandFilter || brandFilter === "All") {
      return data;
    }

    // Filter by brand (case-insensitive)
    const filtered = data.filter((r) =>
      r.brand?.toLowerCase() === brandFilter?.toLowerCase()
    );

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
        const params = {
          platform: globalPlatform !== 'All' ? globalPlatform : undefined,
          location: selectedLocation !== 'All' ? selectedLocation : undefined,
          startDate: timeStart?.format('YYYY-MM-DD'),
          endDate: timeEnd?.format('YYYY-MM-DD'),
          brand: activeBrand || undefined
        };

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
  }, [globalPlatform, selectedLocation, timeStart, timeEnd, datesInitialized, activeBrand]);

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
        data: RPI_BRAND_DATA.map((d) => d.brand),
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
          data: RPI_BRAND_DATA.map((d) => d.rpi),
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
  }, [chartThemeMode]);

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
    { id: "format", label: "Format", sortable: true },
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
    { id: "format", label: "Format", sortable: true },
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

  // DUMMY DATA for Gainer/Drainer (Pricing)
  const pricingGainerDrainerData = {
    ecp: {
      drainer: [
        {
          id: "ECP-D01",
          skuCode: "AMU-701",
          skuName: "Amul Butterscotch 700ml",
          packSize: "700ml",
          platform: "Blinkit",
          categoryTag: "Tub",
          ecpValue: "₹ 145",
          impact: "-8.2%",
          kpis: { mrp: "₹ 180", discount: "19.4%", rpi: "0.85" },
          topCities: [
            { city: "Mumbai", metric: "ECP ₹ 142", change: "-4.5%" },
            { city: "Pune", metric: "Discount 21%", change: "+3.2%" }
          ]
        },
        {
          id: "ECP-D02",
          skuCode: "KW-502",
          skuName: "Kwality Walls Chocolate 500ml",
          packSize: "500ml",
          platform: "Zepto",
          categoryTag: "Tub",
          ecpValue: "₹ 210",
          impact: "-6.5%",
          kpis: { mrp: "₹ 240", discount: "12.5%", rpi: "0.92" },
          topCities: [
            { city: "Delhi", metric: "ECP ₹ 205", change: "-3.1%" },
            { city: "Gurgaon", metric: "RPI 0.88", change: "-0.05" }
          ]
        },
        {
          id: "ECP-D03",
          skuCode: "NIC-101",
          skuName: "NIC Sitaphal 500ml",
          packSize: "500ml",
          platform: "Instamart",
          categoryTag: "Natural",
          ecpValue: "₹ 280",
          impact: "-4.9%",
          kpis: { mrp: "₹ 310", discount: "9.7%", rpi: "1.05" },
          topCities: [
            { city: "Bangalore", metric: "ECP ₹ 275", change: "-2.4%" },
            { city: "Hyderabad", metric: "Discount 11%", change: "+1.5%" }
          ]
        },
        {
          id: "ECP-D04",
          skuCode: "VAD-401",
          skuName: "Vadilal Kesar Pista 1L",
          packSize: "1L",
          platform: "Blinkit",
          categoryTag: "Party Pack",
          ecpValue: "₹ 190",
          impact: "-5.3%",
          kpis: { mrp: "₹ 230", discount: "17.4%", rpi: "0.88" },
          topCities: [
            { city: "Ahmedabad", metric: "ECP ₹ 185", change: "-4.1%" },
            { city: "Surat", metric: "Discount 19%", change: "+2.8%" }
          ]
        }
      ],
      gainer: [
        {
          id: "ECP-G01",
          skuCode: "KW-801",
          skuName: "Magnum Truffle 80ml",
          packSize: "80ml",
          platform: "Zepto",
          categoryTag: "Stick",
          ecpValue: "₹ 85",
          impact: "+5.4%",
          kpis: { mrp: "₹ 95", discount: "10.5%", rpi: "1.2" },
          topCities: [
            { city: "Bangalore", metric: "ECP ₹ 88", change: "+2.1%" },
            { city: "Hyderabad", metric: "RPI 1.15", change: "+0.1" }
          ]
        },
        {
          id: "ECP-G02",
          skuCode: "AMU-201",
          skuName: "Amul Vanilla Cup 100ml",
          packSize: "100ml",
          platform: "Blinkit",
          categoryTag: "Cup",
          ecpValue: "₹ 18",
          impact: "+3.2%",
          kpis: { mrp: "₹ 20", discount: "10%", rpi: "1.05" },
          topCities: [
            { city: "Mumbai", metric: "ECP ₹ 19", change: "+1.5%" },
            { city: "Pune", metric: "Discount 8%", change: "-2%" }
          ]
        },
        {
          id: "ECP-G03",
          skuCode: "HAV-105",
          skuName: "Havmor Rajbhog 500ml",
          packSize: "500ml",
          platform: "Instamart",
          categoryTag: "Tub",
          ecpValue: "₹ 165",
          impact: "+4.1%",
          kpis: { mrp: "₹ 175", discount: "5.7%", rpi: "1.12" },
          topCities: [
            { city: "Pune", metric: "ECP ₹ 168", change: "+2.5%" },
            { city: "Mumbai", metric: "RPI 1.08", change: "+0.08" }
          ]
        },
        {
          id: "ECP-G04",
          skuCode: "NIC-302",
          skuName: "NIC Roasted Almond 750ml",
          packSize: "750ml",
          platform: "Blinkit",
          categoryTag: "Natural",
          ecpValue: "₹ 345",
          impact: "+2.8%",
          kpis: { mrp: "₹ 360", discount: "4.2%", rpi: "1.18" },
          topCities: [
            { city: "Delhi", metric: "ECP ₹ 350", change: "+1.8%" },
            { city: "Gurgaon", metric: "Discount 3%", change: "-1.2%" }
          ]
        }
      ]
    },
    discount: {
      drainer: [
        {
          id: "DSC-D01",
          skuCode: "HAV-301",
          skuName: "Havmor Chocolate 700ml",
          packSize: "700ml",
          platform: "Instamart",
          categoryTag: "Tub",
          discountValue: "25%",
          impact: "-10.5%",
          kpis: { ecp: "₹ 135", mrp: "₹ 180", rpi: "0.78" },
          topCities: [
            { city: "Pune", metric: "Discount 28%", change: "+5%" },
            { city: "Mumbai", metric: "ECP ₹ 130", change: "-3.5%" }
          ]
        },
        {
          id: "DSC-D02",
          skuCode: "MOT-102",
          skuName: "Mother Dairy Kulfi Box",
          packSize: "6 Units",
          platform: "Blinkit",
          categoryTag: "Multipack",
          discountValue: "18%",
          impact: "-7.2%",
          kpis: { ecp: "₹ 148", mrp: "₹ 180", rpi: "0.88" },
          topCities: [
            { city: "Delhi", metric: "Discount 22%", change: "+4%" },
            { city: "Gurgaon", metric: "ECP ₹ 142", change: "-2.8%" }
          ]
        },
        {
          id: "DSC-D03",
          skuCode: "KW-605",
          skuName: "Kwality Walls Cornetto multipack",
          packSize: "4 x 100ml",
          platform: "Zepto",
          categoryTag: "Multipack",
          discountValue: "22%",
          impact: "-5.8%",
          kpis: { ecp: "₹ 210", mrp: "₹ 270", rpi: "0.82" },
          topCities: [
            { city: "Bangalore", metric: "Discount 25%", change: "+3.5%" },
            { city: "Hyderabad", metric: "ECP ₹ 205", change: "-2.1%" }
          ]
        },
        {
          id: "DSC-D04",
          skuCode: "AMU-902",
          skuName: "Amul Cookies n Cream 1L",
          packSize: "1L",
          platform: "Blinkit",
          categoryTag: "Tub",
          discountValue: "15%",
          impact: "-4.3%",
          kpis: { ecp: "₹ 170", mrp: "₹ 200", rpi: "0.95" },
          topCities: [
            { city: "Mumbai", metric: "Discount 18%", change: "+2.8%" },
            { city: "Ahmedabad", metric: "ECP ₹ 165", change: "-1.5%" }
          ]
        }
      ],
      gainer: [
        {
          id: "DSC-G01",
          skuCode: "KW-901",
          skuName: "Cornetto Double Choco",
          packSize: "120ml",
          platform: "Blinkit",
          categoryTag: "Cone",
          discountValue: "5%",
          impact: "+4.8%",
          kpis: { ecp: "₹ 62", mrp: "₹ 65", rpi: "1.15" },
          topCities: [
            { city: "Hyderabad", metric: "Discount 2%", change: "-3%" },
            { city: "Bangalore", metric: "ECP ₹ 64", change: "+1.2%" }
          ]
        },
        {
          id: "DSC-G02",
          skuCode: "VAD-204",
          skuName: "Vadilal Belgian Chocolate 500ml",
          packSize: "500ml",
          platform: "Zepto",
          categoryTag: "Tub",
          discountValue: "8%",
          impact: "+3.5%",
          kpis: { ecp: "₹ 210", mrp: "₹ 230", rpi: "1.08" },
          topCities: [
            { city: "Delhi", metric: "Discount 5%", change: "-2.5%" },
            { city: "Gurgaon", metric: "ECP ₹ 215", change: "+1.8%" }
          ]
        },
        {
          id: "DSC-G03",
          skuCode: "MOT-301",
          skuName: "Mother Dairy Vanilla 1L",
          packSize: "1L",
          platform: "Instamart",
          categoryTag: "Tub",
          discountValue: "10%",
          impact: "+2.9%",
          kpis: { ecp: "₹ 162", mrp: "₹ 180", rpi: "1.02" },
          topCities: [
            { city: "Bangalore", metric: "Discount 8%", change: "-1.2%" },
            { city: "Chennai", metric: "ECP ₹ 165", change: "+1.1%" }
          ]
        },
        {
          id: "DSC-G04",
          skuCode: "AMU-112",
          skuName: "Amul Epic Choco 80ml",
          packSize: "80ml",
          platform: "Blinkit",
          categoryTag: "Stick",
          discountValue: "2%",
          impact: "+2.1%",
          kpis: { ecp: "₹ 39", mrp: "₹ 40", rpi: "1.22" },
          topCities: [
            { city: "Mumbai", metric: "Discount 0%", change: "-2%" },
            { city: "Pune", metric: "ECP ₹ 40", change: "+0.5%" }
          ]
        }
      ]
    },
    rpi: {
      drainer: [
        {
          id: "RPI-D01",
          skuCode: "NIC-501",
          skuName: "NIC Tender Coconut 500ml",
          packSize: "500ml",
          platform: "Zepto",
          categoryTag: "Natural",
          rpiValue: "0.72",
          impact: "-12.4%",
          kpis: { ecp: "₹ 165", discount: "45%", priceChange: "+15%" },
          topCities: [
            { city: "Mumbai", metric: "RPI 0.65", change: "-0.15" },
            { city: "Thane", metric: "ECP ₹ 155", change: "-5.2%" }
          ]
        },
        {
          id: "RPI-D02",
          skuCode: "HAV-402",
          skuName: "Havmor Mango 1L",
          packSize: "1L",
          platform: "Blinkit",
          categoryTag: "Tub",
          rpiValue: "0.85",
          impact: "-8.1%",
          kpis: { ecp: "₹ 185", discount: "25%", priceChange: "+10%" },
          topCities: [
            { city: "Pune", metric: "RPI 0.82", change: "-0.08" },
            { city: "Nashik", metric: "ECP ₹ 180", change: "-3.4%" }
          ]
        },
        {
          id: "RPI-D03",
          skuCode: "NIC-201",
          skuName: "NIC Roasted Almond 500ml",
          packSize: "500ml",
          platform: "Instamart",
          categoryTag: "Natural",
          rpiValue: "0.88",
          impact: "-6.5%",
          kpis: { ecp: "₹ 245", discount: "15%", priceChange: "+5%" },
          topCities: [
            { city: "Delhi", metric: "RPI 0.85", change: "-0.05" },
            { city: "Gurgaon", metric: "ECP ₹ 240", change: "-2.1%" }
          ]
        },
        {
          id: "RPI-D04",
          skuCode: "KW-704",
          skuName: "Kwality Walls Party Pack 1L",
          packSize: "1L",
          platform: "Zepto",
          categoryTag: "Tub",
          rpiValue: "0.91",
          impact: "-4.2%",
          kpis: { ecp: "₹ 195", discount: "10%", priceChange: "+2%" },
          topCities: [
            { city: "Bangalore", metric: "RPI 0.88", change: "-0.06" },
            { city: "Hyderabad", metric: "ECP ₹ 190", change: "-1.8%" }
          ]
        }
      ],
      gainer: [
        {
          id: "RPI-G01",
          skuCode: "AMU-101",
          skuName: "Amul Gold Milk 500ml",
          packSize: "500ml",
          platform: "Blinkit",
          categoryTag: "Milk",
          rpiValue: "1.25",
          impact: "+6.7%",
          kpis: { ecp: "₹ 33", discount: "0%", priceChange: "0%" },
          topCities: [
            { city: "Delhi", metric: "RPI 1.35", change: "+0.12" },
            { city: "Noida", metric: "ECP ₹ 33", change: "0%" }
          ]
        },
        {
          id: "RPI-G02",
          skuCode: "NIC-405",
          skuName: "NIC Sitaphal 100ml",
          packSize: "100ml",
          platform: "Zepto",
          categoryTag: "Natural",
          rpiValue: "1.15",
          impact: "+5.3%",
          kpis: { ecp: "₹ 65", discount: "0%", priceChange: "0%" },
          topCities: [
            { city: "Mumbai", metric: "RPI 1.25", change: "+0.1" },
            { city: "Pune", metric: "ECP ₹ 65", change: "0%" }
          ]
        },
        {
          id: "RPI-G03",
          skuCode: "HAV-602",
          skuName: "Havmor Belgian Chocolate 100ml",
          packSize: "100ml",
          platform: "Instamart",
          categoryTag: "Cup",
          rpiValue: "1.08",
          impact: "+3.8%",
          kpis: { ecp: "₹ 45", discount: "5%", priceChange: "-2%" },
          topCities: [
            { city: "Bangalore", metric: "RPI 1.12", change: "+0.08" },
            { city: "Chennai", metric: "ECP ₹ 48", change: "+4.5%" }
          ]
        },
        {
          id: "RPI-G04",
          skuCode: "KW-111",
          skuName: "Kwality Walls Choco Brownie 500ml",
          packSize: "500ml",
          platform: "Blinkit",
          categoryTag: "Tub",
          rpiValue: "1.05",
          impact: "+2.4%",
          kpis: { ecp: "₹ 240", discount: "2%", priceChange: "-1%" },
          topCities: [
            { city: "Mumbai", metric: "RPI 1.08", change: "+0.05" },
            { city: "Ahmedabad", metric: "ECP ₹ 245", change: "+1.2%" }
          ]
        }
      ]
    }
  };

  // MAIN RETURN
  return (
    <Box sx={{ p: 0, bgcolor: "#f4f6fb", minHeight: "100vh" }}>
      {/* Top Bar */}
      {/* <Card
        sx={{
          mb: 2,
          p: 2,
          borderRadius: 3,
          boxShadow: 4,
          background: "linear-gradient(120deg,#ffffff,#f3f5ff)",
        }}
      >
        <Typography variant="h5" fontWeight={700}>
          Price & Discount Intelligence
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Cross-platform ECP tracking • Brand comparison • Discount movement
        </Typography>
      </Card> */}

      {/* Snapshot Overview - Pricing Metrics */}
      <SnapshotOverview
        title="Pricing Overview"
        chip="Live Metrics"
        kpis={[
          {
            id: 'avg-ecp',
            title: 'ECP',
            value: ecpByBrandData.length > 0
              ? `₹${(ecpByBrandData.reduce((sum, row) => sum + (row.ecp || 0), 0) / ecpByBrandData.length).toFixed(1)}`
              : '₹0.0',
            subtitle: 'MTD',
            delta: 5.2,
            deltaLabel: 'vs last month',
            icon: MonetizationOn,
            gradient: ['#10b981', '#059669'],
            trend: [90, 95, 92, 98, 105, 110, 108, 115],
          },
          {
            id: 'rpi',
            title: 'RPI',
            value: ecpByBrandData.length > 0 && ecpByBrandData.some(row => row.rpi)
              ? (ecpByBrandData.reduce((sum, row) => sum + (row.rpi || 0), 0) / ecpByBrandData.length).toFixed(2)
              : '1.08',
            subtitle: 'INDEX',
            delta: 3.1,
            deltaLabel: 'vs benchmark',
            icon: TrendingUp,
            gradient: ['#3b82f6', '#2563eb'],
            trend: [1.0, 1.05, 1.02, 1.08, 1.12, 1.15, 1.18, 1.20],
          },
          {
            id: 'avg-discount',
            title: 'Discount',
            value: ecpByBrandData.length > 0
              ? `${(ecpByBrandData.reduce((sum, row) => {
                const discount = ((row.mrp - row.ecp) / row.mrp) * 100;
                return sum + (isNaN(discount) ? 0 : discount);
              }, 0) / ecpByBrandData.length).toFixed(1)}%`
              : '0.0%',
            subtitle: 'MTD',
            delta: -2.3,
            deltaLabel: 'vs last month',
            icon: Discount,
            gradient: ['#f59e0b', '#d97706'],
            trend: [15, 18, 16, 19, 17, 14, 16, 12],
          },
        ]}
      />
      <SalesGainerDrainerWrapper
        tabs={pricingGainerDrainerTabs}
        data={pricingGainerDrainerData}
        defaultTab="ecp"
        isPricing={true}
      />
      <Box sx={{ pt: 2 }}>
        <DiscountEcpPricing />
      </Box>
      <Box sx={{ pt: 2 }}>
        <DiscountDrilldownDate />
      </Box>
      <DiscountDrilldownCity />


      {/* KPI Row - ECP Comparison from API */}
      {/* <Grid container spacing={2} mb={2}>
        {ecpLoading ? (
          // Skeleton loading state for KPI cards
          [1, 2, 3].map((i) => (
            <Grid item xs={12} md={4} key={i}>
              <Card sx={{ p: 2, borderRadius: 3, boxShadow: 4, height: 160 }}>
                <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" width="80%" height={40} sx={{ mb: 1, borderRadius: 1 }} />
                <Skeleton variant="text" width="40%" height={20} sx={{ mb: 2 }} />
                <Skeleton variant="rounded" width={80} height={24} />
              </Card>
            </Grid>
          ))
        ) : ecpData.length > 0 ? (
          // API data
          ecpData.slice(0, 3).map((row, idx) => (
            <Grid item xs={12} md={4} key={idx}>
              <Card
                sx={{
                  p: 2,
                  borderRadius: 3,
                  boxShadow: 4,
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(236,240,255,0.9))",
                  cursor: "pointer",
                }}
                onClick={() => applyGlobalBrandSelection(row.brand)}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  {row.brand}
                </Typography>
                <Typography variant="h5" fontWeight={700} mt={1}>
                  ₹{row.ecp_curr?.toFixed(1)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Platform: {row.platform}
                </Typography>
                <Box mt={1}>{renderTrendChip(row.trend)}</Box>
              </Card>
            </Grid>
          ))
        ) : (
          // Fallback to mock data
          PRICE_ROWS.slice(0, 3).map((row) => (
            <Grid item xs={12} md={4} key={row.id}>
              <Card
                sx={{
                  p: 2,
                  borderRadius: 3,
                  boxShadow: 4,
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(236,240,255,0.9))",
                  cursor: "pointer",
                }}
                onClick={() => applyGlobalBrandSelection(row.brand)}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  {row.brand}
                </Typography>
                <Typography variant="h5" fontWeight={700} mt={1}>
                  ₹{row.ecp}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Platform: {row.platform}
                </Typography>
                <Box mt={1}>{renderTrendChip(row.trend)}</Box>
              </Card>
            </Grid>
          ))
        )}
      </Grid> */}


      {/* NEW SECTION: ECP by Brand + Weekday/Weekend */}
      {/* <Grid container spacing={2} mb={2}>
        <Grid item xs={12} md={8}>
          {ecpByBrandLoading ? (
            <Card sx={{ borderRadius: 3, boxShadow: 4, mb: 3, p: 2 }}>
              <Skeleton variant="text" width="200px" height={32} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 2 }} />
            </Card>
          ) : (
            <SuperTable
              title="ECP by Brand"
              columns={ecpByBrandColumns}
              rows={filteredEcpBrandRows}
              initialDensity="comfortable"
              enableRowExpansion={false}
              searchPlaceholder="Search by brand"
              onRowClick={(row) => applyGlobalBrandSelection(row.brand)}
            />   
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {ecpWeekdayWeekendLoading ? (
            <Card sx={{ borderRadius: 3, boxShadow: 4, mb: 3, p: 2, height: '100%' }}>
              <Skeleton variant="text" width="80%" height={32} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="60%" height={20} sx={{ mb: 3 }} />
              <Skeleton variant="rectangular" width="100%" height={150} sx={{ borderRadius: 2 }} />
            </Card>
          ) : (
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: 4,
                mb: 3,
                height: "100%",
                display: "flex",
                flexDirection: "column",
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
                    ECP by Brand – Weekday / Weekend
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Driven by brand selection from left table / SKU / trend
                  </Typography>
                </Box>
                {activeBrand && (
                  <Chip
                    size="small"
                    label={activeBrand}
                    variant="outlined"
                    onDelete={() => applyGlobalBrandSelection(null)}
                  />
                )}
              </Toolbar>

              <TableContainer sx={{ flex: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow
                      sx={{
                        "& th": {
                          bgcolor: "rgba(245,247,252,0.98)",
                          fontWeight: 600,
                        },
                      }}
                    >
                      <TableCell>Brand</TableCell>
                      <TableCell align="right">Weekday</TableCell>
                      <TableCell align="right">Weekend</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>{weekdayWeekendRow.brand}</TableCell>
                      <TableCell align="right">
                        {weekdayWeekendRow.weekday}
                      </TableCell>
                      <TableCell align="right">
                        {weekdayWeekendRow.weekend}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Total
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {weekdayWeekendRow.weekday}
                      </TableCell>
                      <TableCell align="right">
                        {weekdayWeekendRow.weekend}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </Grid>
      </Grid> */}

      {/* Discount Trend Drilldown (Power BI-style) */}
      {/* {discountTrendLoading ? (
        <Card sx={{ borderRadius: 3, boxShadow: 4, mb: 3, p: 2 }}>
          <Skeleton variant="text" width="250px" height={32} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="200px" height={20} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 2 }} />
        </Card>
      ) : (
        <DiscountTrendDrillTable
          groups={discountTrendGroups}
          platforms={discountPlatforms}
          selectedBrand={activeBrand}
          onBrandClick={applyGlobalBrandSelection}
          onCategoryExpand={fetchDiscountByBrand}
        />
      )} */}

      {/* Tabs + Brand / Own vs Competitors */}
      {/* <Card
        sx={{
          mb: 3,
          borderRadius: 3,
          boxShadow: 0,
          background: "transparent",
        }}
        elevation={0}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            mb: 1.5,
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600 },
          }}
        >
          <Tab label="Brand Overview" value="overview" />
          <Tab label="Own vs Competitors" value="own" />
        </Tabs>
      </Card> */}

      {/* {tab === "overview" && (
        brandPriceOverviewLoading ? (
          <Card sx={{ borderRadius: 3, boxShadow: 4, mb: 3, p: 2 }}>
            <Skeleton variant="text" width="250px" height={32} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={350} sx={{ borderRadius: 2 }} />
          </Card>
        ) : (
          <SuperTable
            title="Brand Price Overview"
            columns={brandPriceOverviewColumns}
            rows={brandPriceOverviewData}
            initialDensity="comfortable"
            searchPlaceholder="Search by brand or platform"
            onRowClick={(row) => applyGlobalBrandSelection(row.brand)}
          />
        )
      )} */}

      {/* One View Price Grid Table */}
      {/* {tab === "overview" && (
        oneViewPriceGridLoading ? (
          <Card sx={{ borderRadius: 3, boxShadow: 4, mb: 3, p: 2 }}>
            <Skeleton variant="text" width="250px" height={32} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={350} sx={{ borderRadius: 2 }} />
          </Card>
        ) : (
          <SuperTable
            title="One View Price Grid"
            columns={oneViewPriceGridColumns}
            rows={oneViewPriceGridData}
            initialDensity="comfortable"
            searchPlaceholder="Search by date, platform, brand, or product"
          />
        )
      )} */}


      {/* {tab === "own" && (
        <SuperTable
          title="Own vs Competition Pricing"
          columns={ownVsCompColumns}
          rows={OWN_VS_COMP_ROWS}
          initialDensity="comfortable"
          enableRowExpansion
          onRowClick={(row) => applyGlobalBrandSelection(row.brandOwn)}
          renderDetail={(row) => (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Detailed Comparison — {row.product}
              </Typography>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={3}
                justifyContent="space-between"
              >
                {/* LEFT BLOCK */}
      {/* <Box>
                  <Typography variant="caption" color="text.secondary">
                    Own Brand Details
                  </Typography>
                  <Typography variant="body2">
                    <strong>{row.brandOwn}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Platform: <strong>{row.platform}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Format: <strong>{row.format}</strong> | ML:{" "}
                    <strong>{row.ml}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Own MRP: <strong>₹{row.ownMRP}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Own ECP: <strong>₹{row.ownECP}</strong>
                  </Typography>
                </Box>

                {/* RIGHT BLOCK */}
      {/* <Box>
                  <Typography variant="caption" color="text.secondary">
                    Competitor Details
                  </Typography>
                  <Typography variant="body2">
                    <strong>{row.brandComp}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Comp MRP: <strong>₹{row.compMRP}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Comp ECP: <strong>₹{row.compECP}</strong>
                  </Typography>
                  <Typography variant="body2">
                    ECP Diff:{" "}
                    <strong
                      style={{
                        color:
                          row.diff < 0 ? "green" : row.diff > 0 ? "red" : "",
                      }}
                    >
                      {row.diff}
                    </strong>
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}
        />
      )} */}

      {/* Trend + RPI Card with Tabs */}
      {/* <Card
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 3,
          boxShadow: 4,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            mb: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography fontWeight={600} mb={0.5}>
              Price Intelligence — Trend & RPI
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Switch between discount trend and RPI view. Brand selection is
              synced from tables / SKU / drilldown.
            </Typography>
          </Box>

          <Tabs
            value={chartTab}
            onChange={(_, v) => v && setChartTab(v)}
            sx={{
              minHeight: 32,
              "& .MuiTab-root": {
                textTransform: "none",
                fontSize: 12,
                minHeight: 32,
              },
            }}
          >
            <Tab label="Discount Trend" value="discount" />
            <Tab label="RPI View" value="rpi" />
          </Tabs>
        </Box>

        {chartTab === "discount" && (
          <>
            <Box
              sx={{
                width: "fit-content",
                mx: "auto", // center OR remove this for right side
                mb: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                px: 1.2,
                py: 0.6,
                borderRadius: 999,
                bgcolor: "rgba(15,23,42,0.85)",
                backdropFilter: "blur(10px)",
                boxShadow: 4,
              }}
            >
              <ToggleButtonGroup
                size="small"
                value={chartType}
                exclusive
                onChange={(_, val) => val && setChartType(val)}
                sx={{
                  "& .MuiToggleButton-root": {
                    color: "#e5e7eb",
                    borderColor: "rgba(148,163,184,0.5)",
                    px: 0.8,
                    "&.Mui-selected": {
                      bgcolor: "rgba(248,250,252,0.15)",
                      color: "#f9fafb",
                    },
                  },
                }}
              >
                <ToggleButton value="line">
                  <ShowChart sx={{ fontSize: 18 }} />
                </ToggleButton>
                <ToggleButton value="area">
                  <StackedBarChart sx={{ fontSize: 18 }} />
                </ToggleButton>
                <ToggleButton value="bar">
                  <BarChart sx={{ fontSize: 18 }} />
                </ToggleButton>
                <ToggleButton value="spline">
                  <ShowChart sx={{ fontSize: 18 }} />
                </ToggleButton>
              </ToggleButtonGroup>

              <Divider
                orientation="vertical"
                flexItem
                sx={{ mx: 0.5, borderColor: "rgba(148,163,184,0.6)" }}
              />

              <Tooltip title="Zoom in">
                <IconButton size="small" onClick={() => handleChartZoom("in")}>
                  <ZoomIn sx={{ fontSize: 18, color: "#e5e7eb" }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom out">
                <IconButton size="small" onClick={() => handleChartZoom("out")}>
                  <ZoomOut sx={{ fontSize: 18, color: "#e5e7eb" }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset zoom">
                <IconButton size="small" onClick={handleChartResetZoom}>
                  <RestartAlt sx={{ fontSize: 18, color: "#e5e7eb" }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={chartPanMode ? "Pan mode (on)" : "Pan mode"}>
                <IconButton
                  size="small"
                  onClick={() => setChartPanMode((v) => !v)}
                  sx={{
                    bgcolor: chartPanMode
                      ? "rgba(248,250,252,0.18)"
                      : "transparent",
                  }}
                >
                  <PanTool sx={{ fontSize: 18, color: "#e5e7eb" }} />
                </IconButton>
              </Tooltip>

              <Divider
                orientation="vertical"
                flexItem
                sx={{ mx: 0.5, borderColor: "rgba(148,163,184,0.6)" }}
              />

              <Tooltip
                title={chartPoints ? "Hide data points" : "Show data points"}
              >
                <IconButton
                  size="small"
                  onClick={() => setChartPoints((v) => !v)}
                >
                  {chartPoints ? (
                    <RadioButtonChecked
                      sx={{ fontSize: 18, color: "#e5e7eb" }}
                    />
                  ) : (
                    <RadioButtonUnchecked
                      sx={{ fontSize: 18, color: "#e5e7eb" }}
                    />
                  )}
                </IconButton>
              </Tooltip>

              <Tooltip
                title={chartGradient ? "Disable gradient" : "Enable gradient"}
              >
                <IconButton
                  size="small"
                  onClick={() => setChartGradient((v) => !v)}
                >
                  <Gradient sx={{ fontSize: 18, color: "#e5e7eb" }} />
                </IconButton>
              </Tooltip>

              <Tooltip
                title={
                  chartThemeMode === "light"
                    ? "Dark chart mode"
                    : "Light chart mode"
                }
              >
                <IconButton
                  size="small"
                  onClick={() =>
                    setChartThemeMode((m) => (m === "light" ? "dark" : "light"))
                  }
                >
                  {chartThemeMode === "light" ? (
                    <DarkMode sx={{ fontSize: 18, color: "#e5e7eb" }} />
                  ) : (
                    <LightMode sx={{ fontSize: 18, color: "#e5e7eb" }} />
                  )}
                </IconButton>
              </Tooltip>

              <Tooltip
                title={chartLegendVisible ? "Hide legend" : "Show legend"}
              >
                <IconButton
                  size="small"
                  onClick={() => setChartLegendVisible((visible) => !visible)}
                >
                  <LegendToggle sx={{ fontSize: 18, color: "#e5e7eb" }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Select series">
                <IconButton
                  size="small"
                  onClick={(e) => setSeriesMenuAnchor(e.currentTarget)}
                >
                  <Tune sx={{ fontSize: 18, color: "#e5e7eb" }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Download PNG">
                <IconButton
                  size="small"
                  onClick={() => handleDownloadChart("png")}
                >
                  <Download sx={{ fontSize: 18, color: "#e5e7eb" }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download SVG">
                <IconButton
                  size="small"
                  onClick={() => handleDownloadChart("svg")}
                >
                  <Download sx={{ fontSize: 18, color: "#e5e7eb" }} />
                </IconButton>
              </Tooltip>
            </Box>

            <Menu
              anchorEl={seriesMenuAnchor}
              open={Boolean(seriesMenuAnchor)}
              onClose={() => setSeriesMenuAnchor(null)}
              keepMounted
              PaperProps={{
                style: {
                  maxHeight: 400,
                  overflowY: 'auto'
                }
              }}
            >
              {(chartDataSource.series || []).map((s) => (
                <MenuItem key={s.name} onClick={() => handleToggleSeries(s.name)}>
                  <ListItemIcon>
                    <Checkbox size="small" checked={chartSeriesSelection[s.name] || false} />
                  </ListItemIcon>
                  <ListItemText primary={s.name} />
                </MenuItem>
              ))}
              <Divider />
              <MenuItem onClick={handleToggleAllSeries}>
                <ListItemIcon>
                  <LegendToggle fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Toggle all" />
              </MenuItem>
            </Menu>

            {brandDiscountTrendLoading ? (
              <Box sx={{ mt: 1, height: 320 }}>
                <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 2 }} />
              </Box>
            ) : (
              <Box sx={{ mt: 1, height: 320 }}>
                <EChartsWrapper
                  option={discountChart}
                  style={{ height: "100%", width: "100%" }}
                />
              </Box>
            )}
          </>
        )}

        {chartTab === "rpi" && (
          <Box sx={{ mt: 1, height: 320 }}>
            <Grid container spacing={2} sx={{ height: "100%" }}>
              <Grid item xs={12} md={6} sx={{ height: "100%" }}>
                <EChartsWrapper
                  option={rpiFormatChart}
                  style={{ height: "100%", width: "100%" }}
                />
              </Grid>
              <Grid item xs={12} md={6} sx={{ height: "100%" }}>
                <EChartsWrapper
                  option={rpiBrandChart}
                  style={{ height: "100%", width: "100%" }}
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </Card> */}
      {/* MODERN FLOATING FILTER DOCK */}
      {/* <Box
        sx={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 1000,
        }}
      >
        <Box
          onClick={() => setOpenPopup(true)}
          sx={{
            px: 2.2,
            py: 1.1,
            borderRadius: "30px",
            display: "flex",
            alignItems: "center",
            gap: 1,
            cursor: "pointer",
            boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
            background: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.45)",
            transition: "0.3s",
            "&:hover": {
              background: "rgba(255,255,255,0.9)",
              transform: "translateY(-2px)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
            },
          }}
        >
          <FilterList sx={{ fontSize: 22, color: "#1976d2" }} />
        </Box>
      </Box> */}

      {/* POPUP FILTER PANEL */}
      {/* {FilterPopup} */}
    </Box>
  );
}
