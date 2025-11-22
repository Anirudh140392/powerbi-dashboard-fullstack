import React from 'react';
import { Box, Typography, Button } from '@mui/material';

const PlatformCard = ({ name, value, trend, items, itemsTrend, active, onViewTrends }) => (
  <Box 
    sx={{
      p: 3,
      borderRadius: 2,
      border: active ? '2px solid #2563eb' : '2px solid #e5e7eb',
      bgcolor: active ? '#eff6ff' : 'white',
      minWidth: '200px',
      cursor: 'pointer',
      transition: 'all 0.3s',
      '&:hover': {
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }
    }}
    onClick={onViewTrends}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, color: '#374151' }}>
        {name}
      </Typography>
      {active && <Box sx={{ width: 8, height: 8, bgcolor: '#2563eb', borderRadius: '50%' }} />}
    </Box>
    
    <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mb: 0.5 }}>
      Offtake
    </Typography>
    
    <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', mb: 1 }}>
      {value}
    </Typography>
    
    <Typography 
      variant="caption" 
      sx={{ 
        fontWeight: 700,
        color: trend?.startsWith('-') ? '#dc2626' : '#16a34a',
        display: 'block',
        mb: 2
      }}
    >
      {trend?.startsWith('-') ? '▼' : '▲'} {trend}
    </Typography>
    
    <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block', mb: 0.5 }}>
      #Units: {items}
    </Typography>
    
    <Typography 
      variant="caption" 
      sx={{ 
        fontWeight: 600,
        color: itemsTrend?.startsWith('-') ? '#dc2626' : '#16a34a'
      }}
    >
      {itemsTrend}
    </Typography>
  </Box>
);

export default function PlatformOverview({ cards, onViewTrends }) {
  return (
    <Box sx={{ bgcolor: 'white', borderRadius: 2, p: 3, mb: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 900, color: '#111827', display: 'flex', alignItems: 'center', gap: 1 }}>
          <span style={{ fontSize: '1.2rem' }}>▦</span> Platform Overview
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            size="small"
            sx={{ 
              textTransform: 'none',
              color: '#6b7280',
              borderColor: '#d1d5db',
              '&:hover': {
                borderColor: '#9ca3af',
                bgcolor: '#f9fafb'
              }
            }}
          >
            Stale Data
          </Button>
          <Button 
            variant="outlined" 
            size="small"
            sx={{ 
              textTransform: 'none',
              color: '#6b7280',
              borderColor: '#d1d5db',
              '&:hover': {
                borderColor: '#9ca3af',
                bgcolor: '#f9fafb'
              }
            }}
          >
            Search
          </Button>
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* Left Label */}
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: '100px',
          color: '#6b7280',
          fontWeight: 600,
          fontSize: '0.875rem'
        }}>
          <span>☰</span>
          <span>Offtake</span>
        </Box>
        
        {/* Cards Container with horizontal scroll */}
        <Box sx={{ 
          display: 'flex', 
          gap: 3, 
          overflowX: 'auto',
          pb: 2,
          flex: 1,
          '&::-webkit-scrollbar': {
            height: 8
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f3f4f6',
            borderRadius: 4
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#cbd5e1',
            borderRadius: 4,
            '&:hover': {
              backgroundColor: '#94a3b8'
            }
          }
        }}>
          {cards.map((card, idx) => (
            <PlatformCard 
              key={idx} 
              {...card} 
              onViewTrends={() => onViewTrends(card)}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}