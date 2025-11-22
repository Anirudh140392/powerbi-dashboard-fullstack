import React from 'react';
import { Box, Typography } from '@mui/material';

const CategoryMetricCard = ({ data }) => (
  <Box sx={{
    bgcolor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 2,
    p: 2.5,
    minWidth: '180px',
    maxWidth: '200px'
  }}>
    <Typography sx={{ fontWeight: 900, color: '#111827', textAlign: 'center', mb: 3, fontSize: '0.95rem' }}>
      {data.name}
    </Typography>
    
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Assortment */}
      <Box sx={{ 
        textAlign: 'center', 
        py: 2.5, 
        bgcolor: '#f9fafb', 
        borderRadius: 1.5,
        minHeight: '90px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <Typography variant="h4" sx={{ fontWeight: 900, color: '#111827' }}>
          {data.assortment.count}
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: data.assortment.change?.includes('-') ? '#dc2626' : '#16a34a',
            fontWeight: 600,
            mt: 0.5
          }}
        >
          {data.assortment.change?.includes('-') ? '▼' : '▲'} {data.assortment.change}
        </Typography>
      </Box>
      
      {/* Wt. OSA% */}
      <Box sx={{ 
        textAlign: 'center', 
        py: 2,
        minHeight: '70px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827' }}>
          {data.wtOsa.value}
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: data.wtOsa.change?.includes('-') ? '#dc2626' : '#16a34a',
            fontWeight: 600,
            mt: 0.5
          }}
        >
          {data.wtOsa.change?.includes('-') ? '▼' : '▲'} {data.wtOsa.change}
        </Typography>
      </Box>
      
      {/* Wt. Disc % */}
      <Box sx={{ 
        textAlign: 'center', 
        py: 2,
        minHeight: '70px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827' }}>
          {data.wtDisc.value}
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: data.wtDisc.change?.includes('-') ? '#dc2626' : '#16a34a',
            fontWeight: 600,
            mt: 0.5
          }}
        >
          {data.wtDisc.change?.includes('-') ? '▼' : '▲'} {data.wtDisc.change}
        </Typography>
      </Box>
      
      {/* Overall SOV */}
      <Box sx={{ 
        textAlign: 'center', 
        py: 2,
        minHeight: '70px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827' }}>
          {data.overallSov.value}
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            color: data.overallSov.change?.includes('-') ? '#dc2626' : '#16a34a',
            fontWeight: 600,
            mt: 0.5
          }}
        >
          {data.overallSov.change?.includes('-') ? '▼' : '▲'} {data.overallSov.change}
        </Typography>
      </Box>
      
      {/* DOI */}
      <Box sx={{ 
        textAlign: 'center', 
        py: 2,
        minHeight: '70px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600 }}>
          {data.doi || 'No Data Available'}
        </Typography>
      </Box>
    </Box>
  </Box>
);

export default function CategoryMetricsSection({ metrics }) {
  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {/* Left Labels Column */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: '110px',
        flexShrink: 0
      }}>
        <Box sx={{
          bgcolor: '#f3f4f6',
          p: 1.5,
          borderRadius: 2,
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '1.2rem',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          ☰
        </Box>
        
        <Box sx={{
          bgcolor: '#f3f4f6',
          p: 2,
          borderRadius: 2,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '90px'
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#4b5563' }}>
            Assortment
          </Typography>
        </Box>
        
        <Box sx={{
          bgcolor: '#f3f4f6',
          p: 2,
          borderRadius: 2,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70px'
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#4b5563' }}>
            Wt. OSA%
          </Typography>
        </Box>
        
        <Box sx={{
          bgcolor: '#f3f4f6',
          p: 2,
          borderRadius: 2,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70px'
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#4b5563' }}>
            Wt. Disc %
          </Typography>
        </Box>
        
        <Box sx={{
          bgcolor: '#f3f4f6',
          p: 2,
          borderRadius: 2,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70px'
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#4b5563' }}>
            Overall SOV
          </Typography>
        </Box>
        
        <Box sx={{
          bgcolor: '#f3f4f6',
          p: 2,
          borderRadius: 2,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70px'
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#4b5563' }}>
            DOI
          </Typography>
        </Box>
      </Box>
      
      {/* Metric Cards with horizontal scroll */}
      <Box sx={{
        flex: 1,
        overflowX: 'auto',
        display: 'flex',
        gap: 2.5,
        pb: 2,
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
        {metrics.map((metric, idx) => (
          <CategoryMetricCard key={idx} data={metric} />
        ))}
      </Box>
    </Box>
  );
}