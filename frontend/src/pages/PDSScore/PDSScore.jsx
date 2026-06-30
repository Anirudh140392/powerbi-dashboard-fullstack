import React, { useState, useContext, useEffect } from "react";
import CommonContainer from "../../components/CommonLayout/CommonContainer";
import { FilterContext } from "../../utils/FilterContext";
import TrailyticsTypewriterLoader from "../../components/insights/TrailyticsTypewriterLoader";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  Stack,
  InputBase,
  Button,
  Menu,
  TableSortLabel,
} from "@mui/material";
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ViewAgenda as ViewAgendaIcon,
  ViewComfy as ViewComfyIcon,
  Sort as SortIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";

const PLATFORMS = ["Amazon", "Flipkart National", "Instamart", "Zepto", "BigBasket", "Blinkit"];

const MOCK_PDS_DATA = [
  {
    scoreId: 1,
    dmmhLever: "Assortment",
    dmmhSubLever: "Blockbuster Availability",
    target: "84.08%",
    weight: 35.0,
    score: "78.52%",
    weightedScore: "27.48",
    periodWSTarget: "36.69",
  },
  {
    scoreId: 3,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite generic search",
    target: "15.75%",
    weight: 15.0,
    score: "11.49%",
    weightedScore: "1.72",
    periodWSTarget: "13.47",
  },
  {
    scoreId: 4,
    dmmhLever: "Search",
    dmmhSubLever: "Onsite branded search",
    target: "96.50%",
    weight: 10.0,
    score: "98.73%",
    weightedScore: "9.87",
    periodWSTarget: "9.70",
  },
  {
    scoreId: 6,
    dmmhLever: "Content",
    dmmhSubLever: "Quality hero image",
    target: "91.00%",
    weight: 8.5,
    score: "82.03%",
    weightedScore: "6.97",
    periodWSTarget: "9.13",
  },
  {
    scoreId: 7,
    dmmhLever: "Content",
    dmmhSubLever: "Secondary images",
    target: "88.92%",
    weight: 5.5,
    score: "80.16%",
    weightedScore: "4.41",
    periodWSTarget: "5.51",
  },
  {
    scoreId: 8,
    dmmhLever: "Content",
    dmmhSubLever: "Enhanced Content",
    target: "100.00%",
    weight: 1.0,
    score: "-",
    weightedScore: "-",
    periodWSTarget: "1.00",
  },
  {
    scoreId: 9,
    dmmhLever: "Content",
    dmmhSubLever: "Features & Benefits & Description",
    target: "74.22%",
    weight: 2.0,
    score: "56.09%",
    weightedScore: "1.12",
    periodWSTarget: "2.14",
  },
  {
    scoreId: 10,
    dmmhLever: "Content",
    dmmhSubLever: "Title full usage",
    target: "93.08%",
    weight: 8.0,
    score: "82.64%",
    weightedScore: "6.61",
    periodWSTarget: "7.18",
  },
  {
    scoreId: 11,
    dmmhLever: "Content",
    dmmhSubLever: "Ratings & Reviews",
    target: "74.00%",
    weight: 2.5,
    score: "69.36%",
    weightedScore: "1.73",
    periodWSTarget: "2.59",
  },
  {
    scoreId: 13,
    dmmhLever: "Interruption",
    dmmhSubLever: "Dual Siting & Tagging",
    target: "100.00%",
    weight: 2.5,
    score: "-",
    weightedScore: "-",
    periodWSTarget: "2.50",
  },
  {
    scoreId: 14,
    dmmhLever: "Data",
    dmmhSubLever: "Sell-out data by SKU",
    target: "100.00%",
    weight: 5.0,
    score: "100.00%",
    weightedScore: "5.00",
    periodWSTarget: "5.00",
  },
  {
    scoreId: 15,
    dmmhLever: "Data",
    dmmhSubLever: "Search term frequency",
    target: "100.00%",
    weight: 5.0,
    score: "100.00%",
    weightedScore: "5.00",
    periodWSTarget: "5.00",
  },
];

export default function PDSScore() {
  const { platform, selectedBrand } = useContext(FilterContext);

  const [selectedPlatform, setSelectedPlatform] = useState("Instamart");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedPeriod, setSelectedPeriod] = useState("Period 4");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("compact");
  const [sortConfig, setSortConfig] = useState({ key: "scoreId", direction: "asc" });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [selectedPlatform, selectedYear, selectedPeriod, searchTerm]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredData = MOCK_PDS_DATA.filter((row) => {
    const matchesSearch = Object.values(row).some(
      (val) =>
        val &&
        val.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
    return matchesSearch;
  });

  // Sort data
  const sortData = (data) => {
    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (["scoreId", "weight", "score", "target", "weightedScore"].includes(sortConfig.key)) {
          aValue = parseFloat(String(aValue).replace('%', '')) || 0;
          bValue = parseFloat(String(bValue).replace('%', '')) || 0;
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  };

  const sortedFilteredData = sortData(filteredData);

  const getScoreBadgeColor = (score) => {
    if (score === "-") return { bg: "#f3f4f6", text: "#6b7280" };
    const numScore = parseFloat(score);
    if (numScore >= 90) return { bg: "#d1fae5", text: "#065f46" };
    if (numScore >= 75) return { bg: "#dbeafe", text: "#0c4a6e" };
    if (numScore >= 60) return { bg: "#fed7aa", text: "#92400e" };
    return { bg: "#fee2e2", text: "#991b1b" };
  };



  const leverBackgroundColors = {
    Assortment: "#FCEAEA", // Very light pink
    Search: "#FFF4D4", // Very light orange/yellow
    Content: "#EBF5FB", // Very light blue
    Interruption: "#E1F2FB", // Very light sky blue
    Data: "#F4F6F6", // Very light grey
  };

  return (
    <CommonContainer title="PDS Score">
      <Box sx={{ p: 2 }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            bgcolor: "#fff",
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 4, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: "#0052a3", letterSpacing: 1, textTransform: "uppercase" }}>
              TOTAL PDS SCORE
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ bgcolor: "#0052a3", color: "white", px: 2.5, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, boxShadow: '0 4px 12px rgba(0,82,163,0.3)', borderRadius: '99px' }}>
                <Typography sx={{ fontWeight: 500, fontSize: '0.85rem' }}>Achievement :</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>70</Typography>
              </Box>
              <Box sx={{ bgcolor: "#0052a3", color: "white", px: 2.5, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, boxShadow: '0 4px 12px rgba(0,82,163,0.3)', borderRadius: '99px' }}>
                <Typography sx={{ fontWeight: 500, fontSize: '0.85rem' }}>Target :</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>78</Typography>
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              border: "1px solid #e2e8f0",
              borderRadius: '12px',
              overflow: "hidden",
            }}
          >
          {/* Filter and Search Bar */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                Filter:
              </Typography>

              {/* Platform Filter */}
              <Select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                IconComponent={ExpandMoreIcon}
                sx={{
                  bgcolor: "#fff",
                  color: "#374151",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  borderRadius: "99px",
                  border: "1px solid #cbd5e1",
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#94a3b8" },
                  "& .MuiSelect-select": {
                    paddingTop: "4px",
                    paddingBottom: "4px",
                    paddingLeft: "12px",
                    paddingRight: "24px",
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    border: "none",
                  },
                  "& .MuiSvgIcon-root": {
                    color: "#6b7280",
                    fontSize: "1rem",
                  },
                  minWidth: 130,
                }}
              >
                {PLATFORMS.map((p) => (
                  <MenuItem key={p} value={p} sx={{ fontSize: "0.75rem" }}>
                    {p}
                  </MenuItem>
                ))}
              </Select>

              {/* Year Filter */}
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                IconComponent={ExpandMoreIcon}
                sx={{
                  bgcolor: "#fff",
                  color: "#374151",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  borderRadius: "99px",
                  border: "1px solid #cbd5e1",
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#94a3b8" },
                  "& .MuiSelect-select": {
                    paddingTop: "4px",
                    paddingBottom: "4px",
                    paddingLeft: "12px",
                    paddingRight: "24px",
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    border: "none",
                  },
                  "& .MuiSvgIcon-root": {
                    color: "#6b7280",
                    fontSize: "1rem",
                  },
                  minWidth: 110,
                }}
              >
                <MenuItem value="2025" sx={{ fontSize: "0.75rem" }}>2025</MenuItem>
                <MenuItem value="2024" sx={{ fontSize: "0.75rem" }}>2024</MenuItem>
              </Select>

              {/* Period Filter */}
              <Select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                IconComponent={ExpandMoreIcon}
                sx={{
                  bgcolor: "#fff",
                  color: "#374151",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  borderRadius: "99px",
                  border: "1px solid #cbd5e1",
                  transition: "all 0.2s ease",
                  "&:hover": { borderColor: "#94a3b8" },
                  "& .MuiSelect-select": {
                    paddingTop: "4px",
                    paddingBottom: "4px",
                    paddingLeft: "12px",
                    paddingRight: "24px",
                  },
                  "& .MuiOutlinedInput-notchedOutline": {
                    border: "none",
                  },
                  "& .MuiSvgIcon-root": {
                    color: "#6b7280",
                    fontSize: "1rem",
                  },
                  minWidth: 110,
                }}
              >
                <MenuItem value="Period 1" sx={{ fontSize: "0.75rem" }}>Period 1</MenuItem>
                <MenuItem value="Period 2" sx={{ fontSize: "0.75rem" }}>Period 2</MenuItem>
                <MenuItem value="Period 3" sx={{ fontSize: "0.75rem" }}>Period 3</MenuItem>
                <MenuItem value="Period 4" sx={{ fontSize: "0.75rem" }}>Period 4</MenuItem>
                <MenuItem value="Period 5" sx={{ fontSize: "0.75rem" }}>Period 5</MenuItem>
                <MenuItem value="Period 6" sx={{ fontSize: "0.75rem" }}>Period 6</MenuItem>
              </Select>
            </Box>

            {/* Search Bar */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                bgcolor: "#fff",
                border: "1px solid #cbd5e1",
                borderRadius: "99px",
                px: 2,
                py: 0.6,
                minWidth: 250,
                transition: "all 0.2s ease",
                "&:hover": { borderColor: "#94a3b8" },
              }}
            >
              <SearchIcon sx={{ color: "#9ca3af", fontSize: "1.1rem" }} />
              <InputBase
                placeholder="Search by ID, Lever, or Sub-Lever..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  flex: 1,
                  fontSize: "0.875rem",
                  color: "#1f2937",
                  "& ::placeholder": {
                    color: "#9ca3af",
                    opacity: 1,
                  },
                }}
              />
            </Box>
          </Box>

          {/* Table */}
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <TrailyticsTypewriterLoader size={1.1} message="Analyzing KPI correlations..." />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table sx={{ minWidth: "100%", "& th, & td": { borderRight: "1px solid #e5e7eb" }, "& th:last-child, & td:last-child": { borderRight: "none" } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "#f3f4f6" }}>
                  {[
                    { id: "scoreId", label: "Score ID", width: "8%", align: "center", sortable: false },
                    { id: "dmmhLever", label: "DMMH Lever", width: "12%", align: "left", sortable: false },
                    { id: "dmmhSubLever", label: "DMMH Sub-Lever", width: "24%", align: "left", sortable: false },
                    { id: "target", label: "Target", width: "10%", align: "center", sortable: true },
                    { id: "weight", label: "Weight", width: "10%", align: "center", sortable: true },
                    { id: "score", label: "Score", width: "10%", align: "center", sortable: true },
                    { id: "weightedScore", label: "Weighted Score", width: "13%", align: "center", sortable: true },
                  ].map((headCell) => (
                    <TableCell
                      key={headCell.id}
                      align={headCell.align}
                      sx={{
                        fontWeight: 700,
                        color: "#374151",
                        fontSize: "0.8rem",
                        py: 1.5,
                        px: 2,
                        width: headCell.width,
                      }}
                    >
                      {headCell.sortable ? (
                        <TableSortLabel
                          active={sortConfig.key === headCell.id}
                          direction={sortConfig.key === headCell.id ? sortConfig.direction : 'asc'}
                          onClick={() => handleSort(headCell.id)}
                          sx={{
                            "& .MuiTableSortLabel-icon": {
                              opacity: 0.3,
                            },
                            "&.Mui-active .MuiTableSortLabel-icon": {
                              opacity: 1,
                              color: "#0052a3",
                            },
                          }}
                        >
                          {headCell.label}
                        </TableSortLabel>
                      ) : (
                        headCell.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedFilteredData.map((row, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      backgroundColor: leverBackgroundColors[row.dmmhLever] || (idx % 2 === 0 ? "#ffffff" : "#fafafa"),
                      borderBottom: "1px solid #e5e7eb",
                      "&:hover": {
                        filter: "brightness(0.96)",
                      },
                      transition: "filter 0.15s ease",
                    }}
                  >
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                        fontWeight: 500,
                        textAlign: "center",
                      }}
                    >
                      {row.scoreId}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                        fontWeight: 500,
                      }}
                    >
                      {row.dmmhLever}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                      }}
                    >
                      {row.dmmhSubLever}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                        textAlign: "center",
                      }}
                    >
                      {row.target}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#374151",
                        py: 1.5,
                        px: 2,
                        textAlign: "center",
                      }}
                    >
                      {row.weight}%
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        py: 1.5,
                        px: 2,
                        textAlign: "center",
                      }}
                    >
                      {row.score === "-" ? (
                        <Typography sx={{ color: "#6b7280", fontSize: "0.8rem" }}>
                          —
                        </Typography>
                      ) : (
                        <Box
                          sx={{
                            display: "inline-block",
                            bgcolor: getScoreBadgeColor(row.score).bg,
                            color: getScoreBadgeColor(row.score).text,
                            px: 2,
                            py: 0.4,
                            borderRadius: 1,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          {row.score}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.8rem",
                        color: "#1f2937",
                        py: 1.5,
                        px: 2,
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      {row.weightedScore}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination Info */}
          <Box
            sx={{
              p: 1.5,
              bgcolor: "#f9fafb",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.75rem",
              color: "#6b7280",
            }}
          >
            <Typography sx={{ fontSize: "0.75rem", color: "#6b7280" }}>
              1 — {filteredData.length} of {MOCK_PDS_DATA.length}
            </Typography>
          </Box>
          </>
          )}
          </Box>
        </Paper>
      </Box>
    </CommonContainer>
  );
}
