import React, { useState, useEffect } from "react";
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
import axiosInstance from "../../../api/axiosInstance";

/**
 * RCAModal
 * - Responsive fullscreen/large dialog
 * - Filter toggle button that shows/hides a filter drawer
 * - Integration with RCATree
 */

const SelectBox = ({ label, value, onChange, options = [], width = '100%' }) => (
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
                    border: '1px solid rgba(15, 23, 42, 0.1)',
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
                    e.target.style.borderColor = 'rgba(79, 70, 229, 0.4)';
                    e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.05)';
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(15, 23, 42, 0.1)';
                    e.target.style.boxShadow = 'none';
                }}
            >
                {options.map((opt) => (
                    <option key={opt} value={opt} style={{ backgroundColor: '#fff', color: '#0f172a' }}>
                        {opt}
                    </option>
                ))}
            </select>
            <ChevronDown size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(15, 23, 42, 0.4)' }} />
        </Box>
    </Box>
);

export default function RCAModal({ open, onClose, title, initialData = {} }) {
    const [showFilters, setShowFilters] = useState(false);

    // Dynamic filters from API
    const [platforms, setPlatforms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);
    const [skus, setSkus] = useState([]);
    const months = ['Jan 2026', 'Dec 2025', 'Nov 2025', 'Oct 2025']; // Keep as static for now or fetch list

    const [platform, setPlatform] = useState(initialData.platform || '');
    const [category, setCategory] = useState(initialData.category || '');
    const [brand, setBrand] = useState(initialData.brand || '');
    const [sku, setSku] = useState('All');
    const [month, setMonth] = useState('2026-01-01');

    // Fetch platforms from API on mount
    useEffect(() => {
        const fetchPlatforms = async () => {
            try {
                const response = await axiosInstance.get('/watchtower/platforms');
                const fetchedPlatforms = response.data;
                if (fetchedPlatforms && fetchedPlatforms.length > 0) {
                    setPlatforms(fetchedPlatforms);
                    setPlatform(initialData.platform || fetchedPlatforms[0] || '');
                }
            } catch (error) {
                console.error('Error fetching platforms:', error);
                const fallback = ['Blinkit', 'Zepto', 'Swiggy Instamart', 'BigBasket'];
                setPlatforms(fallback);
                setPlatform(initialData.platform || fallback[0] || '');
            }
        };
        fetchPlatforms();
    }, []);

    // Fetch Categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await axiosInstance.get('/watchtower/trends-filter-options', {
                    params: { filterType: 'categories', platform }
                });
                if (response.data.options) {
                    setCategories(['All', ...response.data.options]);
                    if (!category || category === 'Chocolate') setCategory('All');
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };
        if (platform) fetchCategories();
    }, [platform]);

    // Fetch Brands
    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const response = await axiosInstance.get('/watchtower/trends-filter-options', {
                    params: { filterType: 'brands', platform, category }
                });
                if (response.data.options) {
                    setBrands(['All', ...response.data.options]);
                    if (!brand || brand === 'All Brands') setBrand('All');
                }
            } catch (error) {
                console.error('Error fetching brands:', error);
            }
        };
        if (platform) fetchBrands();
    }, [platform, category]);

    // Fetch SKUs
    useEffect(() => {
        const fetchSkus = async () => {
            try {
                const response = await axiosInstance.get('/watchtower/trends-filter-options', {
                    params: { filterType: 'skus', platform, category, brand }
                });
                if (response.data.options) {
                    setSkus(['All', ...response.data.options]);
                    if (!sku || sku === 'All SKUs') setSku('All');
                }
            } catch (error) {
                console.error('Error fetching skus:', error);
            }
        };
        if (platform) fetchSkus();
    }, [platform, category, brand]);

    const context = { platform, category, brand, sku, month };

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDialog-paper': {
                    bgcolor: '#ffffff',
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
                    borderBottom: '1px solid rgba(15, 23, 42, 0.05)',
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(24px) saturate(160%)',
                    zIndex: 1201,
                    color: '#0f172a'
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
                        <Typography variant="h6" sx={{ fontWeight: 900, fontSize: '1.4rem', color: '#0f172a', letterSpacing: '-1px' }}>
                            Diagnostic Studio
                        </Typography>
                        <Typography sx={{ fontSize: '10px', fontWeight: 900, color: 'rgba(15, 23, 42, 0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
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

            <DialogContent sx={{ p: 0, display: 'flex', overflow: 'hidden', height: '100%', bgcolor: '#ffffff' }}>
                {/* Filter Drawer / Sidebar (Left side) */}
                {showFilters && (
                    <Box
                        sx={{
                            width: 340,
                            flexShrink: 0,
                            bgcolor: 'rgba(255, 255, 255, 0.8)',
                            backdropFilter: 'blur(30px) saturate(150%)',
                            borderRight: '1px solid rgba(15, 23, 42, 0.05)',
                            p: 5,
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '25px 0 50px rgba(0,0,0,0.05)',
                            overflowY: 'auto',
                            zIndex: 10,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 6 }}>
                            <Box sx={{ width: 4, height: 16, bgcolor: '#6366f1', borderRadius: '2px' }} />
                            <Typography sx={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', letterSpacing: '2px', textTransform: 'uppercase' }}>
                                Calibration
                            </Typography>
                        </Box>

                        <SelectBox label="Marketplace Engine" value={platform} onChange={setPlatform} options={platforms} />
                        <SelectBox label="Category Vertical" value={category} onChange={setCategory} options={categories} />
                        <SelectBox label="Brand Identity" value={brand} onChange={setBrand} options={brands} />
                        <SelectBox label="SKU / ASIN" value={sku} onChange={setSku} options={skus} />
                        <SelectBox label="Fiscal Period" value={month} onChange={setMonth} options={months} />

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
                            <Typography sx={{ fontSize: '12px', color: 'rgba(15, 23, 42, 0.7)', lineHeight: 1.6, fontWeight: 700 }}>
                                Algorithms are cross-referencing real-time telemetry from across the selected vertical market.
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* RCA Tree Content */}
                <Box sx={{ flex: 1, position: 'relative', bgcolor: 'transparent' }}>
                    <RCATree title={title} context={context} />
                </Box>
            </DialogContent>
        </Dialog>
    );
}
