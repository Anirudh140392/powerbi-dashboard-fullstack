import React from 'react';
import { Box, Typography } from '@mui/material';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function TopMetricCard({ label, subtitle, trend, trendType, comparison, units, unitsTrend, chart }) {
  // Convert chart array to proper data format
  const chartData = chart ? chart.map((value, index) => ({
    index,
    value: value
  })) : [];

  return (
    <Box sx={{
      bgcolor: 'white',
      p: 3,
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      border: '1px solid #e5e7eb',
      transition: 'box-shadow 0.3s',
      '&:hover': {
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }
    }}>
      <Typography variant="h4" sx={{ fontWeight: 900, color: '#111827', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 2 }}>
        {subtitle}
      </Typography>
      
      <Box sx={{ mb: 1 }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 700,
            color: trendType === 'up' ? '#16a34a' : '#dc2626',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}
        >
          {trendType === 'up' ? '▲' : '▼'} {trend}
        </Typography>
      </Box>
      
      <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 2 }}>
        {comparison}
      </Typography>
      
      {units && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#2563eb', 
            display: 'block', 
            mb: 2,
            fontWeight: 600
          }}
        >
          #Units: {units} {unitsTrend && (
            <span style={{ color: unitsTrend?.startsWith('-') ? '#dc2626' : '#16a34a' }}>
              {unitsTrend?.startsWith('-') ? '▼' : '▲'}{unitsTrend}
            </span>
          )}
        </Typography>
      )}
      
      {/* Chart */}
      {chart && chart.length > 0 && (
        <Box sx={{ width: '100%', height: 80, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#dbeafe" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="index" 
                hide={true}
              />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 11,
                  padding: '4px 8px'
                }}
                labelStyle={{ color: '#fff' }}
                formatter={(value) => value.toFixed(2)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1e40af"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                fill={`url(#gradient-${label})`}
                dot={{
                  fill: '#1e40af',
                  strokeWidth: 2,
                  r: 4,
                  stroke: '#fff'
                }}
                activeDot={{
                  r: 6,
                  fill: '#1e40af',
                  stroke: '#fff',
                  strokeWidth: 2
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
}