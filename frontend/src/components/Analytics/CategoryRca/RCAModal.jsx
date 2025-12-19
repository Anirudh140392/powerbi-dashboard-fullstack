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
import { X, Filter, RefreshCcw, Maximize2, Minimize2, ChevronDown, Info, Activity } from "lucide-react";
import RCATree from "./RCATree";

/**
 * RCAModal
 * - Responsive fullscreen/large dialog
 * - Filter toggle button that shows/hides a filter drawer
 * - Integration with RCATree
 */

const SelectBox = ({ label, value, onChange, width = '100%' }) => (
    <Box sx={{ mb: 4.5 }}>
        <Typography sx={{ fontSize: '10px', fontWeight: 900, color: '#64748b', mb: 1.5, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            {label}
        </Typography>
        <Box sx={{ position: 'relative', width }}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: '100%',
                    padding: '12px 36px 12px 16px',
                    fontSize: '14px',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    color: '#0f172a',
                    appearance: 'none',
                    cursor: 'pointer',
                    fontWeight: 800,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(10px)',
                }}
                onFocus={(e) => {
                    e.target.style.borderColor = '#6366f1';
                    e.target.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.1)';
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(0, 0, 0, 0.08)';
                    e.target.style.boxShadow = 'none';
                }}
            >
                <option>{value}</option>
            </select>
            <ChevronDown size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
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
                    bgcolor: '#09090b',
                    cursor: 'none', // Critical for custom magic cursor compatibility
                },
            }}
        >
            {/* Custom Header */}
            <DialogTitle
                sx={{
                    p: 3,
                    px: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    bgcolor: 'rgba(9, 9, 11, 0.9)',
                    backdropFilter: 'blur(24px) saturate(160%)',
                    zIndex: 1201,
                    color: '#fff'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)',
                        }}
                    >
                        <Activity size={24} strokeWidth={3} />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontSize: '1.4rem', color: '#fff', letterSpacing: '-1px' }}>
                            Diagnostic Studio
                        </Typography>
                        <Typography sx={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Pro Intelligence Pipeline v2.0
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Tooltip title="Calibrate Search Context">
                        <IconButton
                            onClick={() => setShowFilters(!showFilters)}
                            sx={{
                                bgcolor: showFilters ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                                color: showFilters ? '#6366f1' : '#64748b',
                                '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.15)' },
                                border: '1px solid',
                                borderColor: showFilters ? 'rgba(99, 102, 241, 0.2)' : 'rgba(0, 0, 0, 0.05)',
                                width: 44,
                                height: 44,
                                borderRadius: '14px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                            }}
                        >
                            <Filter size={20} strokeWidth={showFilters ? 2.5 : 2} />
                        </IconButton>
                    </Tooltip>

                    <IconButton
                        onClick={onClose}
                        sx={{
                            color: '#64748b',
                            width: 44,
                            height: 44,
                            borderRadius: '14px',
                            bgcolor: 'rgba(239, 68, 68, 0.05)',
                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }
                        }}
                    >
                        <X size={24} />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 0, display: 'flex', overflow: 'hidden', height: '100%', bgcolor: '#09090b' }}>
                {/* Filter Drawer / Sidebar (Left side) */}
                {showFilters && (
                    <Box
                        sx={{
                            width: 340,
                            flexShrink: 0,
                            bgcolor: 'rgba(15, 15, 15, 0.8)',
                            backdropFilter: 'blur(30px) saturate(150%)',
                            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                            p: 5,
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '25px 0 50px rgba(0,0,0,0.5)',
                            overflowY: 'auto',
                            zIndex: 10,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 6 }}>
                            <Box sx={{ width: 4, height: 16, bgcolor: '#6366f1', borderRadius: '2px' }} />
                            <Typography sx={{ fontSize: '12px', fontWeight: 900, color: '#fff', letterSpacing: '2px', textTransform: 'uppercase' }}>
                                Calibration
                            </Typography>
                        </Box>

                        <SelectBox label="Marketplace Engine" value={platform} onChange={setPlatform} />
                        <SelectBox label="Regional Territory" value={location} onChange={setLocation} />
                        <SelectBox label="Category Vertical" value={category} onChange={setCategory} />
                        <SelectBox label="Brand Identity" value={brand} onChange={setBrand} />

                        <Box sx={{
                            mt: 'auto',
                            p: 3,
                            bgcolor: 'rgba(99, 102, 241, 0.1)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '24px',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                <Info size={18} color="#818cf8" strokeWidth={2.5} />
                                <Typography sx={{ fontSize: '11px', fontWeight: 900, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '1px' }}>Intelligence Core</Typography>
                            </Box>
                            <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontWeight: 700 }}>
                                Algorithms are cross-referencing real-time telemetry from across the selected vertical market.
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* RCA Tree Content */}
                <Box sx={{ flex: 1, position: 'relative', bgcolor: 'transparent' }}>
                    <RCATree title={title} />
                </Box>
            </DialogContent>
        </Dialog>
    );
}
