import { 
  Box, Layers, Settings, FileText, PanelLeftClose, PanelLeftOpen, LogOut, Search, PlusCircle, BarChart2
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const NavItem = ({ icon: Icon, label, to, isActive = false, isOpen }: any) => (
  <Link to={to} title={!isOpen ? label : ""} className={`group flex items-center ${isOpen ? 'px-3' : 'justify-center'} py-2.5 mx-3 rounded-full transition-colors relative ${
    isActive 
      ? 'bg-[#e8eaed] text-slate-900 font-medium' 
      : 'text-[#3c4043] hover:bg-[#f1f3f4] hover:text-slate-900 font-normal'
  }`}>
    <Icon size={20} strokeWidth={1.5} className={`shrink-0 transition-all duration-300 ${isOpen ? 'mr-3' : ''}`} />
    <span className={`text-[14px] whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0'}`}>
      {label}
    </span>
  </Link>
);

const SectionHeader = ({ title, isOpen }: any) => (
  <div className={`px-5 py-2 mt-2 mb-0.5 text-[12px] font-medium text-slate-500 whitespace-nowrap overflow-hidden transition-all duration-300 ${isOpen ? 'opacity-100 max-h-10' : 'opacity-0 max-h-0 py-0 mt-0 mb-0'}`}>
    {title}
  </div>
);

export default function Sidebar({ isOpen, toggleSidebar }: any) {
  const location = useLocation();

  return (
    <aside className={`absolute left-0 top-0 h-full bg-[#f8f9fa] border-r border-slate-200/50 transition-all duration-300 ease-in-out z-50 flex flex-col shrink-0 ${isOpen ? 'w-[280px] shadow-2xl sm:shadow-none' : 'w-20'}`}>
      
      {/* Toggle Button */}
      <div className="pt-6 pb-2 px-5 flex items-center">
        <button 
          onClick={toggleSidebar}
          className="text-slate-500 hover:bg-[#f1f3f4] hover:text-slate-800 rounded-full p-2 transition-colors flex items-center justify-center shrink-0"
        >
          {isOpen ? <PanelLeftClose size={22} strokeWidth={1.5} /> : <PanelLeftOpen size={22} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-2 overflow-y-auto overflow-x-hidden space-y-1 custom-scrollbar">
        
        <NavItem icon={Box} label="Dashboard" to="/" isActive={location.pathname === '/'} isOpen={isOpen} />
        
        <SectionHeader title="Management" isOpen={isOpen} />
        {/* <NavItem icon={Layers} label="SKU Management" to="/sku-management" isActive={location.pathname === '/sku-management'} isOpen={isOpen} /> */}
        {/* <NavItem icon={FileText} label="Analysis Tasks" to="/tasks" isActive={location.pathname === '/tasks'} isOpen={isOpen} /> */}
        <NavItem icon={BarChart2} label="Reports" to="/reports" isActive={location.pathname === '/reports'} isOpen={isOpen} />
      </nav>


    </aside>
  );
}