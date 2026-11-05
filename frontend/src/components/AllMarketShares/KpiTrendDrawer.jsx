import React, { useState, useEffect, useContext } from 'react';
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    Skeleton,
    ToggleButtonGroup,
    ToggleButton
} from '@mui/material';
import { X, TrendingUp, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import axiosInstance from '../../api/axiosInstance';
import { FilterContext } from '../../utils/FilterContext';

const KpiTrendDrawer = ({ open, onClose, subCategory }) => {
    const [loading, setLoading] = useState(true);
    const [trendData, setTrendData] = useState([]);
    const [timeStep, setTimeStep] = useState('Monthly');
    const { platform, selectedCategory, timeStart, timeEnd } = useContext(FilterContext);

    useEffect(() => {
        if (open) {
            fetchTrends();
        }
    }, [open, timeStep, subCategory, platform, selectedCategory, timeStart, timeEnd]);

    const fetchTrends = async () => {
        setLoading(true);
        try {
            const params = {
                platform: platform === 'All' ? undefined : (Array.isArray(platform) ? platform.join(",") : platform),
                category: selectedCategory === 'All' ? undefined : (Array.isArray(selectedCategory) ? selectedCategory.join(",") : selectedCategory),
                subCategory: subCategory ? (Array.isArray(subCategory) ? subCategory.join(",") : subCategory) : undefined,
                startDate: timeStart ? timeStart.format('YYYY-MM-DD') : undefined,
                endDate: timeEnd ? timeEnd.format('YYYY-MM-DD') : undefined,
                timeStep: timeStep,
                period: 'Custom'
            };

            const response = await axiosInstance.get('/market-share/trends', { params });
            if (response.data && response.data.timeSeries) {
                setTrendData(response.data.timeSeries);
            }
        } catch (error) {
            console.error('Error fetching KPI trends:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTimeStepChange = (event, newStep) => {
        if (newStep !== null) {
            setTimeStep(newStep);
        }
    };

    const renderChart = (title, dataKey, color, unit = '%') => {
        return (
            <Box sx={{ mb: 4, p: 3, bgcolor: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BarChart3 size={18} className="text-blue-600" />
                    {title}
                </Typography>
                <Box sx={{ height: 300, width: '100%' }}>
                    {loading ? (
                        <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: '16px' }} />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                                    tickFormatter={(val) => `${val}${unit}`}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        borderRadius: '12px', 
                                        border: 'none', 
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                        padding: '12px'
                                    }}
                                    labelStyle={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey={dataKey} 
                                    stroke={color} 
                                    strokeWidth={3} 
                                    dot={{ r: 4, fill: color, strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                    name={title}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </Box>
            </Box>
        );
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: { width: { xs: '100%', sm: 600 }, borderRadius: '32px 0 0 32px', overflow: 'hidden' }
            }}
        >
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Box sx={{ px: 4, py: 3, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#fff' }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                            Market Share KPI Trends
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                            {subCategory ? `Analyzing: ${subCategory}` : 'Overall Trend Analysis'}
                        </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ToggleButtonGroup
                            value={timeStep}
                            exclusive
                            onChange={handleTimeStepChange}
                            size="small"
                            sx={{ 
                                bgcolor: '#f1f5f9', 
                                p: 0.5, 
                                borderRadius: '12px',
                                '& .MuiToggleButton-root': {
                                    border: 'none',
                                    borderRadius: '8px',
                                    px: 2,
                                    py: 0.5,
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    color: '#64748b',
                                    '&.Mui-selected': {
                                        bgcolor: '#fff',
                                        color: '#0f172a',
                                        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
                                    }
                                }
                            }}
                        >
                            <ToggleButton value="Daily">Daily</ToggleButton>
                            <ToggleButton value="Weekly">Weekly</ToggleButton>
                            <ToggleButton value="Monthly">Monthly</ToggleButton>
                        </ToggleButtonGroup>

                        <IconButton onClick={onClose} sx={{ bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}>
                            <X size={20} />
                        </IconButton>
                    </Box>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, overflowY: 'auto', p: 4, bgcolor: '#fff' }}>
                    {renderChart('Market Share %', 'MWMarketShare', '#2563eb')}
                    {renderChart('Overall Share of Visibility', 'OverallSov', '#8b5cf6')}
                    {renderChart('Paid Share of Visibility', 'PaidSov', '#f59e0b')}
                </Box>
            </Box>
        </Drawer>
    );
};

export default KpiTrendDrawer;
