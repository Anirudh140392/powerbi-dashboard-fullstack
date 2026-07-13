import React, { useState, useEffect } from "react";
import axios from "axios";
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
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all"); // all, pending, approved, denied
    const [actionAnimating, setActionAnimating] = useState(null);
    const [userNames, setUserNames] = useState({});

    const API_BASE = import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}/api`
        : "/api";

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const token = sessionStorage.getItem("token");
            const response = await axios.get(`${API_BASE}/admin/pending-requests`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setRequests(response.data.data);
                setError(null);
            } else {
                setError(response.data.error || "Failed to fetch requests");
            }
        } catch (err) {
            console.error("Error fetching requests:", err);
            setError("Error connecting to server.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (id, action) => {
        try {
            setActionAnimating(id);
            const token = sessionStorage.getItem("token");

            // Map 'approved' to 'allow' for backend status
            const status = action === "approved" ? "allow" : "deny";
            const userName = action === "approved" ? userNames[id] : undefined;

            const response = await axios.patch(`${API_BASE}/admin/users/access`,
                { id, status, userName },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                // Remove from list or update local state
                setRequests(prev => prev.filter(r => String(r.id) !== String(id)));
                setActionAnimating(null);
            }
        } catch (err) {
            console.error("Error updating access:", err);
            setActionAnimating(null);
        }
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
    const approvedCount = 0; // Requests are filtered out once approved in this view
    const deniedCount = 0;

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
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${filterStatus === f
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
                    <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Email</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Database</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Device ID</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Date & Time</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">User Name</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            <AnimatePresence>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Requests...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={7} className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-3 text-rose-500">
                                                <p className="text-sm font-bold uppercase tracking-widest">{error}</p>
                                                <button
                                                    onClick={fetchRequests}
                                                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all"
                                                >
                                                    Retry
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center">
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
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${dbColors[req.dbName?.toLowerCase()] || "bg-slate-50 text-slate-600 border-slate-100"}`}>
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

                                            {/* User Name */}
                                            <td className="px-8 py-5">
                                                {req.status === "pending" ? (
                                                    <input
                                                        type="text"
                                                        placeholder="Enter user name"
                                                        value={userNames[req.id] || ""}
                                                        onChange={(e) => setUserNames(prev => ({ ...prev, [req.id]: e.target.value }))}
                                                        className="w-full min-w-[120px] px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                    />
                                                ) : (
                                                    <span className="text-xs font-semibold text-slate-600">{req.name || "-"}</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-8 py-5">
                                                {req.status === "pending" ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <motion.button
                                                            onClick={() => handleAction(req.id, "approved")}
                                                            disabled={actionAnimating === req.id || !userNames[req.id] || userNames[req.id].trim() === ""}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                                                            whileHover={(!userNames[req.id] || userNames[req.id].trim() === "") ? {} : { scale: 1.03 }}
                                                            whileTap={(!userNames[req.id] || userNames[req.id].trim() === "") ? {} : { scale: 0.97 }}
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
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default NewRequests;
