import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Search, 
    Shield, 
    UserPlus, 
    FileDown, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    ChevronsLeft, 
    ChevronsRight, 
    Mail, 
    Calendar, 
    UserCheck,
    Database,
    Trash2,
    Clock
} from "lucide-react";

/**
 * AllUsersTable - Displays the complete user database with expanded mock data.
 */
const AllUsersTable = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);
                const token = sessionStorage.getItem("token");
                const API_BASE = import.meta.env.VITE_API_URL
                    ? `${import.meta.env.VITE_API_URL}/api`
                    : "/api";

                const response = await axios.get(`${API_BASE}/admin/users`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (response.data.success) {
                    setUsers(response.data.data);
                } else {
                    setError(response.data.error || "Failed to fetch users");
                }
            } catch (err) {
                console.error("Error fetching users:", err);
                setError(err.response?.data?.error || "An error occurred while fetching users");
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "Viewer",
        status: "Active"
    });
    const [errors, setErrors] = useState({});

    const filteredUsers = users.filter((user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage));
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + rowsPerPage);

    const getVisiblePages = () => {
        const delta = 1;
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }
        return rangeWithDots;
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = "Full Name is required";
        if (!formData.email.trim()) {
            newErrors.email = "Email Address is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Invalid email format";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleAddUser = (e) => {
        e.preventDefault();
        if (validateForm()) {
            const newUser = {
                id: Math.max(...users.map(u => u.id)) + 1,
                ...formData,
                joined: new Date().toISOString().split('T')[0]
            };

            setUsers([newUser, ...users]);
            setShowModal(false);
            setFormData({ name: "", email: "", role: "Viewer", status: "Active" });
            setErrors({});
            setCurrentPage(1);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

        try {
            const token = sessionStorage.getItem("token");
            const API_BASE = import.meta.env.VITE_API_URL
                ? `${import.meta.env.VITE_API_URL}/api`
                : "/api";

            const response = await axios.delete(`${API_BASE}/admin/users/${userId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data.success) {
                setUsers(users.filter(user => user.id !== userId));
            } else {
                alert(response.data.error || "Failed to delete user");
            }
        } catch (err) {
            console.error("Error deleting user:", err);
            alert(err.response?.data?.error || "An error occurred while deleting user");
        }
    };

    const getInitials = (name) => {
        return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">User Database</h2>
                    <p className="text-slate-500 text-xs font-medium">Full list of all registered workspace members.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                        <FileDown className="w-4 h-4 text-slate-400" />
                        Export CSV
                    </button>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-xl text-xs font-bold text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 cursor-pointer"
                    >
                        <UserPlus className="w-4 h-4" />
                        New User
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search names, emails, or roles..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{filteredUsers.length} Total</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">User Information</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Access Level</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">DB Name</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Joined Date</th>
                                <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Last Login</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Users...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-rose-500">
                                            <p className="text-sm font-bold uppercase tracking-widest">{error}</p>
                                            <button 
                                                onClick={() => window.location.reload()}
                                                className="px-4 py-2 bg-rose-50 rounded-lg text-xs font-bold"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No users found</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((user, index) => (
                                    <tr key={`${user.id}-${index}`} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100 group-hover:scale-105 transition-transform">
                                                    {getInitials(user.name || "Unknown User")}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 leading-none">{user.name}</p>
                                                    <div className="flex items-center gap-1 mt-1.5 text-slate-400 group-hover:text-slate-600 transition-colors">
                                                        <Mail className="w-3 h-3" />
                                                        <p className="text-xs font-medium">{user.email}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                                user.role === 'admin' ? 'bg-rose-50 text-rose-600' :
                                                user.role === 'manager' ? 'bg-amber-50 text-amber-600' :
                                                'bg-indigo-50 text-indigo-600'
                                            }`}>
                                                <Shield className="w-3 h-3" />
                                                {user.role}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : user.status === 'away' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-slate-300'}`} />
                                                <span className="text-xs font-bold text-slate-600 capitalize">
                                                    {user.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <Database className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-xs font-medium text-slate-500 tracking-wider">{user.dbName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-xs">{user.joined}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-slate-500 font-medium whitespace-nowrap">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-xs">{user.lastLogin}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/30 p-4 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rows per page</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setRowsPerPage(parseInt(e.target.value, 10));
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Showing {startIndex + 1}-{Math.min(startIndex + rowsPerPage, filteredUsers.length)} of {filteredUsers.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-1 px-4">
                            {getVisiblePages().map((page, index) => (
                                page === '...' ? (
                                    <span key={`dots-${index}`} className="px-2 text-slate-400 font-bold">...</span>
                                ) : (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${currentPage === page
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                            : 'text-slate-500 hover:bg-slate-50'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                )
                            ))}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-2 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                        >
                            <ChevronsRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Add New User Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
                        >
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest cursor-pointer">Add New User</h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleAddUser} className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Sanyam Miglani"
                                        className={`w-full px-5 py-3 bg-slate-50 border ${errors.name ? 'border-rose-300 ring-4 ring-rose-50' : 'border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500'} rounded-2xl text-sm transition-all outline-none font-medium text-slate-700`}
                                    />
                                    {errors.name && <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase tracking-tighter italic">! {errors.name}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="e.g. sanyam.m@trailytics.com"
                                        className={`w-full px-5 py-3 bg-slate-50 border ${errors.email ? 'border-rose-300 ring-4 ring-rose-50' : 'border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500'} rounded-2xl text-sm transition-all outline-none font-medium text-slate-700`}
                                    />
                                    {errors.email && <p className="text-[10px] font-bold text-rose-500 ml-1 uppercase tracking-tighter italic">! {errors.email}</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Role</label>
                                        <div className="relative">
                                            <select
                                                value={formData.role}
                                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 rounded-2xl text-sm transition-all outline-none appearance-none cursor-pointer font-medium text-slate-700"
                                            >
                                                <option value="Super Admin">Super Admin</option>
                                                <option value="Manager">Manager</option>
                                                <option value="Analyst">Analyst</option>
                                                <option value="Editor">Editor</option>
                                                <option value="Viewer">Viewer</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronRight className="w-4 h-4 rotate-90" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Status</label>
                                        <div className="relative">
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 rounded-2xl text-sm transition-all outline-none appearance-none cursor-pointer font-medium text-slate-700"
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Away">Away</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronRight className="w-4 h-4 rotate-90" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-4 bg-indigo-600 rounded-2xl text-sm font-bold text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                                    >
                                        Create User
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AllUsersTable;
