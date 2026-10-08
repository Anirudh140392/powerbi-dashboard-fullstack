import { useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { 
  Search, Filter, Plus, Box, MoreVertical, 
  ChevronDown, AlertCircle 
} from 'lucide-react';

// --- MOCK DATA ---
const skuData = [
  { id: 1, title: 'Magnum 100ml', category: 'Premium', contentScore: 78, imageScore: 82, status: 'ACTIVE', issues: 2 },
  { id: 2, title: 'Core Tub 700ml', category: 'Core', contentScore: 65, imageScore: 71, status: 'ACTIVE', issues: 4 },
  { id: 3, title: 'Mini Bites', category: 'Snacking', contentScore: 72, imageScore: 68, status: 'ACTIVE', issues: 3 },
  { id: 4, title: 'Family Pack', category: 'Value', contentScore: 81, imageScore: 85, status: 'ACTIVE', issues: 1 },
  { id: 5, title: 'Plant Based', category: 'Health', contentScore: 58, imageScore: 45, status: 'ACTIVE', issues: 5 },
  { id: 6, title: 'Cone Range', category: 'Premium', contentScore: 76, imageScore: 88, status: 'ACTIVE', issues: 2 },
];

// --- REUSABLE COMPONENTS ---

const FilterButton = ({ label }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white border border-slate-200/60 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] transition-all text-sm font-semibold"
      >
        <Filter size={14} className="text-indigo-500" />
        <span>{label}</span>
        <ChevronDown size={14} className={`text-slate-400 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[120px] bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2">
          <div className="p-2 text-xs text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">Option 1</div>
          <div className="p-2 text-xs text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">Option 2</div>
        </div>
      )}
    </div>
  );
};

const ProgressBar = ({ label, score }) => {
  // Determine color based on score thresholds
  const getColor = (value) => {
    if (value >= 80) return 'bg-emerald-500';
    if (value >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="flex items-center justify-between mb-3 last:mb-0">
      <span className="text-xs font-semibold text-slate-500 w-16">{label}</span>
      <div className="flex-1 mx-3 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
        <div 
          className={`h-full rounded-full ${getColor(score)}`} 
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-bold text-slate-900 w-6 text-right">{score}</span>
    </div>
  );
};

const SkuCard = ({ data }) => (
  <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-200/60 p-6 flex flex-col hover:shadow-[0_8px_30px_rgba(6,81,237,0.1)] hover:border-indigo-300 transition-all relative group cursor-pointer">
    
    {/* Context Menu Icon */}
    <button 
      onClick={(e) => { e.stopPropagation(); alert("Context menu opened for " + data.title); }}
      className="absolute top-4 right-4 text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all"
    >
      <MoreVertical size={18} />
    </button>

    <div className="flex items-start space-x-4 mb-6">
      <div className="w-12 h-12 bg-gradient-to-br from-indigo-50 to-violet-100 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-sm">
         <Box size={22} strokeWidth={2.5} />
      </div>
      <div className="min-w-0 pr-6">
        <h3 className="text-[17px] font-extrabold text-slate-900 leading-tight truncate group-hover:text-indigo-700 transition-colors">{data.title}</h3>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">{data.category}</p>
      </div>
    </div>
    
    <div className="mb-6 pt-2">
      <ProgressBar label="Content" score={data.contentScore} />
      <ProgressBar label="Image" score={data.imageScore} />
    </div>

    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
      <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border border-emerald-100/50">
        {data.status}
      </span>
      
      {data.issues > 0 && (
        <div className="flex items-center text-rose-500 text-xs font-bold bg-rose-50 px-2 py-1 rounded-md">
          <AlertCircle size={12} className="mr-1" strokeWidth={2.5} />
          {data.issues} issue{data.issues > 1 ? 's' : ''}
        </div>
      )}
    </div>
  </div>
);


export default function SkuManagement() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="h-screen w-full bg-slate-50/50 font-sans flex flex-col overflow-hidden">
      
      {/* Top Navbar */}
      <Navbar />

      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        
        {/* Sidebar Setup */}
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <div 
          className={`absolute inset-0 z-40 transition-all duration-300 ${
            isSidebarOpen 
              ? 'bg-slate-900/20 backdrop-blur-sm opacity-100 pointer-events-auto' 
              : 'bg-transparent backdrop-blur-none opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />
        
        <div className="w-20 shrink-0" />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto relative z-10 flex flex-col">
          
          <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
            
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">SKU Management</h1>
                <p className="text-sm text-slate-500 mt-2">Manage your product catalog, track content health, and identify optimization opportunities</p>
              </div>
              <button 
                onClick={() => alert("Add SKU modal opened")}
                className="flex items-center justify-center space-x-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 font-semibold text-sm"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>Add SKU</span>
              </button>
            </div>

            {/* Search & Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-2.5 rounded-2xl border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
              <div className="flex-1 relative w-full">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search SKUs, IDs, or keywords..." 
                  className="w-full pl-11 pr-4 py-2 bg-transparent text-[15px] font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0"
                />
              </div>
              <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
              <div className="flex items-center gap-3 pr-2 overflow-x-auto w-full md:w-auto">
                <FilterButton label="Category" />
                <FilterButton label="Status" />
                <FilterButton label="Score Range" />
              </div>
            </div>

            {/* SKU Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {skuData.map((sku) => (
                <SkuCard key={sku.id} data={sku} />
              ))}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}