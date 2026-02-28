import React from "react";
import { motion } from "framer-motion";
import { Search, MoreHorizontal, Shield, UserPlus, FileDown } from "lucide-react";

const UsersTable = () => {
    const users = [
        { id: 1, name: "Admin Trailytics", email: "admin@trailytics.com", role: "Super Admin", status: "Active", initials: "AT" },
        { id: 2, name: "Shubham Pathak", email: "shubham@trailytics.com", role: "Manager", status: "Active", initials: "SP" },
        { id: 3, name: "John Doe", email: "john@example.com", role: "Editor", status: "Away", initials: "JD" },
        { id: 4, name: "Jane Smith", email: "jane@example.com", role: "Viewer", status: "Inactive", initials: "JS" },
    ];

    return (
        <div className="space-y-6">
            {/* Table Header / Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">User Directory</h2>
                    <p className="text-slate-500 text-xs">Manage workspace access and member permissions.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                        <FileDown className="w-4 h-4 text-slate-400" />
                        Export
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-lg text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm">
                        <UserPlus className="w-4 h-4" />
                        Add User
                    </button>
                </div>
            </div>

            {/* Modern Clean Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex gap-2 text-xs font-medium text-slate-500">
                        <span>{users.length} Users Found</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white">
                                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Member</th>
                                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Role</th>
                                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Status</th>
                                <th className="px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100">
                                                {user.initials}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded-md text-xs font-medium text-slate-600">
                                            <Shield className="w-3 h-3 text-slate-400" />
                                            {user.role}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : user.status === 'Away' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                                            <span className="text-xs font-medium text-slate-600">
                                                {user.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                                            <MoreHorizontal className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UsersTable;
