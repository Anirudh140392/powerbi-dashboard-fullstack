import React, { useState, useEffect } from 'react';
import { ChevronDown, Info, BarChart2, Calendar } from 'lucide-react';
import { Typography, Box } from '@mui/material';
import RCATree from './RCATree';
import CategoryTrendsDrawer from '../CategoryTrendsDrawer';
import axiosInstance from '../../../api/axiosInstance';
import SelectBox from "../Common/SelectBox";
import RCADatePicker from "./RCADatePicker";
import { getDynamicRcaTreeData } from "../../../services/api";
import dayjs from "dayjs";

const RCADashboard = () => {
  const [platforms, setPlatforms] = useState([]);
  const [platformChannels, setPlatformChannels] = useState([]);
  const [platform, setPlatform] = useState('');
  const [location, setLocation] = useState('All');
  const [category, setCategory] = useState('All');
  const [brand, setBrand] = useState('All');
  const [sosTopN, setSosTopN] = useState('Top 10');

  // Date states
  const [timeStart, setTimeStart] = useState(dayjs().subtract(15, "day"));
  const [timeEnd, setTimeEnd] = useState(dayjs());
  const [compareStart, setCompareStart] = useState(dayjs().subtract(31, "day"));
  const [compareEnd, setCompareEnd] = useState(dayjs().subtract(16, "day"));
  const [compareOn, setCompareOn] = useState(true);
  const [periodLabel, setPeriodLabel] = useState("Last 15 Days");

  // Trends Drawer State
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [targetKpi, setTargetKpi] = useState(null);

  const handleViewTrends = (kpi) => {
    setTargetKpi(kpi);
    setTrendsOpen(true);
  };

  const handleDateApply = (ts, te, cs, ce, co, label) => {
    setTimeStart(ts);
    setTimeEnd(te);
    setCompareStart(cs);
    setCompareEnd(ce);
    setCompareOn(co);
    setPeriodLabel(label);
  };

  // Fetch platform mappings from API on mount
  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await axiosInstance.get('/watchtower/platform-channels');
        const fetchedMappings = response.data || [];

        if (fetchedMappings.length > 0) {
          setPlatformChannels(fetchedMappings);
          const fetchedPlatforms = fetchedMappings.map(m => m.platform);
          setPlatforms(fetchedPlatforms);
          setPlatform(fetchedPlatforms[0]);
        }
      } catch (error) {
        console.error('Error fetching platforms:', error);
      }
    };
    fetchPlatforms();
  }, []);

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

  const SelectBox = ({ label, value, onChange, options = [], width = '100%' }) => (
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
          {options.length > 0 ? (
            options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))
          ) : (
            <option>{value}</option>
          )}
        </select>
        <ChevronDown size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#f6f8fb',
      marginBottom: '40px',
      fontFamily: '"Outfit", "Inter", sans-serif',
      borderRadius: '24px',
      overflow: 'hidden',
      color: '#0f172a'
    }}>
      {/* Left Sidebar */}
      <div style={{
        width: '320px',
        backgroundColor: 'white',
        borderRight: '1px solid rgba(0,0,0,0.05)',
        padding: '40px 28px',
        flexShrink: 0,
        boxShadow: '20px 0 50px rgba(0,0,0,0.02)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '48px',
          paddingBottom: '24px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #FFD54F 0%, #F59E0B 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(245, 158, 11, 0.25)'
          }}>
            <BarChart2 size={20} color="black" strokeWidth={2.5} />
          </div>

          <Typography sx={{ fontWeight: 900, fontSize: "1.25rem", color: "#0f172a", letterSpacing: "-0.5px" }}>
            RCA <span style={{ color: '#9C27B0' }}>Pro</span>
          </Typography>
        </div>

        {/* Time Period */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', marginBottom: '16px', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
            Fiscal Period
          </div>
          <RCADatePicker
            timeStart={timeStart}
            timeEnd={timeEnd}
            compareStart={compareStart}
            compareEnd={compareEnd}
            onApply={handleDateApply}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <SelectBox label="PLATFORM" value={platform} onChange={setPlatform} options={platforms} />
          <SelectBox label="CATEGORY" value={category} onChange={setCategory} options={['All']} />
          <SelectBox label="BRAND" value={brand} onChange={setBrand} options={['All']} />
        </div>

        {/* Premium Note Badge */}
        <div style={{
          marginTop: 'auto',
          padding: '20px',
          background: 'linear-gradient(135deg, #9C27B0 0%, #E91E63 100%)',
          borderRadius: '20px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 15px 30px rgba(156, 39, 176, 0.3)',
          marginTop: '60px'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', opacity: 0.8, letterSpacing: '1px', marginBottom: '8px' }}>Pro Tip</div>
            <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.4 }}>
              Root cause analysis is performed at the keyword level for maximum precision.
            </div>
          </div>
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            right: '-10px',
            opacity: 0.2,
            transform: 'rotate(-15deg)'
          }}>
            <Info size={80} color="white" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '48px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Header Action */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <div style={{
            padding: '4px',
            backgroundColor: '#f1f5f9',
            borderRadius: '14px',
            display: 'flex',
            gap: '4px'
          }}>
            <button style={{
              padding: '10px 24px',
              backgroundColor: 'white',
              color: '#0f172a',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
            }}>
              PRODUCT RCA
            </button>
            <button style={{
              padding: '10px 24px',
              backgroundColor: 'transparent',
              color: '#64748b',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}>
              MARKET OVERVIEW
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{
              backgroundColor: '#FFD54F',
              color: 'black',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(255, 213, 79, 0.3)'
            }}>
              Export Data
            </button>
          </div>
        </div>

        {/* Tree Structure Container */}
        <Box sx={{
          flex: 1,
          width: '100%',
          minHeight: '800px',
          position: 'relative',
          backgroundColor: '#fff',
          borderRadius: '32px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.03)'
        }}>
          <RCATree
            onViewTrends={handleViewTrends}
            context={{
              platform,
              channel: platformChannels.find(p => p.platform === platform)?.channel || "",
              category,
              brand,
              timeStart,
              timeEnd,
              compareStart,
              compareEnd,
              compareOn
            }}
          />
        </Box>

        <CategoryTrendsDrawer
          open={trendsOpen}
          onClose={() => setTrendsOpen(false)}
          targetKpi={targetKpi}
        />
      </div>
    </div>
  );
};

export default RCADashboard;
