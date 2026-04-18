import React, { useState, useEffect } from "react";
import {
    Autocomplete,
    TextField,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Box,
    Typography,
    Tooltip,
    Drawer,
} from "@mui/material";
import { X, Filter, RefreshCcw, Maximize2, Minimize2, ChevronDown, Info, Activity, Zap } from "lucide-react";
import RCATree from "./RCATree";
import axiosInstance from "../../../api/axiosInstance";
import TrendsCompetitionDrawer from "../../AllAvailablityAnalysis/TrendsCompetitionDrawer";
import { defaultBrands } from "../../../utils/DataCenter";
import RCADatePicker from "./RCADatePicker";
import dayjs from "dayjs";

/**
 * RCAModal
 * - Responsive fullscreen/large dialog
 * - Filter toggle button that shows/hides a filter drawer
 * - Integration with RCATree
 */

const SelectBox = ({ label, value, onChange, options = [], width = '100%', widePopup = false }) => (
    <Box sx={{ mb: 4.5 }}>
        <Typography sx={{ fontSize: '10px', fontWeight: 900, color: '#64748b', mb: 1.5, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            {label}
        </Typography>
        <Autocomplete
            options={options}
            value={value}
            onChange={(event, newValue) => {
                if (newValue !== null) onChange(newValue);
            }}
            disableClearable
            {...(!widePopup && { disablePortal: true })}
            clearOnBlur
            selectOnFocus
            handleHomeEndKeys
            size="small"
            getOptionLabel={(option) => option || ''}
            renderOption={(props, option) => (
                <li {...props} key={option}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, width: '100%', ...(widePopup ? { whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4 } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }) }}>
                        {option}
                    </Typography>
                </li>
            )}
            sx={{
                width,
                '& .MuiInputBase-root': {
                    padding: '6px 14px !important',
                    fontSize: '13px',
                    border: '1px solid rgba(15, 23, 42, 0.1)',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    color: '#0f172a',
                    fontWeight: 800,
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.2s ease',
                    minHeight: '42px',
                    '& fieldset': { border: 'none' },
                    '&:hover': {
                        borderColor: 'rgba(79, 70, 229, 0.4)',
                    },
                    '&.Mui-focused': {
                        borderColor: 'rgba(79, 70, 229, 0.4)',
                        boxShadow: '0 0 0 4px rgba(79, 70, 229, 0.05)',
                    }
                },
                '& .MuiAutocomplete-input': {
                    padding: '4px 4px !important',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#0f172a',
                    textOverflow: 'ellipsis',
                },
                '& .MuiAutocomplete-endAdornment': {
                    right: '10px !important',
                    '& .MuiSvgIcon-root': {
                        fontSize: '20px',
                        color: 'rgba(15, 23, 42, 0.35)',
                    }
                },
                '& .MuiAutocomplete-popupIndicator': {
                    '&:hover': { backgroundColor: 'transparent' },
                },
            }}
            componentsProps={{
                paper: {
                    sx: {
                        borderRadius: '14px',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
                        border: '1px solid rgba(15, 23, 42, 0.06)',
                        mt: 1,
                        overflow: 'hidden',
                        ...(widePopup && { minWidth: '500px' }),
                    }
                },
                ...(widePopup && {
                    popper: {
                        sx: { minWidth: '500px' },
                        placement: 'bottom-start',
                    }
                })
            }}
            renderInput={(params) => (
                <TextField 
                    {...params} 
                    placeholder={`Search ${label.toLowerCase()}...`}
                    variant="outlined"
                    InputProps={{
                        ...params.InputProps,
                        sx: { fontSize: '13px' }
                    }}
                />
            )}
            ListboxProps={{
                sx: {
                    maxHeight: '280px',
                    p: 0.75,
                    '&::-webkit-scrollbar': { width: '5px' },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(15,23,42,0.15)', borderRadius: '10px' },
                    '& .MuiAutocomplete-option': {
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#0f172a',
                        py: '8px !important',
                        px: '12px !important',
                        mb: 0.25,
                        ...(widePopup ? { whiteSpace: 'normal', wordBreak: 'break-word' } : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block !important' }),
                        '&:hover': {
                            backgroundColor: 'rgba(79, 70, 229, 0.06)',
                        },
                        '&[aria-selected="true"]': {
                            backgroundColor: 'rgba(79, 70, 229, 0.1) !important',
                            color: '#4f46e5',
                            fontWeight: 700,
                        }
                    }
                }
            }}
        />
    </Box>
);

export default function RCAModal({ open, onClose, title, initialData = {} }) {
    const [showFilters, setShowFilters] = useState(false);

    // Dynamic filter options from DB
    const [platformOptions, setPlatformOptions] = useState([]);
    const [platformChannels, setPlatformChannels] = useState([]);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [brandOptions, setBrandOptions] = useState([]);
    const [skuOptions, setSkuOptions] = useState(['All SKUs']);
    const [filtersLoading, setFiltersLoading] = useState(true);

    // Selected filter values
    const [platform, setPlatform] = useState('');
    const [category, setCategory] = useState('');
    const [brand, setBrand] = useState('All Brands');
    const [sku, setSku] = useState('All SKUs');

    // Date states
    const [timeStart, setTimeStart] = useState(dayjs().subtract(15, "day"));
    const [timeEnd, setTimeEnd] = useState(dayjs());
    const [compareStart, setCompareStart] = useState(dayjs().subtract(31, "day"));
    const [compareEnd, setCompareEnd] = useState(dayjs().subtract(16, "day"));
    const [compareOn, setCompareOn] = useState(true);
    const [periodLabel, setPeriodLabel] = useState("Last 15 Days");

    const [showTrends, setShowTrends] = useState(false);
    const [selectedTrendName, setSelectedTrendName] = useState("All");
    const [selectedTrendLevel, setSelectedTrendLevel] = useState("MRP");

    const handleViewTrends = (name, level = "MRP") => {
        setSelectedTrendName(name);
        setSelectedTrendLevel(level);
        setShowTrends(true);
    };

    // Fetch platforms and categories on mount
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const load = async () => {
            setFiltersLoading(true);
            try {
                const [platRes, catRes, brandRes] = await Promise.all([
                    axiosInstance.get('/watchtower/platform-channels'),
                    axiosInstance.get('/watchtower/categories'),
                    axiosInstance.get('/watchtower/brands')
                ]);
                if (cancelled) return;

                const fetchedMappings = platRes.data || [];
                setPlatformChannels(fetchedMappings);
                const plats = fetchedMappings.map(m => m.platform);

                const cats = ['All', ...(catRes.data || [])];
                const brands = ['All Brands', ...(brandRes.data || [])];
                setPlatformOptions(plats);
                setCategoryOptions(cats);
                setBrandOptions(brands);

                // Apply initialData or defaults once options are available
                setPlatform(initialData.platform && plats.includes(initialData.platform) ? initialData.platform : (plats[0] || ''));
                setCategory(initialData.category && cats.includes(initialData.category) ? initialData.category : (cats[0] || ''));
                setBrand(initialData.brand && brands.includes(initialData.brand) ? initialData.brand : 'All Brands');
                setSku('All SKUs');
            } catch (err) {
                console.error('[RCAModal] Failed to load filter options:', err);
                setCategoryOptions(['All']);
                setBrandOptions(['All Brands']);
            } finally {
                if (!cancelled) setFiltersLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [open]);

    // Update platform when initialData changes (e.g., when opening RCA for a different entity)
    useEffect(() => {
        if (initialData.platform && platformOptions.includes(initialData.platform)) {
            setPlatform(initialData.platform);
        }
        if (initialData.category && categoryOptions.includes(initialData.category)) {
            setCategory(initialData.category);
        }
        if (initialData.brand && brandOptions.includes(initialData.brand)) {
            setBrand(initialData.brand);
        }
    }, [initialData, open]);

    // Fetch SKUs when filter dependencies change
    useEffect(() => {
        if (!open || !platform) return;
        let cancelled = false;
        const loadSkus = async () => {
            try {
                const params = {
                    platform: platform === 'All' ? '' : platform,
                    category: category === 'All' ? '' : category,
                    brand: brand === 'All Brands' ? '' : brand
                };
                const res = await axiosInstance.get('/watchtower/products', { params });
                if (cancelled) return;
                const skus = ['All SKUs', ...(res.data || [])];
                setSkuOptions(skus);
                // Reset selected SKU if it is no longer valid
                setSku(prev => (!prev || !skus.includes(prev) ? 'All SKUs' : prev));
            } catch (err) {
                console.error('[RCAModal] Failed to load SKU options:', err);
            }
        };
        loadSkus();
        return () => { cancelled = true; };
    }, [platform, category, brand, open]);

    const context = {
        platform,
        channel: platformChannels.find(p => p.platform === platform)?.channel || "",
        category,
        brand,
        sku,
        timeStart,
        timeEnd,
        compareStart,
        compareEnd,
        compareOn
    };

    const handleDateApply = (ts, te, cs, ce, co, label) => {
        setTimeStart(ts);
        setTimeEnd(te);
        setCompareStart(cs);
        setCompareEnd(ce);
        setCompareOn(co);
        setPeriodLabel(label);
    };

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
                            width: 50,
                            height: 50,
                            borderRadius: '18px',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            boxShadow: '0 10px 20px rgba(79, 70, 231, 0.25)',
                        }}
                    >
                        <Zap size={28} strokeWidth={3} fill="white" />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontSize: '1.6rem', color: '#0f172a', letterSpacing: '-1.2px' }}>
                            Diagnostic <span style={{ color: '#4f46e5' }}>Studio</span>
                        </Typography>
                        <Typography sx={{ fontSize: '11px', fontWeight: 900, color: 'rgba(15, 23, 42, 0.4)', textTransform: 'uppercase', letterSpacing: '2px' }}>
                            PRO INTELLIGENCE PIPELINE V2.0
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

                        <SelectBox label="Marketplace Engine" value={platform} onChange={setPlatform} options={platformOptions} />
                        <SelectBox label="Category Vertical" value={category} onChange={setCategory} options={categoryOptions} />
                        <SelectBox label="Brand Identity" value={brand} onChange={setBrand} options={brandOptions} />

                        {/* SKU dropdown — only visible for Ecom Channel platforms (Amazon, Flipkart) */}
                        {(() => {
                            const ch = (platformChannels.find(p => p.platform === platform)?.channel || '').toLowerCase();
                            const pl = (platform || '').toLowerCase();
                            const isEcom = ch.includes('e-commerce') || ch.includes('ecom') || pl === 'amazon' || pl === 'flipkart';
                            return isEcom ? (
                                <SelectBox label="SKU Selection" value={sku} onChange={setSku} options={skuOptions} widePopup />
                            ) : null;
                        })()}

                        <Box sx={{ mb: 4.5 }}>
                            <Typography sx={{ fontSize: '10px', fontWeight: 900, color: '#64748b', mb: 1.5, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                                Fiscal Period
                            </Typography>
                            <RCADatePicker
                                timeStart={timeStart}
                                timeEnd={timeEnd}
                                compareStart={compareStart}
                                compareEnd={compareEnd}
                                onApply={handleDateApply}
                            />
                        </Box>

                        <Box sx={{
                            mt: 'auto',
                            p: 3.5,
                            background: 'linear-gradient(135deg, #9C27B0 0%, #E91E63 100%)',
                            borderRadius: '28px',
                            color: 'white',
                            boxShadow: '0 15px 40px rgba(156, 39, 176, 0.3)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, position: 'relative', zIndex: 1 }}>
                                <Info size={20} color="white" strokeWidth={3} />
                                <Typography sx={{ fontSize: '11px', fontWeight: 900, color: 'white', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Core Engine</Typography>
                            </Box>
                            <Typography sx={{ fontSize: '13px', color: 'white', lineHeight: 1.6, fontWeight: 700, position: 'relative', zIndex: 1 }}>
                                Calibration systems are cross-referencing real-time telemetry from the selected marketplace vertical.
                            </Typography>
                            <Box sx={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.2, rotate: '-15deg' }}>
                                <Activity size={100} color="white" />
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* RCA Tree Content */}
                <Box sx={{ flex: 1, position: 'relative', bgcolor: 'transparent' }}>
                    <RCATree title={title} context={context} onViewTrends={handleViewTrends} />
                </Box>
            </DialogContent>

            <TrendsCompetitionDrawer
                open={showTrends}
                onClose={() => setShowTrends(false)}
                selectedColumn={selectedTrendName}
                selectedLevel={selectedTrendLevel}
                dynamicKey="platform_overview_tower"
                initialPlatform={platform}
                defaultView="Competition"
                brandOptions={brandOptions.filter(b => b !== 'All Brands')}
            />
        </Dialog>
    );
}
