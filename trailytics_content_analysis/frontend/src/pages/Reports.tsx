import { useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { FileText, Download, Calendar, Filter, Plus, FileBarChart } from 'lucide-react';

export default function Reports() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const reports = [
    {
      title: 'Weekly Content Audit',
      date: 'Dec 22, 2024',
      type: 'Audit',
      status: 'Ready',
    },
    {
      title: 'Image Quality Analysis',
      date: 'Dec 20, 2024',
      type: 'Analysis',
      status: 'Ready',
    },
    {
      title: 'Keyword Coverage Report',
      date: 'Dec 18, 2024',
      type: 'SEO',
      status: 'Ready',
    },
    {
      title: 'Review Sentiment Summary',
      date: 'Dec 15, 2024',
      type: 'Reviews',
      status: 'Ready',
    },
    {
      title: 'Monthly Performance',
      date: 'Nov 30, 2024',
      type: 'Performance',
      status: 'Archived',
    },
  ];

  return (
    <div className="h-screen w-full bg-[#f8f9fa] font-sans flex flex-col overflow-hidden">
      
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

        <main className="flex-1 overflow-y-auto bg-slate-50 relative z-10">
          <div className="p-8 sm:p-10 max-w-7xl mx-auto">
      
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">Reports</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Access generated reports, export data, and schedule automated insights</p>
        </div>
        <button className="flex items-center px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/40">
          <FileBarChart size={16} className="mr-2" strokeWidth={2.5} />
          Generate Report
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-3 mb-6">
        <button className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <Calendar size={14} className="mr-2 text-slate-400" />
          Date Range
        </button>
        <button className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <Filter size={14} className="mr-2 text-slate-400" />
          Report Type
        </button>
      </div>

      {/* Reports List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-12">
        <div className="flex flex-col divide-y divide-slate-100">
          {reports.map((report, idx) => (
            <div key={idx} className="p-5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100/50">
                  <FileText size={18} className="text-indigo-500" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-800">{report.title}</h3>
                  <div className="flex items-center text-[12px] text-slate-400 font-medium mt-0.5 space-x-1.5">
                    <span>{report.date}</span>
                    <span>&bull;</span>
                    <span>{report.type}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                {report.status === 'Ready' ? (
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold uppercase tracking-wider rounded-md border border-emerald-100/50">
                    Ready
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[11px] font-bold uppercase tracking-wider rounded-md border border-slate-200/50">
                    Archived
                  </span>
                )}
                
                <button className="flex items-center text-[13px] font-bold text-slate-600 hover:text-indigo-600 transition-colors">
                  <Download size={14} className="mr-1.5" strokeWidth={2.5} />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Reports */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">Scheduled Reports</h2>
      <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
          <FileBarChart size={24} className="text-slate-300" strokeWidth={1.5} />
        </div>
        <h3 className="text-slate-800 font-bold text-[15px] mb-1">No scheduled reports</h3>
        <p className="text-slate-400 text-sm font-medium max-w-sm mb-5">Automate your reporting by scheduling daily, weekly, or monthly exports.</p>
        <button className="flex items-center px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-xl text-[13px] font-bold transition-all shadow-sm">
          <Plus size={16} className="mr-1.5 text-slate-400" strokeWidth={2.5} />
          Create Schedule
        </button>
      </div>

          </div>
        </main>
      </div>
    </div>
  );
}
