import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    Globe,
    Mail,
    Database,
    Calendar,
    UserCheck,
    Filter,
    Inbox,
    ShieldCheck,
    ShieldX,
} from "lucide-react";

/**
 * NewRequests - Displays pending access requests with approve/deny actions.
 */
const NewRequests = () => {
    const [requests, setRequests] = useState([
        { id: 1, email: "dev.kumar@marsinc.com", dbName: "mars", ip: "203.45.67.12", dateTime: "2026-04-06 09:15:32", status: "pending" },
        { id: 2, email: "neha.jain@gcpl.in", dbName: "gcpl", ip: "182.73.120.44", dateTime: "2026-04-06 08:42:11", status: "pending" },
        { id: 3, email: "rahul.s@colpal.com", dbName: "colpal", ip: "14.139.56.78", dateTime: "2026-04-05 17:55:09", status: "pending" },
        { id: 4, email: "anita.m@marsinc.com", dbName: "mars", ip: "49.36.142.91", dateTime: "2026-04-05 14:30:22", status: "pending" },
        { id: 5, email: "vikash.p@trailytics.com", dbName: "mars", ip: "103.87.45.33", dateTime: "2026-04-05 11:20:45", status: "pending" },
        { id: 6, email: "sanya.r@gcpl.in", dbName: "gcpl", ip: "122.176.31.88", dateTime: "2026-04-04 16:10:58", status: "pending" },
        { id: 7, email: "karan.d@colpal.com", dbName: "colpal", ip: "59.94.172.15", dateTime: "2026-04-04 13:05:33", status: "pending" },
        { id: 8, email: "priti.g@marsinc.com", dbName: "mars", ip: "27.56.83.102", dateTime: "2026-04-04 10:48:17", status: "pending" },
        { id: 9, email: "mohit.k@trailytics.com", dbName: "admin_master", ip: "106.215.44.67", dateTime: "2026-04-03 19:22:41", status: "pending" },
        { id: 10, email: "deepa.n@gcpl.in", dbName: "gcpl", ip: "223.189.12.54", dateTime: "2026-04-03 15:33:08", status: "pending" },
    ]);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all"); // all, pending, approved, denied
    const [actionAnimating, setActionAnimating] = useState(null);

    const handleAction = (id, action) => {
        setActionAnimating(id);
        setTimeout(() => {
            setRequests(prev =>
                prev.map(r => r.id === id ? { ...r, status: action } : r)
            );
            setActionAnimating(null);
        }, 400);
    };

    const filteredRequests = requests.filter((r) => {
        const matchesSearch =
            r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.dbName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.ip.includes(searchTerm);
        const matchesFilter = filterStatus === "all" || r.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const pendingCount = requests.filter(r => r.status === "pending").length;
    const approvedCount = requests.filter(r => r.status === "approved").length;
    const deniedCount = requests.filter(r => r.status === "denied").length;

    const getStatusBadge = (status) => {
        switch (status) {
            case "approved":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3" />
                        Approved
                    </span>
                );
            case "denied":
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                        <XCircle className="w-3 h-3" />
                        Denied
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
                        <Clock className="w-3 h-3" />
                        Pending
                    </span>
                );
        }
    };

    const dbColors = {
        mars: "bg-violet-50 text-violet-600 border-violet-100",
        gcpl: "bg-sky-50 text-sky-600 border-sky-100",
        colpal: "bg-teal-50 text-teal-600 border-teal-100",
        admin_master: "bg-rose-50 text-rose-600 border-rose-100",
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">Access Requests</h2>
                    <p className="text-slate-500 text-xs font-medium">Review and manage incoming access requests.</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
                        <Clock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">{pendingCount}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">{approvedCount}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Approved</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100">
                        <ShieldX className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">{deniedCount}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Denied</p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Search + Filters */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between gap-4 flex-wrap">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by email, database, or IP..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        {["all", "pending", "approved", "denied"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilterStatus(f)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                    filterStatus === f
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                        : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Email</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Database</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">IP Address</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Date & Time</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                                                <Inbox className="w-7 h-7 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-400">No requests found</p>
                                            <p className="text-xs text-slate-400">Try adjusting your search or filter.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req) => (
                                    <motion.tr
                                        key={req.id}
                                        className="hover:bg-slate-50/50 transition-colors group"
                                        layout
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                    >
                                        {/* Email */}
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[10px] border border-indigo-100 group-hover:scale-105 transition-transform uppercase">
                                                    {req.email.slice(0, 2)}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                    <span className="text-xs font-semibold">{req.email}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* DB Name */}
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <Database className="w-3.5 h-3.5 text-slate-400" />
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${dbColors[req.dbName] || "bg-slate-50 text-slate-600 border-slate-100"}`}>
                                                    {req.dbName}
                                                </span>
                                            </div>
                                        </td>

                                        {/* IP */}
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <Globe className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-xs font-mono font-medium text-slate-500">{req.ip}</span>
                                            </div>
                                        </td>

                                        {/* Date & Time */}
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3 whitespace-nowrap">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700">{req.dateTime.split(" ")[0]}</span>
                                                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1 mt-0.5">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {req.dateTime.split(" ")[1]}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-8 py-5">
                                            {getStatusBadge(req.status)}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-8 py-5">
                                            {req.status === "pending" ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <motion.button
                                                        onClick={() => handleAction(req.id, "approved")}
                                                        disabled={actionAnimating === req.id}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100 active:scale-95 disabled:opacity-60 cursor-pointer"
                                                        whileHover={{ scale: 1.03 }}
                                                        whileTap={{ scale: 0.97 }}
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        Allow
                                                    </motion.button>
                                                    <motion.button
                                                        onClick={() => handleAction(req.id, "denied")}
                                                        disabled={actionAnimating === req.id}
                                                        className="flex items-center gap-1.5 px-4 py-2 bg-white text-rose-600 border border-rose-200 rounded-xl text-[11px] font-bold hover:bg-rose-50 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                                                        whileHover={{ scale: 1.03 }}
                                                        whileTap={{ scale: 0.97 }}
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        Deny
                                                    </motion.button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-center">
                                                    <button
                                                        onClick={() => handleAction(req.id, "pending")}
                                                        className="px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 rounded-lg transition-all uppercase tracking-wider cursor-pointer"
                                                    >
                                                        Undo
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default NewRequests;
