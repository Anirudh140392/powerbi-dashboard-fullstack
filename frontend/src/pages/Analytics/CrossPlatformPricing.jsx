import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  FormControl,
  Select,
  MenuItem
} from '@mui/material';
import {
  Search as SearchIcon,
  WarningAmber as WarningIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FileDownload as FileDownloadIcon,
  FilterList as FilterListIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  Storefront as StorefrontIcon,
  LocationOn as LocationOnIcon,
  Apartment as ApartmentIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import CommonContainer from '../../components/CommonLayout/CommonContainer';
import { FilterContext } from '../../utils/FilterContext';
import axiosInstance from '../../api/axiosInstance';

const SkuImage = ({ imageUrl, alt }) => {
  const [imgError, setImgError] = useState(false);

  if (!imageUrl || imgError) {
    return <StorefrontIcon sx={{ color: '#94a3b8', fontSize: '1.2rem' }} />;
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      onError={() => setImgError(true)}
    />
  );
};

const getPlatformColor = (pName) => {
  const norm = String(pName || '').toLowerCase();
  if (norm.includes('blinkit')) return { bg: '#fef08a', border: '#eab308', text: '#854d0e' };
  if (norm.includes('instamart') || norm.includes('swiggy')) return { bg: '#ffedd5', border: '#f97316', text: '#9a3412' };
  if (norm.includes('zepto')) return { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' };
  if (norm.includes('amazon')) return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' };
  if (norm.includes('flipkart')) return { bg: '#e0f2fe', border: '#0ea5e9', text: '#0369a1' };
  return { bg: '#f1f5f9', border: '#94a3b8', text: '#334155' };
};

export default function CrossPlatformPricing() {
  const { timeStart, timeEnd } = useContext(FilterContext) || {};

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ cities: [], platforms: [], skus: [] });
  const [selectedCity, setSelectedCity] = useState('All');
  const [breachesOnly, setBreachesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const cityScrollRef = useRef(null);

  const scrollCities = (direction) => {
    if (cityScrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      cityScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const startDateStr = timeStart ? dayjs(timeStart).format('YYYY-MM-DD') : undefined;
  const endDateStr = timeEnd ? dayjs(timeEnd).format('YYYY-MM-DD') : undefined;

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get('/watchtower/cross-platform-pricing', {
          params: {
            startDate: startDateStr,
            endDate: endDateStr,
            location: selectedCity === 'All' ? undefined : selectedCity,
            search: searchQuery || undefined,
            breachesOnly: breachesOnly ? 'true' : undefined
          }
        });
        if (isMounted && res.data) {
          setData(res.data);
          if (selectedCity === 'All' && res.data.cities && res.data.cities.length > 0) {
            setSelectedCity(res.data.cities[0].name);
          }
        }
      } catch (err) {
        console.error('Failed to fetch cross platform pricing data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [startDateStr, endDateStr, selectedCity, searchQuery, breachesOnly]);

  // Calculate pagination
  const totalSkus = data.skus ? data.skus.length : 0;
  const totalPages = Math.ceil(totalSkus / rowsPerPage) || 1;
  const paginatedSkus = useMemo(() => {
    const startIdx = (page - 1) * rowsPerPage;
    return (data.skus || []).slice(startIdx, startIdx + rowsPerPage);
  }, [data.skus, page]);

  const activePlatforms = useMemo(() => {
    if (data.platforms && data.platforms.length > 0) {
      return data.platforms;
    }
    return ['Blinkit', 'Instamart', 'Zepto'];
  }, [data.platforms]);

  // Dynamic minimum table width based on platform count to avoid cluttering and enforce smooth horizontal scrolling
  const tableMinWidth = useMemo(() => {
    return Math.max(1240, 320 + 140 + activePlatforms.length * 260);
  }, [activePlatforms.length]);

  return (
    <CommonContainer title="Cross Platform Pricing">
      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
        
        {/* Header Breadcrumbs */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cross Platform
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>/</Typography>
            <Typography variant="caption" sx={{ color: '#0f172a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cross Platform Pricing
            </Typography>
          </Box>
        </Box>

        {/* Main Card Container */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', bgcolor: '#ffffff', overflow: 'hidden' }}>
          
          {/* Card Top Title Bar */}
          <Box sx={{ px: 3, pt: 3, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a', fontFamily: "'DM Sans', sans-serif" }}>
                SKUs Cross Platform Pricing
              </Typography>
              {activePlatforms.length > 3 && (
                <Chip
                  label="← Scroll Horizontally →"
                  size="small"
                  sx={{
                    bgcolor: '#eff6ff',
                    color: '#0284c7',
                    fontWeight: 700,
                    fontSize: '11px',
                    height: 22,
                    border: '1px solid #bae6fd'
                  }}
                />
              )}
            </Box>

            {/* Breaches Filter Toggle & Search */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                variant={breachesOnly ? "contained" : "outlined"}
                onClick={() => { setBreachesOnly(!breachesOnly); setPage(1); }}
                startIcon={<WarningIcon sx={{ color: breachesOnly ? '#ffffff' : '#d97706', fontSize: '1.1rem' }} />}
                sx={{
                  bgcolor: breachesOnly ? '#d97706' : '#fffbeb',
                  color: breachesOnly ? '#ffffff' : '#92400e',
                  borderColor: '#fcd34d',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  borderRadius: '10px',
                  px: 2,
                  py: 0.8,
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: breachesOnly ? '#b45309' : '#fef3c7',
                    borderColor: '#f59e0b',
                    boxShadow: 'none'
                  }
                }}
              >
                Breaches
              </Button>

              <TextField
                placeholder="Search SKU..."
                size="small"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <SearchIcon sx={{ color: '#94a3b8', fontSize: '1.2rem' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  width: { xs: 160, sm: 220 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    bgcolor: '#f8fafc',
                    fontSize: '13px',
                    '& fieldset': { borderColor: '#e2e8f0' },
                    '&:hover fieldset': { borderColor: '#cbd5e1' },
                    '&.Mui-focused fieldset': { borderColor: '#0284c7' }
                  }
                }}
              />
            </Box>
          </Box>

          {/* Sleek Non-Block City Location Segment Bar */}
          <Box
            sx={{
              px: 3,
              py: 1.5,
              bgcolor: '#f8fafc',
              borderTop: '1px solid #f1f5f9',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap'
            }}
          >
            {/* Left: Location Label & Horizontal Chip Strip */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
                <LocationOnIcon sx={{ fontSize: '1.2rem', color: '#0284c7' }} />
                <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  City:
                </Typography>
              </Box>

              {/* Scrollable Chip Tabs (Non-block Pills) */}
              <Box
                ref={cityScrollRef}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  '&::-webkit-scrollbar': { display: 'none' },
                  py: 0.5
                }}
              >
                {data.cities && data.cities.map((c) => {
                  const isSelected = selectedCity?.toLowerCase() === c.name?.toLowerCase();
                  const isHighBreach = c.breaches > 75;

                  return (
                    <Box
                      key={c.name}
                      onClick={() => { setSelectedCity(c.name); setPage(1); }}
                      sx={{
                        flexShrink: 0,
                        cursor: 'pointer',
                        px: 2.2,
                        py: 0.9,
                        borderRadius: '24px',
                        background: isSelected
                          ? 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)'
                          : '#ffffff',
                        color: isSelected ? '#ffffff' : '#1e293b',
                        border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        fontWeight: isSelected ? 800 : 600,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: isSelected
                          ? '0 4px 14px rgba(2, 132, 199, 0.35)'
                          : '0 1px 3px rgba(0,0,0,0.03)',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          bgcolor: isSelected ? undefined : '#f8fafc',
                          borderColor: isSelected ? '#0284c7' : '#94a3b8'
                        }
                      }}
                    >
                      <span>{c.name}</span>

                      {/* Integrated Micro Breach Badge inside Pill */}
                      <Box
                        sx={{
                          px: 1,
                          py: 0.2,
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800,
                          bgcolor: isSelected
                            ? 'rgba(255, 255, 255, 0.25)'
                            : (isHighBreach ? '#ffe4e6' : '#fffbeb'),
                          color: isSelected
                            ? '#ffffff'
                            : (isHighBreach ? '#be123c' : '#b45309'),
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.4
                        }}
                      >
                        <WarningIcon sx={{ fontSize: '0.75rem', color: isSelected ? '#ffffff' : (isHighBreach ? '#e11d48' : '#d97706') }} />
                        <span>{c.breaches}</span>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Right Controls: Quick Dropdown Select + Scroll Buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={selectedCity}
                  onChange={(e) => { setSelectedCity(e.target.value); setPage(1); }}
                  sx={{
                    borderRadius: '20px',
                    bgcolor: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0f172a',
                    height: 34,
                    '& fieldset': { borderColor: '#cbd5e1' },
                    '&:hover fieldset': { borderColor: '#0284c7' }
                  }}
                >
                  {data.cities && data.cities.map((c) => (
                    <MenuItem key={c.name} value={c.name} sx={{ fontSize: '12px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <span>{c.name}</span>
                      <Chip
                        label={`${c.breaches} breaches`}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '10px',
                          fontWeight: 800,
                          bgcolor: c.breaches > 75 ? '#ffe4e6' : '#fffbeb',
                          color: c.breaches > 75 ? '#e11d48' : '#b45309'
                        }}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={() => scrollCities('left')}
                  sx={{ bgcolor: '#ffffff', border: '1px solid #cbd5e1', width: 32, height: 32, '&:hover': { bgcolor: '#e2e8f0' } }}
                >
                  <ChevronLeftIcon sx={{ fontSize: '1.1rem', color: '#334155' }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => scrollCities('right')}
                  sx={{ bgcolor: '#ffffff', border: '1px solid #cbd5e1', width: 32, height: 32, '&:hover': { bgcolor: '#e2e8f0' } }}
                >
                  <ChevronRightIcon sx={{ fontSize: '1.1rem', color: '#334155' }} />
                </IconButton>
              </Box>
            </Box>
          </Box>

          {/* Pricing Matrix Table */}
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 0,
              overflowX: 'auto',
              maxWidth: '100%',
              scrollbarWidth: 'thin',
              scrollbarColor: '#94a3b8 #f1f5f9',
              '&::-webkit-scrollbar': { height: '10px' },
              '&::-webkit-scrollbar-track': { bgcolor: '#f1f5f9' },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: '#94a3b8',
                borderRadius: '5px',
                border: '2px solid #f1f5f9',
                '&:hover': { bgcolor: '#64748b' }
              }
            }}
          >
            <Table sx={{ minWidth: tableMinWidth, tableLayout: 'fixed' }} aria-label="cross platform pricing table">
              
              {/* Header Group Row */}
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell
                    rowSpan={2}
                    sx={{
                      fontWeight: 800,
                      color: '#475569',
                      fontSize: '12px',
                      py: 1.8,
                      minWidth: 320,
                      width: 320,
                      borderBottom: '2px solid #e2e8f0',
                      position: 'sticky',
                      left: 0,
                      zIndex: 3,
                      bgcolor: '#f8fafc',
                      boxShadow: '3px 0 6px -2px rgba(0,0,0,0.08)'
                    }}
                  >
                    SKU
                  </TableCell>
                  <TableCell
                    rowSpan={2}
                    sx={{
                      fontWeight: 800,
                      color: '#475569',
                      fontSize: '12px',
                      py: 1.8,
                      minWidth: 140,
                      width: 140,
                      borderBottom: '2px solid #e2e8f0',
                      borderLeft: '1px solid #e2e8f0',
                      textAlign: 'center',
                      bgcolor: '#f8fafc'
                    }}
                  >
                    Max Discount<br />Platform
                  </TableCell>
                  
                  {/* Platform Headers */}
                  {activePlatforms.map((pName) => (
                    <TableCell
                      key={pName}
                      colSpan={2}
                      align="center"
                      sx={{
                        fontWeight: 800,
                        color: '#1e293b',
                        fontSize: '13px',
                        py: 1.2,
                        borderBottom: '1px solid #e2e8f0',
                        borderLeft: '1px solid #e2e8f0',
                        bgcolor: '#f1f5f9'
                      }}
                    >
                      {pName}
                    </TableCell>
                  ))}
                </TableRow>

                {/* Sub Header Row */}
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  {activePlatforms.map((pName) => (
                    <React.Fragment key={`${pName}-sub`}>
                      <TableCell align="center" sx={{ fontWeight: 700, color: '#64748b', fontSize: '11px', py: 1, borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', minWidth: 120, width: 120 }}>
                        Guardrail
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: '#64748b', fontSize: '11px', py: 1, borderBottom: '2px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', minWidth: 140, width: 140 }}>
                        Discount / SP
                      </TableCell>
                    </React.Fragment>
                  ))}
                </TableRow>
              </TableHead>

              {/* Table Body */}
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ minWidth: 320, width: 320, position: 'sticky', left: 0, zIndex: 2, bgcolor: '#ffffff' }}><Skeleton variant="rectangular" height={40} borderRadius={8} /></TableCell>
                      <TableCell sx={{ minWidth: 140, width: 140 }}><Skeleton variant="text" /></TableCell>
                      {activePlatforms.map((p) => (
                        <React.Fragment key={p}>
                          <TableCell sx={{ minWidth: 120, width: 120 }}><Skeleton variant="text" /></TableCell>
                          <TableCell sx={{ minWidth: 140, width: 140 }}><Skeleton variant="text" /></TableCell>
                        </React.Fragment>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedSkus.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2 + activePlatforms.length * 2} align="center" sx={{ py: 6 }}>
                      <Typography sx={{ color: '#64748b', fontWeight: 600 }}>
                        No SKU pricing data found for the selected city and filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSkus.map((item, index) => (
                    <TableRow
                      key={`${item.sku}-${index}`}
                      sx={{
                        '&:hover': { bgcolor: '#f8fafc' },
                        '&:hover .sticky-sku-cell': { bgcolor: '#f8fafc' },
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* SKU Column */}
                      <TableCell
                        className="sticky-sku-cell"
                        sx={{
                          py: 2,
                          minWidth: 320,
                          width: 320,
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                          bgcolor: '#ffffff',
                          borderRight: '1px solid #e2e8f0',
                          boxShadow: '3px 0 6px -2px rgba(0,0,0,0.06)',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 42,
                              height: 42,
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              bgcolor: '#f8fafc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              overflow: 'hidden'
                            }}
                          >
                            <SkuImage imageUrl={item.imageUrl} alt={item.sku} />
                          </Box>

                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', lineHeight: 1.3 }}>
                              {item.sku}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              {item.weight && (
                                <Chip
                                  label={`🧴 ${item.weight}`}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    bgcolor: '#f1f5f9',
                                    color: '#475569',
                                    borderRadius: '6px'
                                  }}
                                />
                              )}
                              {item.mrp > 0 && (
                                <Chip
                                  label={`₹ ${item.mrp}`}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    bgcolor: '#e0f2fe',
                                    color: '#0369a1',
                                    borderRadius: '6px'
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Max Discount Platform Column */}
                      <TableCell align="center" sx={{ py: 2, borderLeft: '1px solid #e2e8f0', minWidth: 140, width: 140 }}>
                        {item.maxDiscountPlatform !== '-' ? (
                          <Chip
                            label={item.maxDiscountPlatform}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '12px',
                              bgcolor: getPlatformColor(item.maxDiscountPlatform).bg,
                              color: getPlatformColor(item.maxDiscountPlatform).text,
                              border: `1px solid ${getPlatformColor(item.maxDiscountPlatform).border}`,
                              borderRadius: '8px'
                            }}
                          />
                        ) : (
                          <Typography sx={{ color: '#94a3b8', fontSize: '13px' }}>-</Typography>
                        )}
                      </TableCell>

                      {/* Platform Columns */}
                      {activePlatforms.map((pName) => {
                        const pfVal = item.platformData ? item.platformData[pName] : null;
                        const isBreaching = pfVal && pfVal.isBreaching;
                        const isOutOfStock = pfVal && pfVal.outOfStock;

                        return (
                          <React.Fragment key={`${item.sku}-${pName}`}>
                            {/* Guardrail Sub-Column */}
                            <TableCell
                              align="center"
                              sx={{
                                py: 2,
                                borderLeft: '1px solid #e2e8f0',
                                minWidth: 120,
                                width: 120,
                                bgcolor: isBreaching ? 'rgba(254, 226, 226, 0.4)' : 'transparent'
                              }}
                            >
                              <Typography sx={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>
                                0 - 20%
                              </Typography>
                              <Typography sx={{ fontSize: '10px', color: '#0284c7', fontWeight: 500 }}>
                                Discount %
                              </Typography>
                            </TableCell>

                            {/* Discount / SP Sub-Column */}
                            <TableCell
                              align="center"
                              sx={{
                                py: 2,
                                borderLeft: '1px solid #e2e8f0',
                                minWidth: 140,
                                width: 140,
                                bgcolor: isBreaching ? 'rgba(254, 226, 226, 0.7)' : 'transparent'
                              }}
                            >
                              {!pfVal ? (
                                <Typography sx={{ color: '#94a3b8', fontSize: '13px' }}>-</Typography>
                              ) : isOutOfStock ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <Chip
                                    label="Out Of Stock"
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      bgcolor: '#f1f5f9',
                                      color: '#64748b',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px'
                                    }}
                                  />
                                  <Typography sx={{ fontSize: '12px', color: '#94a3b8', mt: 0.5 }}>--</Typography>
                                </Box>
                              ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.2 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                                    <Typography
                                      sx={{
                                        fontWeight: 800,
                                        fontSize: '13px',
                                        color: isBreaching ? '#dc2626' : '#0f172a'
                                      }}
                                    >
                                      {pfVal.discount}%
                                    </Typography>
                                    {isBreaching && (
                                      <Tooltip title="Discount exceeds maximum guardrail limit (20%)">
                                        <WarningIcon sx={{ fontSize: '0.9rem', color: '#dc2626' }} />
                                      </Tooltip>
                                    )}
                                  </Box>

                                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                                    ₹ {pfVal.sp}
                                  </Typography>
                                </Box>
                              )}
                            </TableCell>
                          </React.Fragment>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Table Footer Pagination */}
          <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
            <Typography sx={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              Showing {totalSkus > 0 ? (page - 1) * rowsPerPage + 1 : 0} - {Math.min(page * rowsPerPage, totalSkus)} of {totalSkus} SKUs
            </Typography>

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

        </Card>
      </Box>
    </CommonContainer>
  );
}
