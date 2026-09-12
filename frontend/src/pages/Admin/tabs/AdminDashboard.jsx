import React from "react";
import { motion } from "framer-motion";
import {
    Users,
    ShieldCheck,
    Key,
    Activity,
    TrendingUp,
    Clock,
    CheckCircle2,
    AlertCircle
} from "lucide-react";

const StatCard = ({ title, value, change, icon: Icon, isPositive }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100">
                <Icon className="w-5 h-5" />
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {change}
            </div>
        </div>
        <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
        </div>
    </div>
);

const AdminDashboard = () => {
    const stats = [
        { title: "Total Users", value: "2,840", change: "+12%", icon: Users, isPositive: true },
        { title: "Security Protocols", value: "128", change: "+4", icon: ShieldCheck, isPositive: true },
        { title: "Active Tokens", value: "1,245", change: "-2%", icon: Key, isPositive: false },
        { title: "System Uptime", value: "99.9%", change: "+0.01%", icon: Activity, isPositive: true },
    ];

    return (
        <div className="space-y-8">
            {/* Header Info */}
            <div className="mb-8">
                <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-2">Platform Overview</h2>
                <p className="text-slate-500 text-sm">Real-time performance metrics and system health monitoring.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <StatCard key={idx} {...stat} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800">System Activity</h3>
                        <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View All Logs</button>
                    </div>
                    <div className="p-0">
                        {[
                            { label: "Admin login successful", time: "2 minutes ago", status: "success", icon: CheckCircle2 },
                            { label: "New user registered: sarah.j", time: "15 minutes ago", status: "info", icon: Clock },
                            { label: "Database backup completed", time: "1 hour ago", status: "success", icon: CheckCircle2 },
                            { label: "Failed login attempt from 192.168.1.1", time: "2 hours ago", status: "warning", icon: AlertCircle },
                        ].map((activity, i) => (
                            <div key={i} className="px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-b last:border-0 border-slate-50">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${activity.status === 'success' ? 'text-emerald-500 bg-emerald-50' :
                                            activity.status === 'warning' ? 'text-amber-500 bg-amber-50' :
                                                'text-blue-500 bg-blue-50'
                                        }`}>
                                        <activity.icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{activity.label}</p>
                                        <p className="text-xs text-slate-400 mt-1">{activity.time}</p>
                                    </div>
                                </div>
                                <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                    <TrendingUp className="w-4 h-4 text-slate-300" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions / Info */}
                <div className="space-y-6">
                    <div className="bg-indigo-600 rounded-2xl p-8 text-white shadow-lg shadow-indigo-100">
                        <h3 className="font-bold text-lg mb-2">System Health</h3>
                        <p className="text-indigo-100 text-sm mb-6">Protocols are functioning within normal operational parameters.</p>
                        <div className="space-y-4">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-indigo-200">
                                <span>Infrastructure</span>
                                <span>Stable</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white w-full rounded-full" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 text-sm">Maintenance</h3>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-xs font-medium text-slate-600">Database Indexing: Done</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-xs font-medium text-slate-600">Security Patch v2.4: Applied</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-slate-200" />
                                <span className="text-xs font-medium text-slate-600">Sync Pipeline: Idle</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
