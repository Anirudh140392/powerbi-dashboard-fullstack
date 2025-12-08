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
  useTheme
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
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import TrendController from "../../../utils/TrendController";

const MyTrendsDrawer = ({ open, onClose, trendData = {}, trendParams = {}, onParamsChange }) => {
  const theme = useTheme();
  const hasRemoteData = Array.isArray(trendData.timeSeries) && trendData.timeSeries.length > 0;

  const { months: selectedPeriod, timeStep, platform } = trendParams;

  const [selectedMetrics, setSelectedMetrics] = useState({
    offtake: true,
    estCategoryShare: true,
    osa: true,
    discount: true,
    overallSOV: false
  });

  const controller = new TrendController();

  const monthsCount =
    selectedPeriod === "1M" ? 1 :
      selectedPeriod === "3M" ? 3 :
        selectedPeriod === "6M" ? 6 : 12;

  const data = hasRemoteData ? trendData.timeSeries : controller.generateData(monthsCount, timeStep);
  const metrics = hasRemoteData ? (trendData.metrics || {}) : controller.getMetrics(data);

  const handleMetricToggle = (key) => {
    setSelectedMetrics({
      ...selectedMetrics,
      [key]: !selectedMetrics[key]
    });
  };

  const handlePeriodChange = (newPeriod) => {
    onParamsChange(prev => ({ ...prev, months: newPeriod }));
  };

  const handleTimeStepChange = (newStep) => {
    onParamsChange(prev => ({ ...prev, timeStep: newStep }));
  };

  const formatNumber = (num) => {
    if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹ ${(num / 100000).toFixed(2)} L`;
    if (num >= 1000) return `₹ ${(num / 1000).toFixed(2)} K`;
    return `₹ ${num.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            px: 2,
            py: 1.5,
            borderRadius: 1.5,
            boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.6)' : '0 4px 20px rgba(0,0,0,0.08)',
            border: `1px solid ${theme.palette.divider}`,
            minWidth: '200px'
          }}
        >
          <Box sx={{ mb: 1.5, pb: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem' }}>
              {payload[0].payload.date}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.65rem', ml: 1, display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
              ⏱ <span>Avg: last {timeStep.toLowerCase()}</span>
            </Typography>
          </Box>
          {selectedMetrics.offtake && payload[0].payload.offtake !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: theme.palette.error.main }}></Box>
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>Offtake</Typography>
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                {formatNumber(payload[0].payload.offtake)}
              </Typography>
            </Box>
          )}
          {selectedMetrics.osa && payload[0].payload.osa !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: theme.palette.success.main }}></Box>
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
    { key: 'offtake', label: 'Offtake', color: theme.palette.error.main },
    { key: 'estCategoryShare', label: 'Est. Category Share', color: theme.palette.secondary ? theme.palette.secondary.main : '#a855f7' },
    { key: 'osa', label: 'OSA%', color: theme.palette.success.main },
    { key: 'discount', label: 'Wt. Discount%', color: theme.palette.primary.main },
    { key: 'overallSOV', label: 'Overall SOV', color: theme.palette.info ? theme.palette.info.main : '#ec4899' }
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
          bgcolor: theme.palette.background.paper
        }
      }}
    >
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{
          px: 3,
          pt: 2.5,
          pb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: theme.palette.primary.main,
              boxShadow: theme.palette.mode === 'dark' ? '0 0 0 3px rgba(255,255,255,0.04)' : '0 0 0 3px rgba(59, 130, 246, 0.08)'
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
                bgcolor: theme.palette.mode === 'dark' ? theme.palette.action.selected : '#ccfbf1',
                color: theme.palette.mode === 'dark' ? theme.palette.text.primary : '#0f766e',
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
                bgcolor: theme.palette.mode === 'dark' ? theme.palette.action.selected : '#dbeafe',
                color: theme.palette.mode === 'dark' ? theme.palette.text.primary : '#1e40af',
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
              color: theme.palette.text.secondary,
              '&:hover': { bgcolor: theme.palette.action.hover }
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Controls */}
        <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          {/* Period Selection Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {['1M', '3M', '6M', '1Y'].map(period => (
                <Button
                  key={period}
                  size="small"
                  onClick={() => handlePeriodChange(period)}
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
                      color: '#ffffff',
                      boxShadow: 'none',
                      '&:hover': {
                        bgcolor: '#2563eb',
                        boxShadow: 'none'
                      }
                    } : {
                      color: '#6b7280',
                      borderColor: '#e5e7eb',
                      bgcolor: 'transparent',
                      '&:hover': {
                        bgcolor: '#f9fafb',
                        borderColor: '#e5e7eb'
                      }
                    })
                  }}
                >
                  {period}
                </Button>
              ))}
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={selectedPeriod === 'Custom'}
                  onChange={(e) => handlePeriodChange(e.target.checked ? 'Custom' : '3M')}
                  sx={{
                    py: 0,
                    '& .MuiSvgIcon-root': { fontSize: 18 }
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: '0.8rem', color: '#111827', fontWeight: 500 }}>
                  Custom
                </Typography>
              }
              sx={{ ml: 1, mb: 0 }}
            />

            {selectedPeriod === 'Custom' && (
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <DatePicker
                    label="Start"
                    value={trendParams.startDate ? dayjs(trendParams.startDate) : null}
                    onChange={(newValue) => onParamsChange(prev => ({ ...prev, startDate: newValue }))}
                    slotProps={{ textField: { size: 'small', sx: { width: 130 } } }}
                  />
                  <DatePicker
                    label="End"
                    value={trendParams.endDate ? dayjs(trendParams.endDate) : null}
                    onChange={(newValue) => onParamsChange(prev => ({ ...prev, endDate: newValue }))}
                    slotProps={{ textField: { size: 'small', sx: { width: 130 } } }}
                  />
                </Box>
              </LocalizationProvider>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>
                Time Step:
              </Typography>
              <FormControl size="small">
                <Select
                  value={timeStep}
                  onChange={(e) => handleTimeStepChange(e.target.value)}
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
                      borderColor: '#e5e7eb'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e5e7eb'
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
                    <Typography sx={{ fontSize: '0.8rem', color: '#111827', fontWeight: 500 }}>
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
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: theme.palette.divider }}
                  dy={10}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: theme.palette.divider }}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => formatNumber(value)}
                  dx={-5}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: theme.palette.divider }}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => `~(${value}%)`}
                  dx={5}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: theme.palette.divider, strokeWidth: 1 }} />
                {selectedMetrics.offtake && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="offtake"
                    stroke={theme.palette.error.main}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: theme.palette.error.main, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: theme.palette.error.main, strokeWidth: 2, stroke: theme.palette.background.paper }}
                  />
                )}
                {selectedMetrics.estCategoryShare && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="categoryShare"
                    stroke={theme.palette.secondary ? theme.palette.secondary.main : '#a855f7'}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: theme.palette.secondary ? theme.palette.secondary.main : '#a855f7', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: theme.palette.secondary ? theme.palette.secondary.main : '#a855f7', strokeWidth: 2, stroke: theme.palette.background.paper }}
                  />
                )}
                {selectedMetrics.osa && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="osa"
                    stroke={theme.palette.success.main}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: theme.palette.success.main, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: theme.palette.success.main, strokeWidth: 2, stroke: theme.palette.background.paper }}
                  />
                )}
                {selectedMetrics.discount && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="discount"
                    stroke={theme.palette.primary.main}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: theme.palette.primary.main, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: theme.palette.primary.main, strokeWidth: 2, stroke: theme.palette.background.paper }}
                  />
                )}
                {selectedMetrics.overallSOV && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="sov"
                    stroke={theme.palette.info ? theme.palette.info.main : '#ec4899'}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: theme.palette.info ? theme.palette.info.main : '#ec4899', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: theme.palette.info ? theme.palette.info.main : '#ec4899', strokeWidth: 2, stroke: theme.palette.background.paper }}
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