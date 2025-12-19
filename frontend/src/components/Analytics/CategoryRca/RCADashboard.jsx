import React, { useState } from 'react';
import { ChevronDown, Info, BarChart2 } from 'lucide-react';
import { Typography, Box } from '@mui/material';
import RCATree from './RCATree';

const RCADashboard = () => {
  const [platform, setPlatform] = useState('Blinkit');
  const [location, setLocation] = useState('All');
  const [category, setCategory] = useState('All');
  const [brand, setBrand] = useState('All');
  const [sosTopN, setSosTopN] = useState('Top 10');

  const MetricCard = ({ title, value, change, isPositive, hasInfo, small }) => (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      padding: small ? '10px 14px' : '12px 16px',
      minWidth: small ? '140px' : '160px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{title}</span>
        {hasInfo && <Info size={14} color="#9ca3af" />}
      </div>
      <div style={{ fontSize: small ? '18px' : '20px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: isPositive ? '#16a34a' : '#dc2626',
        display: 'flex',
        alignItems: 'center',
        gap: '2px'
      }}>
        <span>{isPositive ? '▲' : '▼'}</span>
        <span>{change}</span>
      </div>
    </div>
  );

  const SelectBox = ({ label, value, onChange, width = '100%' }) => (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '8px', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ position: 'relative', width }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 32px 8px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            backgroundColor: 'white',
            color: '#111827',
            appearance: 'none',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          <option>{value}</option>
        </select>
        <ChevronDown size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      marginBottom: '40px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      border: '1px solid #e5e7eb',
      borderRadius: '16px',
      overflow: 'hidden'
    }}>
      {/* Left Sidebar */}
      <div style={{
        width: '300px',
        backgroundColor: 'white',
        borderRight: '1px solid #e5e7eb',
        padding: '30px 20px',
        flexShrink: 0
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '32px',
          paddingBottom: '20px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '16px',
            fontWeight: 700
          }}>
            ∞
          </div>

          <Typography ml={1.2} fontWeight={600} fontSize="1.1rem">
            Root Cause Analysis
          </Typography>
        </div>

        {/* Time Period */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '20px', letterSpacing: '0.5px' }}>
            TIME PERIOD:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>
            <span>01-05-2025</span>
            <span style={{ color: '#9ca3af' }}>to</span>
            <span>13-05-2025</span>
            <span style={{ color: '#3b82f6', cursor: 'pointer', fontSize: '16px' }}>⊕</span>
          </div>
        </div>

        {/* Comparison Period */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '20px', letterSpacing: '0.5px' }}>
            COMPARISON PERIOD:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#111827', fontWeight: 600 }}>
            <span>01-03-2025</span>
            <span style={{ color: '#9ca3af' }}>to</span>
            <span>30-03-2025</span>
            <span style={{ color: '#3b82f6', cursor: 'pointer', fontSize: '16px' }}>⊕</span>
          </div>
        </div>

        {/* Filters */}
        <SelectBox label="PLATFORM:" value={platform} onChange={setPlatform} />
        <SelectBox label="LOCATION:" value={location} onChange={setLocation} />
        <SelectBox label="CATEGORY:" value={category} onChange={setCategory} />
        <SelectBox label="BRAND:" value={brand} onChange={setBrand} />
        <SelectBox label="SOS TOP N:" value={sosTopN} onChange={setSosTopN} />

        {/* Note */}
        <div style={{
          marginTop: '60px',
          padding: '12px',
          backgroundColor: '#fef3c7',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#92400e',
          lineHeight: '1.5'
        }}>
          <strong>NOTE:</strong> SOS is on keyword level
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '32px 40px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: 'white',
          border: '2px solid #3b82f6',
          borderRadius: '8px',
          padding: '6px 8px',
          marginBottom: '28px',
          width: 'fit-content'
        }}>
          <button style={{
            padding: '6px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}>
            PRODUCT RCA
          </button>
        </div>

        {/* Tree Structure Container - Replaced with Interactive RCATree */}
        <Box sx={{
          flex: 1,
          width: '100%',
          minHeight: '800px',
          position: 'relative',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#fff',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
        }}>
          <RCATree />
        </Box>
      </div>
    </div>
  );
};

export default RCADashboard;