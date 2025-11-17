import React, { useState } from "react";
import { createPortal } from "react-dom";

import { X, ChevronDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import TrendController from "../utils/TrendController"; // <-- IMPORTANT: frontend controller

const MyTrendsDrawer = ({ open, onClose, trendData = {}, trendParams = {} }) => {
  // Prefer data passed from Dashboard; otherwise generate locally
  const hasRemoteData = Array.isArray(trendData.timeSeries) && trendData.timeSeries.length > 0;


  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  const [timeStep, setTimeStep] = useState('Weekly');
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);
   const [selectedMetrics, setSelectedMetrics] = useState({
    offtake: true,
    estCategoryShare: true,
    osa: true,
    discount: false,
    overallSOV: false
  });

  // Controller fallback (only used if dashboard didn't provide data)
  const controller = new TrendController();

  // Compute months based on selectedPeriod
  const months =
    selectedPeriod === "1M" ? 1 :
    selectedPeriod === "3M" ? 3 :
    selectedPeriod === "6M" ? 6 : 12;

  // Final data + metrics used by chart
  const data = hasRemoteData ? trendData.timeSeries : controller.generateData(months, timeStep);
  const metrics = hasRemoteData ? (trendData.metrics || {}) : controller.getMetrics(data);

  const platform = trendParams.platform || "Blinkit";
  const location = trendParams.location || "All";

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          <div className="text-gray-400 mb-2 flex items-center gap-2">
            <span>{payload[0].payload.date}</span>
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <span className="text-xs">Avg: last weekly</span>
            </span>
          </div>
          {selectedMetrics.offtake && (
            <div className="flex items-center justify-between gap-8 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>Offtake</span>
              </div>
              <span className="font-semibold">
                ₹ {payload[0].payload.offtake.toFixed(2)} Cr 
                <span className="text-green-400 ml-2">(+6.6%)</span>
              </span>
            </div>
          )}
          {selectedMetrics.osa && (
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>OSA%</span>
              </div>
              <span className="font-semibold">~ (100%)</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return createPortal(
    <>
      {open && (
        <>
       <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998
        }}
        onClick={onClose} 
      />
      {/* Drawer */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '700px',
          maxWidth: '90vw',
          backgroundColor: 'white',
          boxShadow: '-4px 0 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 9999,
          overflowY: 'auto'
        }}
      >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <h2 className="text-xl font-semibold">My Trends</h2>
                  <span className="text-sm text-gray-500">at</span>
                  <span className="bg-teal-100 text-teal-700 px-2 py-1 rounded text-xs font-medium">MRP</span>
                  <span className="text-sm text-gray-500">for</span>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">Blinkit</span>
                </div>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Period and Time Step Selection */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="custom" className="w-4 h-4" />
                  <label htmlFor="custom" className="text-sm text-gray-700">Custom</label>
                </div>
                
                <div className="flex gap-2">
                  {['1M', '3M', '6M', '1Y'].map(period => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                        selectedPeriod === period
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-gray-600">Time Step:</span>
                  <div className="relative">
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-medium">{timeStep}</span>
                      <ChevronDown size={16} className="text-gray-500" />
                    </button>
                    
                    {showDropdown && (
                      <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                        {['Daily', 'Weekly', 'Monthly'].map(step => (
                          <button
                            key={step}
                            onClick={() => {
                              setTimeStep(step);
                              setShowDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                              timeStep === step ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                            }`}
                          >
                            {step}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Metric Toggles */}
              <div className="flex flex-wrap gap-4 mb-6">
                {[
                  { key: 'offtake', label: 'Offtake', color: 'bg-red-500' },
                  { key: 'estCategoryShare', label: 'Est. Category Share', color: 'bg-purple-500' },
                  { key: 'osa', label: 'OSA%', color: 'bg-green-500' },
                  { key: 'discount', label: 'Wt. Discount%', color: 'bg-blue-500' },
                  { key: 'overallSOV', label: 'Overall SOV', color: 'bg-pink-500' }
                ].map(metric => (
                  <label key={metric.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMetrics[metric.key]}
                      onChange={(e) => setSelectedMetrics({
                        ...selectedMetrics,
                        [metric.key]: e.target.checked
                      })}
                      className="w-4 h-4"
                    />
                    <div className={`w-3 h-3 rounded-full ${metric.color}`}></div>
                    <span className="text-sm text-gray-700">{metric.label}</span>
                  </label>
                ))}
              </div>

              {/* Chart */}
              <div className="bg-gray-50 rounded-lg p-6" style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={data}
                    onMouseMove={(e) => {
                      if (e && e.activePayload) {
                        setHoveredPoint(e.activePayload[0].payload);
                      }
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickLine={false}
                      domain={[0, 3.5]}
                      ticks={[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]}
                      tickFormatter={(value) => `₹ ${value} Cr`}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickLine={false}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {selectedMetrics.offtake && (
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="offtake" 
                        stroke="#ef4444" 
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    )}
                    {selectedMetrics.osa && (
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="osa" 
                        stroke="#22c55e" 
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    )}
                    {selectedMetrics.discount && (
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="discount" 
                        stroke="#3b82f6" 
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    )}
                    {selectedMetrics.overallSOV && (
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="sov" 
                        stroke="#ec4899" 
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Stats */}
              <div className="mt-6 text-sm text-gray-600">
                <p>Showing {data.length} data points for {selectedPeriod} period with {timeStep} intervals</p>
                <div className="flex gap-6 mt-2">
                  {selectedMetrics.offtake && (
                    <div>
                      <span className="font-semibold text-gray-800">Latest Offtake:</span> {metrics.offtake.value} 
                      <span className={metrics.offtake.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {' '}({metrics.offtake.change >= 0 ? '+' : ''}{metrics.offtake.change}%)
                      </span>
                    </div>
                  )}
                  {selectedMetrics.osa && (
                    <div>
                      <span className="font-semibold text-gray-800">Latest OSA:</span> {metrics.osa.value}
                    </div>
                  )}
                </div>
              </div>
            </div>
        
          
        </>
      )}
    </>,
     document.body
  );
};

export default MyTrendsDrawer;