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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

// Hardcoded trend data
const trendDataHardcoded = [
  { date: "06 Sep'25", offtake: 41.5, osa: 88, categoryShare: 53.2, discount: 12, sov: 35 },
  { date: "10 Sep'25", offtake: 44.2, osa: 87, categoryShare: 54.8, discount: 13, sov: 36 },
  { date: "14 Sep'25", offtake: 42.8, osa: 86, categoryShare: 52.1, discount: 11, sov: 34 },
  { date: "18 Sep'25", offtake: 38.5, osa: 85, categoryShare: 50.5, discount: 10, sov: 33 },
  { date: "22 Sep'25", offtake: 59.2, osa: 89, categoryShare: 58.3, discount: 15, sov: 42 },
  { date: "26 Sep'25", offtake: 48.5, osa: 87, categoryShare: 55.7, discount: 13, sov: 38 },
  { date: "30 Sep'25", offtake: 35.8, osa: 84, categoryShare: 49.2, discount: 9, sov: 31 }
];

const CategoryTrendsDrawer = ({ open = false, onClose = () => {} }) => {
  const [activeTab, setActiveTab] = useState('trends'); // 'trends', 'competition', 'crossPlatform'

  // Trends
  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  const [timeStep, setTimeStep] = useState('Daily');
  const [selectedMetrics, setSelectedMetrics] = useState({
    offtake: true,
    estCategoryShare: false,
    osa: false,
    discount: false,
    overallSOV: false
  });

  // Competition
  const [competitionView, setCompetitionView] = useState('brands'); // 'brands' or 'skus'
  const [competitionCity, setCompetitionCity] = useState('All x Chennai');
  const [competitionGrammage, setCompetitionGrammage] = useState('Grammage');
  const [searchTerm, setSearchTerm] = useState('');

  const handleMetricToggle = (key) => {
    setSelectedMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <Box sx={{
          bgcolor: '#fff',
          color: '#000',
          px: 2,
          py: 1.5,
          borderRadius: 1.5,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb',
          minWidth: 200
        }}>
          <Box sx={{ mb: 1.5, pb: 1, borderBottom: '1px solid #e5e7eb' }}>
            <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.7rem' }}>
              {payload[0].payload.date}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.65rem', ml: 1, display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
              ⏱ <span>Avg: last weekly</span>
            </Typography>
          </Box>
          {selectedMetrics.offtake && payload[0].payload.offtake && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>Estimated Offtake</Typography>
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                ₹ {payload[0].payload.offtake.toFixed(1)} lac <span style={{ color: '#10b981', marginLeft: 6, fontSize: '0.7rem' }}>(+6.6%)</span>
              </Typography>
            </Box>
          )}
          {selectedMetrics.osa && payload[0].payload.osa && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981' }} />
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>Avg. OSA %</Typography>
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                ~({payload[0].payload.osa.toFixed(0)}%)
              </Typography>
            </Box>
          )}
        </Box>
      );
    }
    return null;
  };

  const metricsList = [
    { key: 'offtake', label: 'Estimated Offtake', color: '#ef4444' },
    { key: 'estCategoryShare', label: 'Est. Cat. Share', color: '#a855f7' },
    { key: 'osa', label: 'Indexed Imp.', color: '#10b981' },
    { key: 'discount', label: 'Indexed CVR', color: '#3b82f6' },
    { key: 'overallSOV', label: 'ASP', color: '#ec4899' }
  ];

  // Brand data (unchanged)
  const brandData = [
    { name: 'Colgate', categoryShare: 32.9, categoryShareChange: -4.5, osa: 74.6, osaChange: -18.3, sov: 20.0, sovChange: -6.6, adSov: 18.8, adSovChange: 0.4 },
    { name: 'Sensodyne', categoryShare: 19.6, categoryShareChange: 2.2, osa: 94.2, osaChange: 3.9, sov: 19.3, sovChange: 2.7, adSov: 18.5, adSovChange: -3.1 },
    { name: 'Oral-B', categoryShare: 11.7, categoryShareChange: -0.9, osa: 86.7, osaChange: -4.2, sov: 16.2, sovChange: -2.8, adSov: 20.8, adSovChange: -5.6 },
    { name: 'Dabur', categoryShare: 8.6, categoryShareChange: 0.2, osa: 90.6, osaChange: -1.2, sov: 7.2, sovChange: 0.3, adSov: 7.4, adSovChange: 2.9 },
    { name: 'Listerine', categoryShare: 4.3, categoryShareChange: 0.6, osa: 91.8, osaChange: 6.5, sov: 2.8, sovChange: 0.8, adSov: 3.1, adSovChange: 1.2 },
    { name: 'Closeup', categoryShare: 3.6, categoryShareChange: 0.2, osa: 90.9, osaChange: 9.8, sov: 6.5, sovChange: 3.0, adSov: 13.8, adSovChange: 4.9 },
    { name: 'Perfora', categoryShare: 3.6, categoryShareChange: -0.7, osa: 89.8, osaChange: 2.5, sov: 3.6, sovChange: -0.1, adSov: 4.7, adSovChange: -1.4 }
  ];

  // SKU data extended with pricing & rating fields for the unified table
  const skuData = [
    {
      name: 'Colgate Strong Teeth Anticavity Toothpaste',
      grammage: '150 g',
      ppu: 131, // display as ₹131
      mrp: 204.8,
      price: 159,
      avgRating: 4.71,
      ratingCount: 8681,
      categoryShare: 3.5,
      categoryShareChange: -1.4,
      wtOsa: 79.3,
      osaChange: -20.1,
      overallSov: 5.5,
      sovChange: -4.4,
      adSov: 0.0,
      adSovChange: 0.0,
      wtDiscount: 24.0,
      conversion: 0.95,
      cvr: 0.012,
      indexedConversion: 1.05,
      asp: 131
    },
    {
      name: 'Sensodyne Deep Clean Sensitive Toothpaste',
      grammage: '70 g',
      ppu: 49,
      mrp: 60,
      price: 49,
      avgRating: 4.65,
      ratingCount: 13855,
      categoryShare: 3.2,
      categoryShareChange: -0.4,
      wtOsa: 96.9,
      osaChange: 4.6,
      overallSov: 7.0,
      sovChange: 2.5,
      adSov: 11.7,
      adSovChange: 5.2,
      wtDiscount: 27.2,
      conversion: 1.2,
      cvr: 0.015,
      indexedConversion: 1.1,
      asp: 60
    },
    {
      name: 'Sensodyne Rapid Relief Sensitive Toothpaste',
      grammage: '80 g',
      ppu: 213,
      mrp: 270,
      price: 212,
      avgRating: 4.75,
      ratingCount: 3289,
      categoryShare: 3.0,
      categoryShareChange: 1.0,
      wtOsa: 91.8,
      osaChange: 4.6,
      overallSov: 1.7,
      sovChange: -1.4,
      adSov: 2.6,
      adSovChange: -5.3,
      wtDiscount: 29.9,
      conversion: 0.85,
      cvr: 0.01,
      indexedConversion: 0.95,
      asp: 212
    },
    {
      name: 'Dabur Red Herbal Toothpaste',
      grammage: '200 g',
      ppu: 135,
      mrp: 252,
      price: 202,
      avgRating: 4.77,
      ratingCount: 2312,
      categoryShare: 2.8,
      categoryShareChange: -0.4,
      wtOsa: 95.8,
      osaChange: -1.9,
      overallSov: 1.3,
      sovChange: -0.3,
      adSov: 0.2,
      adSovChange: -0.7,
      wtDiscount: 24.0,
      conversion: 1.05,
      cvr: 0.02,
      indexedConversion: 1.03,
      asp: 202
    },
    {
      name: 'Sensodyne Sensitive Toothbrush (3 pcs)',
      grammage: '1 pack (3 pieces)',
      ppu: 49,
      mrp: 60,
      price: 49,
      avgRating: 4.65,
      ratingCount: 13855,
      categoryShare: 2.6,
      categoryShareChange: 0.8,
      wtOsa: 94.3,
      osaChange: 4.8,
      overallSov: 2.5,
      sovChange: 0.5,
      adSov: 0.0,
      adSovChange: 0.0,
      wtDiscount: 22.0,
      conversion: 1.02,
      cvr: 0.011,
      indexedConversion: 1.0,
      asp: 49
    }
  ];

  // Cross Platform data
  const crossPlatformData = {
    blinkit: {
      offtake: '₹2.3 Cr',
      offtakeChange: '-1.8% (₹4.3 lac)',
      categoryShare: 35.9,
      categoryShareChange: '-5.4% (-2.0%)',
      osa: 75.4,
      osaChange: '-15.5% (-13.8%)',
      wtDiscount: '24.0%',
      discountChange: '73.3% (10.2%)',
      sov: 36.5,
      sovChange: '-7.3% (-2.9%)'
    },
    instamart: {
      offtake: '₹1.3 Cr',
      offtakeChange: '7.9% (₹9.6 lac)',
      categoryShare: 40.8,
      categoryShareChange: '3.6% (1.4%)',
      osa: 83.4,
      osaChange: '-2.7% (-2.4%)',
      wtDiscount: '27.2%',
      discountChange: '43.5% (8.3%)',
      sov: 39.7,
      sovChange: '-11.3% (-5.0%)'
    },
    zepto: {
      offtake: '₹1.5 Cr',
      offtakeChange: '1.4% (₹2.0 lac)',
      categoryShare: 44.9,
      categoryShareChange: '-0.7% (-0.3%)',
      osa: 79.7,
      osaChange: '-4.7% (-3.9%)',
      wtDiscount: '29.9%',
      discountChange: '63.1% (11.6%)',
      sov: 36.6,
      sovChange: '-3.6% (-1.4%)'
    }
  };

  const renderTrendsTab = () => (
    <>
      <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid #e5e7eb' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <FormControlLabel
            control={<Checkbox size="small" sx={{ py: 0, '& .MuiSvgIcon-root': { fontSize: 18 } }} />}
            label={<Typography sx={{ fontSize: '0.8rem', color: '#111827', fontWeight: 500 }}>Custom</Typography>}
            sx={{ mr: 1, mb: 0 }}
          />
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
                    bgcolor: '#3b82f6',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#2563eb', boxShadow: 'none' }
                  } : {
                    color: '#6b7280',
                    borderColor: '#e5e7eb',
                    bgcolor: 'transparent',
                    '&:hover': { bgcolor: '#f9fafb', borderColor: '#e5e7eb' }
                  })
                }}
              >
                {period}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
            <Typography sx={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>Time Step:</Typography>
            <FormControl size="small">
              <Select
                value={timeStep}
                onChange={(e) => setTimeStep(e.target.value)}
                IconComponent={KeyboardArrowDownIcon}
                sx={{
                  fontSize: '0.8rem',
                  height: '32px',
                  minWidth: '110px',
                  '& .MuiSelect-select': { py: 0.75, pr: 3.5, fontWeight: 500 },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb' }
                }}
              >
                <MenuItem value="Daily" sx={{ fontSize: '0.8rem' }}>Daily</MenuItem>
                <MenuItem value="Weekly" sx={{ fontSize: '0.8rem' }}>Weekly</MenuItem>
                <MenuItem value="Monthly" sx={{ fontSize: '0.8rem' }}>Monthly</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
          {metricsList.map(metric => (
            <FormControlLabel
              key={metric.key}
              control={<Checkbox size="small" checked={selectedMetrics[metric.key]} onChange={() => handleMetricToggle(metric.key)} sx={{ py: 0, pr: 0.75, '& .MuiSvgIcon-root': { fontSize: 18 } }} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: metric.color }} />
                  <Typography sx={{ fontSize: '0.8rem', color: '#111827', fontWeight: 500 }}>{metric.label}</Typography>
                </Box>
              }
              sx={{ mb: 0 }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ flex: 1, px: 2, py: 2.5, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ width: '100%', height: '100%', maxHeight: '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendDataHardcoded} margin={{ top: 10, right: 40, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} dy={10} />
              <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} domain={['auto', 'auto']} tickFormatter={(v) => `₹ ${v} lac`} dx={-5} label={{ value: 'est. Offtake', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7280' } }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} domain={['auto', 'auto']} tickFormatter={(v) => `~(${v}%)`} dx={5} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />
              {selectedMetrics.offtake && <Line yAxisId="left" type="monotone" dataKey="offtake" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3.5, fill: '#ef4444' }} activeDot={{ r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} />}
              {selectedMetrics.estCategoryShare && <Line yAxisId="right" type="monotone" dataKey="categoryShare" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 3.5, fill: '#a855f7' }} activeDot={{ r: 5, fill: '#a855f7', strokeWidth: 2, stroke: '#fff' }} />}
              {selectedMetrics.osa && <Line yAxisId="right" type="monotone" dataKey="osa" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3.5, fill: '#10b981' }} activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />}
              {selectedMetrics.discount && <Line yAxisId="right" type="monotone" dataKey="discount" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3.5, fill: '#3b82f6' }} activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />}
              {selectedMetrics.overallSOV && <Line yAxisId="right" type="monotone" dataKey="sov" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 3.5, fill: '#ec4899' }} activeDot={{ r: 5, fill: '#ec4899', strokeWidth: 2, stroke: '#fff' }} />}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </>
  );

  const renderCompetitionTab = () => (
    <>
      <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid #e5e7eb' }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant={competitionView === 'brands' ? 'contained' : 'text'}
            onClick={() => setCompetitionView('brands')}
            sx={{
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '8px',
              px: 2.5,
              py: 0.75,
              ...(competitionView === 'brands' ? {
                bgcolor: '#3b82f6',
                color: '#fff',
                '&:hover': { bgcolor: '#2563eb' }
              } : {
                color: '#6b7280',
                '&:hover': { bgcolor: '#f9fafb' }
              })
            }}
          >
            Brands
          </Button>
          <Button
            variant={competitionView === 'skus' ? 'contained' : 'text'}
            onClick={() => setCompetitionView('skus')}
            sx={{
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '8px',
              px: 2.5,
              py: 0.75,
              ...(competitionView === 'skus' ? {
                bgcolor: '#3b82f6',
                color: '#fff',
                '&:hover': { bgcolor: '#2563eb' }
              } : {
                color: '#6b7280',
                '&:hover': { bgcolor: '#f9fafb' }
              })
            }}
          >
            SKUs
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>Competition Benchmarking</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mr: 0.5 }}>for</Typography>
          <Chip label={competitionCity} size="small" sx={{ bgcolor: '#dbeafe', color: '#1e40af', height: 26, fontSize: '0.75rem', fontWeight: 600, '& .MuiChip-label': { px: 1.5 } }} />
          {competitionView === 'skus' && <Chip label={competitionGrammage} size="small" sx={{ bgcolor: '#fed7aa', color: '#9a3412', height: 26, fontSize: '0.75rem', fontWeight: 600, '& .MuiChip-label': { px: 1.5 } }} />}

          <Box sx={{ ml: 'auto', display: 'flex', gap: 1.5 }}>
            <Button startIcon={<FilterListIcon sx={{ fontSize: '18px !important' }} />} sx={{ textTransform: 'none', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600, border: '1px solid #3b82f6', borderRadius: '6px', px: 2, py: 0.5, height: '32px' }}>Filters</Button>

            <TextField
              placeholder="Search"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: '#9ca3af' }} /></InputAdornment>) }}
              sx={{ width: '200px', '& .MuiOutlinedInput-root': { height: '32px', fontSize: '0.8rem', '& fieldset': { borderColor: '#e5e7eb' } } }}
            />

            <IconButton size="small" sx={{ border: '1px solid #e5e7eb', borderRadius: '6px', width: 32, height: 32 }}>
              <FileDownloadIcon sx={{ fontSize: 18, color: '#6b7280' }} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Competition Table */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2 }}>
        {competitionView === 'brands' ? (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', py: 1.5, borderBottom: '2px solid #e5e7eb', width: '200px' }}>Brand</TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', py: 1.5, borderBottom: '2px solid #e5e7eb', width: '140px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>Est. Category Share <Box component="span" sx={{ color: '#a855f7', fontSize: '1rem' }}>↕</Box></Box>
                  </TableCell>
                  <TableCell align="center" colSpan={3} sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', py: 1.5, borderBottom: '2px solid #e5e7eb' }}>
                    Impressions
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ borderBottom: '2px solid #e5e7eb', py: 0 }}></TableCell>
                  <TableCell sx={{ borderBottom: '2px solid #e5e7eb', py: 0 }}></TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', py: 1, borderBottom: '2px solid #e5e7eb', width: '120px' }}>Wt. OSA %</TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', py: 1, borderBottom: '2px solid #e5e7eb', width: '120px' }}>Overall SOV</TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', py: 1, borderBottom: '2px solid #e5e7eb', width: '120px' }}>Ad SOV</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {brandData.map((row, index) => (
                  <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                    <TableCell sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#1f2937', py: 2, borderBottom: '1px solid #f3f4f6' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: '#fff', border: '1px solid #eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#1f2937' }}>
                          {row.name.charAt(0)}
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1f2937' }}>{row.name}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mt: 0.25 }}>{index === 0 ? 'Leader' : 'Competitor'}</Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>{row.categoryShare}%</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: row.categoryShareChange < 0 ? '#ef4444' : '#10b981', mt: 0.5 }}>{row.categoryShareChange}%</Typography>
                      </Box>
                    </TableCell>

                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>{row.osa}%</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: row.osaChange < 0 ? '#ef4444' : '#10b981', mt: 0.5 }}>{row.osaChange}%</Typography>
                      </Box>
                    </TableCell>

                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>{row.sov}%</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: row.sovChange < 0 ? '#ef4444' : '#10b981', mt: 0.5 }}>{row.sovChange}%</Typography>
                      </Box>
                    </TableCell>

                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>{row.adSov}%</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: row.adSovChange < 0 ? '#ef4444' : '#10b981', mt: 0.5 }}>{row.adSovChange}%</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          /* SKUs view: unified, horizontally scrollable with many columns */
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 1400 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>SKU</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Est. Category Share</TableCell>

                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Wt. PPU (x100)</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb', px:5 }}>MRP</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Price</TableCell>

                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Avg Rating</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Rating Count</TableCell>

                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Wt. OSA %</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Overall SOV</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Ad SOV</TableCell>

                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Wt. Discount</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Conversion</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>CVR %</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>Indexed Conversion</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>ASP</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {skuData.map((s, idx) => (
                  <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                    {/* SKU cell: image placeholder + name + grammage pill */}
                    <TableCell sx={{ py: 2, borderBottom: '1px solid #f3f4f6', minWidth: 300 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 44, height: 44, borderRadius: 1, bgcolor: '#fff', border: '1px solid #eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#1f2937' }}>
                          IMG
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>{s.name}</Typography>
                          <Box sx={{ mt: 0.5, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ bgcolor: '#fef3c7', color: '#92400e', fontSize: '0.75rem', px: 1, py: '2px', borderRadius: '6px' }}>{s.grammage}</Box>
                          </Box>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Est Category Share */}
                    <TableCell align="right" sx={{ py: 2, borderBottom: '1px solid #f3f4f6', minWidth: 110 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, px:5 }}>{s.categoryShare}%</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: s.categoryShareChange < 0 ? '#ef4444' : '#10b981', mt: 0.5,px:5 }}>{s.categoryShareChange}%</Typography>
                      </Box>
                    </TableCell>

                    {/* PPU / MRP / Price */}
                    <TableCell align="center" sx={{ py: 2, px: 5, borderBottom: '1px solid #f3f4f6' }}>₹{s.ppu}</TableCell>
                    <TableCell align="center" sx={{ py: 7,px: 5, borderBottom: '1px solid #f3f4f6', whitespace: 'nowrap' }}>₹{s.mrp}</TableCell>
                    <TableCell align="center" sx={{ py: 2,px: 5, borderBottom: '1px solid #f3f4f6' }}>₹{s.price}</TableCell>

                    {/* Rating */}
                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>{s.avgRating.toFixed(2)}</TableCell>
                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>{s.ratingCount}</TableCell>

                    {/* Wt. OSA / Overall SOV / Ad SOV */}
                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>
                      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>{s.wtOsa}%</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: s.osaChange < 0 ? '#ef4444' : '#10b981', mt: 0.25 }}>{s.osaChange}%</Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>
                      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>{s.overallSov}%</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: s.sovChange < 0 ? '#ef4444' : '#10b981', mt: 0.25 }}>{s.sovChange}%</Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>
                      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>{s.adSov}%</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: s.adSovChange < 0 ? '#ef4444' : '#10b981', mt: 0.25 }}>{s.adSovChange}%</Typography>
                    </TableCell>

                    {/* Wt. Discount */}
                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>{s.wtDiscount}%</TableCell>

                    {/* Conversion / CVR / Indexed Conversion / ASP */}
                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>{s.conversion}</TableCell>
                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>{(s.cvr * 100).toFixed(2)}%</TableCell>
                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>{s.indexedConversion}</TableCell>
                    <TableCell align="center" sx={{ py: 2, borderBottom: '1px solid #f3f4f6' }}>₹{s.asp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </>
  );

  const renderCrossPlatformTab = () => (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ px: 3, pt: 2, pb: 1.5, borderBottom: '1px solid #e5e7eb' }}>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#1f2937' }}>Cross Platform Comparison</Typography>
      </Box>

      <Box sx={{ px: 3, py: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {Object.entries(crossPlatformData).map(([key, data]) => (
            <Box key={key} sx={{ bgcolor: '#fff', borderRadius: 2, p: 2, boxShadow: '0 4px 18px rgba(15,23,42,0.04)', border: '1px solid #eef2ff', minHeight: 140 }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>{key.charAt(0).toUpperCase() + key.slice(1)}</Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '1.05rem', fontWeight: 800 }}>{data.offtake}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: data.offtakeChange.includes('-') ? '#ef4444' : '#10b981' }}>{data.offtakeChange}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '1.05rem', fontWeight: 800 }}>{data.categoryShare}%</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: data.categoryShareChange.includes('-') ? '#ef4444' : '#10b981' }}>{data.categoryShareChange}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '1.05rem', fontWeight: 800 }}>{data.osa}%</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: data.osaChange.includes('-') ? '#ef4444' : '#10b981' }}>{data.osaChange}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>Wt. Discount</Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: data.discountChange.includes('-') ? '#ef4444' : '#10b981' }}>{data.wtDiscount} • {data.discountChange}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>Overall SOV</Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: data.sovChange.includes('-') ? '#ef4444' : '#10b981' }}>{data.sov} • {data.sovChange}</Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );

  return (
    <Drawer anchor="right" open={open} onClose={() => onClose()} PaperProps={{ sx: { width: '82%', maxWidth: 1200, borderRadius: '12px 0 0 12px', overflow: 'hidden' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 2, borderBottom: '1px solid #e5e7eb' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={() => setActiveTab('trends')} sx={{ px: 2, py: 0.75, fontSize: '0.9rem', fontWeight: 700, textTransform: 'none', color: activeTab === 'trends' ? '#0f172a' : '#6b7280', bgcolor: activeTab === 'trends' ? '#eff6ff' : 'transparent', borderRadius: '999px' }}>Trends</Button>
          <Button onClick={() => setActiveTab('competition')} sx={{ px: 2, py: 0.75, fontSize: '0.9rem', fontWeight: 700, textTransform: 'none', color: activeTab === 'competition' ? '#0f172a' : '#6b7280', bgcolor: activeTab === 'competition' ? '#eff6ff' : 'transparent', borderRadius: '999px' }}>Competition</Button>
          <Button onClick={() => setActiveTab('crossPlatform')} sx={{ px: 2, py: 0.75, fontSize: '0.9rem', fontWeight: 700, textTransform: 'none', color: activeTab === 'crossPlatform' ? '#0f172a' : '#6b7280', bgcolor: activeTab === 'crossPlatform' ? '#eff6ff' : 'transparent', borderRadius: '999px' }}>Cross Platform</Button>
        </Box>

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>MTD</Typography>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>vs</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>Previous Month</Typography>
          <IconButton onClick={() => onClose()} sx={{ ml: 1 }}><CloseIcon /></IconButton>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 68px)' }}>
        {activeTab === 'trends' && renderTrendsTab()}
        {activeTab === 'competition' && renderCompetitionTab()}
        {activeTab === 'crossPlatform' && renderCrossPlatformTab()}
      </Box>
    </Drawer>
  );
};

export default CategoryTrendsDrawer;
