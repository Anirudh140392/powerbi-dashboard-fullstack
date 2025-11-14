import React from "react";
import { Card, CardContent, Typography, Box } from "@mui/material";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart, Tooltip } from "recharts";

export default function CardMetric({ title, value, trend, chartKey }) {
  // Generate realistic data with proper date labels
  const generateData = (variant) => {
    const months = ['Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025'];
    const data = [];
    
    // Different patterns for different metrics
    let baseValue = 40;
    let volatility = 5;
    
    if (variant === 'offtake') {
      // Gradual upward trend with final spike
      for (let i = 0; i < 25; i++) {
        const progress = i / 25;
        baseValue = 30 + (progress * 35) + Math.random() * volatility;
        if (i > 20) baseValue += (i - 20) * 3; // Final spike
        data.push({ 
          date: i, 
          value: baseValue,
          label: months[Math.floor((i / 25) * 4)]
        });
      }
    } else if (variant === 'share') {
      // Decline then stabilization
      for (let i = 0; i < 25; i++) {
        if (i < 5) {
          baseValue = 60 - i * 2 + Math.random() * 3;
        } else if (i < 15) {
          baseValue = 45 - (i - 5) * 1.5 + Math.random() * 3;
        } else {
          baseValue = 32 + Math.random() * 4;
        }
        data.push({ 
          date: i, 
          value: baseValue,
          label: months[Math.floor((i / 25) * 4)]
        });
      }
    } else if (variant === 'stock') {
      // High volatility with drops
      baseValue = 65;
      for (let i = 0; i < 25; i++) {
        baseValue += Math.random() * 8 - 4;
        if (i === 10 || i === 15 || i === 18) {
          baseValue -= 15; // Sharp drops
        }
        baseValue = Math.max(30, Math.min(75, baseValue));
        data.push({ 
          date: i, 
          value: baseValue,
          label: months[Math.floor((i / 25) * 4)]
        });
      }
    } else {
      // Stable with slight variations
      baseValue = 50;
      for (let i = 0; i < 25; i++) {
        baseValue += Math.random() * 4 - 2;
        baseValue = Math.max(40, Math.min(60, baseValue));
        data.push({ 
          date: i, 
          value: baseValue,
          label: months[Math.floor((i / 25) * 4)]
        });
      }
    }
    
    return data;
  };

  const data = generateData(chartKey);
  
  // Determine trend color and icon
  const isNegative = trend?.includes("▼") || trend?.includes("-");
  const trendColor = isNegative ? "#ef4444" : "#16a34a";

  return (
    <Card 
      elevation={0} 
      sx={{ 
        height: '100%',
        borderRadius: 2,
        border: '1px solid #e5e7eb',
        transition: 'box-shadow 0.3s',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2 } }}>
        {/* Title */}
        <Typography 
          variant="subtitle2" 
          sx={{ 
            fontWeight: 700,
            fontSize: '0.75rem',
            color: '#6b7280',
            letterSpacing: '0.5px',
            mb: 1
          }}
        >
          {title}
        </Typography>

        {/* Value */}
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 900,
            fontSize: '1.75rem',
            color: '#111827',
            mb: 0.5,
            lineHeight: 1
          }}
        >
          {value}
        </Typography>

        {/* Trend */}
        {trend && (
          <Typography 
            variant="caption" 
            sx={{ 
              color: trendColor,
              display: "block",
              fontWeight: 600,
              fontSize: '0.7rem',
              mb: 2
            }}
          >
            {trend}
          </Typography>
        )}

        {/* Chart */}
        <Box sx={{ width: '100%', height: 140, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={data}
              margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`gradient-${chartKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#dbeafe" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                hide={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                ticks={[0, 8, 16, 24]}
                tickFormatter={(value) => {
                  const labels = ['Jul 2025', 'Aug 2025', 'Sep 2025', 'Oct 2025'];
                  return labels[Math.floor(value / 6)] || '';
                }}
              />
              <YAxis hide domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 12
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill={`url(#gradient-${chartKey})`}
                dot={{
                  fill: '#2563eb',
                  strokeWidth: 2,
                  r: 3,
                  stroke: '#fff'
                }}
                activeDot={{
                  r: 5,
                  fill: '#2563eb',
                  stroke: '#fff',
                  strokeWidth: 2
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}