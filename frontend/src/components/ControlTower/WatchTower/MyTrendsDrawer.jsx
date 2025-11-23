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
import TrendController from "../../../utils/TrendController";

const MyTrendsDrawer = ({ open, onClose, trendData = {}, trendParams = {} }) => {
  const hasRemoteData = Array.isArray(trendData.timeSeries) && trendData.timeSeries.length > 0;

  const [selectedPeriod, setSelectedPeriod] = useState('3M');
  const [timeStep, setTimeStep] = useState('Weekly');
  const [selectedMetrics, setSelectedMetrics] = useState({
    offtake: true,
    estCategoryShare: true,
    osa: true,
    discount: true,
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
            bgcolor: 'rgba(31, 41, 55, 0.95)',
            color: 'white',
            px: 2,
            py: 1.5,
            borderRadius: 1.5,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: '200px'
          }}
        >
          <Box sx={{ mb: 1.5, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '0.7rem' }}>
              {payload[0].payload.date}
            </Typography>
            <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '0.65rem', ml: 1, display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
              ⏱ <span>Avg: last weekly</span>
            </Typography>
          </Box>
          {selectedMetrics.offtake && payload[0].payload.offtake && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }}></Box>
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>Offtake</Typography>
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                ₹ {payload[0].payload.offtake.toFixed(2)} Cr 
                <span style={{ color: '#4ade80', marginLeft: 6, fontSize: '0.7rem' }}>(+6.6%)</span>
              </Typography>
            </Box>
          )}
          {selectedMetrics.osa && payload[0].payload.osa && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e' }}></Box>
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>OSA%</Typography>
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
          width: '65vw',
          maxWidth: '1000px',
          minWidth: '800px',
          bgcolor: '#ffffff'
        }
      }}
    >
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ 
          px: 3, 
          pt: 2.5, 
          pb: 2,
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%', 
              bgcolor: '#3b82f6',
              boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
            }}></Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#111827' }}>
              My Trends
            </Typography>
            <Typography sx={{ color: '#6b7280', fontSize: '0.875rem', mx: 0.5 }}>
              at
            </Typography>
            <Chip 
              label="MRP" 
              size="small" 
              sx={{ 
                bgcolor: '#ccfbf1', 
                color: '#0f766e', 
                height: 24,
                fontSize: '0.75rem',
                fontWeight: 600,
                '& .MuiChip-label': { px: 1.5 }
              }} 
            />
            <Typography sx={{ color: '#6b7280', fontSize: '0.875rem', mx: 0.5 }}>
              for
            </Typography>
            <Chip 
              label={platform} 
              size="small" 
              sx={{ 
                bgcolor: '#dbeafe', 
                color: '#1e40af',
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
              color: '#6b7280',
              '&:hover': { bgcolor: '#f3f4f6' }
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Controls */}
        <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid #f3f4f6' }}>
          {/* Period Selection Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox 
                  size="small" 
                  sx={{ 
                    py: 0,
                    '& .MuiSvgIcon-root': { fontSize: 18 }
                  }} 
                />
              }
              label={
                <Typography sx={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>
                  Custom
                </Typography>
              }
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
                      bgcolor: '#2563eb',
                      boxShadow: 'none',
                      '&:hover': { 
                        bgcolor: '#1d4ed8',
                        boxShadow: 'none'
                      }
                    } : {
                      color: '#6b7280',
                      borderColor: '#d1d5db',
                      bgcolor: 'transparent',
                      '&:hover': { 
                        bgcolor: '#f9fafb', 
                        borderColor: '#9ca3af'
                      }
                    })
                  }}
                >
                  {period}
                </Button>
              ))}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>
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
                      borderColor: '#d1d5db'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': { 
                      borderColor: '#9ca3af'
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
                    <Typography sx={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>
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
          <Box sx={{ width: '100%', height: '100%', maxHeight: '500px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={data}
                margin={{ top: 10, right: 40, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  dy={10}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => `₹ ${value} Cr`}
                  dx={-5}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => `~(${value}%)`}
                  dx={5}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#d1d5db', strokeWidth: 1 }} />
                {selectedMetrics.offtake && (
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="offtake" 
                    stroke="#ef4444" 
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#ef4444', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
                  />
                )}
                {selectedMetrics.estCategoryShare && (
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="categoryShare" 
                    stroke="#a855f7" 
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#a855f7', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#a855f7', strokeWidth: 2, stroke: '#fff' }}
                  />
                )}
                {selectedMetrics.osa && (
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="osa" 
                    stroke="#22c55e" 
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#22c55e', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }}
                  />
                )}
                {selectedMetrics.discount && (
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="discount" 
                    stroke="#3b82f6" 
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  />
                )}
                {selectedMetrics.overallSOV && (
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="sov" 
                    stroke="#ec4899" 
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#ec4899', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#ec4899', strokeWidth: 2, stroke: '#fff' }}
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

export default MyTrendsDrawer;