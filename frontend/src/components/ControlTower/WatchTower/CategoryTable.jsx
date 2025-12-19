import React, { useState, useMemo } from "react";
import {
  Box,
  Card,
  Typography,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  TextField,
  Button,
} from "@mui/material";
import TableChartIcon from "@mui/icons-material/TableChart";
import { Download } from "lucide-react";

export default function CategoryTable({ categories, activeTab = "" }) {
  const platforms = Object.keys(categories[0]).filter((k) => k !== "name");
  const [searchTerm, setSearchTerm] = useState("");

  const allMetricKeys = useMemo(() => {
    const set = new Set();
    categories.forEach((cat) => {
      platforms.forEach((p) => {
        Object.keys(cat[p] || {})
          .filter((k) => !k.endsWith("_change"))
          .forEach((k) => set.add(k));
      });
    });
    return Array.from(set);
  }, []);

  const metricOptions = allMetricKeys.map((key) => ({
    label: key.replace(/_/g, " ").toUpperCase(),
    key,
  }));

  const [selectedMetric, setSelectedMetric] = useState(metricOptions[0]);
  const theme = useTheme();

  /* --------------------- FILTER --------------------- */
  const filteredCategories = useMemo(() => {
    return categories.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, categories]);

  /* -------------------- PAGINATION -------------------- */
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [page, setPage] = useState(0);

  const paginatedRows = useMemo(() => {
    return filteredCategories.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredCategories, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredCategories.length / rowsPerPage);

  /* --------------------- CSV DOWNLOAD --------------------- */
  const handleDownload = () => {
    let csv = [];
    csv.push(["Category/SKU", ...platforms.map((p) => p.toUpperCase())].join(","));
    csv.push(["", selectedMetric.label]);

    filteredCategories.forEach((cat) => {
      const row = [cat.name];
      platforms.forEach((p) => {
        const main = cat[p][selectedMetric.key] || "-";
        const change = cat[p][selectedMetric.key + "_change"] || "-";
        row.push(`${main} (${change})`);
      });
      csv.push(row.join(","));
    });

    const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `table_export_${selectedMetric.key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderChange = (value) => {
    if (!value) return "-";
    const positive = value.startsWith("+");
    return (
      <span
        style={{
          color: positive ? theme.palette.success.main : theme.palette.error.main,
        }}
      >
        {value}
      </span>
    );
  };

  return (
    <Box>
      <Card
        sx={{
          p: 3,
          borderRadius: 3,
          boxShadow: 2,
          background: theme.palette.background.paper,
        }}
      >
        {/* HEADER */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background:
                  theme.palette.mode === "dark"
                    ? theme.palette.background.default
                    : "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TableChartIcon sx={{ color: theme.palette.primary.main }} />
            </Box>

            <Typography fontSize="1.2rem" fontWeight={700} fontFamily="Roboto, sans-serif">
              {activeTab}
            </Typography>
          </Box>

          {/* RIGHT CONTROLS */}
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            {/* <Typography variant="body2" sx={{ color: "#6b7280", fontWeight: 600, fontFamily: "Roboto, sans-serif" }}>
              Metrics:
            </Typography> */}

            <Select
              size="small"
              value={selectedMetric.key}
              onChange={(e) =>
                setSelectedMetric(
                  metricOptions.find((m) => m.key === e.target.value)
                )
              }
              sx={{
                minWidth: 130,
                height: 36,
                fontSize: "0.85rem",
                background: "#f3f4f6",
              }}
            >
              {metricOptions.map((opt) => (
                <MenuItem key={opt.key} value={opt.key}>
                  {opt.label.toLowerCase().charAt(0).toUpperCase() + opt.label.toLowerCase().slice(1)}
                </MenuItem>
              ))}
            </Select>

            {/* SEARCH */}
            <TextField
              size="small"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0); // reset page on search
              }}
              sx={{ width: 200 }}
            />

            {/* DOWNLOAD BUTTON */}
            <Button
              variant="outlined"
              size="small"
              onClick={handleDownload}
              sx={{ minWidth: "auto", p: 1 }}
            >
              <Download size={18} />
            </Button>
          </Box>
        </Box>

        {/* TABLE */}
        <TableContainer
          component={Paper}
          sx={{ background: theme.palette.background.paper }}
        >
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    background:
                      theme.palette.mode === "dark"
                        ? theme.palette.background.default
                        : "#f9fafb",
                    position: "sticky",
                    left: 0,
                    zIndex: 10,
                    textAlign: "center",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    lineHeight: 1.4,
                    fontFamily: "Roboto, sans-serif",
                  }}
                >
                  {activeTab === "Split by Category" ? "Category" : "SKU"}
                </TableCell>



                {platforms.map((p) => (
                  <TableCell
                    align="center"
                    key={p}
                    sx={{
                      background:
                        theme.palette.mode === "dark"
                          ? theme.palette.background.default
                          : "#f9fafb",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      fontFamily: "Roboto, sans-serif",
                    }}
                  >
                    <Typography fontWeight={700} fontSize="0.95rem" fontFamily="Roboto, sans-serif">
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>

              <TableRow>
                <TableCell
                  sx={{
                    background: "#f9fafb",
                    position: "sticky",
                    left: 0,
                    zIndex: 9,
                  }}
                ></TableCell>

                <TableCell
                  align="center"
                  colSpan={platforms.length}
                  sx={{
                    background:
                      theme.palette.mode === "dark"
                        ? theme.palette.background.default
                        : "#f9fafb",
                    color: theme.palette.text.primary,
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    fontFamily: "Roboto, sans-serif",
                  }}
                >
                  {selectedMetric.label.toLowerCase().charAt(0).toUpperCase() + selectedMetric.label.toLowerCase().slice(1)}
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedRows.map((cat, i) => (
                <TableRow key={i} hover>
                  <TableCell
                    sx={{
                      position: "sticky",
                      left: 0,
                      background: theme.palette.background.paper,
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      lineHeight: 1.4,
                      fontFamily: "Roboto, sans-serif",
                      textAlign: "center",
                    }}
                  >
                    <Typography fontWeight={700} fontSize="0.95rem" fontFamily="Roboto, sans-serif">{cat.name}</Typography>
                  </TableCell>
                  {platforms.map((p) => {
                    const main = cat[p][selectedMetric.key];
                    const change = cat[p][selectedMetric.key + "_change"];
                    return (
                      <TableCell key={p + i} align="center">
                        <Box
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                        >
                          <Typography
                            fontSize="0.95rem"
                            fontWeight={700}
                            fontFamily="Roboto, sans-serif"
                          >
                            <Typography fontWeight={700} fontSize="0.95rem" fontFamily="Roboto, sans-serif">
                              {main}
                            </Typography>
                          </Typography>
                          <Typography fontSize="0.75rem" fontWeight={400} fontFamily="Roboto, sans-serif">
                            {renderChange(change)}
                          </Typography>
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* PAGINATION */}
        <div className="mt-3 flex items-center justify-between text-[11px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-full border px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>

            <span>
              Page <b>{page + 1}</b> / {totalPages}
            </span>

            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div>
              Rows/page
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0); // Reset to first page when changing rows per page
                }}
                className="ml-1 rounded-full border px-2 py-1"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>
          </div>
        </div>
      </Card>
    </Box>
  );
}