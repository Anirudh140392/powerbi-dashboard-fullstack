import React, { useEffect, useState, useContext } from 'react';
import {
    Modal,
    Box,
    Typography,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import api from '../../api/axiosInstance';
import { FilterContext } from '../../utils/FilterContext';

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: 1000,
    maxHeight: '85vh',
    bgcolor: 'background.paper',
    boxShadow: 24,
    borderRadius: '16px',
    p: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
};

const BSRModal = ({ open, onClose }) => {
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
    const [activeTab, setActiveTab] = useState('gainers');

    useEffect(() => {
        if (open && timeStart && timeEnd) {
            fetchBSRData();
        }
    }, [open, selectedPlatform, selectedBrand, selectedCity, selectedCategory, selectedChannel, timeStart, timeEnd]);

    const fetchBSRData = async () => {
        setLoading(true);
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
            setData(response.data.data || []);
        } catch (error) {
            console.error('Error fetching BSR data:', error);
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
        const color = isGood ? '#2e7d32' : '#d32f2f';
        const Icon = isGood ? (isBSR ? TrendingDownIcon : TrendingUpIcon) : (isBSR ? TrendingUpIcon : TrendingDownIcon);
        
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', color, fontSize: '0.75rem', fontWeight: 'bold' }}>
                <Icon sx={{ fontSize: '0.9rem', mr: 0.2 }} />
                {Math.abs(delta).toFixed(isBSR ? 0 : 1)}
                {!isBSR && '%'}
            </Box>
        );
    };

    const gainers = data.filter(row => row.bsrDelta < 0).sort((a, b) => (a.currentBSR || 999999) - (b.currentBSR || 999999));
    const drainers = data.filter(row => row.bsrDelta > 0).sort((a, b) => (a.currentBSR || 999999) - (b.currentBSR || 999999));

    const BSRTable = ({ tableData, title, titleColor }) => (
        <Box sx={{ mb: 2 }}>
            {tableData.length === 0 ? (
                <Paper sx={{ p: 6, textAlign: 'center', bgcolor: '#fafafa', border: '1px dashed #ccc', borderRadius: '12px' }}>
                    <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                        No SKUs found in this category.
                    </Typography>
                </Paper>
            ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8f9fa', py: 1.5 }}>SKU</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: '#f8f9fa' }}>Current BSR</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: '#f8f9fa' }}>Prev BSR</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: '#f8f9fa' }}>Discount %</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: '#f8f9fa' }}>Prev Disc. %</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tableData.map((row, index) => (
                                <TableRow key={index} sx={{ '&:hover': { bgcolor: '#fcfcfc' } }}>
                                    <TableCell sx={{ minWidth: 200, fontWeight: 500, fontSize: '0.8125rem', py: 1.5 }}>{row.sku}</TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatBSR(row.currentBSR)}</Typography>
                                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                            {renderDelta(row.bsrDelta, true)}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" color="text.secondary">{formatBSR(row.prevBSR)}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDiscount(row.currentDiscount)}</Typography>
                                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                            {renderDelta(row.discountDelta, false)}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" color="text.secondary">{formatDiscount(row.prevDiscount)}</Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            aria-labelledby="bsr-modal-title"
        >
            <Box sx={style}>
                {/* Header */}
                <Box sx={{ 
                    p: 2.5, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    bgcolor: '#f8f9fa',
                    borderBottom: '1px solid #eee'
                }}>
                    <Box>
                        <Typography id="bsr-modal-title" variant="h6" component="h2" sx={{ fontWeight: 700, color: '#1a1a1a' }}>
                            Best Seller Rank (BSR) Analysis
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Analyze SKU-level performance trends
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small" sx={{ bgcolor: '#fff', '&:hover': { bgcolor: '#f0f0f0' } }}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Switch & Filters */}
                <Box sx={{ px: 3, pt: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', gap: 1, bgcolor: '#f1f5f9', p: 0.5, borderRadius: '24px' }}>
                        {[
                            { id: 'gainers', label: 'Top Gainers', color: '#2e7d32' },
                            { id: 'drainers', label: 'Top Drainers', color: '#d32f2f' }
                        ].map((tab) => (
                            <Box
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                sx={{
                                    px: 3,
                                    py: 1,
                                    borderRadius: '20px',
                                    fontSize: '0.8125rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    bgcolor: activeTab === tab.id ? '#fff' : 'transparent',
                                    color: activeTab === tab.id ? tab.color : '#64748b',
                                    boxShadow: activeTab === tab.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    '&:hover': {
                                        color: activeTab === tab.id ? tab.color : '#0f172a'
                                    }
                                }}
                            >
                                {tab.label}
                            </Box>
                        ))}
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        Showing {activeTab === 'gainers' ? gainers.length : drainers.length} SKUs
                    </Typography>
                </Box>

                {/* Content */}
                <Box sx={{ p: 3, pt: 1, overflowY: 'auto', maxHeight: 'calc(85vh - 180px)' }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                            <CircularProgress size={40} thickness={4} sx={{ color: '#003366', mb: 2 }} />
                            <Typography color="text.secondary">Analyzing BSR Trends...</Typography>
                        </Box>
                    ) : data.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 8 }}>
                            <Typography color="text.secondary">No BSR data found for the selected filters.</Typography>
                        </Box>
                    ) : (
                        <Box>
                            {activeTab === 'gainers' ? (
                                <BSRTable 
                                    tableData={gainers} 
                                    title="Top Gainers (BSR Improved)" 
                                    titleColor="#2e7d32" 
                                />
                            ) : (
                                <BSRTable 
                                    tableData={drainers} 
                                    title="Top Drainers (BSR Declined)" 
                                    titleColor="#d32f2f" 
                                />
                            )}
                        </Box>
                    )}
                </Box>


                {/* Footer */}
                <Box sx={{ p: 2, borderTop: '1px solid #eee', bgcolor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        * Gainers: SKUs with improved (lower) rank. Drainers: SKUs with declined (higher) rank.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Showing data from {timeStart?.format('MMM DD')} to {timeEnd?.format('MMM DD, YYYY')}
                    </Typography>
                </Box>
            </Box>
        </Modal>
    );
};

export default BSRModal;
