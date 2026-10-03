import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  TableSortLabel,
  Stack,
} from "@mui/material";
import { Search, Download, X, MapPin, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

// Utility to join classes
function cn(...c) {
    return c.filter(Boolean).join(" ");
}

// Utility to format numbers to Indian units (k, Lacs, Cr)
const formatNumberToIndianUnits = (num) => {
    if (!num || isNaN(num)) return "0";
    const absNum = Math.abs(num);
    if (absNum >= 10000000) return (num / 10000000).toFixed(1) + "Cr";
    if (absNum >= 100000) return (num / 100000).toFixed(1) + "Lacs";
    if (absNum >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toLocaleString();
};

/* ─── Modern Trend Pill ──────────────────────────────────────────────────── */
function TrendPill({ value }) {
    const isDown = value < 0;
    return (
        <div className={cn(
            "flex items-center gap-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap transition-all duration-300",
            isDown 
                ? "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100" 
                : "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
        )}>
            {isDown ? <ArrowDownRight size={14} strokeWidth={2} /> : <ArrowUpRight size={14} strokeWidth={2} />}
            {Math.abs(value).toFixed(1)}%
        </div>
    );
}

const PricingInsightsTable = ({ sku, onClose, insightType }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [page, setPage] = useState(1);

    const data = useMemo(() => {
        const raw = sku?.cities || [];
        if (insightType === 'drop') {
            return raw.filter(c => c.change < 0);
        }
        if (insightType === 'increase') {
            return raw.filter(c => c.change > 0);
        }
        return raw;
    }, [sku, insightType]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        let result = [...data];
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(item => item.name?.toLowerCase().includes(lowerSearch));
        }

        result.sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [data, searchTerm, sortConfig]);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return sortedData.slice(start, start + rowsPerPage);
    }, [sortedData, page, rowsPerPage]);

    const handleExportCSV = () => {
        const headers = ["City", "Current Discount %", "Change %", "OSA %", "Offtake"];
        const csvRows = [
            headers.join(","),
            ...sortedData.map(item => [
                `"${item.name}"`,
                item.discount.toFixed(1),
                item.change.toFixed(1),
                (item.osa || 0).toFixed(1),
                (item.offtakes || 0).toLocaleString()
            ].join(","))
        ];
        
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `pricing_analysis_${sku?.title.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalPages = Math.ceil(sortedData.length / rowsPerPage);

    return (
        <Box sx={{ 
            display: 'flex', flexDirection: 'column', 
            flex: 1, minHeight: 0,
            bgcolor: 'white', overflow: 'hidden'
        }}>
            {/* Header Redesign - Minimalist & Compact */}
            <Box sx={{ 
                px: 2, py: 1.5, 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid #f1f5f9'
            }}>
                <Box>
                    <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', letterSpacing: '-0.01em' }}>
                        City Impacts for <span style={{ color: '#3b82f6' }}>"{sku?.title}"</span> on <span className="capitalize" style={{ color: '#6366f1' }}>{sku?.platform}</span>
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {/* CSV Export Button */}
                    <IconButton 
                        onClick={handleExportCSV}
                        sx={{ 
                            bgcolor: '#f8fafc', borderRadius: '10px', p: 1,
                            border: '1px solid #f1f5f9',
                            '&:hover': { bgcolor: '#f1f5f9' }
                        }}
                        title="Download CSV"
                    >
                        <Download size={18} color="#64748b" />
                    </IconButton>

                    {/* Close Button */}
                    <IconButton 
                        onClick={onClose}
                        sx={{ 
                            bgcolor: '#f8fafc', borderRadius: '10px', p: 1,
                            border: '1px solid #f1f5f9',
                            '&:hover': { bgcolor: '#fee2e2', border: '1px solid #fecaca' }
                        }}
                    >
                        <X size={18} color="#64748b" />
                    </IconButton>
                </Box>
            </Box>

            {/* Table Area - Now Scrollable */}
            <Box sx={{ 
                flex: 1, px: 2, py: 0.5, 
                overflow: 'hidden', 
                display: 'flex', flexDirection: 'column' 
            }}>
                <TableContainer sx={{ 
                    border: 'none', boxShadow: 'none', 
                    flex: 1, overflowY: 'auto',
                    '&::-webkit-scrollbar': { width: '6px' },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: '#e2e8f0', borderRadius: '10px' },
                }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow sx={{ '& th': { borderBottom: '1px solid #f1f5f9', py: 1, px: 1, bgcolor: 'white' } }}>
                                <TableCell sx={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    <TableSortLabel active={sortConfig.key === 'name'} direction={sortConfig.direction} onClick={() => handleSort('name')}>
                                        City
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    Current Discount %
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    OSA %
                                </TableCell>

                                <TableCell align="center" sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    Offtake
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                                        <Typography sx={{ color: '#94a3b8', fontSize: '13px' }}>No cities match this filter.</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((row) => (
                                    <TableRow key={row.name} hover sx={{ '& td': { borderBottom: '1px solid #f8fafc', py: 0.8, px: 1 } }}>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>{row.name}</Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="center">
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                                                    {row.discount.toFixed(1)}%
                                                </Typography>
                                                <TrendPill value={row.change} />
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                                                {(row.osa || 0).toFixed(1)}%
                                            </Typography>
                                        </TableCell>

                                        <TableCell align="center">
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                                                {formatNumberToIndianUnits(row.offtakes)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {/* Pagination Footer - Minimalist & Compact */}
            <Box sx={{ 
                px: 2, py: 1, 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: '1px solid #f1f5f9', bgcolor: '#fafafa'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <button 
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                        title="Previous"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    
                    <Box sx={{ px: 2, py: 0.5, bgcolor: '#f1f5f9', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                            {page} <span style={{ color: '#94a3b8', fontWeight: 500, margin: '0 4px' }}>/</span> {totalPages || 1}
                        </Typography>
                    </Box>

                    <button 
                        disabled={page >= totalPages || totalPages === 0}
                        onClick={() => setPage(p => p + 1)}
                        className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                        title="Next"
                    >
                        <ChevronRight size={16} />
                    </button>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>Rows/page</Typography>
                    <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => {
                                setRowsPerPage(Number(e.target.value));
                                setPage(1);
                            }}
                            style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#1e293b',
                                backgroundColor: 'white',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                paddingLeft: '8px',
                                paddingRight: '24px',
                                paddingTop: '4px',
                                paddingBottom: '4px',
                                cursor: 'pointer',
                                outline: 'none',
                                appearance: 'none',
                                fontFamily: 'inherit',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                        >
                            {[5, 10, 20, 50].map(val => (
                                <option key={val} value={val}>{val}</option>
                            ))}
                        </select>
                        <Box sx={{ 
                            position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                            pointerEvents: 'none', display: 'flex', alignItems: 'center'
                        }}>
                            <ChevronDown size={12} color="#94a3b8" />
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default PricingInsightsTable;
