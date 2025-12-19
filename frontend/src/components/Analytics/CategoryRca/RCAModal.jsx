import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Box,
    Typography,
    Tooltip,
    Drawer,
} from "@mui/material";
import { X, Filter, RefreshCcw, Maximize2, Minimize2 } from "lucide-react";
import RCATree from "./RCATree";
import { ChevronDown, Info } from 'lucide-react';

/**
 * RCAModal
 * - Responsive fullscreen/large dialog
 * - Filter toggle button that shows/hides a filter drawer
 * - Integration with RCATree
 */

const SelectBox = ({ label, value, onChange, width = '100%' }) => (
    <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#374151', mb: 1, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {label}
        </Typography>
        <Box sx={{ position: 'relative', width }}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: '100%',
                    padding: '8px 32px 8px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#111827',
                    appearance: 'none',
                    cursor: 'pointer',
                    fontWeight: 500
                }}
            >
                <option>{value}</option>
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
        </Box>
    </Box>
);

export default function RCAModal({ open, onClose, title, initialData = {} }) {
    const [showFilters, setShowFilters] = useState(false);
    const [platform, setPlatform] = useState(initialData.platform || 'Blinkit');
    const [location, setLocation] = useState(initialData.location || 'All');
    const [category, setCategory] = useState(initialData.category || 'All');
    const [brand, setBrand] = useState(initialData.brand || 'All');

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDialog-paper': {
                    bgcolor: '#f9fafb',
                },
            }}
        >
            {/* Custom Header */}
            <DialogTitle
                sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #e5e7eb',
                    bgcolor: '#fff',
                    zIndex: 1201,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: 700,
                        }}
                    >
                        ∞
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.2rem', color: '#1e293b' }}>
                        Root Cause Analysis
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title="Toggle Filters">
                        <IconButton
                            onClick={() => setShowFilters(!showFilters)}
                            sx={{
                                bgcolor: showFilters ? '#eff6ff' : 'transparent',
                                color: showFilters ? '#2563eb' : '#64748b',
                                '&:hover': { bgcolor: '#eff6ff' },
                                border: '1px solid',
                                borderColor: showFilters ? '#bfdbfe' : '#e2e8f0',
                            }}
                        >
                            <Filter size={20} />
                        </IconButton>
                    </Tooltip>

                    <IconButton onClick={onClose} sx={{ color: '#64748b' }}>
                        <X size={24} />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 0, display: 'flex', overflow: 'hidden', height: '100%' }}>
                {/* Filter Drawer / Sidebar (Left side, inside content) */}
                {showFilters && (
                    <Box
                        sx={{
                            width: 300,
                            flexShrink: 0,
                            bgcolor: '#fff',
                            borderRight: '1px solid #e5e7eb',
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '4px 0 14px rgba(0,0,0,0.02)',
                            overflowY: 'auto',
                        }}
                    >
                        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#64748b', mb: 4, letterSpacing: '1px' }}>
                            CALIBRATION
                        </Typography>

                        <SelectBox label="Platform" value={platform} onChange={setPlatform} />
                        <SelectBox label="Location" value={location} onChange={setLocation} />
                        <SelectBox label="Category" value={category} onChange={setCategory} />
                        <SelectBox label="Brand" value={brand} onChange={setBrand} />

                        <Box sx={{
                            mt: 'auto',
                            p: 2,
                            bgcolor: '#fef3c7',
                            borderRadius: '12px',
                            border: '1px solid #fde68a'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Info size={14} color="#92400e" />
                                <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#92400e' }}>NOTE</Typography>
                            </Box>
                            <Typography sx={{ fontSize: '11px', color: '#92400e', lineHeight: 1.4 }}>
                                SOS metrics are calculated at the keyword level for the selected period.
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* RCA Tree Content */}
                <Box sx={{ flex: 1, position: 'relative', bgcolor: '#f8fafc' }}>
                    <RCATree title={title} />
                </Box>
            </DialogContent>
        </Dialog>
    );
}
