import React, { useEffect, useState, useContext, useMemo } from 'react';
import { Box, Typography, Paper, CircularProgress, Table, TableContainer, TableHead, TableRow, TableCell, TableBody, Chip, TextField, IconButton, Skeleton } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../../api/axiosInstance';
import { FilterContext } from '../../utils/FilterContext';
import { Package, TrendingUp } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import SnapshotOverview from '../CommonLayout/SnapshotOverview';
import BSRTrendsDrawer from './BSRTrendsDrawer';

const BSRAnalysisSegment = () => {
    const {
        selectedPlatform,
        selectedBrand,
        selectedCity,
        selectedCategory,
        selectedChannel,
        timeStart,
        timeEnd
    } = useContext(FilterContext);

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [sovData, setSovData] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('gainers');
    const [searchQuery, setSearchQuery] = useState('');
    const [showTrendsDrawer, setShowTrendsDrawer] = useState(false);

    useEffect(() => {
        if (timeStart && timeEnd) {
            fetchBSRData();
        }
    }, [selectedPlatform, selectedBrand, selectedCity, selectedCategory, selectedChannel, timeStart, timeEnd]);

    const fetchBSRData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/visibility-analysis/bsr-data', {
                params: {
                    platform: selectedPlatform,
                    brand: selectedBrand,
                    city: selectedCity,
                    format: selectedCategory,
                    channel: selectedChannel,
                    startDate: timeStart.format('YYYY-MM-DD'),
                    endDate: timeEnd.format('YYYY-MM-DD')
                }
            });
            setData(response.data?.data?.skus || []);
            setSovData(response.data?.data?.bsrSov || null);
        } catch (err) {
            console.error('Error fetching BSR data:', err);
            setError(err?.response?.data?.message || err.message || 'Failed to load BSR data');
            setData([]);
            setSovData(null);
        } finally {
            setLoading(false);
        }
    };

    const formatBSR = (val) => {
        if (val === 0 || val === null || val === undefined) return 'N/A';
        return Math.round(val);
    };

    const formatDiscount = (val) => {
        if (val === null || val === undefined) return 'N/A';
        return `${Number(val).toFixed(1)}%`;
    };

    const renderDelta = (delta, isBSR = false) => {
        if (delta === 0 || !delta) return null;
        
        const isGood = isBSR ? delta < 0 : delta > 0;
        const color = isGood ? '#10b981' : '#f43f5e'; // tailwind emerald-500, rose-500
        const Icon = isGood ? (isBSR ? TrendingDownIcon : TrendingUpIcon) : (isBSR ? TrendingUpIcon : TrendingDownIcon);
        
        return (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', color, fontSize: '0.75rem', fontWeight: 700 }}>
                <Icon sx={{ fontSize: '1rem', mr: 0.3 }} />
                {Math.abs(delta).toFixed(isBSR ? 0 : 1)}
                {!isBSR && '%'}
            </Box>
        );
    };

    // Category Aggregation for the top table
    const categoryAggregatedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const grouped = data.reduce((acc, row) => {
            const cat = row.category || 'Uncategorized';
            if (!acc[cat]) {
                acc[cat] = {
                    category: cat,
                    platform: row.platform || 'AMAZON', 
                    productsCount: 0,
                    prevProductsCount: 0,
                    totalBSR: 0,
                    totalPrevBSR: 0,
                    top10Count: 0,
                    prevTop10Count: 0
                };
            }
            if (row.currentBSR) {
                acc[cat].productsCount += 1;
                acc[cat].totalBSR += row.currentBSR;
                if (row.currentBSR <= 10) acc[cat].top10Count += 1;
            }
            if (row.prevBSR) {
                acc[cat].prevProductsCount += 1;
                acc[cat].totalPrevBSR += row.prevBSR;
                if (row.prevBSR <= 10) acc[cat].prevTop10Count += 1;
            }
            return acc;
        }, {});

        return Object.values(grouped).map(group => {
            const avgPos = group.productsCount > 0 ? group.totalBSR / group.productsCount : 0;
            const prevAvgPos = group.prevProductsCount > 0 ? group.totalPrevBSR / group.prevProductsCount : 0;
            const catSov = sovData?.categories?.[group.category] || null;
            const bsrSov = catSov ? catSov.current : 0;
            const bsrSovDelta = catSov ? catSov.delta : 0;

            return {
                category: group.category,
                platform: group.platform,
                amazonShare: bsrSov,
                amazonShareDelta: bsrSovDelta,
                productsCount: group.productsCount,
                productsDelta: group.productsCount - group.prevProductsCount,
                avgPosition: avgPos,
                avgPositionDelta: avgPos - prevAvgPos,
                bsrSov: bsrSov,
                bsrSovDelta: bsrSovDelta,
                top10Count: group.top10Count,
                top10Delta: group.top10Count - group.prevTop10Count,
            };
        });
    }, [data]);

    const kpiMetrics = useMemo(() => {
        if (!data || data.length === 0) return [];
        
        let productsCount = 0;
        let prevProductsCount = 0;
        let totalBSR = 0;
        let totalPrevBSR = 0;
        let top10Count = 0;
        let prevTop10Count = 0;

        data.forEach(row => {
            if (row.currentBSR) {
                productsCount++;
                totalBSR += row.currentBSR;
                if (row.currentBSR <= 10) top10Count++;
            }
            if (row.prevBSR) {
                prevProductsCount++;
                totalPrevBSR += row.prevBSR;
                if (row.prevBSR <= 10) prevTop10Count++;
            }
        });

        const avgBSR = productsCount > 0 ? (totalBSR / productsCount) : 0;
        const prevAvgBSR = prevProductsCount > 0 ? (totalPrevBSR / prevProductsCount) : 0;
        
        // Calculate Deltas
        const productsDelta = productsCount - prevProductsCount;
        const avgBSRDelta = avgBSR - prevAvgBSR;
        const top10Delta = top10Count - prevTop10Count;

        return [
            {
                id: 'products_in_bsr',
                title: "Products in BSR",
                value: productsCount,
                subtitle: "Products ranked in top 100 BSR",
                delta: productsDelta,
                deltaLabel: `${Math.abs(productsDelta)} pts (from ${prevProductsCount})`,
                prevText: "vs Previous Period",
                trendSeries: [43, 45, 46, 44, 47, 49, 50, 48, 47], // Mocked array for the solid color area chart
                gradient: ['#6366f1', '#8b5cf6'] // Indigo/Purple
            },
            {
                id: 'avg_bsr_position',
                title: "Avg. BSR Position",
                value: avgBSR.toFixed(1),
                subtitle: "Average ranking across tracked products",
                delta: -avgBSRDelta, // Negative delta means a lower BSR, which is good
                deltaLabel: `${Math.abs(avgBSRDelta).toFixed(1)} pts (from ${prevAvgBSR.toFixed(1)})`,
                prevText: "vs Previous Period",
                trendSeries: [25.1, 26.2, 24.8, 27.0, 26.5, 25.3, 24.6], // Mocked array
                gradient: ['#14b8a6', '#06b6d4'] // Teal/Cyan
            },
            {
                id: 'bsr_sov',
                title: "BSR SOS %",
                value: sovData ? `${sovData.global?.current?.toFixed(1)}%` : "0.0%",
                subtitle: "Share of Voice in Best Seller rankings",
                delta: sovData ? sovData.global?.delta : 0,
                deltaLabel: sovData ? `${Math.abs(sovData.global?.delta || 0).toFixed(1)} pts (from ${sovData.global?.prev?.toFixed(1)}%)` : "0.0 pts",
                prevText: "vs Previous Period",
                trendSeries: [19.2, 19.6, 18.9, 18.2, 18.0, 18.5, 18.4], // Fixed graph rendering with mocked trend until API supports it
                gradient: ['#f43f5e', '#ec4899'] // Rose/Pink
            },
            {
                id: 'top_10_bsr_products',
                title: "Top 10 BSR Products",
                value: top10Count,
                subtitle: "Products in top 10 BSR positions",
                delta: top10Delta,
                deltaLabel: `${Math.abs(top10Delta)} pts (from ${prevTop10Count})`,
                prevText: "vs Previous Period",
                trendSeries: [5, 6, 6, 7, 6, 8, 8], // Mocked array
                gradient: ['#f59e0b', '#fbbf24'] // Amber/Yellow
            }
        ];
    }, [data, sovData]);

    // SKU Table processing
    const filteredSKUs = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase();
        let targetData = activeTab === 'gainers' 
            ? data.filter(row => row.bsrDelta < 0).sort((a, b) => (a.currentBSR || 9999) - (b.currentBSR || 9999))
            : data.filter(row => row.bsrDelta > 0).sort((a, b) => (a.currentBSR || 9999) - (b.currentBSR || 9999));
        
        if (searchQuery) {
            targetData = targetData.filter(row => (row.sku || '').toLowerCase().includes(lowerQuery));
        }
        return targetData;
    }, [data, activeTab, searchQuery]);

    const renderChipDelta = (val, delta, isBSR = false) => {
        const isGood = isBSR ? delta < 0 : delta > 0;
        const colorClass = isGood ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-rose-600 bg-rose-50 border-rose-200';
        const arrow = isGood ? (isBSR ? '➘' : '➚') : (isBSR ? '➚' : '➘'); 

        return (
            <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{isBSR ? val.toFixed(1) : val.toFixed(2) + '%'}</span>
                {delta !== 0 && (
                    <div className={`px-1.5 py-0.5 border rounded-full text-[10px] font-bold ${colorClass} tracking-wider`}>
                        {arrow} {Math.abs(delta).toFixed(1)}
                    </div>
                )}
                {delta === 0 && (
                    <div className={`px-1.5 py-0.5 border rounded-full text-[10px] font-bold text-slate-500 bg-slate-50 border-slate-200 tracking-wider`}>
                        —
                    </div>
                )}
            </div>
        )
    };

    const downloadCSV = (exportData, filename, isCategory) => {
        if (!exportData || exportData.length === 0) return;
        
        let csvContent = "";
        
        // Define headers based on table type
        const headers = isCategory 
            ? ['Category', 'Platform', 'Products in BSR', 'Avg. Position', 'BSR SOS %', 'Top 10']
            : ['SKU', 'Platform', 'Best BSR (Current)', 'Best BSR (Previous)', 'Discount %'];
            
        // Map data rows securely wrapping text in quotes to handle commas
        const rows = isCategory 
            ? exportData.map(row => [
                `"${row.category}"`, 
                `"${row.platform || 'All'}"`, 
                row.productsCount, 
                row.avgPosition.toFixed(1), 
                row.bsrSov.toFixed(1) + '%', 
                row.top10Count
            ])
            : exportData.map(row => [
                `"${(row.sku || '').replace(/"/g, '""')}"`, 
                `"${row.platform || 'All'}"`, 
                row.currentBSR || 'N/A', 
                row.prevBSR || 'N/A', 
                row.discount ? row.discount.toFixed(1) + '%' : 'N/A'
            ]);

        // Construct CSV string
        csvContent = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");

        // Use Blob for robust downloading
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1, fontFamily: 'Inter, sans-serif' }}>

            {/* Error State with Refresh */}
            {error && !loading && (
                <Box sx={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    py: 8, px: 4, borderRadius: '16px', border: '1px solid #fecaca', 
                    background: 'linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                    <Box sx={{ fontSize: '2.5rem', mb: 2 }}>⚠️</Box>
                    <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#991b1b', mb: 1 }}>
                        Failed to Load BSR Data
                    </Typography>
                    <Typography sx={{ fontSize: '13px', color: '#b91c1c', mb: 3, textAlign: 'center', maxWidth: 400 }}>
                        {error}
                    </Typography>
                    <button
                        onClick={fetchBSRData}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 28px', borderRadius: 12, border: 'none',
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.45)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.35)'; }}
                    >
                        🔄 Refresh
                    </button>
                </Box>
            )}

            {/* KPI Cards — only show when no error */}
            {!error && (
            <>
            <SnapshotOverview 
                title="BSR Overview"
                chip={data[0]?.platform || selectedPlatform === 'All' ? 'AMAZON' : selectedPlatform}
                headerRight="VS PREVIOUS PERIOD"
                kpis={kpiMetrics} 
                loading={loading} 
            />

            {/* 1. Category BSR Performance Table */}
            <Paper elevation={0} sx={{ border: '1px solid #f1f5f9', borderRadius: '16px', overflow: 'hidden', p: 3, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-[17px] font-bold text-slate-900 mb-1">Category BSR Performance</h2>
                        <p className="text-xs text-slate-500 font-medium">Hover on any value to see trend sparkline</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                        <button
                            onClick={() => setShowTrendsDrawer(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all text-xs font-bold"
                            title="View Trends"
                        >
                            <TrendingUp size={14} />
                            Trends
                        </button>
                        <button 
                            onClick={() => downloadCSV(categoryAggregatedData, 'Category_BSR_Performance', true)}
                            className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                            title="Download CSV"
                        >
                            <DownloadIcon sx={{ fontSize: 18 }} />
                        </button>
                        <div className="flex items-center gap-1.5 text-slate-600"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Healthy</div>
                        <div className="flex items-center gap-1.5 text-slate-600"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Watch</div>
                        <div className="flex items-center gap-1.5 text-slate-600"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Action</div>
                    </div>
                </div>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                        <CircularProgress size={30} sx={{ color: '#6366f1' }} />
                    </Box>
                ) : categoryAggregatedData.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography color="text.secondary">No BSR data found for the selected filters.</Typography>
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="medium">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, color: '#64748b', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }}>Category</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 600, color: '#64748b', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }}>Products in BSR</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 600, color: '#64748b', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }}>Avg. Position</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 600, color: '#64748b', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }}>BSR SOS %</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 600, color: '#64748b', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }}>Top 10</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 600, color: '#64748b', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }}>Trend</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {categoryAggregatedData.map((row, index) => (
                                    <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f8fafc' }, transition: 'background-color 0.2s', td: { borderBottom: '1px solid #f1f5f9', py: 2 } }}>
                                        <TableCell sx={{ fontWeight: 600, color: '#334155' }}>{row.category}</TableCell>
                                        <TableCell align="center">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="font-semibold text-slate-800">{row.productsCount}</span>
                                                <span className={`text-[10px] font-bold ${row.productsDelta > 0 ? 'text-emerald-500' : row.productsDelta < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    {row.productsDelta > 0 ? '➚' : row.productsDelta < 0 ? '➘' : '—'} {row.productsDelta !== 0 ? Math.abs(row.productsDelta) : ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell align="center">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="font-semibold text-slate-800">{row.avgPosition.toFixed(1)}</span>
                                                <span className={`text-[10px] font-bold ${row.avgPositionDelta < 0 ? 'text-emerald-500' : row.avgPositionDelta > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    {row.avgPositionDelta < 0 ? '➘' : row.avgPositionDelta > 0 ? '➚' : '—'} {row.avgPositionDelta !== 0 ? Math.abs(row.avgPositionDelta).toFixed(1) : ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell align="center">
                                            <div className="flex justify-center">
                                                {renderChipDelta(row.bsrSov, row.bsrSovDelta, false)}
                                            </div>
                                        </TableCell>
                                        <TableCell align="center">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="font-semibold text-slate-800">{row.top10Count}</span>
                                                <span className={`text-[10px] font-bold ${row.top10Delta > 0 ? 'text-emerald-500' : row.top10Delta < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    {row.top10Delta > 0 ? '➚' : row.top10Delta < 0 ? '➘' : '—'} {row.top10Delta !== 0 ? Math.abs(row.top10Delta) : ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell align="center" sx={{ width: 100 }}>
                                            <div className="h-8 w-20 mx-auto">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={[
                                                        { value: row.avgPosition + row.avgPositionDelta },
                                                        { value: row.avgPosition - (Math.random()*2) },
                                                        { value: row.avgPosition + (Math.random()*1) },
                                                        { value: row.avgPosition }
                                                    ]}>
                                                        <Line 
                                                            type="monotone" 
                                                            dataKey="value" 
                                                            stroke={row.avgPositionDelta < 0 ? "#10b981" : "#f43f5e"} 
                                                            strokeWidth={2} 
                                                            dot={false}
                                                            isAnimationActive={false}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>

            {/* 2. Key Insights Section */}
            <Paper elevation={0} sx={{ border: '1px solid #f1f5f9', borderRadius: '16px', overflow: 'hidden', p: 3, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <h2 className="text-[17px] font-bold text-slate-900">Key Insights</h2>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wide">
                                {data[0]?.platform || selectedPlatform === 'All' ? 'AMAZON' : selectedPlatform}
                            </span>
                            <span className="text-slate-400 text-sm font-medium">for</span>
                            <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold flex items-center gap-1 border border-blue-100 cursor-pointer">
                                {selectedCategory === 'All' ? 'All Categories' : selectedCategory} <span className="text-[10px]">›</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                         <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                🔍
                            </div>
                            <input
                                type="text"
                                placeholder="Search SKU..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <button 
                            onClick={() => downloadCSV(filteredSKUs, `Key_Insights_BSR_${activeTab}`, false)}
                            className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                            title="Download CSV"
                        >
                            <DownloadIcon sx={{ fontSize: 20 }} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                     <button
                        onClick={() => setActiveTab('gainers')}
                        className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all ${activeTab === 'gainers' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' : 'bg-transparent text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                    >
                        Gainers
                    </button>
                    <button
                        onClick={() => setActiveTab('drainers')}
                        className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all ${activeTab === 'drainers' ? 'bg-rose-500 text-white shadow-sm shadow-rose-200' : 'bg-transparent text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                    >
                        Drainers
                    </button>
                </div>

                {/* Table */}
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                        <CircularProgress size={30} sx={{ color: '#6366f1' }} />
                    </Box>
                ) : filteredSKUs.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography color="text.secondary">No SKUs in this analysis tab.</Typography>
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="medium">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, color: '#64748b', fontSize: '12px', borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }}>SKU</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 600, color: '#64748b', fontSize: '12px', borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
                                        Best BSR<br/><span className="text-[10px] font-medium text-slate-400">(Current Period)</span>
                                    </TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 600, color: '#64748b', fontSize: '12px', borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc' }}>
                                        Best BSR<br/><span className="text-[10px] font-medium text-slate-400">(Previous Period)</span>
                                    </TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 600, color: '#64748b', fontSize: '12px', borderBottom: '1px solid #f1f5f9', bgcolor: '#f8fafc', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}>Discount %</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredSKUs.map((row, index) => (
                                    <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f8fafc' }, td: { borderBottom: '1px solid #f1f5f9' } }}>
                                        <TableCell sx={{ py: 1.5, minWidth: 350 }}>
                                            <div className="flex items-center gap-3">
                                                {row.imageUrl ? (
                                                    <img
                                                        src={row.imageUrl}
                                                        alt={row.sku}
                                                        onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                                        style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', border: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}
                                                    />
                                                ) : null}
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200/60 shadow-sm shrink-0" style={{ display: row.imageUrl ? 'none' : 'flex' }}>
                                                    <Package size={20} strokeWidth={1.5} />
                                                </div>
                                                <Typography sx={{ fontWeight: 600, color: '#1e293b', fontSize: '13px', lineHeight: 1.4 }}>
                                                    {row.sku}
                                                </Typography>
                                            </div>
                                        </TableCell>
                                        <TableCell align="center">
                                             <div className="flex items-center justify-center gap-2">
                                                <span className="text-[15px] font-bold text-slate-900">{formatBSR(row.currentBSR)}</span>
                                                {row.bsrDelta !== 0 && (
                                                    <div className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${row.bsrDelta < 0 ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-rose-600 border-rose-200 bg-rose-50'}`}>
                                                        {row.bsrDelta < 0 ? '➘' : '➚'} {Math.abs(row.bsrDelta)}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '14px' }}>
                                                {formatBSR(row.prevBSR)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-[14px] font-bold text-slate-800">{formatDiscount(row.currentDiscount)}</span>
                                                {row.discountDelta !== 0 && row.discountDelta !== null && (
                                                    <span className={`text-[11px] font-bold mt-0.5 ${row.discountDelta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {row.discountDelta > 0 ? '+' : ''}{row.discountDelta.toFixed(1)}%
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
            </>
            )}
            {/* Trends Drawer */}
            <BSRTrendsDrawer 
                open={showTrendsDrawer} 
                onClose={() => setShowTrendsDrawer(false)}
                selectedCategory={selectedCategory === 'All' ? 'All' : selectedCategory}
            />
        </Box>
    );
};

export default BSRAnalysisSegment;
