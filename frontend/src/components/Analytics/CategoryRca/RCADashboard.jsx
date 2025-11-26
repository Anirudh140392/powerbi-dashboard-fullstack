import React, { useState } from 'react';
import { ChevronDown, Info, BarChart2 } from 'lucide-react';
import { Typography } from '@mui/material';

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
      minHeight: '160vh',
      backgroundColor: '#f9fafb',
      mb: '40px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
      <div style={{ flex: 1, padding: '32px 40px', position: 'relative' }}>
        {/* Header */}
        <div style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: 'white',
          border: '2px solid #3b82f6',
          borderRadius: '8px',
          padding: '6px 8px',
          marginBottom: '28px'
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

        {/* Tree Structure Container */}
        <div style={{ position: 'relative', paddingLeft: '140px' }}>
          {/* Offtake - Root Node */}
          <div style={{ 
            position: 'absolute',
            left: 0,
            top: '480px',
            transform: 'translateY(-50%)'
          }}>
            <div style={{
              backgroundColor: '#111827',
              borderRadius: '12px',
              padding: '20px 24px',
              width: '220px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '15px', color: 'white', fontWeight: 600, marginBottom: '8px' }}>
                Offtake
              </div>
              <div style={{ fontSize: '28px', color: 'white', fontWeight: 700, marginBottom: '4px' }}>
                51.53M
              </div>
              <div style={{ fontSize: '14px', color: '#ef4444', fontWeight: 700, marginBottom: '16px' }}>
                ▼ -48.92%
              </div>
              <div style={{ borderTop: '1px solid #374151', paddingTop: '12px' }}>
                <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '4px' }}>
                  Market Share
                </div>
                <div style={{ fontSize: '18px', color: 'white', fontWeight: 700, marginBottom: '2px' }}>
                  52.33%
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                  Week: 04-May to 10-May
                </div>
              </div>
            </div>
          </div>

          {/* Horizontal line from Offtake */}
          <div style={{
            position: 'absolute',
            left: '220px',
            top: '480px',
            width: '40px',
            height: '2px',
            backgroundColor: '#3b82f6'
          }} />

          {/* Vertical connector line */}
          <div style={{
            position: 'absolute',
            left: '260px',
            top: '230px',
            width: '2px',
            height: '450px',
            backgroundColor: '#3b82f6'
          }} />

          {/* Tree branches and nodes */}
          <div style={{ position: 'relative', paddingLeft: '80px' }}>
            {/* Row 1: Impression */}
            <div style={{ position: 'absolute', left: '200px', top: '90px' }}>
              <div style={{
                position: 'absolute',
                left: '-80px',
                top: '50%',
                width: '80px',
                height: '2px',
                backgroundColor: '#3b82f6'
              }} />
              <div style={{ 
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '14px 16px',
                width: '200px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '15px', color: '#111827', fontWeight: 700 }}>Impression</span>
                  <Info size={16} color="#9ca3af" />
                </div>
                <MetricCard title="Overall Impression" value="6.13M" change="-49.04%" isPositive={false} small />
                <div style={{ marginTop: '12px' }}>
                  <MetricCard title="Overall SOS" value="27.25%" change="-0.04%" isPositive={false} small />
                </div>
              </div>
            </div>

            {/* Impression child branches */}
            <div style={{ position: 'absolute', left: '500px', top: '10px' }}>
             <div style={{
                position: 'absolute',
                left: '-100px',
                top: '250px',
                width: '110px',
                height: '2px',
                backgroundColor: '#3b82f6'
              }} />
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '2px',
                height: '620px',
                backgroundColor: '#3b82f6'
              }} />

              {/* Organic Impressions */}
              <div style={{ position: 'absolute', left: 0, top: '620px' }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  width: '40px',
                  height: '2px',
                  backgroundColor: '#3b82f6'
                }} />
                <div style={{ 
                  position: 'absolute',
                  left: '40px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  width: '200px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '15px', color: '#111827', fontWeight: 700 }}>Organic Impressions</span>
                    <Info size={16} color="#9ca3af" />
                  </div>
                  <MetricCard title="Organic Impressions" value="4.93M" change="-44.48%" isPositive={false} small />
                  <div style={{ marginTop: '12px' }}>
                    <MetricCard title="Organic SOS" value="24.23%" change="-0.05%" isPositive={false} small />
                  </div>
                </div>
              </div>

              {/* Availability */}
              <div style={{ position: 'absolute', left: 0, top: 0 }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '40px',
                  height: '2px',
                  backgroundColor: '#3b82f6'
                }} />
                <div style={{ 
                  position: 'absolute',
                  left: '40px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  width: '200px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '15px', color: '#111827', fontWeight: 700 }}>Availability</span>
                    <Info size={16} color="#9ca3af" />
                  </div>
                  <MetricCard title="OSA %" value="54.10%" change="-0.41%" isPositive={false} small />
                  <div style={{
                    fontSize: '11px',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontWeight: 600,
                    marginTop: '12px'
                  }}>
                    *Click Here To Navigate<br/>To Availability Analysis
                  </div>
                </div>
              </div>

              {/* Ad Impressions */}
              <div style={{ position: 'absolute', left: 0, top: '250px' }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  width: '40px',
                  height: '2px',
                  backgroundColor: '#3b82f6'
                }} />
                <div style={{ 
                  position: 'absolute',
                  left: '40px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  width: '200px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '15px', color: '#111827', fontWeight: 700 }}>Ad Impressions</span>
                    <Info size={16} color="#9ca3af" />
                  </div>
                  <MetricCard title="Ad Impressions" value="1.20M" change="-61.92%" isPositive={false} small />
                  <div style={{ marginTop: '12px' }}>
                    <MetricCard title="Ad SOS" value="3.02%" change="0.01%" isPositive={true} small />
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontWeight: 600,
                    marginTop: '12px'
                  }}>
                    *Click Here To Navigate<br/>To SOS Analysis
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Conversion */}
            <div style={{ position: 'absolute', left: '200px', top: '650px' }}>
              <div style={{
                position: 'absolute',
                left: '-80px',
                top: '30px',
                width: '80px',
                height: '2px',
                backgroundColor: '#3b82f6'
              }} />
              <div style={{ 
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '14px 16px',
                width: '200px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '15px', color: '#111827', fontWeight: 700 }}>Conversion</span>
                  <Info size={16} color="#9ca3af" />
                </div>
                <MetricCard title="Conversion" value="4.72%" change="-0.12%" isPositive={false} small />
              </div>
            </div>
            

            {/* Conversion children */}
            <div style={{ position: 'absolute', left: '230px', top: '570px' }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: '242px',
                width: '2px',
                height: '50px',
                backgroundColor: '#3b82f6'
              }} />
              <div style={{
                position: 'absolute',
                left: '-100px',
                top: '290px',
                width: '200px',
                height: '2px',
                backgroundColor: '#3b82f6'
              }} />

              {/* Discounting */}
              <div style={{ position: 'absolute', left: '-250px', top: '350px' }}>
                <div style={{
                  position: 'absolute',
                  left: '150px',
                  top: '-60px',
                  width: '2px',
                  height: '60px',
                  backgroundColor: '#3b82f6'
                }} />
                <div style={{ 
                  position: 'absolute',
                  left: '40px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  width: '200px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '15px', color: '#111827', fontWeight: 700 }}>Discounting</span>
                    <Info size={16} color="#9ca3af" />
                  </div>
                  <MetricCard title="Discount%" value="24.22%" change="2.60%" isPositive={true} small />
                </div>
              </div>
           
            <div style={{ position: 'absolute', left: 0, top: '350px' }}>
                <div style={{
                  position: 'absolute',
                  left: '100px',
                  top: '-60px',
                  width: '2px',
                  height: '60px',
                  backgroundColor: '#3b82f6'
                }} />
                <div style={{ 
                  position: 'absolute',
                  left: '40px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  width: '200px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '15px', color: '#111827', fontWeight: 700 }}>Price Segment</span>
                    <Info size={16} color="#9ca3af" />
                  </div>
                  <MetricCard title="PPU*100" value="₹ 145.18" change="-2.87%" isPositive={false} small />
                </div>
                </div>
                 </div>
           

            {/* Row 3: Price */}
            <div style={{ position: 'absolute', left: '200px', top: '450px' }}>
              <div style={{
                position: 'absolute',
                left: '-80px',
                top: '30px',
                width: '80px',
                height: '2px',
                backgroundColor: '#3b82f6'
              }} />
              <div style={{ 
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '14px 16px',
                width: '200px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '15px', color: '#111827', fontWeight: 700 }}>Price</span>
                  <Info size={16} color="#9ca3af" />
                </div>
                <MetricCard title="ASP" value="₹ 217.19" change="12.32%" isPositive={true} small />
              </div>
            </div>

           
            
          </div>
        </div>

      
    
      </div>
    </div>
  );
};

export default RCADashboard;