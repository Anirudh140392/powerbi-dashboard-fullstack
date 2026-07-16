import { useState, useRef, useEffect } from 'react';
import { VectorSquare, Bell, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

const PLATFORMS = {
  Marketplaces: ['Amazon India', 'Flipkart'],
  QComm: ['Blinkit', 'Zepto', 'Instamart'],
  Grocery: ['BigBasket']
};

export default function Navbar({ platform, onPlatformChange }: { platform?: string, onPlatformChange?: (platform: string) => void } = {}) {
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [localPlatform, setLocalPlatform] = useState('Amazon India');
  const selectedPlatform = platform !== undefined ? platform : localPlatform;
  
  const handlePlatformChange = (p: string) => {
    if (onPlatformChange) {
      onPlatformChange(p);
    } else {
      setLocalPlatform(p);
    }
    setIsDropdownOpen(false);
  };
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

      {/* Center: Platform Dropdown */}
      <div className="flex-none relative" ref={dropdownRef}>
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="relative border-none bg-transparent p-0 outline-none cursor-pointer font-sans group"
        >
          {/* Shadow layer */}
          <span className="absolute top-0 left-0 w-full h-full bg-black/25 rounded-lg translate-y-[2px] transition-transform duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:translate-y-[4px] group-hover:duration-[250ms] group-hover:ease-[cubic-bezier(0.3,0.7,0.4,1.5)] group-active:translate-y-[1px] group-active:duration-[34ms]"></span>
          
          {/* Edge layer */}
          <span className="absolute top-0 left-0 w-full h-full rounded-lg bg-[linear-gradient(to_left,hsl(217,33%,16%)_0%,hsl(217,33%,32%)_8%,hsl(217,33%,32%)_92%,hsl(217,33%,16%)_100%)]"></span>
          
          {/* Front layer */}
          <span className="relative flex items-center justify-center px-5 py-2 text-sm font-semibold text-white bg-[hsl(217,33%,17%)] rounded-lg -translate-y-[4px] transition-transform duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:-translate-y-[6px] group-hover:duration-[250ms] group-hover:ease-[cubic-bezier(0.3,0.7,0.4,1.5)] group-active:-translate-y-[2px] group-active:duration-[34ms]">
            <span className="select-none flex items-center space-x-2">
              <span>{selectedPlatform}</span>
              <ChevronDown size={16} className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </span>
          </span>
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full mt-4 w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="py-2 max-h-[80vh] overflow-y-auto">
              {Object.entries(PLATFORMS).map(([category, platforms]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="px-4 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {category}
                  </div>
                  {platforms.map(platform => (
                    <button
                      key={platform}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedPlatform === platform ? 'text-indigo-600 font-semibold bg-indigo-50/50' : 'text-slate-700'}`}
                      onClick={() => handlePlatformChange(platform)}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end space-x-4 flex-1">
      </div>
    </header>
  );
}