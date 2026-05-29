import React, { useState } from "react";
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Button,
    Checkbox,
    FormControlLabel,
    Select,
    MenuItem,
    Chip,
    FormControl,
    useTheme
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import TrendController from "../../utils/TrendController";

const PricingTrendsDrawer = ({ open, onClose, entityName, dimensionType, platform = "Blinkit" }) => {
    const theme = useTheme();
    const [selectedPeriod, setSelectedPeriod] = useState('3M');
    const [timeStep, setTimeStep] = useState('Weekly');
    const [selectedMetrics, setSelectedMetrics] = useState({
        discount: true,
        pricePerUnit: true,
        asp: true
    });

    const controller = new TrendController();

    const months =
        selectedPeriod === "1M" ? 1 :
            selectedPeriod === "3M" ? 3 :
                selectedPeriod === "6M" ? 6 : 12;

    // Generate mock data for pricing
    const data = controller.generateData(months, timeStep).map(d => ({
        ...d,
        discount: 10 + Math.random() * 20,
        pricePerUnit: 150 + Math.random() * 100,
        asp: 180 + Math.random() * 150
    }));

    const handleMetricToggle = (key) => {
        setSelectedMetrics({
            ...selectedMetrics,
            [key]: !selectedMetrics[key]
        });
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <Box
                    sx={{
                        bgcolor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        px: 2,
                        py: 1.5,
                        borderRadius: 1.5,
                        boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.6)' : '0 4px 20px rgba(0,0,0,0.08)',
                        border: `1px solid ${theme.palette.divider}`,
                        minWidth: '220px'
                    }}
                >
                    <Box sx={{ mb: 1.5, pb: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem' }}>
                            {payload[0].payload.date}
                        </Typography>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.65rem', ml: 1, display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                            ⏱ <span>Avg: last {timeStep.toLowerCase()}</span>
                        </Typography>
                    </Box>
                    {payload.map((entry, index) => {
                        const labelMap = {
                            discount: 'Discount %',
                            pricePerUnit: 'Price/Unit 1g / 1 piece',
                            asp: 'Average Selling Price'
                        };
                        const unitMap = {
                            discount: '%',
                            pricePerUnit: '₹',
                            asp: '₹'
                        };
                        const isCurrency = unitMap[entry.dataKey] === '₹';

                        return (
                            <Box key={index} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color }}></Box>
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>{labelMap[entry.dataKey]}</Typography>
                                </Box>
                                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                                    {isCurrency ? '₹ ' : ''}{entry.value.toFixed(2)}{!isCurrency ? unitMap[entry.dataKey] : ''}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            );
        }
        return null;
    };

    const metricsList = [
        { key: 'discount', label: 'Discount %', color: '#6366f1' },
        { key: 'pricePerUnit', label: 'Price/Unit 1g / 1 piece', color: '#14b8a6' },
        { key: 'asp', label: 'Average Selling Price', color: '#8b5cf6' }
    ];

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: '65vw',
                    maxWidth: '1000px',
                    minWidth: '800px',
                    bgcolor: theme.palette.background.paper
                }
            }}
        >
            <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Box sx={{
                    px: 3,
                    pt: 2.5,
                    pb: 2,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: theme.palette.primary.main,
                            boxShadow: theme.palette.mode === 'dark' ? '0 0 0 3px rgba(255,255,255,0.04)' : '0 0 0 3px rgba(59, 130, 246, 0.08)'
                        }}></Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: theme.palette.text.primary }}>
                            {entityName} Trends
                        </Typography>
                        <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.875rem', mx: 0.5 }}>
                            ({dimensionType})
                        </Typography>
                        <Chip
                            label={platform}
                            size="small"
                            sx={{
                                bgcolor: theme.palette.mode === 'dark' ? theme.palette.action.selected : '#dbeafe',
                                color: theme.palette.mode === 'dark' ? theme.palette.text.primary : '#1e40af',
                                height: 24,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                '& .MuiChip-label': { px: 1.5 }
                            }}
                        />
                    </Box>
                    <IconButton
                        onClick={onClose}
                        size="small"
                        sx={{
                            color: theme.palette.text.secondary,
                            '&:hover': { bgcolor: theme.palette.action.hover }
                        }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                {/* Controls */}
                <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                    {/* Period Selection Row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            {['1M', '3M', '6M', '1Y'].map(period => (
                                <Button
                                    key={period}
                                    size="small"
                                    onClick={() => setSelectedPeriod(period)}
                                    variant={selectedPeriod === period ? 'contained' : 'outlined'}
                                    sx={{
                                        minWidth: '50px',
                                        height: '32px',
                                        px: 2,
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        textTransform: 'none',
                                        borderRadius: '6px',
                                        ...(selectedPeriod === period ? {
                                            bgcolor: theme.palette.primary.main,
                                            boxShadow: 'none',
                                            '&:hover': {
                                                bgcolor: theme.palette.primary.dark,
                                                boxShadow: 'none'
                                            }
                                        } : {
                                            color: theme.palette.text.secondary,
                                            borderColor: theme.palette.divider,
                                            bgcolor: 'transparent',
                                            '&:hover': {
                                                bgcolor: theme.palette.mode === 'dark' ? theme.palette.action.hover : '#f9fafb',
                                                borderColor: theme.palette.divider
                                            }
                                        })
                                    }}
                                >
                                    {period}
                                </Button>
                            ))}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
                            <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary, fontWeight: 500 }}>
                                Time Step:
                            </Typography>
                            <FormControl size="small">
                                <Select
                                    value={timeStep}
                                    onChange={(e) => setTimeStep(e.target.value)}
                                    IconComponent={KeyboardArrowDownIcon}
                                    sx={{
                                        fontSize: '0.8rem',
                                        height: '32px',
                                        minWidth: '110px',
                                        '& .MuiSelect-select': {
                                            py: 0.75,
                                            pr: 3.5,
                                            fontWeight: 500
                                        },
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: theme.palette.divider
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: theme.palette.divider
                                        }
                                    }}
                                >
                                    <MenuItem value="Daily" sx={{ fontSize: '0.8rem' }}>Daily</MenuItem>
                                    <MenuItem value="Weekly" sx={{ fontSize: '0.8rem' }}>Weekly</MenuItem>
                                    <MenuItem value="Monthly" sx={{ fontSize: '0.8rem' }}>Monthly</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                    </Box>

                    {/* Metric Toggles Row */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
                        {metricsList.map(metric => (
                            <FormControlLabel
                                key={metric.key}
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={selectedMetrics[metric.key]}
                                        onChange={() => handleMetricToggle(metric.key)}
                                        sx={{
                                            py: 0,
                                            pr: 0.75,
                                            '& .MuiSvgIcon-root': { fontSize: 18 }
                                        }}
                                    />
                                }
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <Box sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            bgcolor: metric.color
                                        }}></Box>
                                        <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.primary, fontWeight: 500 }}>
                                            {metric.label}
                                        </Typography>
                                    </Box>
                                }
                                sx={{ mb: 0 }}
                            />
                        ))}
                    </Box>
                </Box>

                {/* Chart Area */}
                <Box sx={{
                    flex: 1,
                    px: 2,
                    py: 2.5,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Box sx={{ width: '100%', height: '100%', maxHeight: '550px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={data}
                                margin={{ top: 10, right: 40, left: 20, bottom: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={{ stroke: theme.palette.divider }}
                                    dy={10}
                                />
                                <YAxis
                                    yAxisId="left"
                                    tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={{ stroke: theme.palette.divider }}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(value) => `₹ ${value}`}
                                    dx={-5}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={{ stroke: theme.palette.divider }}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                                    dx={5}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: theme.palette.divider, strokeWidth: 1 }} />

                                {selectedMetrics.discount && (
                                    <Line
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="discount"
                                        stroke="#6366f1"
                                        strokeWidth={2.5}
                                        dot={{ r: 3.5, fill: "#6366f1", strokeWidth: 0 }}
                                        activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: theme.palette.background.paper }}
                                    />
                                )}
                                {selectedMetrics.pricePerUnit && (
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="pricePerUnit"
                                        stroke="#14b8a6"
                                        strokeWidth={2.5}
                                        dot={{ r: 3.5, fill: "#14b8a6", strokeWidth: 0 }}
                                        activeDot={{ r: 5, fill: "#14b8a6", strokeWidth: 2, stroke: theme.palette.background.paper }}
                                    />
                                )}
                                {selectedMetrics.asp && (
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="asp"
                                        stroke="#8b5cf6"
                                        strokeWidth={2.5}
                                        dot={{ r: 3.5, fill: "#8b5cf6", strokeWidth: 0 }}
                                        activeDot={{ r: 5, fill: "#8b5cf6", strokeWidth: 2, stroke: theme.palette.background.paper }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </Box>
                </Box>
            </Box>
        </Drawer>
    );
};

export default PricingTrendsDrawer;
