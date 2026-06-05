import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileSpreadsheet, 
  ArrowLeftRight, 
  ArrowUpRight,
  Crown
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from "recharts";
import { useAuth } from "../../../utils/AuthContext";

export default function SalesOverview() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("billing"); // "billing", "d2c", "comparison"

  const isDrlUser = user?.dbName === "drl";

  // Mock Data
  const data = {
    billing: {
      kpis: [
        { label: "Gross billing", value: "₹48.3 Cr", trend: "+6.2% MoM", isPositive: true },
        { label: "Net amount", value: "₹43.1 Cr", trend: "+5.8%", isPositive: true },
        { label: "Active CFAs", value: "12", subtext: "1,842 docs" },
        { label: "Avg PTR", value: "₹886", trend: "-1.1%", isPositive: false },
      ],
      distributorsTitle: "Top distributors / CFAs",
      distributors: [
        { name: "Counfreedise", value: "₹36.1 Cr", percentage: 75, color: "#3b82f6" },
        { name: "Ean Enterprises", value: "₹5.2 Cr", percentage: 11, color: "#60a5fa" },
        { name: "Hasmukh Agency", value: "₹2.4 Cr", percentage: 5, color: "#93c5fd" },
        { name: "Others", value: "₹4.6 Cr", percentage: 9, color: "#cbd5e1" },
      ],
      zonesTitle: "Zone split",
      zones: [
        { name: "West", value: "₹33.7 Cr", percentage: 78, color: "#3b82f6" },
        { name: "North", value: "₹6.4 Cr", percentage: 15, color: "#93c5fd" },
        { name: "South", value: "₹3.2 Cr", percentage: 7, color: "#cbd5e1" },
      ],
      footerText: "Monthly refresh · last uploaded 01 May 2026",
      footerLinkText: "Brand & division",
      footerDotColor: "bg-amber-500"
    },
    d2c: {
      kpis: [
        { label: "GMV", value: "₹15.1 Cr", trend: "+1.3%", isPositive: true },
        { label: "Conversion", value: "55.96%", trend: "-1.08%", isPositive: false },
        { label: "Availability", value: "81.00%", trend: "+1.4%", isPositive: true },
        { label: "Orders", value: "486K", trend: "+2.45%", isPositive: true },
      ],
      platformsTitle: "Platform split",
      platforms: [
        { name: "Blinkit", value: "₹7.5 Cr", percentage: 50, color: "#10b981" },
        { name: "Dunzo", value: "₹4.1 Cr", percentage: 27, color: "#34d399" },
        { name: "Instamart", value: "₹2.6 Cr", percentage: 17, color: "#a7f3d0" },
      ],
      footerText: "Refreshes daily · as of today",
      footerLinkText: "Platform detail",
      footerDotColor: "bg-emerald-500"
    },
    comparison: {
      kpis: [
        { label: "Billing vs D2C ratio", value: "4.5x", trend: "+2.1% MoM", isPositive: true },
        { label: "Zone alignment", value: "92%", subtext: "Highly aligned" },
        { label: "Distributor overlap", value: "14", subtext: "Active distributors" },
        { label: "Avg unit realization delta", value: "₹1,503", trend: "+3.4%", isPositive: true },
      ],
      chartTitle: "Monthly trend — primary vs secondary",
      chartData: [
        { month: "Nov", primary: 35, secondary: 15 },
        { month: "Dec", primary: 45, secondary: 18 },
        { month: "Jan", primary: 50, secondary: 20 },
        { month: "Feb", primary: 55, secondary: 22 },
        { month: "Mar", primary: 60, secondary: 24 },
        { month: "Apr", primary: 75, secondary: 30 },
      ],
      footerText: "Refreshes daily · as of today",
      footerLinkText: "Comparison detail",
      footerDotColor: "bg-emerald-500"
    }
  };

  // If NOT a DRL user, show it as a beautiful premium teaser feature
  if (!isDrlUser) {
    return (
      <div className="w-full rounded-[24px] bg-white border border-slate-200/80 shadow-md p-5 lg:p-6 mb-6 relative overflow-hidden transition-all duration-300 hover:shadow-lg">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-100/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-50/30 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Locked Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-50 text-slate-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-400 tracking-tight" style={{ fontFamily: "Inter, sans-serif" }}>
                Sales overview
              </h3>
              <p className="text-[11px] text-slate-400 font-medium" style={{ fontFamily: "Inter, sans-serif" }}>
                Monitor billing vs D2C splits and distributor performance
              </p>
            </div>
          </div>
          <div className="text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5" style={{ fontFamily: "Inter, sans-serif" }}>
            Apr 2026
          </div>
        </div>

        {/* Premium Upgrade Content Area */}
        <div className="flex flex-col items-center text-center py-6 px-4 relative z-10">
          {/* Logo badge with gold gradient border */}
          <div className="relative mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-50 via-yellow-100/30 to-orange-50 border border-amber-200/50 shadow-inner">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400/20 animate-ping" />
            <Crown className="w-7 h-7 text-amber-500 drop-shadow-sm" />
          </div>

          <h4 className="text-base font-extrabold tracking-tight mb-2" style={{ fontFamily: "Inter, sans-serif" }}>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600">
              ✦ Sales Intelligence Premium
            </span>
          </h4>

          <p className="max-w-md text-[11px] text-slate-500 leading-relaxed font-medium" style={{ fontFamily: "Inter, sans-serif" }}>
            Access primary billing insights, secondary D2C sales channel splits, distributor performance indicators, and monthly comparison trends. Contact administrator to upgrade.
          </p>
        </div>

        {/* Locked Background Teaser */}
        <div className="w-full opacity-5 pointer-events-none select-none relative z-0 mt-2 filter blur-[3px]">
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-slate-200 rounded-xl" />
            ))}
          </div>
          <div className="h-20 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const activeData = data[activeTab];

  return (
    <div className="w-full rounded-[24px] bg-white border border-slate-200/80 shadow-md p-4 lg:p-6 mb-6 transition-all duration-300 hover:shadow-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 mb-4 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight" style={{ fontFamily: "Inter, sans-serif" }}>
              Sales overview
            </h3>
            <p className="text-[11px] text-slate-500 font-medium" style={{ fontFamily: "Inter, sans-serif" }}>
              Monitor billing vs D2C splits and distributor performance
            </p>
          </div>
        </div>
        <div className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 self-end sm:self-center" style={{ fontFamily: "Inter, sans-serif" }}>
          Apr 2026
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 mb-6 overflow-x-auto gap-2 sm:gap-6 no-scrollbar">
        <button
          onClick={() => setActiveTab("billing")}
          className={`flex items-center gap-2 py-3 px-1 text-xs font-semibold border-b-2 transition-all outline-none ${
            activeTab === "billing"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          Primary — billing
        </button>
        <button
          onClick={() => setActiveTab("d2c")}
          className={`flex items-center gap-2 py-3 px-1 text-xs font-semibold border-b-2 transition-all outline-none ${
            activeTab === "d2c"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          Secondary — D2C
        </button>
        <button
          onClick={() => setActiveTab("comparison")}
          className={`flex items-center gap-2 py-3 px-1 text-xs font-semibold border-b-2 transition-all outline-none ${
            activeTab === "comparison"
              ? "border-blue-600 text-blue-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
          Comparison
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 border border-slate-100 rounded-2xl divide-x divide-y md:divide-y-0 divide-slate-100 overflow-hidden mb-6">
            {activeData.kpis.map((kpi, idx) => (
              <div key={idx} className="p-4 flex flex-col justify-between min-h-[95px] bg-slate-50/20">
                <span className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase" style={{ fontFamily: "Inter, sans-serif" }}>
                  {kpi.label}
                </span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-xl font-bold text-slate-800" style={{ fontFamily: "Inter, sans-serif" }}>
                    {kpi.value}
                  </span>
                  {kpi.trend && (
                    <span
                      className={`text-[11px] font-bold ${
                        kpi.isPositive ? "text-emerald-600" : "text-rose-600"
                      }`}
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {kpi.trend}
                    </span>
                  )}
                  {kpi.subtext && (
                    <span className="text-[11px] text-slate-500 font-medium" style={{ fontFamily: "Inter, sans-serif" }}>
                      {kpi.subtext}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* D2C Tab Layout */}
          {activeTab === "d2c" && (
            <div className="bg-[#f7f7f5]/80 border border-slate-100 rounded-2xl p-5">
              <h4 className="text-xs font-bold text-slate-700 mb-4" style={{ fontFamily: "Inter, sans-serif" }}>
                {activeData.platformsTitle}
              </h4>
              <div className="space-y-4">
                {activeData.platforms.map((plat, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-600" style={{ fontFamily: "Inter, sans-serif" }}>
                        {plat.name}
                      </span>
                      <span className="font-bold text-slate-800" style={{ fontFamily: "Inter, sans-serif" }}>
                        {plat.value}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${plat.percentage}%`,
                          backgroundColor: plat.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparison Tab Layout */}
          {activeTab === "comparison" && (
            <div className="bg-[#f7f7f5]/80 border border-slate-100 rounded-2xl p-5">
              <h4 className="text-xs font-bold text-slate-700 mb-4" style={{ fontFamily: "Inter, sans-serif" }}>
                {activeData.chartTitle}
              </h4>
              
              <div className="w-full h-[160px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activeData.chartData}
                    barGap={4}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <XAxis 
                      dataKey="month" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
                    />
                    <YAxis hide={true} />
                    <Tooltip 
                      cursor={{ fill: "transparent" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "11px",
                        fontFamily: "Inter, sans-serif"
                      }}
                    />
                    
                    {/* Primary Bar */}
                    <Bar dataKey="primary" radius={[4, 4, 0, 0]}>
                      {activeData.chartData.map((entry, index) => {
                        const isApr = entry.month === "Apr";
                        return (
                          <Cell 
                            key={`cell-pri-${index}`} 
                            fill={isApr ? "#3b82f6" : "#bfdbfe"} 
                          />
                        );
                      })}
                    </Bar>
                    
                    {/* Secondary Bar */}
                    <Bar dataKey="secondary" radius={[4, 4, 0, 0]}>
                      {activeData.chartData.map((entry, index) => {
                        const isApr = entry.month === "Apr";
                        return (
                          <Cell 
                            key={`cell-sec-${index}`} 
                            fill={isApr ? "#10b981" : "#bbf7d0"} 
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Custom Legend */}
              <div className="flex items-center gap-4 mt-3 text-[11px] font-bold text-slate-500 pl-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                  Primary (billing)
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  Secondary (D2C)
                </div>
              </div>
            </div>
          )}

          {/* Billing Tab Layout: Two Columns */}
          {activeTab === "billing" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-slate-700 mb-4" style={{ fontFamily: "Inter, sans-serif" }}>
                  {activeData.distributorsTitle}
                </h4>
                <div className="space-y-3.5">
                  {activeData.distributors.map((dist, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-600" style={{ fontFamily: "Inter, sans-serif" }}>
                          {dist.name}
                        </span>
                        <span className="font-bold text-slate-800" style={{ fontFamily: "Inter, sans-serif" }}>
                          {dist.value}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${dist.percentage}%`,
                            backgroundColor: dist.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-slate-700 mb-4" style={{ fontFamily: "Inter, sans-serif" }}>
                  {activeData.zonesTitle}
                </h4>
                <div className="space-y-3.5">
                  {activeData.zones.map((zone, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-600" style={{ fontFamily: "Inter, sans-serif" }}>
                          {zone.name}
                        </span>
                        <span className="font-bold text-slate-800" style={{ fontFamily: "Inter, sans-serif" }}>
                          {zone.value}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${zone.percentage}%`,
                            backgroundColor: zone.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <span className={`w-2 h-2 rounded-full ${activeData.footerDotColor}`} />
          {activeData.footerText}
        </div>
        <a
          href={`#${activeData.footerLinkText.toLowerCase().replace(/\s+/g, "-")}`}
          className="flex items-center gap-0.5 text-blue-600 hover:text-blue-700 font-bold transition-all"
          onClick={(e) => e.preventDefault()}
        >
          {activeData.footerLinkText} <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
