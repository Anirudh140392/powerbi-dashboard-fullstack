import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Skeleton,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FileDownload as FileDownloadIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import CommonContainer from '../../components/CommonLayout/CommonContainer';
import MultiSelectSearchDropdown from '../../components/CommonLayout/MultiSelectSearchDropdown';
import { FilterContext } from '../../utils/FilterContext';
import { fetchMopFilters, fetchMopData } from '../../api/mopAnalysisService';

export default function MopAnalysis() {
  const { timeStart, timeEnd } = useContext(FilterContext) || {};

  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);

  // Filter dropdown options
  const [ecomOptions, setEcomOptions] = useState([]);
  const [codeOptions, setCodeOptions] = useState([]);

  // Selected filter states ('All' or array of strings)
  const [selectedEcom, setSelectedEcom] = useState('All');
  const [selectedCode, setSelectedCode] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Table & pagination state
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const startDateStr = timeStart ? dayjs(timeStart).format('YYYY-MM-DD') : undefined;
  const endDateStr = timeEnd ? dayjs(timeEnd).format('YYYY-MM-DD') : undefined;

  // Fetch filter options on mount
  useEffect(() => {
    let isMounted = true;
    const loadFilters = async () => {
      setFiltersLoading(true);
      try {
        const res = await fetchMopFilters();
        if (isMounted) {
          setEcomOptions(res?.ecomNaming || []);
          setCodeOptions(res?.codes || []);
        }
      } catch (err) {
        console.error('Failed to load MOP filters:', err);
      } finally {
        if (isMounted) setFiltersLoading(false);
      }
    };
    loadFilters();
    return () => { isMounted = false; };
  }, []);

  // Fetch table data when filters, dates or pagination change
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const ecomParam = selectedEcom === 'All'
          ? undefined
          : (Array.isArray(selectedEcom) ? (selectedEcom.length === 0 ? '' : selectedEcom.join(',')) : selectedEcom);

        const codeParam = selectedCode === 'All'
          ? undefined
          : (Array.isArray(selectedCode) ? (selectedCode.length === 0 ? '' : selectedCode.join(',')) : selectedCode);

        const res = await fetchMopData({
          ecomNaming: ecomParam,
          code: codeParam,
          startDate: startDateStr,
          endDate: endDateStr,
          page,
          pageSize
        });
        if (isMounted) {
          setRows(res?.rows || []);
          setTotalRows(res?.total || 0);
        }
      } catch (err) {
        console.error('Failed to load MOP data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [selectedEcom, selectedCode, startDateStr, endDateStr, page, pageSize]);

  // Client-side search filtering for quick lookup
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(r =>
      (r.code && r.code.toLowerCase().includes(q)) ||
      (r.product && r.product.toLowerCase().includes(q)) ||
      (r.ecomNaming && r.ecomNaming.toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  const totalPages = Math.ceil((totalRows || filteredRows.length) / pageSize) || 1;

  // Format date string to M/D/YYYY for UI display matching the screenshot
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = dayjs(dateStr);
    return d.isValid() ? d.format('M/D/YYYY') : dateStr;
  };

  // Helper to render price with MOP violation color rules matching DAX formula:
  // IF price = 0 -> BLANK()
  // IF price < t2 -> "Red"
  // IF price < t1 -> "Blue"
  // ELSE -> BLANK() (default text color)
  const renderPriceCell = (price, t1Mop, t2Mop) => {
    if (price === null || price === undefined || price === '' || Number(price) === 0) {
      return '';
    }

    const numPrice = Number(price);
    const numT1 = t1Mop !== null && t1Mop !== undefined ? Number(t1Mop) : null;
    const numT2 = t2Mop !== null && t2Mop !== undefined ? Number(t2Mop) : null;

    let color = '#334155'; // default regular text color
    let fontWeight = 500;

    if (numT2 !== null && numPrice < numT2) {
      color = '#ef4444'; // Red for T2 breach
      fontWeight = 700;
    } else if (numT1 !== null && numPrice < numT1) {
      color = '#2563eb'; // Blue for T1 breach
      fontWeight = 700;
    }

    return (
      <Typography
        component="span"
        sx={{
          fontSize: '13px',
          fontWeight,
          color,
          fontFamily: 'monospace'
        }}
      >
        {numPrice.toFixed(2)}
      </Typography>
    );
  };


  // Export table to CSV
  const handleExportCSV = () => {
    if (rows.length === 0) return;
    const headers = [
      'Date', 'Code', 'Product', 'MRP', 'T1 MOP', 'T2 MOP',
      'Amazon Price', 'Blinkit Price', 'BigBasket Price',
      'Flipkart Price', 'Swiggy Price', 'Zepto Price'
    ];

    const csvData = rows.map(r => [
      formatDate(r.date),
      `"${r.code || ''}"`,
      `"${(r.product || '').replace(/"/g, '""')}"`,
      r.mrp ?? '',
      r.t1Mop ?? '',
      r.t2Mop ?? '',
      r.amazonPrice ?? '',
      r.blinkitPrice ?? '',
      r.bigbasketPrice ?? '',
      r.flipkartPrice ?? '',
      r.swiggyPrice ?? '',
      r.zeptoPrice ?? ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvData.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MOP_Analysis_${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <CommonContainer title="MOP Analysis">
      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f8fafc', minHeight: '100vh' }}>


        {/* ─── Header & Top Filter Section ─── */}
        <Card
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2,
              mb: 2
            }}
          >
            {/* Title */}
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                Market Operating Price Analysis :
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                Track platform-level minimum selling prices against T1/T2 MOP guidelines.
              </Typography>
            </Box>

            {/* Filter Dropdowns (E-Com Naming & Code) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {/* E-Com Naming Dropdown */}
              <MultiSelectSearchDropdown
                label="E-Com Naming"
                options={ecomOptions}
                value={selectedEcom}
                onChange={(val) => {
                  setSelectedEcom(val);
                  setPage(1);
                }}
                minWidth={180}
              />

              {/* Code Dropdown */}
              <MultiSelectSearchDropdown
                label="Code"
                options={codeOptions}
                value={selectedCode}
                onChange={(val) => {
                  setSelectedCode(val);
                  setPage(1);
                }}
                minWidth={180}
              />

              {/* CSV Export Button */}
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportCSV}
                disabled={rows.length === 0}
                sx={{
                  borderRadius: '8px',
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  px: 2,
                  py: 0.8,
                  '&:hover': {
                    borderColor: '#94a3b8',
                    bgcolor: '#f8fafc'
                  }
                }}
              >
                Export CSV
              </Button>
            </Box>
          </Box>

          {/* Quick Search & Mandatory Note */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1.5,
              pt: 1,
              borderTop: '1px dashed #e2e8f0'
            }}
          >
            {/* Search Input */}
            <TextField
              size="small"
              placeholder="Search by code or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#94a3b8', fontSize: '1.1rem' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: { xs: '100%', sm: 300 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  fontSize: '13px',
                  bgcolor: '#f8fafc'
                }
              }}
            />

            {/* Mandatory Note matching screenshot exact text */}
            <Typography
              variant="caption"
              sx={{
                fontStyle: 'italic',
                fontWeight: 700,
                color: '#334155',
                textAlign: { xs: 'left', sm: 'right' }
              }}
            >
              *Blanks in the data indicates that the particular SKU is OOS on a particular day Pan India
            </Typography>
          </Box>
        </Card>

        {/* ─── Main Table Section ─── */}
        <Card
          elevation={0}
          sx={{
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}
        >
          <TableContainer sx={{ maxHeight: 'calc(100vh - 320px)' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    Code
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5, minWidth: 200 }}>
                    Product
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    MRP
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    T1 MOP
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    T2 MOP
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    Amazon Price
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    Blinkit Price
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    BigBasket Price
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    Flipkart Price
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    Swiggy Price
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '12px', color: '#1e293b', bgcolor: '#f8fafc', py: 1.5 }}>
                    Zepto Price
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, idx) => (
                    <TableRow key={idx}>
                      {Array.from({ length: 12 }).map((__, cIdx) => (
                        <TableCell key={cIdx} sx={{ py: 1.2 }}>
                          <Skeleton variant="text" height={20} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                      <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                        No MOP Analysis data found for the selected filters.
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
                        Try clearing or adjusting your date range or filter selections.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row, index) => (
                    <TableRow
                      key={`${row.code}-${row.date}-${index}`}
                      hover
                      sx={{
                        '&:nth-of-type(even)': { bgcolor: '#fcfcfd' },
                        '&:hover': { bgcolor: '#f1f5f9' },
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Date */}
                      <TableCell sx={{ fontSize: '13px', color: '#334155', py: 1.2 }}>
                        {formatDate(row.date)}
                      </TableCell>

                      {/* Code */}
                      <TableCell sx={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', py: 1.2 }}>
                        {row.code}
                      </TableCell>

                      {/* Product */}
                      <TableCell sx={{ fontSize: '13px', color: '#334155', py: 1.2, maxWidth: 260 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '13px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={row.product}
                        >
                          {row.product}
                        </Typography>
                      </TableCell>

                      {/* MRP */}
                      <TableCell align="right" sx={{ fontSize: '13px', color: '#334155', py: 1.2, fontWeight: 500 }}>
                        {row.mrp != null ? Number(row.mrp) : ''}
                      </TableCell>

                      {/* T1 MOP */}
                      <TableCell align="right" sx={{ fontSize: '13px', color: '#334155', py: 1.2, fontWeight: 500 }}>
                        {row.t1Mop != null ? Number(row.t1Mop) : ''}
                      </TableCell>

                      {/* T2 MOP */}
                      <TableCell align="right" sx={{ fontSize: '13px', color: '#334155', py: 1.2, fontWeight: 500 }}>
                        {row.t2Mop != null ? Number(row.t2Mop) : ''}
                      </TableCell>

                      {/* Amazon Price */}
                      <TableCell align="right" sx={{ py: 1.2 }}>
                        {renderPriceCell(row.amazonPrice, row.t1Mop, row.t2Mop)}
                      </TableCell>

                      {/* Blinkit Price */}
                      <TableCell align="right" sx={{ py: 1.2 }}>
                        {renderPriceCell(row.blinkitPrice, row.t1Mop, row.t2Mop)}
                      </TableCell>

                      {/* BigBasket Price */}
                      <TableCell align="right" sx={{ py: 1.2 }}>
                        {renderPriceCell(row.bigbasketPrice, row.t1Mop, row.t2Mop)}
                      </TableCell>

                      {/* Flipkart Price */}
                      <TableCell align="right" sx={{ py: 1.2 }}>
                        {renderPriceCell(row.flipkartPrice, row.t1Mop, row.t2Mop)}
                      </TableCell>

                      {/* Swiggy Price */}
                      <TableCell align="right" sx={{ py: 1.2 }}>
                        {renderPriceCell(row.swiggyPrice, row.t1Mop, row.t2Mop)}
                      </TableCell>

                      {/* Zepto Price */}
                      <TableCell align="right" sx={{ py: 1.2 }}>
                        {renderPriceCell(row.zeptoPrice, row.t1Mop, row.t2Mop)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ─── Pagination Footer ─── */}
          <Box
            sx={{
              px: 3,
              py: 2,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
              borderTop: '1px solid #f1f5f9',
              bgcolor: '#ffffff'
            }}
          >
            <Typography sx={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              Showing {totalRows > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, totalRows)} of {totalRows} records
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Rows per page selector */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '13px', color: '#64748b' }}>Rows per page:</Typography>
                <Select
                  size="small"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value);
                    setPage(1);
                  }}
                  sx={{
                    borderRadius: '8px',
                    fontSize: '13px',
                    height: 32,
                    '& .MuiSelect-select': { py: 0.5, px: 1 }
                  }}
                >
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </Box>

              {/* Prev / Next Pagination buttons */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton
                  disabled={page <= 1}
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', p: 0.6 }}
                >
                  <ChevronLeftIcon sx={{ fontSize: '1.2rem' }} />
                </IconButton>

                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', px: 1 }}>
                  {page} / {totalPages}
                </Typography>

                <IconButton
                  disabled={page >= totalPages}
                  onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', p: 0.6 }}
                >
                  <ChevronRightIcon sx={{ fontSize: '1.2rem' }} />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Card>
      </Box>
    </CommonContainer>
  );
}
