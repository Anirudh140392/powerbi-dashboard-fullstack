import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from "@mui/material";
import DateRangeComparePicker from "./CommonLayout/DateRangeComparePicker";

export default function DashboardHeadersFilters({
  filters,
  setFilters,
  platforms = [],
  categories = [],
  brands = [],
  locations = [],
  msls = [],
  premiums = [],
}) {
  const handleChange = (key) => (e) =>
    setFilters((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(4, 1fr) 3fr",
        },
        gap: 2,
        width: "100%",
      }}
    >
      {/* PLATFORM */}
      <FormControl fullWidth size="small">
        <InputLabel>PLATFORM :</InputLabel>
        <Select
          value={filters.platform}
          onChange={handleChange("platform")}
          sx={{ borderRadius: 3, bgcolor: "white" }}
        >
          <MenuItem value="All">All</MenuItem>
          {platforms.map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* CATEGORY */}
      <FormControl fullWidth size="small">
        <InputLabel>CATEGORY :</InputLabel>
        <Select
          value={filters.category}
          onChange={handleChange("category")}
          sx={{ borderRadius: 3, bgcolor: "white" }}
        >
          <MenuItem value="All">All</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* BRAND */}
      <FormControl fullWidth size="small">
        <InputLabel>BRAND :</InputLabel>
        <Select
          value={filters.brand}
          onChange={handleChange("brand")}
          sx={{ borderRadius: 3, bgcolor: "white" }}
        >
          <MenuItem value="All">All</MenuItem>
          {brands.map((b) => (
            <MenuItem key={b} value={b}>
              {b}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* LOCATION */}
      <FormControl fullWidth size="small">
        <InputLabel>LOCATION :</InputLabel>
        <Select
          value={filters.location}
          onChange={handleChange("location")}
          sx={{ borderRadius: 3, bgcolor: "white" }}
        >
          <MenuItem value="All">All</MenuItem>
          {locations.map((l) => (
            <MenuItem key={l} value={l}>
              {l}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* MSL */}
      <FormControl fullWidth size="small">
        <InputLabel>MSL :</InputLabel>
        <Select
          value={filters.msl}
          onChange={handleChange("msl")}
          sx={{ borderRadius: 3, bgcolor: "white" }}
        >
          <MenuItem value="All">All</MenuItem>
          {msls.map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* PREMIUM */}
      <FormControl fullWidth size="small">
        <InputLabel>PREMIUM :</InputLabel>
        <Select
          value={filters.premium}
          onChange={handleChange("premium")}
          sx={{ borderRadius: 3, bgcolor: "white" }}
        >
          <MenuItem value="All">All</MenuItem>
          {premiums.map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* DATE RANGE & COMPARE PICKER */}
      <Box sx={{ gridColumn: { md: "span 1" } }}>
        <DateRangeComparePicker
          dateRange={{
            startDate: filters.startDate || "",
            endDate: filters.endDate || "",
          }}
          onDateRangeChange={(range) => {
            setFilters((prev) => ({
              ...prev,
              startDate: range.startDate,
              endDate: range.endDate,
            }));
          }}
          comparison={filters.comparison || "period"}
          onComparisonChange={(val) => {
            setFilters((prev) => ({ ...prev, comparison: val }));
          }}
          compareDateRange={{
            startDate: filters.compareStartDate || "",
            endDate: filters.compareEndDate || "",
          }}
          onCompareDateRangeChange={(range) => {
            setFilters((prev) => ({
              ...prev,
              compareStartDate: range.startDate,
              compareEndDate: range.endDate,
            }));
          }}
        />
      </Box>
    </Box>
  );
}
