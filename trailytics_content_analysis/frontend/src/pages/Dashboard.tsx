import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { 
  ChevronDown, Check, Search, TrendingUp, TrendingDown, BarChart2, ImageIcon, ShoppingCart,
  ChevronRight, Activity, SlidersHorizontal, ExternalLink, Info, X, AlertCircle,
  Filter, MapPin, Tag, Calendar, Settings, Gauge, Image as LucideImage, ShieldCheck, Target, LayoutGrid,
  Type, Images, AlignLeft
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

// --- CHART DATA (kept as-is — historical trend data is not in scope) ---

const lineChartData = [
  { name: 'Dec 02', score: 62, image: 58 },
  { name: 'Dec 04', score: 68, image: 63 },
  { name: 'Dec 06', score: 65, image: 64 },
  { name: 'Dec 08', score: 71, image: 64 },
  { name: 'Dec 10', score: 69, image: 69 },
  { name: 'Dec 12', score: 72, image: 73 },
  { name: 'Dec 14', score: 74, image: 71 },
];

// --- API TYPES ---

const API_BASE = '/api';

interface ApiProduct {
  productId: string;
  title: string;
  totalScore: number | null;
  titleScore: number | null;
  bulletPointScore: number | null;
  descriptionScore: number | null;
  aplusScore: number | null;
  thumbnailScore: number | null;
  thumbnailVideoScore: number | null;
}

interface ApiSummary {
  totalProducts: number;
  averageScore: number | null;
  avgTitleScore: number | null;
  avgBulletScore: number | null;
  avgDescriptionScore: number | null;
  avgAplusScore: number | null;
  avgThumbnailScore: number | null;
  avgThumbnailVideoScore: number | null;
}

interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse {
  summary: ApiSummary;
  products: ApiProduct[];
  pagination: ApiPagination;
}

// --- REUSABLE UI COMPONENTS ---

const MetricCard = ({ title, value, change, trend, subtext, icon: Icon, color = "indigo", weightage }: any) => {
  const colorMap: any = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    cyan: "bg-cyan-50 text-cyan-600",
    violet: "bg-violet-50 text-violet-600",
    blue: "bg-blue-50 text-blue-600",
    fuchsia: "bg-fuchsia-50 text-fuchsia-600"
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300 group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${colorMap[color]} transition-transform duration-300 group-hover:scale-110`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <div className={`flex items-center text-xs font-bold ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend === 'up' ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
          {change}
        </div>
      </div>
      <h4 className="text-slate-500 font-bold text-xs uppercase tracking-wider">{title}</h4>
      <p className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{value}</p>
      
      <div className="flex justify-between items-end mt-2">
         <p className="text-[10px] font-medium text-slate-400">{subtext}</p>
         {weightage && (
            <div className="relative group/info cursor-help">
               <Info size={14} className="text-slate-300 group-hover/info:text-indigo-500 transition-colors" />
               {/* Tooltip */}
               <div className="absolute bottom-full right-0 mb-2 hidden group-hover/info:block w-52 bg-slate-800 text-white p-3 rounded-xl shadow-2xl z-50 text-left border border-slate-700 pointer-events-none transition-all origin-bottom-right">
                 <p className="font-bold text-[10px] uppercase tracking-wider text-indigo-300 mb-1.5">{title}</p>
                 <p className="text-[11px] leading-relaxed text-slate-200">
                   Contributes <span className="font-bold text-white bg-slate-700/50 px-1 rounded">{weightage}%</span> to the overall score.
                 </p>
                 <div className="h-px bg-slate-700 my-2"></div>
                 <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                   Calculated by dividing the obtained points by the total weightage of {weightage}.
                 </p>
                 {/* Tooltip arrow */}
                 <div className="absolute top-full right-1 -mt-1 border-4 border-transparent border-t-slate-800"></div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

const FilterSection = ({ title, icon: Icon, options: initialOptions, isOpen = true }) => {
  const [options, setOptions] = useState(initialOptions);
  const [isSectionOpen, setIsSectionOpen] = useState(isOpen);

  const selectOption = (index) => {
    setOptions(options.map((opt, i) => ({
      ...opt,
      selected: i === index // Radio button behavior
    })));
  };

  return (
    <div className="mb-6">
      <div 
        className="flex items-center justify-between cursor-pointer mb-4 group"
        onClick={() => setIsSectionOpen(!isSectionOpen)}
      >
        <div className="flex items-center space-x-2 text-slate-900">
          <Icon size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
          <h3 className="font-bold text-sm tracking-wide">{title}</h3>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isSectionOpen ? 'rotate-180' : ''}`} />
      </div>
      
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isSectionOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-3 pb-2">
          {options.map((opt, idx) => (
            <label key={idx} className="flex items-start space-x-3 cursor-pointer group py-1">
              <input type="radio" name={title} className="hidden" checked={opt.selected} onChange={() => selectOption(idx)} />
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                opt.selected 
                  ? 'border-indigo-500 bg-white' 
                  : 'bg-white border-slate-300 group-hover:border-indigo-400'
              }`}>
                {opt.selected && <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />}
              </div>
              <span className={`text-[13px] ${opt.selected ? 'text-slate-900 font-bold' : 'text-slate-600 font-medium'}`}>
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

const FilterDropdownSection = ({ title, icon: Icon, options: initialOptions, isSearchable, type = "list" }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState(initialOptions || []);

  const toggleOption = (idx: number) => {
    const newOptions = [...options];
    newOptions[idx].selected = !newOptions[idx].selected;
    setOptions(newOptions);
  };

  const filteredOptions = options.map((opt: any, originalIndex: number) => ({...opt, originalIndex})).filter((opt: any) => opt.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center text-sm font-bold text-slate-700">
          <Icon size={15} className="mr-2.5 text-indigo-500" />
          {title}
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          {type === 'date' ? (
            <input type="date" className="w-full bg-white border border-slate-200 text-sm rounded-lg px-3 py-2 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          ) : (
            <>
              {isSearchable && (
                <div className="relative mb-3">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder={`Search ${title}...`}
                    className="w-full bg-white border border-slate-200 text-xs rounded-lg pl-8 pr-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2.5 max-h-40 overflow-y-auto custom-scrollbar px-1 py-1">
                {filteredOptions.map((opt: any) => (
                  <label key={opt.originalIndex} className="flex items-center space-x-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input type="checkbox" className="hidden" checked={opt.selected} onChange={() => toggleOption(opt.originalIndex)} />
                      <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all duration-200 ${opt.selected ? 'bg-indigo-500 border-indigo-500 shadow-[0_2px_5px_rgba(99,102,241,0.3)]' : 'border-slate-300 bg-white group-hover:border-indigo-400'}`}>
                        {opt.selected && <Check size={11} strokeWidth={3} className="text-white" />}
                      </div>
                    </div>
                    <span className={`text-[13px] ${opt.selected ? 'text-slate-900 font-bold' : 'text-slate-600 font-medium group-hover:text-slate-900'}`}>{opt.label}</span>
                  </label>
                ))}
                {filteredOptions.length === 0 && <div className="text-[11px] text-slate-400 text-center py-3 font-medium">No results found</div>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const FilterModal = ({ onClose }: any) => {
  const [activeTab, setActiveTab] = useState('category');
  
  const tabs = [
    { id: 'category', label: 'Category', icon: LayoutGrid },
    { id: 'brand', label: 'Brand', icon: Tag },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'dateRange', label: 'Date Range', icon: Calendar },
  ];

  const contentMap: any = {
    category: {
      title: 'Category',
      subtext: 'Select categorys to filter your dashboard',
      options: ['Chocolates (Non Gifting)', 'GMFC', 'Chocolates (Gifting)']
    },
    brand: {
      title: 'Brand',
      subtext: 'Select brands to filter your dashboard',
      options: ['Unilever', 'P&G', 'Nestle', "L'Oreal"]
    },
    location: {
      title: 'Location',
      subtext: 'Select locations to filter your dashboard',
      options: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai']
    },
    dateRange: {
      title: 'Date Range',
      subtext: 'Select a custom date range to filter results',
      options: []
    }
  };

  const activeContent = contentMap[activeTab];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl h-[550px] max-h-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Column */}
          <div className="w-56 bg-slate-50 flex flex-col border-r border-slate-200 shrink-0">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center space-x-3">
              <div className="p-1.5 bg-white/20 rounded-md">
                <SlidersHorizontal size={16} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-[14px] leading-tight">Filters</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">None active</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-[13px] font-bold transition-all ${
                      isActive 
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700 border border-transparent'
                    }`}
                  >
                    <div className={`p-1.5 rounded-md transition-colors ${isActive ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-400 group-hover:bg-slate-300'}`}>
                      <tab.icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
            
            {/* Header */}
            <div className="p-5 pb-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{activeContent.title}</h2>
                <p className="text-xs text-slate-400 mt-1">{activeContent.subtext}</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="bg-slate-800 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">All selected</span>
                <button onClick={onClose} className="p-1.5 bg-slate-50 text-slate-400 hover:bg-slate-100 rounded-full transition-colors border border-slate-200">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Actions & List / Date Pickers */}
            {activeTab === 'dateRange' ? (
              <div className="flex-1 p-8">
                <div className="grid grid-cols-2 gap-6 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Date from</label>
                    <input 
                      type="date" 
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-800/10 transition-all font-medium" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Date to</label>
                    <input 
                      type="date" 
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-800/10 transition-all font-medium" 
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
                  <div className="flex space-x-2">
                    <button className="px-4 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors bg-white">Select all</button>
                    <button className="px-4 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors bg-white">Clear</button>
                  </div>
                  <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      className="w-full pl-9 pr-3 py-1.5 bg-[#f8fafc] border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-800/10 transition-all"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-2.5 bg-white">
                  {activeContent.options.map((opt: string, idx: number) => (
                    <label key={idx} className="flex items-center p-3 border border-slate-200 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                      <div className="w-4 h-4 bg-slate-800 rounded-[3px] border border-slate-800 flex items-center justify-center mr-3 shrink-0 shadow-sm">
                        <Check size={12} className="text-white" strokeWidth={3.5} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{opt}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 bg-white flex justify-between items-center shrink-0">
          <button onClick={onClose} className="text-rose-500 text-xs font-bold flex items-center px-3 hover:bg-rose-50 py-2 rounded-lg transition-colors">
            <X size={14} className="mr-1.5" strokeWidth={2.5} />
            Reset All
          </button>
          <div className="flex space-x-3">
            <button onClick={onClose} className="px-6 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors bg-white">Cancel</button>
            <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-md shadow-slate-900/20 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/30 transition-all">Apply Filters</button>
          </div>
        </div>
      </div>
    </div>
  );
};


const RangeSlider = ({ min = 0, max = 100, value, onChange, label, displayValue }: any) => {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-wider">
        <span>{label}</span>
        <span className="text-indigo-600">{displayValue}</span>
      </div>
      <div className="relative h-1.5 w-full bg-slate-100 rounded-full">
        <div className="absolute h-full bg-indigo-500 rounded-full pointer-events-none transition-all duration-75" style={{ width: `${((value - min) / (max - min)) * 100}%` }}></div>
        <input 
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div 
          className="absolute h-[14px] w-[14px] bg-white border-2 border-indigo-500 rounded-full top-1/2 -translate-y-1/2 shadow-sm pointer-events-none z-0 transition-all duration-75" 
          style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 7px)` }}
        ></div>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD COMPONENT ---


// --- SKU DRILL DOWN TABLE — now receives live API data via props ---

interface SkuDrillDownTableProps {
  /** Products from the API (current page only) */
  products: ApiProduct[];
  /** Total product count across all pages (from summary) */
  totalCount: number;
  /** Current page (controlled by parent) */
  currentPage: number;
  /** Rows per page (controlled by parent) */
  rowsPerPage: number;
  /** Search text (controlled by parent) */
  search: string;
  /** Sort column (controlled by parent) */
  sortBy: string;
  /** Sort direction (controlled by parent) */
  sortOrder: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (column: string, order: 'asc' | 'desc') => void;
  isLoading: boolean;
  error: string | null;
}

const SkuDrillDownTable = ({
  products,
  totalCount,
  currentPage,
  rowsPerPage,
  search,
  sortBy,
  sortOrder: _sortOrder,
  onPageChange,
  onRowsPerPageChange,
  onSearchChange,
  onSortChange: _onSortChange,
  isLoading,
  error,
}: SkuDrillDownTableProps) => {
  const [expandedCell, setExpandedCell] = useState<{ ri: number, ci: number } | null>(null);
  const [lastExpandedCell, setLastExpandedCell] = useState<{ ri: number, ci: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const toggleCell = (ri: number, ci: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedCell?.ri === ri && expandedCell?.ci === ci) {
      setExpandedCell(null);
    } else {
      setExpandedCell({ ri, ci });
      setLastExpandedCell({ ri, ci });
    }
  };

  const totalPages = rowsPerPage > 0 ? Math.ceil(totalCount / rowsPerPage) : 1;

  const mapToTopMetrics = (product: ApiProduct): (number | null)[] => [
    product.totalScore != null ? Math.round(product.totalScore) : null,
    product.thumbnailScore != null ? Math.round(product.thumbnailScore) : null,
    product.thumbnailVideoScore != null ? Math.round(product.thumbnailVideoScore) : null,
    product.titleScore != null ? Math.round(product.titleScore) : null,
    product.bulletPointScore != null ? Math.round(product.bulletPointScore) : null,
    product.aplusScore != null ? Math.round(product.aplusScore) : null,
    product.descriptionScore != null ? Math.round(product.descriptionScore) : null,
  ];

  // Sortable column mapping: metricLabel index → API column name
  const sortColumnMap: Record<number, string> = {
    0: 'score',
    1: 'thumbnail_score',
    2: 'video_score',
    3: 'title_score',
    4: 'bullet_point_score',
    5: 'aplus_score',
    6: 'description_score',
  };

  const paginatedData = products;

  const weightages = [100, 15, 10, 20, 20, 15, 20];
  const getScoreStyle = (score: number | null, columnIndex: number) => {
    const isOverall = columnIndex === 0;
    if (score === null) {
      return {
        bg: 'bg-slate-50', 
        border: 'border-slate-200',
        text: 'text-slate-400',
        trendText: 'text-transparent',
        trend: 'none'
      };
    }
    const maxScore = weightages[columnIndex] || 100;
    const percentage = (score / maxScore) * 100;

    if (percentage >= 80) return {
      bg: isOverall ? 'bg-emerald-100' : 'bg-[#f2fbf5]', 
      border: isOverall ? 'border-emerald-300' : 'border-[#dcfce7]', 
      text: 'text-slate-800',
      trendText: 'text-emerald-500',
      trend: 'up'
    };
    if (percentage >= 60) return {
      bg: isOverall ? 'bg-amber-100' : 'bg-[#fffbeb]', 
      border: isOverall ? 'border-amber-300' : 'border-[#fef3c7]',
      text: 'text-slate-800',
      trendText: 'text-amber-500',
      trend: 'up'
    };
    return {
      bg: isOverall ? 'bg-rose-100' : 'bg-[#fff5f5]', 
      border: isOverall ? 'border-rose-300' : 'border-[#ffe4e6]',
      text: 'text-slate-800',
      trendText: 'text-rose-500',
      trend: 'down'
    };
  };

  const getDetailedBreakdown = (label: string) => {
    switch (label) {
      case 'Title Score':
        return [
          { check: 'Title ≥ 100 chars', score: 20, status: 'Pass', action: 'No Action Required' },
          { check: 'Title 50–99 chars', score: 10, status: 'Warn', action: 'Action Required' },
          { check: 'Title < 50 chars', score: 0, status: 'Fail', action: 'Action Required' },
        ];
      case 'Bullet Score':
        return [
          { check: '4+ bullets', score: 20, status: 'Pass', action: 'No Action Required' },
          { check: '1–3 bullets', score: 10, status: 'Warn', action: 'Action Required' },
          { check: 'No bullets', score: 0, status: 'Fail', action: 'Action Required' },
        ];
      case 'Description Score':
        return [
          { check: '400+ chars', score: 20, status: 'Pass', action: 'No Action Required' },
          { check: '200–399 chars', score: 10, status: 'Warn', action: 'Action Required' },
          { check: '<200 chars', score: 0, status: 'Fail', action: 'Action Required' },
        ];
      case 'Thumbnail Image Score':
        return [
          { check: '7+ images', score: 15, status: 'Pass', action: 'No Action Required' },
          { check: '1–6 images', score: 5, status: 'Warn', action: 'Action Required' },
          { check: 'No images', score: 0, status: 'Fail', action: 'Action Required' },
        ];
      case 'Thumbnail Video Score':
        return [
          { check: 'At least 1 video', score: 10, status: 'Pass', action: 'No Action Required' },
          { check: 'No video', score: 0, status: 'Fail', action: 'Action Required' },
        ];
      case 'A+ Image Score':
        return [
          { check: 'At least 1 A+ image', score: 15, status: 'Pass', action: 'No Action Required' },
          { check: 'No A+ images', score: 0, status: 'Fail', action: 'Action Required' },
        ];
      default:
        return [
          { check: 'Overall compliance', score: 100, status: 'Pass', action: 'No Action Required' },
        ];
    }
  };

  const metricLabels = ['Overall Score', 'Thumbnail Image Score', 'Thumbnail Video Score', 'Title Score', 'Bullet Score', 'A+ Image Score', 'Description Score'];

  return (
    <div className="mb-10" ref={tableRef}>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Content Coverage Breakdown</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Click a specific score metric to expand its detailed breakdown and fixes
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort By Dropdown */}
          <div className="relative group z-20">
             <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                <span className="text-slate-400">Sort:</span>
                {_sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                <ChevronDown size={14} className="text-slate-400" />
             </button>
             {/* Dropdown Menu */}
             <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 flex flex-col overflow-hidden">
                <button 
                  onClick={() => _onSortChange(sortBy, 'desc')}
                  className={`px-4 py-2.5 text-xs font-semibold text-left transition-colors ${
                    _sortOrder === 'desc' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Descending
                </button>
                <button 
                  onClick={() => _onSortChange(sortBy, 'asc')}
                  className={`px-4 py-2.5 text-xs font-semibold text-left transition-colors ${
                    _sortOrder === 'asc' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Ascending
                </button>
             </div>
          </div>

          {/* Search bar — triggers API search */}
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU or title…"
              value={search}
              onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200 flex flex-col min-w-[900px]">
        {/* Combined Table Wrapper */}
        <div className="border border-slate-200 rounded-[14px] bg-white shadow-sm flex flex-col">
          {/* Header */}
          <div className="flex items-center border-b border-slate-200 bg-slate-50/80 rounded-t-[14px]">
            <div className="w-[20%] flex items-center justify-center py-3.5 border-r border-slate-200">
             <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">SKU</span>
          </div>
          <div className="w-[80%] flex">
            {metricLabels.map((label, i) => {
              const weightage = weightages[i] || 100;
              return (
                <div key={label} className={`flex-1 py-3 px-1 flex flex-col items-center justify-center text-center group relative cursor-help ${i !== metricLabels.length - 1 ? 'border-r border-slate-200' : ''}`}>
                   <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest leading-tight text-center px-1">
                     {label.replace(' Score', '')}
                     <br className="hidden lg:block"/> 
                     <span className="inline-flex items-center gap-1 mt-0.5">
                       Score
                       <Info size={11} className="shrink-0 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                     </span>
                   </div>
                   {/* Tooltip */}
                   <div className="absolute bottom-full mb-2 hidden group-hover:block w-52 bg-slate-800 text-white p-3 rounded-xl shadow-2xl z-50 text-left border border-slate-700 pointer-events-none transform -translate-x-1/2 left-1/2 transition-all">
                     <p className="font-bold text-[10px] uppercase tracking-wider text-indigo-300 mb-1.5">{label}</p>
                     <p className="text-[11px] leading-relaxed text-slate-200">
                       Contributes <span className="font-bold text-white bg-slate-700/50 px-1 rounded">{weightage}%</span> to the overall score.
                     </p>
                     <div className="h-px bg-slate-700 my-2"></div>
                     <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                       Calculated by dividing the obtained points by the total weightage of {weightage}.
                     </p>
                     {/* Tooltip arrow */}
                     <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                   </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="flex flex-col divide-y divide-slate-100">
            {Array.from({ length: rowsPerPage }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-50 animate-pulse last:rounded-b-[14px]" />
            ))}
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-3 bg-rose-50 rounded-full mb-3">
              <AlertCircle size={24} className="text-rose-500" />
            </div>
            <p className="text-slate-700 font-bold text-sm">Failed to load products</p>
            <p className="text-slate-400 text-xs mt-1">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && paginatedData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-slate-700 font-bold text-sm">No products found</p>
            <p className="text-slate-400 text-xs mt-1">Try adjusting your filters or search term.</p>
          </div>
        )}

        {/* Rows */}
        <div className="flex flex-col divide-y divide-slate-100">
          {!isLoading && !error && paginatedData.map((row: ApiProduct, index: number) => {
            const ri = (currentPage - 1) * rowsPerPage + index;
            const isRowExpanded = expandedCell?.ri === ri;
            const wasRowExpanded = lastExpandedCell?.ri === ri;
            const topMetrics = mapToTopMetrics(row);

            // Deterministic avatar image using product ID as seed
            const DANONE_LOGO = "https://logolook.net/wp-content/uploads/2024/09/Danone-Logo.png";
            const imgUrl = DANONE_LOGO || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(row.productId)}&backgroundColor=ffffff`;

            return (
              <div key={ri} className={`flex flex-col bg-white transition-all duration-300 last:rounded-b-[14px] ${isRowExpanded ? 'bg-slate-50/50 shadow-inner' : 'hover:bg-slate-50/50'}`}>
                
                {/* Main Row */}
                <div className="flex items-center p-3 relative">
                  {/* Entity */}
                  <div className="w-[20%] flex items-center space-x-3 pr-4">
                     <div className="w-12 h-12 rounded-xl bg-slate-50/50 border border-slate-100 flex items-center justify-center p-1.5 shrink-0">
                        <img 
                          src={imgUrl} 
                          alt={row.title} 
                          onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(row.productId)}&backgroundColor=ffffff`; }}
                          className="w-full h-full object-contain mix-blend-multiply opacity-80" 
                        />
                     </div>
                     <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 text-[13px] leading-tight truncate" title={row.title}>{row.title || row.productId}</h4>
                        <p className="text-[10px] text-slate-400 font-medium truncate">{row.productId}</p>
                     </div>
                  </div>

                  {/* Metrics */}
                  <div className="w-[80%] flex space-x-2 pr-2">
                    {topMetrics.map((score, ci) => {
                      const style = getScoreStyle(score, ci);
                      const isCellExpanded = expandedCell?.ri === ri && expandedCell?.ci === ci;
                      const colName = sortColumnMap[ci];
                      const isActiveSortCol = colName === sortBy;
                      
                      return (
                        <div 
                          key={ci} 
                          onClick={(e) => {
                            if (ci !== 0) {
                              toggleCell(ri, ci, e);
                            }
                          }}
                          className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl border relative overflow-hidden transition-all duration-300 ${isCellExpanded ? 'shadow-md ' + style.bg + ' ' + style.border : style.bg + ' ' + style.border} ${ci !== 0 ? 'cursor-pointer group hover:-translate-y-1 hover:scale-105 hover:shadow-lg hover:z-10' : ''}`}
                        >
                           {!isCellExpanded && ci !== 0 && <div className="absolute inset-0 bg-white/40 group-hover:bg-transparent transition-colors pointer-events-none"></div>}
                           <div className={`text-[15px] font-black relative z-10 ${style.text}`}>
                             {score === null ? '-' : `${Math.round((score / (weightages[ci] || 100)) * 100)}%`}
                           </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Expanded Details */}
                <div className={`grid transition-all duration-500 ease-in-out ${isRowExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    {(isRowExpanded || wasRowExpanded) && (() => {
                       const activeCi = (isRowExpanded && expandedCell) ? expandedCell.ci : (lastExpandedCell ? lastExpandedCell.ci : 0);
                       const metricLabel = metricLabels[activeCi];
                       const actualScore = topMetrics[activeCi];
                       const fullBreakdown = getDetailedBreakdown(metricLabel);
                       
                       // Find the perfect match or fallback to the closest/highest applicable bucket
                       const exactMatch = fullBreakdown.filter(item => item.score === actualScore);
                       const breakdownData = exactMatch.length > 0 ? exactMatch : fullBreakdown.length > 0 ? [fullBreakdown.reduce((prev, curr) => Math.abs(curr.score - (actualScore ?? 0)) < Math.abs(prev.score - (actualScore ?? 0)) ? curr : prev)] : fullBreakdown;
                       
                       return (
                         <div className="p-6 bg-white border-t border-slate-100 rounded-b-[20px]">
                            <div className="mb-4 text-slate-400 text-sm font-medium">
                               {metricLabel} breakdown and fixes.
                            </div>
                            <div className="border border-slate-100 rounded-[14px] overflow-hidden shadow-sm">
                               <table className="w-full text-left table-fixed">
                                  <thead className="bg-slate-50/50">
                                     <tr>
                                        <th className="py-3 px-5 text-[13px] font-bold text-slate-900 border-b border-r border-slate-100 w-[40%]">Check</th>
                                        <th className="py-3 px-5 text-[13px] font-bold text-slate-900 border-b border-r border-slate-100 w-[20%] text-center">Score</th>
                                        <th className="py-3 px-5 text-[13px] font-bold text-slate-900 border-b border-r border-slate-100 w-[15%] text-center">Status</th>
                                        <th className="py-3 px-5 text-[13px] font-bold text-slate-900 border-b border-slate-100 w-[25%]">Action</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                     {breakdownData.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                           <td className="py-3.5 px-5 text-[13px] font-semibold text-slate-700 border-r border-slate-100 truncate" title={item.check}>{item.check}</td>
                                           <td className="py-3.5 px-5 border-r border-slate-100">
                                              <div className="flex items-center space-x-3 max-w-[140px] mx-auto">
                                                 <span className="font-bold text-slate-800 text-[13px] w-6 text-right">{item.score}</span>
                                                 <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                      className={`h-full ${item.status === 'Fail' ? 'bg-rose-500' : item.status === 'Warn' ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                                                      style={{ width: `${(item.score / (weightages[activeCi] || 100)) * 100}%` }}
                                                    ></div>
                                                 </div>
                                              </div>
                                           </td>
                                           <td className="py-3.5 px-5 text-center border-r border-slate-100">
                                              {item.status === 'Fail' && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 text-[11px] font-bold border border-rose-100"><X size={10} strokeWidth={3} className="mr-1" /> Fail</span>}
                                              {item.status === 'Warn' && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 text-[11px] font-bold border border-amber-100"><AlertCircle size={10} strokeWidth={3} className="mr-1" /> Warn</span>}
                                              {item.status === 'Pass' && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-500 text-[11px] font-bold border border-emerald-100"><Check size={10} strokeWidth={3} className="mr-1" /> Pass</span>}
                                           </td>
                                           <td className="py-3.5 px-5 text-[13px] text-slate-500 font-medium truncate" title={item.action}>{item.action}</td>
                                        </tr>
                                     ))}
                                  </tbody>
                               </table>
                            </div>
                         </div>
                       );
                    })()}
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100">
           <div className="flex items-center space-x-2 text-sm text-slate-500 font-medium">
             <span>Show</span>
             <select 
               value={rowsPerPage} 
               onChange={(e) => {
                 onRowsPerPageChange(Number(e.target.value));
                 onPageChange(1);
               }}
               className="border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
             >
               <option value={5}>5</option>
               <option value={10}>10</option>
               <option value={20}>20</option>
               <option value={50}>50</option>
             </select>
             <span>rows</span>
           </div>
           
           <div className="flex items-center space-x-5">
             <span className="text-sm font-medium text-slate-500">
                Page <span className="font-bold text-slate-700 px-1">{currentPage}</span> of <span className="font-bold text-slate-700 px-1">{totalPages || 1}</span>
             </span>
             <div className="flex space-x-2">
                <button 
                  onClick={() => {
                    onPageChange(Math.max(1, currentPage - 1));
                    tableRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  disabled={currentPage === 1 || isLoading}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 disabled:hover:bg-transparent transition-colors shadow-sm"
                >
                  Prev
                </button>
                <button 
                  onClick={() => {
                    onPageChange(Math.min(totalPages, currentPage + 1));
                    tableRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 disabled:hover:bg-transparent transition-colors shadow-sm"
                >
                  Next
                </button>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};


export default function Dashboard() {

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  
  const [scoreRange, setScoreRange] = useState(85);
  const [imageRating, setImageRating] = useState(50);

  // --- API State ---
  const [company, setCompany] = useState('danone');        // database name
  const [platform, setPlatform] = useState('');           // platform filter
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [summary, setSummary] = useState<ApiSummary | null>(null);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const params = new URLSearchParams({
        company,
        page: String(page),
        limit: String(rowsPerPage),
        sortBy,
        sortOrder,
      });
      let apiPlatform = platform;
      if (platform === 'Amazon India') {
        apiPlatform = 'Amazon';
      }
      if (apiPlatform) params.append('platform', apiPlatform);
      if (search) params.append('search', search);

      const res = await fetch(`${API_BASE}/content-dashboard?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: ApiResponse = await res.json() as ApiResponse;
      // We no longer set summary here because it is fetched separately
      setProducts(data.products);
      setTotalCount(data.pagination.total);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to load data');
      setProducts([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [company, platform, page, rowsPerPage, search, sortBy, sortOrder]);

  // Re-fetch products whenever any filter/pagination param changes
  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // Fetch summary separately so it ignores search, pagination, and sorting
  const fetchSummaryData = useCallback(async () => {
    setIsSummaryLoading(true);
    try {
      const params = new URLSearchParams({
        company,
        page: '1',
        limit: '1',
      });
      let apiPlatform = platform;
      if (platform === 'Amazon India') {
        apiPlatform = 'Amazon';
      }
      if (apiPlatform) params.append('platform', apiPlatform);

      const res = await fetch(`${API_BASE}/content-dashboard?${params.toString()}`);
      if (res.ok) {
        const data: ApiResponse = await res.json() as ApiResponse;
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load summary data', err);
      setSummary(null);
    } finally {
      setIsSummaryLoading(false);
    }
  }, [company, platform]);

  useEffect(() => {
    void fetchSummaryData();
  }, [fetchSummaryData]);

  const handleSortChange = (column: string, order: 'asc' | 'desc') => {
    setSortBy(column);
    setSortOrder(order);
    setPage(1);
  };

  const PLATFORMS = ['', 'Amazon', 'Flipkart', 'Blinkit', 'Zepto', 'Swiggy Instamart'];

  // Format a numeric score for MetricCard display
  const fmt = (v: number | undefined | null) =>
    (v !== undefined && v !== null) ? `${Number(v).toFixed(1)}` : 'N/A';

  const tableData = [
    { id: 'AMAZON-112', sku: 'Core Tub 700ml', scope: 'Organic Search', issue: 'Low keyword relevance; missing primary term in title', severity: 'HIGH', owner: 'Content', eta: '3 days', status: 'In Progress' },
    { id: 'AMAZON-141', sku: 'Family Pack 1L', scope: 'All', issue: 'Primary image below 1000x1000', severity: 'HIGH', owner: 'Creative', eta: '5 days', status: 'Open' },
    { id: 'AMAZON-128', sku: 'Magnum 100ml', scope: 'Mobile PDP', issue: 'A+ missing comparison module', severity: 'MEDIUM', owner: 'Brand', eta: '7 days', status: 'Open' },
    { id: 'AMAZON-156', sku: 'Plant Based', scope: 'Desktop PDP', issue: 'Missing vegan certification badge', severity: 'MEDIUM', owner: 'Compliance', eta: '10 days', status: 'Open' },
  ];

  return (
    <div className="h-screen w-full bg-slate-50/50 font-sans flex flex-col overflow-hidden">
      
      <Navbar platform={platform || 'Amazon India'} onPlatformChange={setPlatform} />

      <div className="flex flex-1 overflow-hidden min-h-0 relative">

        <div className="flex-1 flex min-w-0 overflow-hidden relative z-10">
          
          

          {/* Config Drawer Overlay */}
          <div className={`fixed inset-0 z-[100] transition-opacity duration-300 ${isConfigOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setIsConfigOpen(false)} />
            <div className={`absolute top-0 right-0 h-full w-[320px] bg-white shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${isConfigOpen ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <h2 className="font-extrabold text-slate-900 text-sm tracking-widest uppercase">Config</h2>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button onClick={() => alert("Config reset")} className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-white transition-colors bg-indigo-50 hover:bg-indigo-500 px-3 py-1.5 rounded-lg shadow-sm">Reset</button>
                    <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                </div>

              <div className="space-y-8">
                <FilterSection 
                  title="Issue Categories" 
                  icon={Info}
                  options={[
                    { label: 'Content Quality Issues', selected: true },
                    { label: 'Image Issues', selected: false },
                    { label: 'Compliance Gaps', selected: true }
                  ]}
                />
                
                <FilterSection 
                  title="Product Status" 
                  icon={Activity}
                  options={[
                    { label: 'Active Listings', selected: true },
                    { label: 'Drafts', selected: false },
                    { label: 'Suppressed', selected: false }
                  ]}
                />
                
                <div className="pt-2">
                  <div className="flex items-center space-x-2 text-slate-900 mb-6">
                    <SlidersHorizontal size={16} className="text-slate-400" />
                    <h3 className="font-bold text-sm tracking-wide">Metrics Thresholds</h3>
                  </div>
                  
                  <div className="space-y-6 mt-4">
                    <RangeSlider 
                      label="Score Range" 
                      min={0} 
                      max={100} 
                      value={scoreRange} 
                      onChange={setScoreRange} 
                      displayValue={`0 - ${scoreRange}`} 
                    />
                    <RangeSlider 
                      label="Image Rating" 
                      min={0} 
                      max={100} 
                      value={imageRating} 
                      onChange={setImageRating} 
                      displayValue={`< ${imageRating}`} 
                    />
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent">
            

            <main className="flex-1 overflow-y-auto p-8">
              
              <section className="mb-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
                  <div>
                    <h2 className="font-extrabold text-slate-900 text-2xl tracking-tight">
                      Catalog Analysis{' '}
                      <span className="text-slate-400 font-semibold">
                        ({isSummaryLoading ? '…' : `${summary?.totalProducts || 0} SKUs`})
                      </span>
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-3 items-center">
                  </div>
                </div>

                {/* Metrics Grid — values now come from API summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
                  <MetricCard
                    title="Total Score"
                    value={isSummaryLoading ? '…' : fmt(summary?.averageScore)}
                    change="Live" trend="up"
                    subtext={`Avg across ${summary?.totalProducts || 0} SKUs`}
                    icon={Gauge} color="violet"
                  />
                  <MetricCard
                    title="Thumbnail Image Score"
                    value={isSummaryLoading ? '…' : fmt(summary?.avgThumbnailScore)}
                    change="Live" trend="up"
                    subtext="Image completeness and quality"
                    icon={LucideImage} color="blue"
                    weightage={15}
                  />
                  <MetricCard
                    title="Thumbnail Video Score"
                    value={isSummaryLoading ? '…' : fmt(summary?.avgThumbnailVideoScore)}
                    change="Live" trend="up"
                    subtext="Video completeness and quality"
                    icon={Images} color="rose"
                    weightage={10}
                  />
                  <MetricCard
                    title="Title Score"
                    value={isSummaryLoading ? '…' : fmt(summary?.avgTitleScore)}
                    change="Live" trend="up"
                    subtext="Title Quality"
                    icon={Type} color="indigo"
                    weightage={20}
                  />
                  <MetricCard
                    title="Bullet Score"
                    value={isSummaryLoading ? '…' : fmt(summary?.avgBulletScore)}
                    change="Live" trend="up"
                    subtext="Bullet points details"
                    icon={AlignLeft} color="cyan"
                    weightage={20}
                  />
                  <MetricCard
                    title="A+ Image Score"
                    value={isSummaryLoading ? '…' : fmt(summary?.avgAplusScore)}
                    change="Live" trend="up"
                    subtext="A+ content quality"
                    icon={LayoutGrid} color="fuchsia"
                    weightage={15}
                  />
                  <MetricCard
                    title="Description Score"
                    value={isSummaryLoading ? '…' : fmt(summary?.avgDescriptionScore)}
                    change="Live" trend="up"
                    subtext="Description quality"
                    icon={AlignLeft} color="amber"
                    weightage={20}
                  />
                </div>

                <SkuDrillDownTable
                  products={products}
                  totalCount={totalCount}
                  currentPage={page}
                  rowsPerPage={rowsPerPage}
                  search={search}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onPageChange={setPage}
                  onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(1); }}
                  onSearchChange={setSearch}
                  onSortChange={handleSortChange}
                  isLoading={isLoading}
                  error={apiError}
                />
              </section>



              
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}