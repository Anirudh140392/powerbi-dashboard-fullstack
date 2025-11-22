import React, { useState } from 'react';
import { Box, Typography, Button, TextField, Select, MenuItem } from '@mui/material';
import { Download } from 'lucide-react';

const PlatformIcon = ({ platform }) => {
  const icons = {
    'All': { color: '#9333ea', shape: 'circle' },
    'Blinkit': { color: '#facc15', shape: 'square' },
    'Zepto': { color: '#7c3aed', shape: 'square' },
    'Instamart': { color: '#f97316', shape: 'circle' }
  };
  
  const config = icons[platform] || icons['All'];
  
  return (
    <Box sx={{
      width: 12,
      height: 12,
      bgcolor: config.color,
      borderRadius: config.shape === 'circle' ? '50%' : '2px'
    }} />
  );
};

export default function SKUTable({ data }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');

  return (
    <Box>
      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#6b7280', fontWeight: 600 }}>
            Metrics:
          </Typography>
          <Select 
            size="small" 
            value="offtake"
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="offtake">Offtake</MenuItem>
            <MenuItem value="growth">Growth</MenuItem>
          </Select>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            size="small"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 200 }}
          />
          <Select 
            size="small" 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="All">Category: All</MenuItem>
            <MenuItem value="Toothpaste">Toothpaste</MenuItem>
            <MenuItem value="Toothbrush">Toothbrush</MenuItem>
          </Select>
          <Button 
            variant="outlined" 
            size="small"
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <Download size={18} />
          </Button>
        </Box>
      </Box>

      {/* Table */}
      <Box sx={{ 
        border: '1px solid #e5e7eb', 
        borderRadius: 2, 
        overflow: 'hidden',
        bgcolor: 'white'
      }}>
        <Box sx={{ 
          maxHeight: '500px', 
          overflowY: 'auto',
          '&::-webkit-scrollbar': {
            width: 8
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f3f4f6'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#cbd5e1',
            borderRadius: 4,
            '&:hover': {
              backgroundColor: '#94a3b8'
            }
          }
        }}>
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '12px', 
                    fontWeight: 700, 
                    color: '#374151',
                    borderRight: '1px solid #e5e7eb',
                    minWidth: '300px'
                  }}>
                    SKU
                  </th>
                  <th colSpan="2" style={{ 
                    padding: '12px', 
                    textAlign: 'center', 
                    fontWeight: 700,
                    borderRight: '1px solid #e5e7eb'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <PlatformIcon platform="All" />
                      <span>All</span>
                    </Box>
                  </th>
                  <th colSpan="2" style={{ 
                    padding: '12px', 
                    textAlign: 'center', 
                    fontWeight: 700,
                    borderRight: '1px solid #e5e7eb'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <PlatformIcon platform="Blinkit" />
                      <span>Blinkit</span>
                    </Box>
                  </th>
                  <th colSpan="2" style={{ 
                    padding: '12px', 
                    textAlign: 'center', 
                    fontWeight: 700,
                    borderRight: '1px solid #e5e7eb'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <PlatformIcon platform="Zepto" />
                      <span>Zepto</span>
                    </Box>
                  </th>
                  <th colSpan="2" style={{ 
                    padding: '12px', 
                    textAlign: 'center', 
                    fontWeight: 700
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <PlatformIcon platform="Instamart" />
                      <span>Instamart</span>
                    </Box>
                  </th>
                </tr>
                <tr style={{ backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb', position: 'sticky', top: 49, zIndex: 2 }}>
                  <th style={{ padding: '8px 12px', borderRight: '1px solid #e5e7eb' }}></th>
                  <th style={{ padding: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>Offtake</th>
                  <th style={{ padding: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>Growth %</th>
                  <th style={{ padding: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>Offtake</th>
                  <th style={{ padding: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>Growth %</th>
                  <th style={{ padding: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>Offtake</th>
                  <th style={{ padding: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>Growth %</th>
                  <th style={{ padding: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, borderRight: '1px solid #e5e7eb' }}>Offtake</th>
                  <th style={{ padding: '8px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>Growth %</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr 
                    key={idx} 
                    style={{ 
                      borderTop: '1px solid #e5e7eb',
                      backgroundColor: 'white'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <td style={{ 
                      padding: '12px',
                      borderRight: '1px solid #e5e7eb'
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <img 
                          src={row.productImage || 'https://via.placeholder.com/40'} 
                          alt={row.sku}
                          style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }}
                        />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827' }}>
                            {row.sku}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            {row.weight}
                          </Typography>
                        </Box>
                      </Box>
                    </td>
                    
                    {/* All Platform */}
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e5e7eb' }}>
                      {row.all.offtake}
                    </td>
                    <td style={{ 
                      padding: '8px', 
                      textAlign: 'center',
                      color: row.all.growth?.includes('-') ? '#dc2626' : '#16a34a',
                      fontWeight: 600,
                      borderRight: '1px solid #e5e7eb'
                    }}>
                      {row.all.growth}
                    </td>
                    
                    {/* Blinkit Platform */}
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e5e7eb' }}>
                      {row.blinkit.offtake}
                    </td>
                    <td style={{ 
                      padding: '8px', 
                      textAlign: 'center',
                      color: row.blinkit.growth?.includes('-') ? '#dc2626' : '#16a34a',
                      fontWeight: 600,
                      borderRight: '1px solid #e5e7eb'
                    }}>
                      {row.blinkit.growth}
                    </td>
                    
                    {/* Zepto Platform */}
                    <td style={{ padding: '8px', textAlign: 'center', color: '#9ca3af', borderRight: '1px solid #e5e7eb' }}>
                      {row.zepto.offtake}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#9ca3af', borderRight: '1px solid #e5e7eb' }}>
                      {row.zepto.growth}
                    </td>
                    
                    {/* Instamart Platform */}
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, borderRight: '1px solid #e5e7eb' }}>
                      {row.instamart.offtake}
                    </td>
                    <td style={{ 
                      padding: '8px', 
                      textAlign: 'center',
                      color: row.instamart.growth?.includes('-') ? '#dc2626' : '#16a34a',
                      fontWeight: 600
                    }}>
                      {row.instamart.growth}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}