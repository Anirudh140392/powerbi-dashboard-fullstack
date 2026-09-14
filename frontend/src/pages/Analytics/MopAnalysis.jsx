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
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
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

  // Format date string to DD/MM/YYYY for UI display matching user requirement (dd/mm/yyyy)
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = dayjs(dateStr);
    return d.isValid() ? d.format('DD/MM/YYYY') : dateStr;
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

  // Helper to get styled price value for Excel export with red and blue breach formatting
  const getPriceExportStyle = (price, t1Mop, t2Mop) => {
    if (price === null || price === undefined || price === '' || Number(price) === 0) {
      return { text: '', style: 'text-align: right;' };
    }
    const numPrice = Number(price);
    const numT1 = t1Mop !== null && t1Mop !== undefined ? Number(t1Mop) : null;
    const numT2 = t2Mop !== null && t2Mop !== undefined ? Number(t2Mop) : null;

    let color = '#334155';
    let fontWeight = '500';

    if (numT2 !== null && numPrice < numT2) {
      color = '#ef4444'; // Red for T2 breach
      fontWeight = '700';
    } else if (numT1 !== null && numPrice < numT1) {
      color = '#2563eb'; // Blue for T1 breach
      fontWeight = '700';
    }

    return {
      text: numPrice.toFixed(2),
      style: `color: ${color}; font-weight: ${fontWeight}; text-align: right;`
    };
  };

  // Export table to native .xlsx format retaining red and blue colour formatting and dd/mm/yyyy dates
  const handleExportExcel = async () => {
    const dataToExport = filteredRows.length > 0 ? filteredRows : rows;
    if (dataToExport.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Trailytics';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('MOP Analysis');

      // Define columns and widths
      worksheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Code', key: 'code', width: 20 },
        { header: 'Product', key: 'product', width: 38 },
        { header: 'MRP', key: 'mrp', width: 12 },
        { header: 'T1 MOP', key: 't1Mop', width: 12 },
        { header: 'T2 MOP', key: 't2Mop', width: 12 },
        { header: 'Amazon Price', key: 'amazonPrice', width: 15 },
        { header: 'Blinkit Price', key: 'blinkitPrice', width: 15 },
        { header: 'BigBasket Price', key: 'bigbasketPrice', width: 15 },
        { header: 'Flipkart Price', key: 'flipkartPrice', width: 15 },
        { header: 'Swiggy Price', key: 'swiggyPrice', width: 15 },
        { header: 'Zepto Price', key: 'zeptoPrice', width: 15 }
      ];

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      // Populate data rows
      dataToExport.forEach((r) => {
        const dateVal = formatDate(r.date);
        const row = worksheet.addRow({
          date: dateVal,
          code: r.code || '',
          product: r.product || '',
          mrp: r.mrp != null ? Number(r.mrp) : '',
          t1Mop: r.t1Mop != null ? Number(r.t1Mop) : '',
          t2Mop: r.t2Mop != null ? Number(r.t2Mop) : '',
          amazonPrice: r.amazonPrice != null && Number(r.amazonPrice) > 0 ? Number(r.amazonPrice) : '',
          blinkitPrice: r.blinkitPrice != null && Number(r.blinkitPrice) > 0 ? Number(r.blinkitPrice) : '',
          bigbasketPrice: r.bigbasketPrice != null && Number(r.bigbasketPrice) > 0 ? Number(r.bigbasketPrice) : '',
          flipkartPrice: r.flipkartPrice != null && Number(r.flipkartPrice) > 0 ? Number(r.flipkartPrice) : '',
          swiggyPrice: r.swiggyPrice != null && Number(r.swiggyPrice) > 0 ? Number(r.swiggyPrice) : '',
          zeptoPrice: r.zeptoPrice != null && Number(r.zeptoPrice) > 0 ? Number(r.zeptoPrice) : ''
        });

        row.height = 20;

        // Alignment
        row.getCell('date').alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell('code').alignment = { vertical: 'middle', horizontal: 'left' };
        row.getCell('product').alignment = { vertical: 'middle', horizontal: 'left' };

        // Number format for MRP, T1, T2
        ['mrp', 't1Mop', 't2Mop'].forEach((colKey) => {
          const cell = row.getCell(colKey);
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (cell.value !== '') cell.numFmt = '0.00';
        });

        const numT1 = r.t1Mop != null ? Number(r.t1Mop) : null;
        const numT2 = r.t2Mop != null ? Number(r.t2Mop) : null;

        // Platform price columns
        const platformKeys = [
          { key: 'amazonPrice', val: r.amazonPrice },
          { key: 'blinkitPrice', val: r.blinkitPrice },
          { key: 'bigbasketPrice', val: r.bigbasketPrice },
          { key: 'flipkartPrice', val: r.flipkartPrice },
          { key: 'swiggyPrice', val: r.swiggyPrice },
          { key: 'zeptoPrice', val: r.zeptoPrice }
        ];

        platformKeys.forEach(({ key, val }) => {
          const cell = row.getCell(key);
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (val !== null && val !== undefined && val !== '' && Number(val) > 0) {
            const numPrice = Number(val);
            cell.numFmt = '0.00';

            if (numT2 !== null && numPrice < numT2) {
              // T2 breach -> Red
              cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFEF4444' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
            } else if (numT1 !== null && numPrice < numT1) {
              // T1 breach -> Blue
              cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF2563EB' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
            } else {
              cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
            }
          } else {
            cell.value = '';
          }
        });

        // Grid borders
        row.eachCell((cell) => {
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `MOP_Analysis_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel report:', err);
    }
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

              {/* Report Export Button (Styled Excel with Red/Blue Breach formatting) */}
              <Button
                variant="contained"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportExcel}
                disabled={rows.length === 0}
                sx={{
                  borderRadius: '8px',
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  px: 2,
                  py: 0.8,
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  '&:hover': {
                    bgcolor: '#1d4ed8'
                  }
                }}
              >
                Export Report
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
