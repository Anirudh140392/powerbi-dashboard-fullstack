import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileSpreadsheet, 
  ArrowLeftRight, 
  ArrowUpRight,
  Crown,
  Download,
  Navigation,
  Lock
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList
} from "recharts";
import { useAuth } from "../../../utils/AuthContext";

const DRL_MOCK_DATA = {
  primaryMom: [
    { month: "Dec-23", value: 0.75, label: "75.99L" },
    { month: "Jan-24", value: 0.19, label: "19.19L" },
    { month: "Feb-24", value: 0.27, label: "27.81L" },
    { month: "Mar-24", value: 0.73, label: "73.40L" },
    { month: "Apr-24", value: 1.05, label: "1.05CR" },
    { month: "May-24", value: 1.15, label: "1.15CR" },
    { month: "Jun-24", value: 1.84, label: "1.84CR" },
    { month: "Jul-24", value: 2.07, label: "2.07CR" },
    { month: "Aug-24", value: 2.50, label: "2.50CR" },
    { month: "Sep-24", value: 1.89, label: "1.89CR" },
    { month: "Oct-24", value: 2.79, label: "2.79CR" },
    { month: "Nov-24", value: 1.58, label: "1.58CR" },
    { month: "Dec-24", value: 1.72, label: "1.72CR" },
    { month: "Jan-25", value: 2.06, label: "2.06CR" },
    { month: "Feb-25", value: 2.61, label: "2.61CR" },
    { month: "Mar-25", value: 3.54, label: "3.54CR" },
    { month: "Apr-25", value: 4.68, label: "4.68CR" },
    { month: "May-25", value: 5.10, label: "5.10CR" },
    { month: "Jun-25", value: 4.26, label: "4.26CR" },
    { month: "Jul-25", value: 3.88, label: "3.88CR" },
    { month: "Aug-25", value: 0.75, label: "75.11L" },
  ],
  quarterWise: [
    { quarter: "Q3 2022", value: 0.19, label: "19.19L" },
    { quarter: "Q4 2022", value: 1.68, label: "1.68CR" },
    { quarter: "Q1 2023", value: 2.61, label: "2.61CR" },
    { quarter: "Q2 2023", value: 4.10, label: "4.10CR" },
    { quarter: "Q3 2023", value: 6.40, label: "6.40CR" },
    { quarter: "Q4 2023", value: 6.26, label: "6.26CR" },
    { quarter: "Q1 2024", value: 4.55, label: "4.55CR" },
    { quarter: "Q2 2024", value: 6.46, label: "6.46CR" },
    { quarter: "Q3 2024", value: 13.31, label: "13.31CR" },
    { quarter: "Q4 2024", value: 12.59, label: "12.59CR" },
    { quarter: "Q1 2025", value: 0.75, label: "75.11L" },
  ],
  tableData: [
    { retailer: "Amazon Retail India Pvt Limite", dec22: "1,918,624", jan23: "7,598,656", feb23: "2,781,259", mar23: "6,446,795", apr23: "6,908,719", may23: "8,156,123", jun23: "10,432,064", jul23: "9,864,867", aug23: "10,995,096", sep23: "16,877,336", oct23: "15,370,454", nov23: "19,507,834" },
    { retailer: "Counfreedise Retail Services L", dec22: "", jan23: "", feb23: "", mar23: "", apr23: "431,398", may23: "185,227", jun23: "32,123", jul23: "1,205,317", aug23: "535,137", sep23: "1,503,748", oct23: "1,551,458", nov23: "1,185,240" },
    { retailer: "Ean Enterprises", dec22: "", jan23: "", feb23: "", mar23: "", apr23: "", may23: "", jun23: "", jul23: "", aug23: "", sep23: "", oct23: "1,415,187", nov23: "32,271" },
    { retailer: "Hasmukh Agency", dec22: "", jan23: "", feb23: "", mar23: "", apr23: "", may23: "", jun23: "", jul23: "", aug23: "", sep23: "", oct23: "", nov23: "" },
    { retailer: "Katalysst Cpg Consultants Llp", dec22: "", jan23: "", feb23: "", mar23: "", apr23: "", may23: "", jun23: "", jul23: "", aug23: "", sep23: "", oct23: "", nov23: "" },
    { retailer: "Nykaa E-Retail Limited", dec22: "", jan23: "", feb23: "", mar23: "", apr23: "", may23: "", jun23: "", jul23: "", aug23: "", sep23: "", oct23: "", nov23: "" },
    { retailer: "Rk Worldinfocom Private Limite", dec22: "", jan23: "", feb23: "", mar23: "", apr23: "", may23: "", jun23: "", jul23: "", aug23: "", sep23: "", oct23: "", nov23: "" },
  ]
};

export default function SalesOverview() {
  const { user } = useAuth();
  // Adjust this condition based on the users that are actually authorized. 
  // We'll use 'drl' or 'trailytics' as an example of authorized DBs that shouldn't see the lock.
  const showSalesOverview = user?.dbName === "drl" || user?.dbName === "trailytics";

  const [viewMode, setViewMode] = useState('Units');

  const getMappedData = () => {
    const isMRP = viewMode === 'MRP';
    const mapLabel = (label) => {
      if (!label) return label;
      if (isMRP) return `₹${label}`;
      return label.replace('CR', 'K').replace('L', '');
    };
    const mapTableVal = (val) => {
      if (!val) return val;
      if (isMRP) return `₹${val}`;
      return val;
    };

    return {
      primaryMom: DRL_MOCK_DATA.primaryMom.map(d => ({ ...d, label: mapLabel(d.label) })),
      quarterWise: DRL_MOCK_DATA.quarterWise.map(d => ({ ...d, label: mapLabel(d.label) })),
      tableData: DRL_MOCK_DATA.tableData.map(row => {
        const newRow = { ...row };
        Object.keys(newRow).forEach(k => {
          if (k !== 'retailer' && newRow[k]) {
            newRow[k] = mapTableVal(newRow[k]);
          }
        });
        return newRow;
      })
    };
  };

  const currentData = getMappedData();

  return (
    <div className="relative w-full mb-8">
      <div className={`w-full bg-white rounded-[24px] border border-slate-100 p-5 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-sans transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] ${!showSalesOverview ? "blur-[2px] pointer-events-none select-none" : ""}`}>
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full" />
            <h2 className="text-lg lg:text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 tracking-tight">
              PRIMARY SUMMARY
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Animated Toggle */}
            <div className="flex items-center bg-slate-100/80 p-1 rounded-xl shadow-inner border border-slate-200/50">
              <button 
                onClick={() => setViewMode('Units')}
                className={`relative px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 z-10 ${
                  viewMode === 'Units' ? 'text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {viewMode === 'Units' && (
                  <motion.div 
                    layoutId="toggleBg" 
                    className="absolute inset-0 bg-white rounded-lg -z-10" 
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                Units
              </button>
              <button 
                onClick={() => setViewMode('MRP')}
                className={`relative px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 z-10 ${
                  viewMode === 'MRP' ? 'text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {viewMode === 'MRP' && (
                  <motion.div 
                    layoutId="toggleBg" 
                    className="absolute inset-0 bg-white rounded-lg -z-10" 
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                MRP
              </button>
            </div>

            <button className="p-2 bg-orange-50 text-orange-500 border border-orange-100 rounded-xl hover:bg-orange-500 hover:text-white transition-colors shadow-sm">
              <Download size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
          {['BRAND NAME', 'RETAILER NAME', 'PRODUCT', 'DIVISION', 'ZONE', 'X-AXIS'].map((filterName, idx) => (
            <div key={idx} className="flex flex-col gap-1.5 flex-1 min-w-[130px] group">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors ml-1">{filterName}</label>
              <div className="relative">
                <select className="w-full appearance-none bg-white border border-slate-200 rounded-xl py-2 pl-3 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm cursor-pointer hover:border-slate-300">
                  {filterName === 'X-AXIS' ? <option>Retailer Name</option> : <option>All</option>}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <motion.div 
            whileHover={{ y: -2 }}
            className="border border-slate-100 rounded-2xl bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] transition-all duration-300"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-fuchsia-500" />
              <h4 className="text-[11px] font-extrabold text-slate-600 uppercase tracking-widest">PRIMARY MOM</h4>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentData.primaryMom} margin={{ top: 20, right: 10, left: 10, bottom: 20 }} barCategoryGap="20%">
                  <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} angle={-45} textAnchor="end" interval={0} axisLine={false} tickLine={false} dy={10} />
                  <Tooltip cursor={{ fill: "rgba(241, 245, 249, 0.6)", rx: 8 }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }} />
                  <Bar dataKey="value" fill="#d946ef" radius={[4, 4, 0, 0]} maxBarSize={30}>
                    <LabelList dataKey="label" position="top" style={{ fontSize: '10px', fontWeight: '800', fill: '#64748b' }} offset={8} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          
          <motion.div 
            whileHover={{ y: -2 }}
            className="border border-slate-100 rounded-2xl bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_15px_-4px_rgba(0,0,0,0.1)] transition-all duration-300"
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <h4 className="text-[11px] font-extrabold text-slate-600 uppercase tracking-widest">QUARTER WISE PRIMARY DATA</h4>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentData.quarterWise} margin={{ top: 20, right: 10, left: 10, bottom: 20 }} barCategoryGap="25%">
                  <XAxis dataKey="quarter" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} interval={0} axisLine={false} tickLine={false} dy={10} />
                  <Tooltip cursor={{ fill: "rgba(241, 245, 249, 0.6)", rx: 8 }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={45}>
                    <LabelList dataKey="label" position="top" style={{ fontSize: '10px', fontWeight: '800', fill: '#64748b' }} offset={8} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Table */}
        <div className="border border-slate-100 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-widest">BRAND WISE PRIMARY</h4>
            </div>
          </div>
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="font-bold text-slate-400 border-b border-r border-slate-200 py-4 px-5 min-w-[220px] uppercase tracking-wider sticky left-0 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-20">Retailer Name</th>
                  {['Dec-22', 'Jan-23', 'Feb-23', 'Mar-23', 'Apr-23', 'May-23', 'Jun-23', 'Jul-23', 'Aug-23', 'Sep-23', 'Oct-23', 'Nov-23', 'Dec-23'].map(m => (
                    <th key={m} className="font-bold text-slate-400 border-b border-r border-slate-100 last:border-r-0 py-4 px-3 whitespace-nowrap text-right uppercase tracking-wider">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentData.tableData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group bg-white">
                    <td className="py-3.5 px-5 font-bold text-slate-700 sticky left-0 bg-slate-50 group-hover:bg-slate-100 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-20 border-r border-slate-200">{row.retailer}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.dec22}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.jan23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.feb23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.mar23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.apr23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.may23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.jun23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.jul23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.aug23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.sep23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.oct23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium border-r border-slate-100">{row.nov23}</td>
                    <td className="py-3.5 px-3 text-right text-slate-600 font-medium last:border-r-0">{row.dec23 || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lock Overlay for non-authorized users */}
      {!showSalesOverview && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/30 backdrop-blur-md rounded-[24px]">
          <div className="bg-white/95 border border-slate-100 p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] max-w-sm text-center flex flex-col items-center transform transition-all hover:scale-[1.02]">
            <div className="relative mb-6 flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-50 border border-amber-200/50 shadow-inner">
              <Lock className="w-8 h-8 text-amber-500" />
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full p-1.5 shadow-lg border-2 border-white">
                <Crown className="w-3 h-3" />
              </div>
            </div>

            <h4 className="text-lg font-black tracking-tight mb-3">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-orange-600">
                Unlock Sales Intelligence
              </span>
            </h4>

            <p className="text-xs text-slate-500 leading-relaxed font-medium mb-8">
              Get full access to primary billing insights, D2C channel splits, and brand-wise performance metrics. Upgrade your workspace to view this data.
            </p>

            <button className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-[0_4px_15px_rgba(0,0,0,0.15)] transition-all hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] flex items-center justify-center gap-2">
              Upgrade Workspace <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
