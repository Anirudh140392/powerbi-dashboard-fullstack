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
} from "@mui/material";
import {
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  CloudDownload as CloudDownloadIcon,
  TrendingUp as TrendingUpIcon,
  Email as EmailIcon,
  Delete as DeleteIcon,
  AddCircle as AddCircleIcon,
  Close as CloseIcon,
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

  const SuccessToast = ({ open, message, onClose, color = "success" }) => {
    return (
      <AnimatePresence>
        {open && (
          <Snackbar
            open={open}
            autoHideDuration={4000}
            onClose={onClose}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            sx={{ zIndex: 2000 }}
          >
            <motion.div
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <Alert
                severity={color}
                icon={<CheckCircleIcon />}
                action={
                  <IconButton size="small" onClick={onClose}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                }
                sx={{
                  minWidth: 360,
                  borderRadius: "14px",
                  fontWeight: 600,
                  boxShadow:
                    color === "success"
                      ? "0 12px 30px rgba(34,197,94,0.35)"
                      : "0 12px 30px rgba(139,92,246,0.35)",
                }}
              >
                {message}
              </Alert>
            </motion.div>
          </Snackbar>
        )}
      </AnimatePresence>
    );
  };

  // Handle schedule save
  const handleScheduleSave = () => {
    console.log('scheduleForm:');
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

  // Pagination for Active Schedules (uses project PaginationFooter)
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(5);
  const pageSizeOptions = [5, 10, 20, 50];
  const totalPages = Math.max(
    1,
    Math.ceil((scheduledReports || []).length / pageSize)
  );

  // Keep footer visible when dataset is larger than smallest page-size option
  // so the user can change Rows/page even if current pageSize collapses pages to 1.
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
  return (
    <>
      <style>
        {`
          @keyframes gradient-shift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }

          @keyframes pulse-glow {
            0%, 100% { 
              box-shadow: 0 0 20px rgba(59, 130, 246, 0.3),
                          0 0 40px rgba(59, 130, 246, 0.2),
                          0 0 60px rgba(59, 130, 246, 0.1);
            }
            50% { 
              box-shadow: 0 0 30px rgba(59, 130, 246, 0.5),
                          0 0 60px rgba(59, 130, 246, 0.3),
                          0 0 80px rgba(59, 130, 246, 0.2);
            }
          }

          @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }

          .gradient-border {
            position: relative;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            background-size: 200% 200%;
            animation: gradient-shift 3s ease infinite;
            padding: 2px;
            border-radius: 16px;
          }

          .dropdown-container {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .dropdown-container:hover {
            transform: translateY(-4px);
          }

          .download-button-glow {
            animation: pulse-glow 2s ease-in-out infinite;
          }

          .shimmer-effect {
            background: linear-gradient(
              90deg,
              transparent 0%,
              rgba(255, 255, 255, 0.3) 50%,
              transparent 100%
            );
            background-size: 1000px 100%;
            animation: shimmer 2s infinite;
          }
        `}
      </style>

      <Box
        sx={{
          minHeight: "calc(100vh - 200px)",
          background: "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)",
          borderRadius: "20px",
          p: 4,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Animated Background Elements */}
        <Box
          sx={{
            position: "absolute",
            top: "-50%",
            right: "-10%",
            width: "500px",
            height: "500px",
            background:
              "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
            borderRadius: "50%",
            animation: "float 6s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: "-30%",
            left: "-5%",
            width: "400px",
            height: "400px",
            background:
              "radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)",
            borderRadius: "50%",
            animation: "float 8s ease-in-out infinite",
            animationDelay: "1s",
            pointerEvents: "none",
          }}
        />

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Box
            sx={{ textAlign: "center", mb: 5, position: "relative", zIndex: 1 }}
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                mb: 2,
              }}
            >
              <Box
                sx={{
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  padding: "12px",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "float 3s ease-in-out infinite",
                }}
              >
                <CloudDownloadIcon sx={{ fontSize: 32, color: "#fff" }} />
              </Box>
            </Box>
            {/* <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 1,
              }}
            >
              Download Custom Reports
            </Typography> */}
            <Typography variant="h4" fontWeight={600}>
              Download Custom Reports
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: "rgba(0,0,0,0.6)", maxWidth: "600px", mx: "auto" }}
            >
              Select your preferred filters and generate comprehensive reports
              instantly
            </Typography>
          </Box>
        </motion.div>

        {/* Success Alert */}
        <AnimatePresence>
          <SuccessToast
            open={showSuccess}
            onClose={() => setShowSuccess(false)}
            message="Report downloaded successfully! Check your downloads folder."
          />
        </AnimatePresence>

        {/* Dropdown Filters Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "1fr 1fr 1fr",
              lg: "1fr 1fr 1fr 1fr 1fr",
            },
            gap: 3,
            mb: 4,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Platform Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="dropdown-container"
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                border: "2px solid rgba(102, 126, 234, 0.2)",
                transition: "all 0.3s ease",
                "&:hover": {
                  border: "2px solid rgba(102, 126, 234, 0.5)",
                  boxShadow: "0 8px 30px rgba(102, 126, 234, 0.15)",
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "#667eea",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  mb: 1,
                  display: "block",
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Platform
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={selectedFilters.platform}
                  onChange={(e) =>
                    handleFilterChange("platform", e.target.value)
                  }
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 48 * 5 + 8,
                        borderRadius: "12px",
                      },
                    },
                  }}
                  sx={{
                    "& .MuiOutlinedInput-notchedOutline": {
                      border: "none",
                    },
                    "& .MuiSelect-select": {
                      fontWeight: 600,
                      color: "#1e293b",
                      fontSize: "0.95rem",
                      padding: "8px 0",
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
            </Paper>
          </motion.div>

          {/* Brand Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="dropdown-container"
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                border: "2px solid rgba(236, 72, 153, 0.2)",
                transition: "all 0.3s ease",
                "&:hover": {
                  border: "2px solid rgba(236, 72, 153, 0.5)",
                  boxShadow: "0 8px 30px rgba(236, 72, 153, 0.15)",
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "#ec4899",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  mb: 1,
                  display: "block",
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Brand
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={selectedFilters.brand}
                  onChange={(e) => handleFilterChange("brand", e.target.value)}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 48 * 5 + 8,
                        borderRadius: "12px",
                      },
                    },
                  }}
                  sx={{
                    "& .MuiOutlinedInput-notchedOutline": {
                      border: "none",
                    },
                    "& .MuiSelect-select": {
                      fontWeight: 600,
                      color: "#1e293b",
                      fontSize: "0.95rem",
                      padding: "8px 0",
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
            </Paper>
          </motion.div>

          {/* Location Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="dropdown-container"
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                border: "2px solid rgba(34, 197, 94, 0.2)",
                transition: "all 0.3s ease",
                "&:hover": {
                  border: "2px solid rgba(34, 197, 94, 0.5)",
                  boxShadow: "0 8px 30px rgba(34, 197, 94, 0.15)",
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "#22c55e",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  mb: 1,
                  display: "block",
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Location
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={selectedFilters.location}
                  onChange={(e) =>
                    handleFilterChange("location", e.target.value)
                  }
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 48 * 5 + 8,
                        borderRadius: "12px",
                      },
                    },
                  }}
                  sx={{
                    "& .MuiOutlinedInput-notchedOutline": {
                      border: "none",
                    },
                    "& .MuiSelect-select": {
                      fontWeight: 600,
                      color: "#1e293b",
                      fontSize: "0.95rem",
                      padding: "8px 0",
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
            </Paper>
          </motion.div>

          {/* Time Period Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="dropdown-container"
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                border: "2px solid rgba(249, 115, 22, 0.2)",
                transition: "all 0.3s ease",
                "&:hover": {
                  border: "2px solid rgba(249, 115, 22, 0.5)",
                  boxShadow: "0 8px 30px rgba(249, 115, 22, 0.15)",
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "#f97316",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  mb: 1,
                  display: "block",
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Time Period
              </Typography>

              {selectedFilters.timePeriod === "Custom Range" ? (
                // Show Date Pickers when Custom Range is selected
                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                >
                  <DatePicker
                    label="Start Date"
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
                        sx: {
                          "& .MuiOutlinedInput-root": {
                            fontSize: "0.85rem",
                            "& fieldset": {
                              borderColor: "rgba(249, 115, 22, 0.3)",
                            },
                            "&:hover fieldset": {
                              borderColor: "rgba(249, 115, 22, 0.5)",
                            },
                            "&.Mui-focused fieldset": {
                              borderColor: "#f97316",
                            },
                          },
                          "& .MuiInputLabel-root": {
                            fontSize: "0.85rem",
                          },
                        },
                      },
                    }}
                  />
                  <DatePicker
                    label="End Date"
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
                        sx: {
                          "& .MuiOutlinedInput-root": {
                            fontSize: "0.85rem",
                            "& fieldset": {
                              borderColor: "rgba(249, 115, 22, 0.3)",
                            },
                            "&:hover fieldset": {
                              borderColor: "rgba(249, 115, 22, 0.5)",
                            },
                            "&.Mui-focused fieldset": {
                              borderColor: "#f97316",
                            },
                          },
                          "& .MuiInputLabel-root": {
                            fontSize: "0.85rem",
                          },
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
                      color: "#f97316",
                      fontSize: "0.75rem",
                      "&:hover": {
                        background: "rgba(249, 115, 22, 0.1)",
                      },
                    }}
                  >
                    ← Back to presets
                  </Button>
                </Box>
              ) : (
                // Show regular dropdown for preset periods
                <FormControl fullWidth>
                  <Select
                    value={selectedFilters.timePeriod}
                    onChange={(e) =>
                      handleFilterChange("timePeriod", e.target.value)
                    }
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 48 * 5 + 8,
                          borderRadius: "12px",
                        },
                      },
                    }}
                    sx={{
                      "& .MuiOutlinedInput-notchedOutline": {
                        border: "none",
                      },
                      "& .MuiSelect-select": {
                        fontWeight: 600,
                        color: "#1e293b",
                        fontSize: "0.95rem",
                        padding: "8px 0",
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
            </Paper>
          </motion.div>

          {/* Report Type Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="dropdown-container"
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: "16px",
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(10px)",
                border: "2px solid rgba(168, 85, 247, 0.2)",
                transition: "all 0.3s ease",
                "&:hover": {
                  border: "2px solid rgba(168, 85, 247, 0.5)",
                  boxShadow: "0 8px 30px rgba(168, 85, 247, 0.15)",
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "#a855f7",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  mb: 1,
                  display: "block",
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                }}
              >
                Report Type
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={selectedFilters.reportType}
                  onChange={(e) =>
                    handleFilterChange("reportType", e.target.value)
                  }
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 48 * 5 + 8,
                        borderRadius: "12px",
                      },
                    },
                  }}
                  sx={{
                    "& .MuiOutlinedInput-notchedOutline": {
                      border: "none",
                    },
                    "& .MuiSelect-select": {
                      fontWeight: 600,
                      color: "#1e293b",
                      fontSize: "0.95rem",
                      padding: "8px 0",
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
            </Paper>
          </motion.div>
        </Box>

        {/* Info Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <Box
            sx={{
              mt: 6,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
              },
              gap: 3,
              maxWidth: "900px",
              mx: "auto",
              position: "relative",
              zIndex: 1,
            }}
          >
            <Paper
              elevation={0}
              onClick={handleDownload}
              sx={{
                p: 3,
                borderRadius: "16px",
                background: "white",
                backdropFilter: "blur(10px)",
                border: "2px solid rgba(16, 185, 129, 0.35)",
                transition: "all 0.3s ease",
                cursor: isDownloading ? "not-allowed" : "pointer",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 30px rgba(16, 185, 129, 0.35)",
                  border: "2px solid rgba(16, 185, 129, 0.6)",
                },
              }}
              className={!isDownloading ? "download-button-glow" : ""}
            >
              {/* Header */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  mb: 1.5,
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: "12px",
                    background:
                      "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
                    display: "flex",
                  }}
                >
                  {isDownloading ? (
                    <ScheduleIcon
                      sx={{
                        color: "#fff",
                        fontSize: 24,
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  ) : (
                    <DownloadIcon sx={{ color: "#fff", fontSize: 24 }} />
                  )}
                </Box>

                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#064e3b" }}
                >
                  Download Report
                </Typography>
              </Box>

              {/* Description */}
              <Typography
                variant="body2"
                sx={{ color: "rgba(0,0,0,0.65)", mb: 2 }}
              >
                Export this report in PDF, Excel, or CSV format for offline use
                and sharing.
              </Typography>

              {/* CTA */}
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                fullWidth
                disabled={isDownloading}
                sx={{
                  borderColor: "#10b981",
                  color: "#10b981",
                  fontWeight: 600,
                  "&:hover": {
                    borderColor: "#059669",
                    background: "rgba(16, 185, 129, 0.12)",
                  },
                }}
              >
                {isDownloading ? "Preparing Download..." : "Download Now"}
              </Button>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: "16px",
                background: "white",
                backdropFilter: "blur(10px)",
                border: "2px solid rgba(168, 85, 247, 0.3)",
                transition: "all 0.3s ease",
                cursor: "pointer",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 30px rgba(168, 85, 247, 0.3)",
                  border: "2px solid rgba(168, 85, 247, 0.6)",
                },
              }}
              onClick={() => setScheduleModalOpen(true)}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  mb: 1.5,
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: "12px",
                    background:
                      "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
                    display: "flex",
                  }}
                >
                  <ScheduleIcon sx={{ color: "#fff", fontSize: 24 }} />
                </Box>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#1e293b" }}
                >
                  Scheduled Delivery
                </Typography>
                <AddCircleIcon sx={{ color: "#8b5cf6", ml: "auto" }} />
              </Box>
              <Typography
                variant="body2"
                sx={{ color: "rgba(0,0,0,0.6)", mb: 2 }}
              >
                Set up automatic reports delivered to your inbox
              </Typography>
              <Button
                variant="outlined"
                startIcon={<EmailIcon />}
                fullWidth
                sx={{
                  borderColor: "#8b5cf6",
                  color: "#8b5cf6",
                  fontWeight: 600,
                  "&:hover": {
                    borderColor: "#7c3aed",
                    background: "rgba(139, 92, 246, 0.1)",
                  },
                }}
              >
                Set Up Schedule
              </Button>
            </Paper>
          </Box>
        </motion.div>

        {/* Schedule Success Alert */}
        <AnimatePresence>
          <SuccessToast
            open={scheduleSuccess}
            onClose={() => setScheduleSuccess(false)}
            message="Schedule created successfully! Reports will be delivered automatically."
            color="info"
          />
        </AnimatePresence>

        {/* Active Schedules Section */}
        {scheduledReports.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Box sx={{ mt: 6, position: "relative", zIndex: 1 }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: "#1e293b",
                  mb: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <ScheduleIcon sx={{ color: "#8b5cf6" }} />
                Active Schedules ({scheduledReports.length})
              </Typography>
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  borderRadius: "16px",
                  border: "1px solid rgba(0,0,0,0.1)",
                }}
              >
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: "rgba(139, 92, 246, 0.05)" }}>
                      <TableCell sx={{ fontWeight: 700, color: "#8b5cf6" }}>
                        Email
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "#8b5cf6" }}>
                        Frequency
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "#8b5cf6" }}>
                        Time
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "#8b5cf6" }}>
                        Report Type
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "#8b5cf6" }}>
                        Platform
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, color: "#8b5cf6" }}
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedSchedules.map((schedule) => (
                      <TableRow
                        key={schedule.id}
                        sx={{
                          "&:hover": {
                            background: "rgba(139, 92, 246, 0.02)",
                          },
                        }}
                      >
                        <TableCell>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <EmailIcon
                              sx={{ color: "#8b5cf6", fontSize: 18 }}
                            />
                            {schedule.email}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={schedule.frequency}
                            size="small"
                            sx={{
                              background:
                                "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
                              color: "#fff",
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell>{schedule.time}</TableCell>
                        <TableCell>
                          {schedule.reportConfig.reportType}
                        </TableCell>
                        <TableCell>{schedule.reportConfig.platform}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => onScheduleDelete(schedule.id)}
                            sx={{
                              color: "#ef4444",
                              "&:hover": {
                                background: "rgba(239, 68, 68, 0.1)",
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {showPagination && (
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
                )}
              </TableContainer>
            </Box>
          </motion.div>
        )}

        {/* Schedule Configuration Modal */}
        <Dialog
          open={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: "20px",
              p: 1,
            },
          }}
        >
          <DialogTitle>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: "12px",
                    background:
                      "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
                    display: "flex",
                  }}
                >
                  <ScheduleIcon sx={{ color: "#fff" }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Schedule Report Delivery
                </Typography>
              </Box>
              <IconButton
                onClick={() => setScheduleModalOpen(false)}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Email Input */}
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                value={scheduleForm.email}
                onChange={(e) => {
                  setScheduleForm({ ...scheduleForm, email: e.target.value });
                  setEmailError("");
                }}
                error={Boolean(emailError)}
                helperText={emailError}
                placeholder="your.email@example.com"
                InputLabelProps={{
                  shrink: true,
                }}
                InputProps={{
                  startAdornment: (
                    <EmailIcon sx={{ color: "#8b5cf6", fontSize: 20 }} />
                  ),
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    "& fieldset": {
                      borderColor: "rgba(139,92,246,0.4)",
                    },
                    "&:hover fieldset": {
                      borderColor: "#8b5cf6",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#8b5cf6",
                    },
                  },

                  "& .MuiInputLabel-root": {
                    transform: "translate(14px, -4px) scale(0.85)",
                    background: "#fff",
                    padding: "0 8px",
                  },

                  "& .MuiInputLabel-root.Mui-focused": {
                    color: "#8b5cf6",
                  },
                }}
              />

              {/* Frequency Selector */}
              <FormControl fullWidth>
                <Typography
                  variant="caption"
                  sx={{
                    color: "#64748b",
                    fontWeight: 600,
                    mb: 1,
                    display: "block",
                  }}
                >
                  Delivery Frequency
                </Typography>
                <Select
                  value={scheduleForm.frequency}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      frequency: e.target.value,
                    })
                  }
                  sx={{
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#8b5cf6",
                    },
                  }}
                >
                  <MenuItem value="Daily">Daily</MenuItem>
                  <MenuItem value="Weekly">Weekly (Monday)</MenuItem>
                  <MenuItem value="Monthly">Monthly (1st of month)</MenuItem>
                </Select>
              </FormControl>

              {/* Time Picker */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: "#64748b",
                    fontWeight: 600,
                    mb: 1,
                    display: "block",
                  }}
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
                      sx: {
                        "& .MuiOutlinedInput-root": {
                          "&.Mui-focused fieldset": {
                            borderColor: "#8b5cf6",
                          },
                        },
                      },
                    },
                  }}
                />
              </Box>

              {/* Preview Box */}
              <Paper
                sx={{
                  p: 2,
                  background:
                    "linear-gradient(135deg, #a78bfa10 0%, #8b5cf610 100%)",
                  border: "1px solid rgba(139, 92, 246, 0.2)",
                  borderRadius: "12px",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: "#64748b", fontWeight: 600 }}
                >
                  PREVIEW
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: "#1e293b" }}>
                  📧{" "}
                  <strong>
                    {scheduleForm.email || "your.email@example.com"}
                  </strong>{" "}
                  will receive <strong>{selectedFilters.reportType}</strong>{" "}
                  reports{" "}
                  <strong>{scheduleForm.frequency.toLowerCase()}</strong> at{" "}
                  <strong>{scheduleForm.time.format("hh:mm A")}</strong>
                </Typography>
              </Paper>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2 }}>
            <Button
              onClick={() => setScheduleModalOpen(false)}
              sx={{ color: "#64748b" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleSave}
              variant="contained"
              startIcon={<CheckCircleIcon />}
              sx={{
                background: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
                color: "#fff",
                fontWeight: 600,
                px: 3,
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                },
              }}
            >
              Save Schedule
            </Button>
          </DialogActions>
        </Dialog>

        {/* Spin animation for loading icon */}
        <style>
          {`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </Box>
    </>
  );
};
