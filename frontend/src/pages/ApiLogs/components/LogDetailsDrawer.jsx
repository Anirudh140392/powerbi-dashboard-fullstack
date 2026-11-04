import React, { useState } from 'react';
import { 
    X, 
    Copy, 
    Check, 
    ExternalLink, 
    AlertCircle, 
    Clock, 
    Calendar, 
    Layers, 
    LayoutGrid, 
    FileText,
    Database
} from 'lucide-react';
import { Drawer } from '@mui/material';
import StatusBadge from './StatusBadge';
import StatusCodeChip from './StatusCodeChip';

export default function LogDetailsDrawer({ log, open, onClose }) {
    const [copiedRunId, setCopiedRunId] = useState(false);
    const [copiedApi, setCopiedApi] = useState(false);

    if (!log) return null;

    const copyText = (text, type) => {
        navigator.clipboard.writeText(text);
        if (type === 'runId') {
            setCopiedRunId(true);
            setTimeout(() => setCopiedRunId(false), 2000);
        } else if (type === 'api') {
            setCopiedApi(true);
            setTimeout(() => setCopiedApi(false), 2000);
        }
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDrawer-paper': {
                    width: { xs: '100%', sm: 480 },
                    bgcolor: '#ffffff',
                    boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
                },
            }}
        >
            <div className="h-full flex flex-col justify-between overflow-y-auto">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div>
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <h3 className="text-base font-bold text-slate-800">
                                API Execution Details
                            </h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Recorded during automated health run
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5 flex-1">
                    {/* Status & Timing Banner */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                                Status & Code
                            </span>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={log.responseStatus} />
                                <StatusCodeChip code={log.statusCode} />
                            </div>
                        </div>

                        <div className="text-right space-y-1">
                            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                                Latency
                            </span>
                            <div className="flex items-center gap-1 justify-end font-mono text-sm font-bold text-slate-800">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <span>{log.responseTimeMs} ms</span>
                            </div>
                        </div>
                    </div>

                    {/* API Endpoint Path */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                            Endpoint Route
                        </label>
                        <div className="p-3 bg-slate-900 rounded-lg text-emerald-400 font-mono text-xs flex items-center justify-between break-all">
                            <span>{log.api}</span>
                            <button
                                title="Copy Endpoint"
                                onClick={() => copyText(log.api, 'api')}
                                className="ml-2 p-1 text-slate-400 hover:text-white rounded transition-colors flex-shrink-0"
                            >
                                {copiedApi ? (
                                    <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mb-1">
                                <Layers className="w-3.5 h-3.5 text-blue-500" />
                                Page
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                                {log.page}
                            </span>
                        </div>

                        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mb-1">
                                <LayoutGrid className="w-3.5 h-3.5 text-indigo-500" />
                                Segment / Tab
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                                {log.segment}
                            </span>
                        </div>

                        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mb-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Run Date
                            </span>
                            <span className="text-xs font-semibold text-slate-700">
                                {log.date}
                            </span>
                        </div>

                        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mb-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                Logged At
                            </span>
                            <span className="text-xs font-semibold text-slate-700">
                                {log.createdAt || log.timestamp}
                            </span>
                        </div>

                        {/* Client DB Card */}
                        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 col-span-2">
                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mb-1">
                                <Database className="w-3.5 h-3.5 text-violet-500" />
                                Client Database
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                    {log.clientDb || log.client_db || 'demo'}
                                </span>
                                <span className="text-xs text-slate-500">
                                    Tenant client workspace under which the API request was executed
                                </span>
                            </div>
                        </div>

                        {/* Empty Response Card */}
                        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 col-span-2">
                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mb-1">
                                <Database className="w-3.5 h-3.5 text-amber-500" />
                                Empty Response (0 / 1)
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`inline-flex items-center justify-center font-mono font-bold text-xs px-2.5 py-0.5 rounded-full border shadow-2xs ${
                                    log.emptyResponse === 1
                                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                }`}>
                                    Value: {log.emptyResponse === 1 ? '1' : '0'}
                                </span>
                                <span className="text-xs text-slate-600 font-medium">
                                    {log.emptyResponse === 1
                                        ? 'Empty Response (1) - The API returned no records or an empty body'
                                        : 'Non-Empty Response (0) - Valid response payload returned'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Error Message callout if failed */}
                    {log.errorMessage ? (
                        <div>
                            <label className="block text-xs font-semibold text-rose-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Error Message
                            </label>
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-mono text-rose-800 break-words">
                                {log.errorMessage}
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span>This endpoint executed without server-side or network errors.</span>
                        </div>
                    )}

                    {/* Run ID */}
                    {log.runId && (
                        <div className="pt-2 border-t border-slate-100">
                            <span className="text-[11px] text-slate-400 font-medium block mb-1">
                                Test Execution Run ID
                            </span>
                            <div className="flex items-center justify-between p-2 rounded bg-slate-100/70 border border-slate-200/50">
                                <span className="font-mono text-[11px] text-slate-600 truncate">
                                    {log.runId}
                                </span>
                                <button
                                    onClick={() => copyText(log.runId, 'runId')}
                                    className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                                    title="Copy Run ID"
                                >
                                    {copiedRunId ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </Drawer>
    );
}
