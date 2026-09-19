import { useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { 
  Search, Filter, Plus, LayoutGrid, List, 
  MoreHorizontal, ChevronDown, CheckCircle2, Clock, AlertCircle
} from 'lucide-react';

// --- MOCK DATA ---
const taskData = {
  todo: [
    { id: 'TSK-001', title: 'Fix title capitalization for Magnum', sku: 'Magnum 100ml', priority: 'high', assignee: { name: 'Yash', color: 'bg-indigo-500' } }
  ],
  inProgress: [
    { id: 'TSK-002', title: 'Upload missing lifestyle images', sku: 'Family Pack 1L', priority: 'medium', assignee: { name: 'Sarah', color: 'bg-emerald-500' } }
  ],
  inReview: [],
  done: []
};

// --- REUSABLE COMPONENTS ---

const StatCard = ({ title, count }) => (
  <div className="bg-white border border-slate-200/60 rounded-xl px-5 py-4 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] flex flex-col justify-center min-w-[130px] transition-all hover:shadow-md hover:border-indigo-200 cursor-pointer">
    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{title}</span>
    <span className="text-3xl font-extrabold text-slate-800 leading-none">{count}</span>
  </div>
);

const FilterDropdown = ({ label }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between space-x-2 bg-white border border-slate-200/60 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] text-sm font-semibold whitespace-nowrap min-w-[140px]"
      >
        <span>{label}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2">
          <div className="p-2 text-xs text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">Option 1</div>
          <div className="p-2 text-xs text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">Option 2</div>
        </div>
      )}
    </div>
  );
};

const TaskCard = ({ task }) => {
  const priorityColors = {
    high: 'bg-rose-500',
    medium: 'bg-amber-500',
    low: 'bg-emerald-500'
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-[0_8px_30px_rgba(6,81,237,0.1)] hover:border-indigo-300 cursor-grab active:cursor-grabbing transition-all relative overflow-hidden group">
      {/* Priority Left Border Stripe */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${priorityColors[task.priority]}`} />
      
      {/* Card Content */}
      <div className="pl-2">
        <div className="flex justify-between items-start mb-3">
          <h4 className="text-[14px] font-bold text-slate-800 leading-snug pr-4 group-hover:text-indigo-700 transition-colors">{task.title}</h4>
          <button className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-2 -mt-1 rounded-md hover:bg-indigo-50">
            <MoreHorizontal size={16} />
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-4">
          <span className="bg-slate-50 border border-slate-100 text-slate-500 text-[11px] font-bold px-2 py-1 rounded-md truncate max-w-[120px]">
            {task.sku}
          </span>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold shadow-sm ${task.assignee.color}`}>
            {task.assignee.name.charAt(0)}
          </div>
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ title, tasks, count }) => (
  <div className="flex flex-col w-[320px] shrink-0">
    <div className="flex items-center justify-between mb-4 px-1">
      <h3 className="font-extrabold text-slate-900 text-sm tracking-wide">{title}</h3>
      <span className="bg-white border border-slate-200/60 shadow-sm text-slate-500 text-xs font-bold px-2.5 py-0.5 rounded-full">
        {count}
      </span>
    </div>
    
    <div className="flex-1 bg-slate-100/50 border border-slate-200/40 rounded-2xl p-3 flex flex-col gap-3 min-h-[200px]">
      {tasks.length > 0 ? (
        tasks.map(task => <TaskCard key={task.id} task={task} />)
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200/60 rounded-xl p-4">
          <span className="text-sm font-medium italic">No tasks</span>
        </div>
      )}
    </div>
  </div>
);

// --- MAIN PAGE COMPONENT ---

export default function Tasks() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="h-screen w-full bg-slate-50/50 font-sans flex flex-col overflow-hidden">
      
      <Navbar />

      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        
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

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          
          {/* Header & Controls Area (Static height) */}
          <div className="px-8 pt-8 pb-6 shrink-0 border-b border-slate-200/60 bg-transparent">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Tasks</h1>
                <p className="text-sm text-slate-500 mt-2">Manage and track your content improvement tasks.</p>
              </div>
              <button onClick={() => alert("Create Task modal opened")} className="flex items-center space-x-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 font-semibold text-sm">
                <Plus size={18} strokeWidth={2.5} />
                <span>Create Task</span>
              </button>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Stats Row */}
              <div className="flex space-x-3 overflow-x-auto pb-2 lg:pb-0">
                <StatCard title="My Tasks" count="1" />
                <StatCard title="Due Soon" count="0" />
                <StatCard title="Completed" count="0" />
              </div>

              {/* Filters Row */}
              <div className="flex items-center space-x-3 overflow-x-auto pb-2 lg:pb-0">
                <FilterDropdown label="All Assignees" />
                <FilterDropdown label="All Priorities" />
                
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Filter by SKU..." 
                    className="pl-9 pr-4 py-2 w-48 bg-white border border-slate-200/60 rounded-xl text-[14px] font-medium placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] transition-all"
                  />
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="h-8 w-px bg-slate-200/80 mx-1 shrink-0"></div>

                <div className="flex bg-white border border-slate-200/60 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-1 shrink-0">
                  <button className="p-1.5 bg-slate-100 text-slate-700 rounded-lg shadow-sm" onClick={() => alert("Switched to Grid View")}><LayoutGrid size={16} /></button>
                  <button className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg" onClick={() => alert("Switched to List View")}><List size={16} /></button>
                </div>

                <button onClick={() => alert("Filter sidebar opened")} className="flex items-center space-x-2 bg-white border border-slate-200/60 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] text-sm font-semibold shrink-0">
                  <Filter size={16} className="text-slate-400" />
                  <span>Filter</span>
                </button>
              </div>
            </div>
          </div>

          {/* Kanban Board Area (Scrollable X/Y) */}
          <div className="flex-1 overflow-auto p-8">
            <div className="flex space-x-6 min-w-max h-full">
              <KanbanColumn title="Todo" count={taskData.todo.length} tasks={taskData.todo} />
              <KanbanColumn title="In Progress" count={taskData.inProgress.length} tasks={taskData.inProgress} />
              <KanbanColumn title="In Review" count={taskData.inReview.length} tasks={taskData.inReview} />
              <KanbanColumn title="Done" count={taskData.done.length} tasks={taskData.done} />
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}