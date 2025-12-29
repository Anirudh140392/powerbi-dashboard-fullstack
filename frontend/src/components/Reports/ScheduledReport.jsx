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
} from "@mui/material";
import {
    Download as DownloadIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
    CloudDownload as CloudDownloadIcon,
    TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

export const ScheduledReport = ({
    selectedFilters,
    handleFilterChange,
    handleDownload,
    isDownloading,
    showSuccess,
    platformOptions,
    getBrandOptions,
    getLocationOptions,
    timePeriodOptions,
    reportTypeOptions,
    customDateRange,
    setCustomDateRange,
}) => {
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
                    <Box sx={{ textAlign: "center", mb: 5, position: "relative", zIndex: 1 }}>
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
                                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
                        <Typography
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
                    {showSuccess && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Alert
                                icon={<CheckCircleIcon fontSize="inherit" />}
                                severity="success"
                                sx={{
                                    mb: 3,
                                    borderRadius: "12px",
                                    boxShadow: "0 4px 20px rgba(76, 175, 80, 0.3)",
                                }}
                            >
                                Report downloaded successfully! Check your downloads folder.
                            </Alert>
                        </motion.div>
                    )}
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
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
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
                                        onClick={() => handleFilterChange("timePeriod", "Last 30 Days")}
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

                {/* Download Button */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                >
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 4, position: "relative", zIndex: 1 }}>
                        <Button
                            variant="contained"
                            size="large"
                            disabled={isDownloading}
                            onClick={handleDownload}
                            className={!isDownloading ? "download-button-glow" : ""}
                            sx={{
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                color: "#fff",
                                fontSize: "1.1rem",
                                fontWeight: 700,
                                padding: "16px 48px",
                                borderRadius: "16px",
                                textTransform: "none",
                                boxShadow: "0 10px 40px rgba(102, 126, 234, 0.4)",
                                transition: "all 0.3s ease",
                                position: "relative",
                                overflow: "hidden",
                                "&:hover": {
                                    background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                                    transform: "translateY(-2px)",
                                    boxShadow: "0 15px 50px rgba(102, 126, 234, 0.5)",
                                },
                                "&:active": {
                                    transform: "translateY(0px)",
                                },
                                "&:disabled": {
                                    background: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
                                    color: "#fff",
                                },
                                "&::before": isDownloading
                                    ? {
                                        content: '""',
                                        position: "absolute",
                                        top: 0,
                                        left: "-100%",
                                        width: "100%",
                                        height: "100%",
                                        background:
                                            "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                                        animation: "shimmer 1.5s infinite",
                                    }
                                    : {},
                            }}
                            startIcon={
                                isDownloading ? (
                                    <ScheduleIcon sx={{ animation: "spin 1s linear infinite" }} />
                                ) : (
                                    <DownloadIcon />
                                )
                            }
                        >
                            {isDownloading ? "Generating Report..." : "Download Report"}
                        </Button>
                    </Box>
                </motion.div>

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
                            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                            gap: 3,
                            position: "relative",
                            zIndex: 1,
                        }}
                    >
                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                borderRadius: "16px",
                                background: "rgba(255, 255, 255, 0.7)",
                                backdropFilter: "blur(10px)",
                                border: "1px solid rgba(0,0,0,0.05)",
                                transition: "all 0.3s ease",
                                "&:hover": {
                                    transform: "translateY(-4px)",
                                    boxShadow: "0 12px 30px rgba(0,0,0,0.1)",
                                },
                            }}
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
                                        background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
                                        display: "flex",
                                    }}
                                >
                                    <TrendingUpIcon sx={{ color: "#fff", fontSize: 24 }} />
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: "#1e293b" }}>
                                    Fast Processing
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
                                Reports are generated in seconds using optimized algorithms
                            </Typography>
                        </Paper>

                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                borderRadius: "16px",
                                background: "rgba(255, 255, 255, 0.7)",
                                backdropFilter: "blur(10px)",
                                border: "1px solid rgba(0,0,0,0.05)",
                                transition: "all 0.3s ease",
                                "&:hover": {
                                    transform: "translateY(-4px)",
                                    boxShadow: "0 12px 30px rgba(0,0,0,0.1)",
                                },
                            }}
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
                                        background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
                                        display: "flex",
                                    }}
                                >
                                    <CheckCircleIcon sx={{ color: "#fff", fontSize: 24 }} />
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: "#1e293b" }}>
                                    Multiple Formats
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
                                Download in PDF, Excel, or CSV format for easy sharing
                            </Typography>
                        </Paper>

                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                borderRadius: "16px",
                                background: "rgba(255, 255, 255, 0.7)",
                                backdropFilter: "blur(10px)",
                                border: "1px solid rgba(0,0,0,0.05)",
                                transition: "all 0.3s ease",
                                "&:hover": {
                                    transform: "translateY(-4px)",
                                    boxShadow: "0 12px 30px rgba(0,0,0,0.1)",
                                },
                            }}
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
                                        background: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
                                        display: "flex",
                                    }}
                                >
                                    <ScheduleIcon sx={{ color: "#fff", fontSize: 24 }} />
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: "#1e293b" }}>
                                    Scheduled Delivery
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)" }}>
                                Set up automatic reports delivered to your inbox daily
                            </Typography>
                        </Paper>
                    </Box>
                </motion.div>

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