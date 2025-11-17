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
  FormControl
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
import TrendController from "../utils/TrendController";

const MyTrendsDrawer = ({ open, onClose, trendData = {}, trendParams = {} }) => {
  const hasRemoteData = Array.isArray(trendData.timeSeries) && trendData.timeSeries.length > 0;

  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  const [timeStep, setTimeStep] = useState('Weekly');
  const [selectedMetrics, setSelectedMetrics] = useState({
    offtake: true,
    estCategoryShare: false,
    osa: true,
    discount: false,
    overallSOV: false
  });

  const controller = new TrendController();

  const months =
    selectedPeriod === "1M" ? 1 :
    selectedPeriod === "3M" ? 3 :
    selectedPeriod === "6M" ? 6 : 12;

  const data = hasRemoteData ? trendData.timeSeries : controller.generateData(months, timeStep);
  const metrics = hasRemoteData ? (trendData.metrics || {}) : controller.getMetrics(data);

  const platform = trendParams.platform || "Blinkit";

  const handleMetricToggle = (key) => {
    const currentlySelected = Object.values(selectedMetrics).filter(v => v).length;
    const isCurrentlyChecked = selectedMetrics[key];
    
    if (!isCurrentlyChecked && currentlySelected >= 2) {
      return;
    }
    
    setSelectedMetrics({
      ...selectedMetrics,
      [key]: !isCurrentlyChecked
    });
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            bgcolor: 'grey.900',
            color: 'white',
            px: 2,
            py: 1.5,
            borderRadius: 1,
            boxShadow: 3,
            fontSize: '0.875rem'
          }}
        >
          <Box sx={{ color: 'grey.400', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption">{payload[0].payload.date}</Typography>
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span>+</span>
              <span>Avg: last weekly</span>
            </Typography>
          </Box>
          {selectedMetrics.offtake && payload[0].payload.offtake && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, mb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }}></Box>
                <Typography variant="body2">Offtake</Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ₹ {payload[0].payload.offtake.toFixed(2)} Cr 
                <span style={{ color: '#4ade80', marginLeft: 8 }}>(+6.6%)</span>
              </Typography>
            </Box>
          )}
          {selectedMetrics.osa && payload[0].payload.osa && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e' }}></Box>
                <Typography variant="body2">OSA%</Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>~ ({payload[0].payload.osa.toFixed(0)}%)</Typography>
            </Box>
          )}
        </Box>
      );
    }
    return null;
  };

  const metricsList = [
    { key: 'offtake', label: 'Offtake', color: '#ef4444' },
    { key: 'estCategoryShare', label: 'Est. Category Share', color: '#a855f7' },
    { key: 'osa', label: 'OSA%', color: '#22c55e' },
    { key: 'discount', label: 'Wt. Discount%', color: '#3b82f6' },
    { key: 'overallSOV', label: 'Overall SOV', color: '#ec4899' }
  ];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '900px',
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh'
        }
      }}
    >
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3b82f6' }}></Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.125rem' }}>
              My Trends
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              at
            </Typography>
            <Chip 
              label="MRP" 
              size="small" 
              sx={{ 
                bgcolor: '#ccfbf1', 
                color: '#0f766e', 
                height: 22,
                fontSize: '0.75rem',
                fontWeight: 500
              }} 
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
              for
            </Typography>
            <Chip 
              label={platform} 
              size="small" 
              sx={{ 
                bgcolor: '#dbeafe', 
                color: '#1e40af',
                height: 22,
                fontSize: '0.75rem',
                fontWeight: 500
              }} 
            />
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Period and Time Step Selection */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
          <FormControlLabel
            control={<Checkbox size="small" sx={{ py: 0 }} />}
            label={<Typography variant="caption">Custom</Typography>}
            sx={{ mr: 1 }}
          />
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            {['1M', '3M', '6M', '1Y'].map(period => (
              <Button
                key={period}
                size="small"
                onClick={() => setSelectedPeriod(period)}
                variant={selectedPeriod === period ? 'contained' : 'outlined'}
                sx={{
                  minWidth: 'auto',
                  px: 1.5,
                  py: 0.5,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  ...(selectedPeriod === period ? {
                    bgcolor: '#2563eb',
                    '&:hover': { bgcolor: '#1d4ed8' }
                  } : {
                    color: 'text.primary',
                    borderColor: 'divider',
                    bgcolor: '#f9fafb',
                    '&:hover': { bgcolor: '#f3f4f6', borderColor: 'divider' }
                  })
                }}
              >
                {period}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Time Step:
            </Typography>
            <FormControl size="small">
              <Select
                value={timeStep}
                onChange={(e) => setTimeStep(e.target.value)}
                IconComponent={KeyboardArrowDownIcon}
                sx={{
                  fontSize: '0.75rem',
                  '& .MuiSelect-select': { py: 0.5, pr: 3 },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' }
                }}
              >
                <MenuItem value="Daily" sx={{ fontSize: '0.75rem' }}>Daily</MenuItem>
                <MenuItem value="Weekly" sx={{ fontSize: '0.75rem' }}>Weekly</MenuItem>
                <MenuItem value="Monthly" sx={{ fontSize: '0.75rem' }}>Monthly</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Metric Toggles */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
          {metricsList.map(metric => (
            <FormControlLabel
              key={metric.key}
              control={
                <Checkbox
                  size="small"
                  checked={selectedMetrics[metric.key]}
                  onChange={() => handleMetricToggle(metric.key)}
                  sx={{ py: 0, pr: 0.5 }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: metric.color }}></Box>
                  <Typography variant="caption">{metric.label}</Typography>
                </Box>
              }
            />
          ))}
        </Box>

        {/* Chart */}
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
              />
              <YAxis 
                yAxisId="left"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                domain={[0, 3.5]}
                ticks={[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]}
                tickFormatter={(value) => `₹ ${value} Cr`}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              {selectedMetrics.offtake && (
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="offtake" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}
              {selectedMetrics.estCategoryShare && (
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="categoryShare" 
                  stroke="#a855f7" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}
              {selectedMetrics.osa && (
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="osa" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}
              {selectedMetrics.discount && (
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="discount" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}
              {selectedMetrics.overallSOV && (
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="sov" 
                  stroke="#ec4899" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </Drawer>
  );
};

export default MyTrendsDrawer;