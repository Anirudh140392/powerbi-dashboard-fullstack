import { motion, AnimatePresence } from "framer-motion";
import {
  Box,
  FormControl,
  Select,
  MenuItem,
  Button,
  Typography,
  Paper,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  InputAdornment,
  Grid,
  Divider,
  Stack,
  useTheme,
} from "@mui/material";
import {
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  CloudDownload as CloudDownloadIcon,
  Email as EmailIcon,
  Delete as DeleteIcon,
  AddCircle as AddCircleIcon,
  Close as CloseIcon,
  FilterList as FilterListIcon,
  CalendarMonth as CalendarIcon,
  Place as PlaceIcon,
  Store as StoreIcon,
  Category as CategoryIcon,
  Assessment as AssessmentIcon,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";
import React from "react";
import PaginationFooter from "@/components/CommonLayout/PaginationFooter";

export const ScheduledReport = ({
  selectedFilters,
  handleFilterChange,
  handleDownload,
  isDownloading,
  showSuccess,
  setShowSuccess,
  platformOptions,
  getBrandOptions,
  getLocationOptions,
  timePeriodOptions,
  reportTypeOptions,
  customDateRange,
  setCustomDateRange,
  scheduledReports = [],
  onScheduleAdd,
  onScheduleDelete,
  scheduleSuccess,
  setScheduleSuccess,
}) => {
  // Modal state
  const [scheduleModalOpen, setScheduleModalOpen] = React.useState(false);

  // Form state
  const [scheduleForm, setScheduleForm] = React.useState({
    email: "",
    frequency: "Daily",
    time: dayjs().hour(9).minute(0), // Default 9:00 AM
  });

  const [emailError, setEmailError] = React.useState("");

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const theme = useTheme();

  const SuccessToast = ({ open, message, onClose, color = "success" }) => {
    return (
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={onClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{ zIndex: 2000 }}
      >
        <Alert
          severity={color}
          onClose={onClose}
          sx={{
            width: "100%",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            fontWeight: 500,
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    );
  };

  // Handle schedule save
  const handleScheduleSave = () => {
    if (!scheduleForm.email) {
      setEmailError("Email is required");
      return;
    }
    if (!validateEmail(scheduleForm.email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    onScheduleAdd({
      email: scheduleForm.email,
      frequency: scheduleForm.frequency,
      time: scheduleForm.time.format("hh:mm A"),
    });

    // Reset form and close modal
    setScheduleForm({
      email: "",
      frequency: "Daily",
      time: dayjs().hour(9).minute(0),
    });
    setEmailError("");
    setScheduleModalOpen(false);
  };

  // Pagination for Active Schedules
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(4);
  const pageSizeOptions = [4, 10, 20, 50];
  const totalPages = Math.max(
    1,
    Math.ceil((scheduledReports || []).length / pageSize)
  );

  const minPageOption = Math.min(...pageSizeOptions);
  const showPagination =
    (scheduledReports || []).length > minPageOption || totalPages > 1;

  React.useEffect(() => {
    const tp = Math.max(
      1,
      Math.ceil((scheduledReports || []).length / pageSize)
    );
    if (page > tp) setPage(tp);
  }, [scheduledReports, pageSize]);

  const paginatedSchedules = (scheduledReports || []).slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const FilterCard = ({ title, icon: Icon, color, children }) => (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: "12px",
        height: "100%",
        border: "1px solid #E2E8F0",
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          borderColor: color,
          boxShadow: `0 4px 12px ${color}15`,
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${color}15`,
            color: color,
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, color: "#475569" }}
        >
          {title}
        </Typography>
      </Box>
      {children}
    </Paper>
  );

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 140px)",
        background: "#F8FAFC", // Slate-50
        borderRadius: "16px",
        p: { xs: 2, md: 4 },
        fontFamily: "'Roboto', sans-serif",
      }}
    >
      {/* Header Section */}
      <Box sx={{ maxWidth: "1200px", mx: "auto", mb: 5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 3, mb: 4 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: "16px",
              background: "linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)",
              color: "white",
              boxShadow: "0 8px 16px rgba(79, 70, 229, 0.2)",
            }}
          >
            <CloudDownloadIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: "#1E293B",
                mb: 1,
              }}
            >
              Scheduled Reports
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748B" }}>
              Generate, download, and schedule automated reports for your
              business metrics.
            </Typography>
          </Box>
        </Box>

        {/* Filters Section */}
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 2,
              color: "#334155",
            }}
          >
            <FilterListIcon fontSize="small" />
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1.1rem" }}>
              Configuration
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <FilterCard
                title="Platform"
                icon={CategoryIcon}
                color="#4F46E5" // Indigo
              >
                <FormControl fullWidth size="small">
                  <Select
                    value={selectedFilters.platform}
                    onChange={(e) =>
                      handleFilterChange("platform", e.target.value)
                    }
                    displayEmpty
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 200,
                          borderRadius: "12px",
                        },
                      },
                    }}
                    sx={{
                      borderRadius: "8px",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#E2E8F0",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#4F46E5",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#4F46E5",
                      },
                    }}
                  >
                    {platformOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </FilterCard>
            </Grid>

            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <FilterCard
                title="Brand"
                icon={StoreIcon}
                color="#EC4899" // Pink
              >
                <FormControl fullWidth size="small">
                  <Select
                    value={selectedFilters.brand}
                    onChange={(e) =>
                      handleFilterChange("brand", e.target.value)
                    }
                    displayEmpty
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 200,
                          borderRadius: "12px",
                        },
                      },
                    }}
                    sx={{
                      borderRadius: "8px",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#E2E8F0",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#EC4899",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#EC4899",
                      },
                    }}
                  >
                    {getBrandOptions().map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </FilterCard>
            </Grid>

            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <FilterCard
                title="Location"
                icon={PlaceIcon}
                color="#10B981" // Emerald
              >
                <FormControl fullWidth size="small">
                  <Select
                    value={selectedFilters.location}
                    onChange={(e) =>
                      handleFilterChange("location", e.target.value)
                    }
                    displayEmpty
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 200,
                          borderRadius: "12px",
                        },
                      },
                    }}
                    sx={{
                      borderRadius: "8px",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#E2E8F0",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#10B981",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#10B981",
                      },
                    }}
                  >
                    {getLocationOptions().map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </FilterCard>
            </Grid>

            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <FilterCard
                title="Time Period"
                icon={CalendarIcon}
                color="#F59E0B" // Amber
              >
                {selectedFilters.timePeriod === "Custom Range" ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <DatePicker
                      label="Start"
                      value={customDateRange.startDate}
                      onChange={(newValue) =>
                        setCustomDateRange((prev) => ({
                          ...prev,
                          startDate: newValue,
                        }))
                      }
                      slotProps={{
                        textField: {
                          size: "small",
                          fullWidth: true,
                          sx: {
                            "& .MuiOutlinedInput-root": { borderRadius: "8px" },
                          },
                        },
                      }}
                    />
                    <DatePicker
                      label="End"
                      value={customDateRange.endDate}
                      onChange={(newValue) =>
                        setCustomDateRange((prev) => ({
                          ...prev,
                          endDate: newValue,
                        }))
                      }
                      minDate={customDateRange.startDate}
                      slotProps={{
                        textField: {
                          size: "small",
                          fullWidth: true,
                          sx: {
                            "& .MuiOutlinedInput-root": { borderRadius: "8px" },
                          },
                        },
                      }}
                    />
                    <Button
                      size="small"
                      onClick={() =>
                        handleFilterChange("timePeriod", "Last 30 Days")
                      }
                      sx={{
                        textTransform: "none",
                        color: "#F59E0B",
                        fontSize: "0.75rem",
                        justifyContent: "flex-start",
                        p: 0,
                      }}
                    >
                      ← Back
                    </Button>
                  </Box>
                ) : (
                  <FormControl fullWidth size="small">
                    <Select
                      value={selectedFilters.timePeriod}
                      onChange={(e) =>
                        handleFilterChange("timePeriod", e.target.value)
                      }
                      displayEmpty
                      sx={{
                        borderRadius: "8px",
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#E2E8F0",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#F59E0B",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#F59E0B",
                        },
                      }}
                    >
                      {timePeriodOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </FilterCard>
            </Grid>

            <Grid item xs={12} sm={6} md={4} lg={2.4}>
              <FilterCard
                title="Report Type"
                icon={AssessmentIcon}
                color="#8B5CF6" // Violet
              >
                <FormControl fullWidth size="small">
                  <Select
                    value={selectedFilters.reportType}
                    onChange={(e) =>
                      handleFilterChange("reportType", e.target.value)
                    }
                    displayEmpty
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 200,
                          borderRadius: "12px",
                        },
                      },
                    }}
                    sx={{
                      borderRadius: "8px",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#E2E8F0",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#8B5CF6",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#8B5CF6",
                      },
                    }}
                  >
                    {reportTypeOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </FilterCard>
            </Grid>
          </Grid>
        </Box>

        {/* Actions & Active Schedules Grid */}
        <Grid container spacing={4} sx={{ alignItems: "stretch" }}>
          {/* Actions Column */}
          <Grid item xs={12} md={4} sx={{ display: "flex", flexDirection: "column" }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                height: "100%",
              }}
            >
              {/* Download Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: "16px",
                  border: "1px solid #E2E8F0",
                  background: "white",
                  transition: "all 0.2s",
                  flex: 1, // Stretch to fill available space
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  "&:hover": {
                    boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  Export Data
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "#64748B", mb: 3, lineHeight: 1.6 }}
                >
                  Download the current report view as a PDF, Excel, or CSV file.
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleDownload}
                  disabled={isDownloading}
                  startIcon={
                    isDownloading ? null : <DownloadIcon />
                  }
                  sx={{
                    borderRadius: "10px",
                    py: 1.5,
                    textTransform: "none",
                    fontWeight: 600,
                    background: "#0F172A", // Slate-900
                    "&:hover": { background: "#1E293B" }, // Slate-800
                  }}
                >
                  {isDownloading ? "Generating Report..." : "Download Report"}
                </Button>
              </Paper>

              {/* Schedule Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: "16px",
                  border: "1px solid #E2E8F0",
                  background: "white",
                  position: "relative",
                  overflow: "hidden",
                  flex: 1, // Stretch to fill available space
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    p: 2,
                    opacity: 0.1,
                  }}
                >
                  <ScheduleIcon sx={{ fontSize: 80, color: "#4F46E5" }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  Schedule Delivery
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "#64748B",
                    mb: 3,
                    lineHeight: 1.6,
                    position: "relative",
                  }}
                >
                  Automate your reporting. Receive this report in your inbox
                  daily, weekly, or monthly.
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => setScheduleModalOpen(true)}
                  startIcon={<AddCircleIcon />}
                  sx={{
                    borderRadius: "10px",
                    py: 1.5,
                    textTransform: "none",
                    fontWeight: 600,
                    borderColor: "#4F46E5",
                    color: "#4F46E5",
                    "&:hover": {
                      borderColor: "#4338CA",
                      background: "#EEF2FF",
                    },
                  }}
                >
                  Create Schedule
                </Button>
              </Paper>
            </Box>
          </Grid>

          {/* Active Schedules Table Column */}
          <Grid item xs={12} md={8}>
            <Paper
              elevation={0}
              sx={{
                borderRadius: "16px",
                border: "1px solid #E2E8F0",
                overflow: "hidden",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box
                sx={{
                  p: 2.5,
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "white",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <ScheduleIcon sx={{ color: "#4F46E5" }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Active Schedules
                  </Typography>
                  <Chip
                    label={scheduledReports.length}
                    size="small"
                    sx={{
                      background: "#EEF2FF",
                      color: "#4F46E5",
                      fontWeight: 700,
                      borderRadius: "6px",
                    }}
                  />
                </Box>
              </Box>

              {scheduledReports.length > 0 ? (
                <>
                  <TableContainer sx={{ flex: 1 }}>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ background: "#F8FAFC" }}>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              color: "#64748B",
                              borderBottom: "1px solid #E2E8F0",
                              fontSize: "0.85rem",
                            }}
                          >
                            RECIPIENT
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              color: "#64748B",
                              borderBottom: "1px solid #E2E8F0",
                              fontSize: "0.85rem",
                            }}
                          >
                            FREQUENCY
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              color: "#64748B",
                              borderBottom: "1px solid #E2E8F0",
                              fontSize: "0.85rem",
                            }}
                          >
                            TIME
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              color: "#64748B",
                              borderBottom: "1px solid #E2E8F0",
                              fontSize: "0.85rem",
                            }}
                          >
                            CONFIG
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: 600,
                              color: "#64748B",
                              borderBottom: "1px solid #E2E8F0",
                              fontSize: "0.85rem",
                            }}
                          >
                            ACTIONS
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedSchedules.map((schedule) => (
                          <TableRow
                            key={schedule.id}
                            hover
                            sx={{
                              "&:hover": { background: "#F8FAFC" },
                            }}
                          >
                            <TableCell sx={{ borderBottom: "1px solid #F1F5F9" }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Box
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: "50%",
                                    background: "#EEF2FF",
                                    color: "#4F46E5",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  {schedule.email.charAt(0).toUpperCase()}
                                </Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {schedule.email}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ borderBottom: "1px solid #F1F5F9" }}>
                              <Chip
                                label={schedule.frequency}
                                size="small"
                                sx={{
                                  borderRadius: "6px",
                                  height: "24px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background:
                                    schedule.frequency === "Daily"
                                      ? "#DCFCE7"
                                      : schedule.frequency === "Weekly"
                                        ? "#DBEAFE"
                                        : "#F3E8FF",
                                  color:
                                    schedule.frequency === "Daily"
                                      ? "#166534"
                                      : schedule.frequency === "Weekly"
                                        ? "#1E40AF"
                                        : "#6B21A8",
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ borderBottom: "1px solid #F1F5F9" }}>
                              <Typography variant="body2" color="text.secondary">
                                {schedule.time}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ borderBottom: "1px solid #F1F5F9" }}>
                              <Stack direction="column" spacing={0.5}>
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                  {schedule.reportConfig.reportType}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {schedule.reportConfig.platform}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ borderBottom: "1px solid #F1F5F9" }}
                            >
                              <IconButton
                                size="small"
                                onClick={() => onScheduleDelete(schedule.id)}
                                sx={{
                                  color: "#EF4444",
                                  "&:hover": { background: "#FEE2E2" },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {showPagination && (
                    <Box sx={{ borderTop: "1px solid #E2E8F0", p: 1 }}>
                      <PaginationFooter
                        isVisible={true}
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={(p) =>
                          setPage(Math.min(Math.max(1, p), totalPages))
                        }
                        pageSize={pageSize}
                        onPageSizeChange={(s) => {
                          setPageSize(s);
                          setPage(1);
                        }}
                        pageSizeOptions={pageSizeOptions}
                        itemsLabel="Rows/page"
                      />
                    </Box>
                  )}
                </>
              ) : (
                <Box
                  component={motion.div}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 6,
                    color: "#94A3B8",
                    textAlign: "center",
                    position: "relative",
                  }}
                >
                  <Box
                    component={motion.div}
                    animate={{
                      y: [0, -10, 0],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    sx={{
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mb: 3,
                      position: "relative",
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        border: "1px dashed #C7D2FE",
                        animation: "spin 10s linear infinite",
                      }}
                    />
                    <style>
                      {`
                        @keyframes spin {
                          from { transform: rotate(0deg); }
                          to { transform: rotate(360deg); }
                        }
                      `}
                    </style>
                    <ScheduleIcon
                      sx={{
                        fontSize: 48,
                        color: "#6366F1",
                        filter: "drop-shadow(0 4px 6px rgba(99, 102, 241, 0.2))",
                      }}
                    />
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: "#1E293B",
                      mb: 1,
                    }}
                  >
                    No Active Schedules
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      maxWidth: "280px",
                      color: "#64748B",
                      lineHeight: 1.6,
                      mb: 3,
                    }}
                  >
                    You haven't set up any automated reports yet. Create a schedule to get started.
                  </Typography>
                  <Button
                    component={motion.button}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    variant="outlined"
                    onClick={() => setScheduleModalOpen(true)}
                    startIcon={<AddCircleIcon />}
                    sx={{
                      textTransform: "none",
                      borderRadius: "10px",
                      fontWeight: 600,
                      borderColor: "#6366F1",
                      color: "#6366F1",
                      borderWidth: "1.5px",
                      "&:hover": {
                        borderWidth: "1.5px",
                        background: "#EEF2FF",
                        borderColor: "#4F46E5",
                      },
                    }}
                  >
                    Create First Schedule
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Success Alert */}
        <SuccessToast
          open={showSuccess}
          onClose={() => setShowSuccess(false)}
          message="Report downloaded successfully!"
        />

        {/* Schedule Success Alert */}
        <SuccessToast
          open={scheduleSuccess}
          onClose={() => setScheduleSuccess(false)}
          message="Schedule created successfully!"
          color="info"
        />

        {/* Schedule Configuration Modal */}
        <Dialog
          open={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            },
          }}
        >
          <DialogTitle sx={{ p: 3, borderBottom: "1px solid #E2E8F0" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: "8px",
                    background: "#EEF2FF",
                    color: "#4F46E5",
                    display: "flex",
                  }}
                >
                  <ScheduleIcon />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  New Schedule
                </Typography>
              </Box>
              <IconButton onClick={() => setScheduleModalOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ p: 3, pt: 3 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: "#64748B", fontWeight: 600, mb: 0.5, display: "block" }}
                >
                  Recipient Email
                </Typography>
                <TextField
                  type="email"
                  fullWidth
                  value={scheduleForm.email}
                  onChange={(e) => {
                    setScheduleForm({ ...scheduleForm, email: e.target.value });
                    setEmailError("");
                  }}
                  error={Boolean(emailError)}
                  helperText={emailError}
                  placeholder="name@company.com"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: "#94A3B8" }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "8px",
                    },
                  }}
                />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748B", fontWeight: 600, mb: 0.5 }}
                    >
                      Frequency
                    </Typography>
                    <Select
                      value={scheduleForm.frequency}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          frequency: e.target.value,
                        })
                      }
                      MenuProps={{
                        PaperProps: {
                          style: {
                            maxHeight: 200,
                            borderRadius: "12px",
                          },
                        },
                      }}
                      sx={{ borderRadius: "8px" }}
                    >
                      <MenuItem value="Daily">Daily</MenuItem>
                      <MenuItem value="Weekly">Weekly (Mon)</MenuItem>
                      <MenuItem value="Monthly">Monthly (1st)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748B", fontWeight: 600, mb: 0.5 }}
                    >
                      Delivery Time
                    </Typography>
                    <TimePicker
                      value={scheduleForm.time}
                      onChange={(newTime) =>
                        setScheduleForm({ ...scheduleForm, time: newTime })
                      }
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          sx: { "& .MuiOutlinedInput-root": { borderRadius: "8px" } },
                        },
                      }}
                    />
                  </Box>
                </Grid>
              </Grid>

              {/* Summary */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  background: "#F8FAFC",
                  border: "1px dashed #CBD5E1",
                  borderRadius: "8px",
                }}
              >
                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <CheckCircleIcon
                    fontSize="small"
                    sx={{ color: "#4F46E5", mt: 0.3 }}
                  />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Summary
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#64748B", mt: 0.5 }}>
                      Send <strong>{selectedFilters.reportType}</strong> report to{" "}
                      <strong>
                        {scheduleForm.email || "..."}
                      </strong>{" "}
                      <strong>{scheduleForm.frequency.toLowerCase()}</strong> at{" "}
                      <strong>{scheduleForm.time.format("hh:mm A")}</strong>.
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 2, borderTop: "1px solid #E2E8F0" }}>
            <Button
              onClick={() => setScheduleModalOpen(false)}
              sx={{ color: "#64748B", fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleSave}
              variant="contained"
              disableElevation
              sx={{
                background: "#4F46E5",
                fontWeight: 600,
                px: 3,
                "&:hover": { background: "#4338CA" },
              }}
            >
              Confirm Schedule
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};
