import React from "react";
import { motion } from "framer-motion";
import { Shield, ShieldCheck, Users, Edit3, Trash2, CheckCircle2 } from "lucide-react";

const RolesPermissions = () => {
    const roles = [
        {
            name: "Super Admin",
            description: "Full system administration access with capability to manage all platform aspects.",
            users: 2,
            permissions: ["User Management", "System Config", "Billing Control", "Audit Logs"]
        },
        {
            name: "Manager",
            description: "Standard operational management access for daily business workflows.",
            users: 14,
            permissions: ["User Control", "Data Export", "Analytics Access"]
        },
        {
            name: "Viewer",
            description: "Restricted read-only access for monitoring and reporting purposes.",
            users: 142,
            permissions: ["View Analytics", "Standard Reports"]
        }
    ];

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">Access Roles</h2>
                    <p className="text-slate-500 text-xs">Define and manage permission sets for system members.</p>
                </div>
                <button className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                    Create New Role
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {roles.map((role, idx) => (
                    <div
                        key={role.name}
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex flex-col h-full hover:border-indigo-200 transition-colors group"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="p-3 bg-slate-50 rounded-xl text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all border border-slate-100 group-hover:border-indigo-100">
                                <Shield className="w-6 h-6" />
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                                <Users className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{role.users} Users</span>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mb-2">{role.name}</h3>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-8 flex-1">
                            {role.description}
                        </p>

                        <div className="space-y-3 mb-8">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Core Permissions</p>
                            {role.permissions.map(perm => (
                                <div key={perm} className="flex items-center gap-3">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xs font-semibold text-slate-600">{perm}</span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                                <button className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider">
                                Full Specs
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RolesPermissions;
