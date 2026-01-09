import React, { useState, useRef } from "react";
import {
    Box,
    Typography,
    TextField,
    Checkbox,
    Divider,
    Popover,
    Paper,
} from "@mui/material";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CustomHeaderDropdown = ({
    label,
    options = [],
    value,
    onChange,
    width = 200,
}) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const open = Boolean(anchorEl);

    const getSelectedList = () => {
        if (!value || value === "All") return options;
        if (Array.isArray(value)) return value;
        return [value];
    };

    const currentSelected = getSelectedList();

    const filteredOptions = options.filter((opt) =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const emitChange = (newList) => {
        if (newList.length === options.length) {
            onChange("All"); // All options selected = "All"
        } else if (newList.length === 0) {
            onChange([]); // No options selected = empty array
        } else {
            onChange(newList.length === 1 ? newList[0] : newList);
        }
    };

    const handleToggleOption = (option) => {
        let newList;
        if (currentSelected.includes(option)) {
            newList = currentSelected.filter((item) => item !== option);
        } else {
            newList = [...currentSelected, option];
        }
        emitChange(newList);
    };

    const handleSelectAll = () => {
        // Toggle: if all are selected, deselect all; otherwise select all
        const allSelected = currentSelected.length === options.length && options.length > 0;
        if (allSelected) {
            onChange([]); // Deselect all - emit empty array
        } else {
            onChange("All"); // Select all - emit "All"
        }
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleTriggerClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const displayValue = !value
        ? (options.length > 0 ? "All" : "Select...")
        : Array.isArray(value)
            ? (value.length === 0 ? "None" : value.length === options.length ? "All" : value.join(", "))
            : value;

    return (
        <Box sx={{ width }}>
            <Typography
                sx={{
                    display: { xs: "none", sm: "block" },
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    mb: 0.5,
                    opacity: 0.7,
                    textTransform: "uppercase",
                }}
            >
                {label}
            </Typography>

            {/* Trigger Button */}
            <Box
                onClick={handleTriggerClick}
                sx={{
                    height: { xs: "32px", sm: "38px" },
                    bgcolor: "#F8FAFC",
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: open ? "#3B82F6" : "#E2E8F0",
                    display: "flex",
                    alignItems: "center",
                    px: { xs: 1.5, sm: 2 },
                    gap: 1,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    "&:hover": { borderColor: "#3B82F6" },
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", flex: 1, overflow: "hidden" }}>
                    <Typography
                        sx={{
                            fontSize: { xs: "0.75rem", sm: "0.85rem" },
                            fontWeight: 700,
                            color: "#0f172a",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {displayValue}
                    </Typography>
                </Box>
                {open ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
            </Box>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1,
                            borderRadius: "12px",
                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                            border: "1px solid #F1F5F9",
                            width: "280px",
                            overflow: 'visible',
                            p: 2,
                        }
                    }
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                    }}
                >
                    {/* Search */}
                    <TextField
                        size="small"
                        placeholder="Search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: <Search size={16} style={{ marginRight: 8, color: "#94A3B8" }} />,
                            sx: {
                                borderRadius: "8px",
                                bgcolor: "#F8FAFC",
                                "& fieldset": { borderColor: "#E2E8F0" },
                            },
                        }}
                        fullWidth
                    />

                    {/* Select All */}
                    <Box
                        onClick={handleSelectAll}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            cursor: "pointer",
                            "&:hover": { opacity: 0.8 },
                        }}
                    >
                        <Checkbox
                            size="small"
                            checked={currentSelected.length === options.length && options.length > 0}
                            indeterminate={currentSelected.length > 0 && currentSelected.length < options.length}
                            sx={{ p: 0.5 }}
                        />
                        <Typography sx={{ fontSize: "0.9rem", fontWeight: 700 }}>
                            Select All
                        </Typography>
                    </Box>

                    <Divider />

                    {/* Options List */}
                    <Box
                        sx={{
                            maxHeight: "200px",
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.5,
                            pr: 0.5,
                            "&::-webkit-scrollbar": { width: "6px" },
                            "&::-webkit-scrollbar-thumb": { bgcolor: "#CBD5E1", borderRadius: "3px" },
                        }}
                    >
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <Box
                                    key={option}
                                    onClick={() => handleToggleOption(option)}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        cursor: "pointer",
                                        py: 0.5,
                                        borderRadius: "4px",
                                        "&:hover": { bgcolor: "#F8FAFC" },
                                    }}
                                >
                                    <Checkbox
                                        size="small"
                                        checked={currentSelected.includes(option)}
                                        sx={{ p: 0.5 }}
                                    />
                                    <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
                                        {option}
                                    </Typography>
                                </Box>
                            ))
                        ) : (
                            <Typography sx={{ fontSize: "0.85rem", color: "#64748B", textAlign: "center", py: 2 }}>
                                No results found
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Popover>
        </Box>

    );
};

export default CustomHeaderDropdown;
