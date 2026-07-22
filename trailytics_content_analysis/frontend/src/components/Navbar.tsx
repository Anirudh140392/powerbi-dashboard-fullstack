import { VectorSquare, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

export default function Navbar({ onFiltersClick }: { onFiltersClick?: () => void } = {}) {
  const location = useLocation();

  let pageName = "";
  if (location.pathname === '/') {
    pageName = "Dashboard";
  } else if (location.pathname === '/sku-management') {
    pageName = "SKU Management";
  } else if (location.pathname === '/tasks') {
    pageName = "Analysis Tasks";
  } else if (location.pathname === '/reports') {
    pageName = "Reports";
  }

  return (
    <header className="w-full px-6 py-3.5 flex items-center bg-white border-b border-slate-200 shrink-0 z-50">

      {/* Brand Logo & Breadcrumbs (Left) */}
      <div className="flex items-center space-x-3 group cursor-pointer flex-1">
        <div className="flex items-center justify-center">
          <VectorSquare className="text-slate-900" size={24} strokeWidth={2.5} />
        </div>

        <div className="flex items-center space-x-3">
          <Link to="/" className="flex flex-col hover:opacity-80 transition-opacity">
            <span className="text-[13px] font-extrabold text-slate-900 leading-none tracking-tight">CONTENT</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-bold mt-0.5">Analysis</span>
          </Link>

          {pageName && (
            <>
              <ChevronRight size={14} className="text-slate-300" strokeWidth={3} />
              <span className="text-[13px] font-bold text-slate-600">{pageName}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Filters Button */}
      <div className="flex items-center justify-end space-x-4 flex-none">
        <button
          onClick={onFiltersClick}
          className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white rounded-xl text-[14px] font-semibold shadow-[0_4px_14px_-3px_rgba(37,99,235,0.5)] hover:from-[#1e40af] hover:to-[#3b82f6] hover:shadow-[0_6px_20px_-4px_rgba(37,99,235,0.65)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          <SlidersHorizontal size={16} className="text-white" strokeWidth={2.5} />
          <span>Filters</span>
        </button>
      </div>
    </header>
  );
}