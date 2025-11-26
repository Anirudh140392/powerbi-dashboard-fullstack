import React, { useState } from "react";
import { Info, Grid3X3, ChevronRight, Download } from "lucide-react";

import {
  BsGrid3X3GapFill,
  BsSearch,
  BsInfoCircle,
  BsCalendar,
} from "react-icons/bs";

import { Typography, Box } from "@mui/material";

const categoryData = [
  {
    key: "all",
    label: "All",
    metrics: {
      estimatedOfftake: { value: "₹2.3 Cr", change: "1.8%", changeValue: "₹4.3 lac", positive: false, units: "1.4 lac", unitChange: "6.6%", unitPositive: false },
      estCategoryShare: { value: "35.9%", change: "5.4%", changeValue: "-2.0%", positive: false },
      indexedImpressions: { value: "19.4 lac", change: "4.7%", changeValue: "86.5 K", positive: true, wtOsa: "75.4%", wtOsaChange: "15.5%", wtOsaPositive: false, adSov: "14.2%", adSovChange: "10.6%", adSovPositive: true },
      indexedConversion: { value: "7.0%", change: "10.6%", changeValue: "-0.8%", positive: false, wtDisc: "24.0%", wtDiscChange: "73.9%", wtDiscPositive: true },
      asp: { value: "₹132.2", change: "7.2%", changeValue: "₹10.3", positive: false }
    }
  },
  {
    key: "toothpaste",
    label: "Toothpaste",
    metrics: {
      estimatedOfftake: { value: "₹1.6 Cr", change: "4.3%", changeValue: "₹7.0 lac", positive: false, units: "86.4 K", unitChange: "8.8%", unitPositive: false },
      estCategoryShare: { value: "42.9%", change: "8.9%", changeValue: "-4.2%", positive: false },
      indexedImpressions: { value: "13.7 lac", change: "3.7%", changeValue: "48.7 K", positive: true, wtOsa: "73.8%", wtOsaChange: "17.3%", wtOsaPositive: false, adSov: "15.3%", adSovChange: "20.3%", adSovPositive: true },
      indexedConversion: { value: "6.3%", change: "12.1%", changeValue: "-0.9%", positive: false, wtDisc: "22.4%", wtDiscChange: "66.3%", wtDiscPositive: true },
      asp: { value: "₹141.0", change: "5.8%", changeValue: "₹8.8", positive: false }
    }
  },
  {
    key: "toothbrush",
    label: "Toothbrush",
    metrics: {
      estimatedOfftake: { value: "₹46.5 lac", change: "8.5%", changeValue: "₹3.6 lac", positive: true, units: "28.4 K", unitChange: "1.6%", unitPositive: false },
      estCategoryShare: { value: "29.1%", change: "2.9%", changeValue: "0.8%", positive: true },
      indexedImpressions: { value: "4.1 lac", change: "6.8%", changeValue: "25.9 K", positive: true, wtOsa: "79.2%", wtOsaChange: "12.7%", wtOsaPositive: false, adSov: "15.4%", adSovChange: "22.6%", adSovPositive: true },
      indexedConversion: { value: "7.0%", change: "7.9%", changeValue: "-0.6%", positive: false, wtDisc: "30.5%", wtDiscChange: "114.7%", wtDiscPositive: true },
      asp: { value: "₹115.5", change: "10.7%", changeValue: "₹13.8", positive: false }
    }
  },
  {
    key: "mouthwash",
    label: "Mouthwash",
    metrics: {
      estimatedOfftake: { value: "₹12.7 lac", change: "1.3%", changeValue: "₹17.2 K", positive: false, units: "6.9 K", unitChange: "1.4%", unitPositive: false },
      estCategoryShare: { value: "23.0%", change: "3.7%", changeValue: "-0.9%", positive: false },
      indexedImpressions: { value: "30.2 K", change: "3.8%", changeValue: "1.2 K", positive: false, wtOsa: "82.4%", wtOsaChange: "8.3%", wtOsaPositive: false, adSov: "2.1%", adSovChange: "78.9%", adSovPositive: false },
      indexedConversion: { value: "12.7%", change: "6.8%", changeValue: "0.8%", positive: true, wtDisc: "22.5%", wtDiscChange: "27.6%", wtDiscPositive: true },
      asp: { value: "₹143.3", change: "5.9%", changeValue: "₹9.1", positive: false }
    }
  }
];

const Change = ({ value, positive }) => (
  <span style={{ 
    color: positive ? '#16a34a' : '#dc2626', 
    fontSize: '11px', 
    fontWeight: 600,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }}>
    {positive ? '▲' : '▼'}{value}
  </span>
);

const MetricLabel = ({ label }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    height: '95px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }}>
    <span style={{ color: '#374151', fontSize: '13px', fontWeight: 500 }}>{label}</span>
    <Info size={14} color="#9ca3af" />
  </div>
);

const OfftakeCard = ({ data }) => (
  <div style={{ 
    backgroundColor: '#fff', 
    border: '1px solid #e5e7eb', 
    borderRadius: '8px', 
    padding: '12px 16px', 
    height: '88px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }}>
    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{data.value}</div>
    <div style={{ marginTop: '2px' }}>
      <Change value={`${data.change} (${data.changeValue})`} positive={data.positive} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '11px', color: '#6b7280' }}>
      <span style={{ fontSize: '11px', color: '#6b7280' }}>#Units: {data.units}</span>
      <Change value={data.unitChange} positive={data.unitPositive} />
    </div>
  </div>
);

const ShareCard = ({ data }) => (
  <div style={{ 
    backgroundColor: '#fff', 
    border: '1px solid #e5e7eb', 
    borderRadius: '8px', 
    padding: '12px 16px', 
    height: '72px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }}>
    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{data.value}</div>
    <div style={{ marginTop: '4px' }}>
      <Change value={`${data.change} (${data.changeValue})`} positive={data.positive} />
    </div>
  </div>
);

const ImpressionsCard = ({ data }) => (
  <div style={{ 
    backgroundColor: '#fff', 
    border: '1px solid #e5e7eb', 
    borderRadius: '8px', 
    padding: '12px 16px', 
    height: '124px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }}>
    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{data.value}</div>
    <div style={{ marginTop: '2px' }}>
      <Change value={`${data.change} (${data.changeValue})`} positive={data.positive} />
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px' }}>
      <span style={{ fontSize: '11px', color: '#6b7280' }}>
        Wt. OSA % <span style={{ fontWeight: 600, color: '#111' }}>{data.wtOsa}</span>
      </span>
      <Change value={data.wtOsaChange} positive={data.wtOsaPositive} />
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px' }}>
      <span style={{ fontSize: '11px', color: '#6b7280' }}>
        Ad. SOV: <span style={{ fontWeight: 600, color: '#111' }}>{data.adSov}</span>
      </span>
      <Change value={data.adSovChange} positive={data.adSovPositive} />
    </div>
  </div>
);

const ConversionCard = ({ data }) => (
  <div style={{ 
    backgroundColor: '#fff', 
    border: '1px solid #e5e7eb', 
    borderRadius: '8px', 
    padding: '12px 16px', 
    height: '95px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }}>
    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{data.value}</div>
    <div style={{ marginTop: '2px' }}>
      <Change value={`${data.change} (${data.changeValue})`} positive={data.positive} />
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px' }}>
      <span style={{ fontSize: '11px', color: '#6b7280' }}>
        Wt. Disc%: <span style={{ fontWeight: 600, color: '#111' }}>{data.wtDisc}</span>
      </span>
      <Change value={data.wtDiscChange} positive={data.wtDiscPositive} />
    </div>
  </div>
);

const AspCard = ({ data }) => (
  <div style={{ 
    backgroundColor: '#fff', 
    border: '1px solid #e5e7eb', 
    borderRadius: '8px', 
    padding: '12px 16px', 
    height: '75px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }}>
    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{data.value}</div>
    <div style={{ marginTop: '4px' }}>
      <Change value={`${data.change} (${data.changeValue})`} positive={data.positive} />
    </div>
  </div>
);

const ActionButtons = () => ({ catLabel, onViewTrends }) => (
  <div style={{ marginTop: '12px' }}>
    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
      <button style={{
        fontSize: '11px', 
        fontWeight: 600, 
        color: '#2563eb', 
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe', 
        borderRadius: '16px', 
        padding: '6px 14px',
        cursor: 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        📊 Impact SKUs
      </button>
      <button style={{
        fontSize: '11px', 
        fontWeight: 600, 
        color: '#6b7280', 
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb', 
        borderRadius: '16px', 
        padding: '6px 14px',
        cursor: 'pointer',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        🔗 RCA
      </button>
    </div>
    <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
    
     <button
        onClick={(e) => {
          e.stopPropagation();
          onViewTrends(catLabel);   // ✔️ correct
        }}
        style={{
          fontSize: '11px',
          color: '#2563eb',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '2px'
        }}
      >
        View Trends <ChevronRight size={12} />
      </button>

      <button style={{ 
        fontSize: '11px', 
        color: '#2563eb', 
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        Competition <ChevronRight size={12} />
      </button>
    </div>
    <button style={{ 
      fontSize: '11px', 
      color: '#2563eb', 
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      Cross Platform
      <span style={{ 
        width: '18px', 
        height: '18px', 
        borderRadius: '50%', 
        backgroundColor: '#f3e8ff', 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: '10px',
        color: '#7c3aed'
      }}>
        ◎
      </span>
    </button>
  </div>
);

export default function CategoryPlatformOverview({ data = categoryData, onViewTrends }) {
  const [selected, setSelected] = useState("all");

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ backgroundColor: '#fff', minHeight: '100vh', padding: '24px 12px' }}>
        {/* Header */}
         <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
          mb={3}
        >
          <Box display="flex" alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "#f8f9fa",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BsGrid3X3GapFill size={20} color="#0d6efd" />
            </Box>

            <Typography ml={1.2} fontWeight={600} fontSize="1.1rem">
              City Level Breakdown
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            {/* Stale Data */}
            <Box
              display="flex"
              alignItems="center"
              px={1.5}
              py={0.7}
              sx={{
                borderRadius: 1,
                fontSize: "0.8rem",
                fontWeight: 500,
                background: "#f8f3f0",
                border: "1px solid #e3dad6",
                color: "#6c757d",
              }}
            >
              <BsCalendar style={{ marginRight: 6 }} /> Stale Data
            </Box>

            {/* Search Box */}
            <Box
              display="flex"
              alignItems="center"
              px={1.5}
              sx={{
                borderRadius: 5,
                width: 220,
                height: 36,
                border: "1px solid #dee2e6",
                background: "#f2f6fb",
              }}
            >
              <input
                type="text"
                placeholder="Search"
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "0.85rem",
                }}
              />
              <BsSearch size={15} color="#6c757d" />
            </Box>
          </Box>
        </Box>

        {/* Time Period */}
       
        {/* Main Content */}
        <div style={{ padding: '20px'}}>
          <div style={{ display: 'flex', gap: '16px', minWidth: 'max-content',  backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', borderColor: '#e5e7eb', borderWidth: '1px', borderStyle: 'solid' }}>
            {/* Left Labels */}
            <div style={{ width: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  backgroundColor: '#f3f4f6', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Grid3X3 size={18} color="#6b7280" />
                </div>
              </div>
              <MetricLabel label="Estimated Offtake" />
              <MetricLabel label="Est. Category Share" />
              <div style={{ 
                backgroundColor: '#f3f4f6', 
                borderRadius: '6px', 
                padding: '21px 24px', 
                fontSize: '11px', 
                fontWeight: 600, 
                color: '#6b7280',
                fontStyle: 'italic'
              }}>
                Components
              </div>
              <MetricLabel label="Indexed Impressions" />
              <MetricLabel label="Indexed Conversion" />
              <MetricLabel label="ASP" />
            </div>

            {/* Category Columns */}
      
            {categoryData.map((cat) => (
              <div key={cat.key} style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={() => setSelected(cat.key)}
                  style={{
                    height: '44px',
                    borderRadius: '8px',
                    border: selected === cat.key ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    backgroundColor: selected === cat.key ? '#2563eb' : '#fff',
                    color: selected === cat.key ? '#fff' : '#374151',
                    fontSize: '13px',
                    fontWeight: 600,
                    width: '100%',
                    cursor: 'pointer',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  {cat.label}
                </button>

                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                  width: '250px', 
                  height: '200px', 
                  backgroundColor: '#f3f4f6', 
                  borderRadius: 4, 
                  padding: 8,
                 py:4,
                 
                }}>
                <OfftakeCard data={cat.metrics.estimatedOfftake} />
                <ShareCard data={cat.metrics.estCategoryShare} />
                </div>
                <div style={{ height: '34px' }} />
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                  width: '250px', 
                  height: '450px', 
                
                  backgroundColor: '#f3f4f6', 
                  borderRadius: 4, 
                  padding: 8,
                 py:4,
                 
                }}>
                <ImpressionsCard data={cat.metrics.indexedImpressions} />
                <ConversionCard data={cat.metrics.indexedConversion} />
                <AspCard data={cat.metrics.asp} />
                <ActionButtons  catLabel={cat.label}
  onViewTrends={onViewTrends} />
                </div>
              
              </div>
            ))}
          </div>
        
        </div>
      </div>
    </div>
  );
}