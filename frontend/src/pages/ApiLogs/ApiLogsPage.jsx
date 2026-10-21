import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Play, 
    RefreshCw, 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    ShieldCheck, 
    Activity,
    Layers,
    Server
} from 'lucide-react';
import { 
    Snackbar, 
    Alert, 
    CircularProgress, 
    Tooltip, 
    Chip 
} from '@mui/material';
import CommonContainer from '../../components/CommonLayout/CommonContainer';
import SummaryCards from './components/SummaryCards';
import FiltersBar from './components/FiltersBar';
import LogsTable from './components/LogsTable';
import LogDetailsDrawer from './components/LogDetailsDrawer';
import { 
    fetchApiLogs, 
    fetchApiLogsSummary, 
    fetchApiLogsFilters, 
    triggerApiTestRun 
} from '../../api/apiLogsService';

export default function ApiLogsPage() {
    // Filter State
    const [filters, setFilters] = useState({
        date: '',
        page: '',
        segment: '',
        status: 'All',
        search: '',
    });

    // Pagination & Sort State
    const [pageNumber, setPageNumber] = useState(1);
    const [pageSize] = useState(20);
    const [sortBy, setSortBy] = useState('Date');
    const [sortOrder, setSortOrder] = useState('DESC');

    // Data State
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState(null);
    const [availableOptions, setAvailableOptions] = useState({
        dates: [],
        pages: [],
        segments: [],
    });

    // Loading & UX State
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [runningTest, setRunningTest] = useState(false);

    // Drawer State
    const [selectedLog, setSelectedLog] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Toast State
    const [toast, setToast] = useState({
        open: false,
        message: '',
        severity: 'info',
    });

    const isMounted = useRef(true);

    const showToast = (message, severity = 'info') => {
        setToast({ open: true, message, severity });
    };

    const handleToastClose = () => {
        setToast((prev) => ({ ...prev, open: false }));
    };

    // 1. Fetch Filter Options on Mount
    const loadFilterOptions = useCallback(async (isInitial = false) => {
        try {
            const res = await fetchApiLogsFilters();
            const filterData = res?.data || res?.filters;
            if (res && res.success && filterData) {
                const dates = filterData.dates || [];
                const pages = filterData.pages || [];
                const segments = filterData.segments || [];

                setAvailableOptions({ dates, pages, segments });

                if (isInitial && dates.length > 0) {
                    setFilters((prev) => ({
                        ...prev,
                        date: prev.date || dates[0],
                    }));
                }
            }
        } catch (err) {
            console.error('[ApiLogsPage] Failed to load filter options:', err);
        }
    }, []);

    // 2. Fetch Summary Metrics
    const loadSummary = useCallback(async (currentFilters) => {
        try {
            setLoadingSummary(true);
            const params = {};
            if (currentFilters.date) params.date = currentFilters.date;
            if (currentFilters.page) params.page = currentFilters.page;
            if (currentFilters.segment) params.segment = currentFilters.segment;

            const res = await fetchApiLogsSummary(params);
            const summaryData = res?.data || res?.summary;
            if (res && res.success && summaryData) {
                setSummary(summaryData);
            }
        } catch (err) {
            console.error('[ApiLogsPage] Failed to load summary:', err);
        } finally {
            setLoadingSummary(false);
        }
    }, []);

    // 3. Fetch Logs Table Data
    const loadLogs = useCallback(async (currentFilters, pNum, pSize, sBy, sOrder) => {
        try {
            setLoadingLogs(true);
            const params = {
                pageNumber: pNum,
                pageSize: pSize,
                sortBy: sBy,
                sortOrder: sOrder,
            };

            if (currentFilters.date) params.date = currentFilters.date;
            if (currentFilters.page) params.page = currentFilters.page;
            if (currentFilters.segment) params.segment = currentFilters.segment;
            if (currentFilters.status && currentFilters.status !== 'All') {
                params.status = currentFilters.status;
            }
            if (currentFilters.search) params.search = currentFilters.search.trim();

            const res = await fetchApiLogs(params);
            if (res && res.success) {
                setLogs(res.data || []);
                setTotal(res.pagination?.total || 0);
            } else {
                setLogs([]);
                setTotal(0);
            }
        } catch (err) {
            console.error('[ApiLogsPage] Failed to load logs:', err);
            setLogs([]);
            setTotal(0);
        } finally {
            setLoadingLogs(false);
        }
    }, []);

    // Initial Mount
    useEffect(() => {
        isMounted.current = true;
        loadFilterOptions(true);

        return () => {
            isMounted.current = false;
        };
    }, [loadFilterOptions]);

    // React to filter / pagination / sort changes
    useEffect(() => {
        loadLogs(filters, pageNumber, pageSize, sortBy, sortOrder);
    }, [filters, pageNumber, pageSize, sortBy, sortOrder, loadLogs]);

    // React to date/page/segment changes for summary
    useEffect(() => {
        loadSummary(filters);
    }, [filters, loadSummary]);

    // 60-Second Auto Refresh
    useEffect(() => {
        const interval = setInterval(() => {
            // Silently refresh if drawer is not open
            if (!drawerOpen) {
                loadLogs(filters, pageNumber, pageSize, sortBy, sortOrder);
                loadSummary(filters);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [drawerOpen, filters, pageNumber, pageSize, sortBy, sortOrder, loadLogs, loadSummary]);

    // Handle "Run Now" Manual Trigger
    const handleRunNow = async () => {
        if (runningTest) return;
        try {
            setRunningTest(true);
            showToast('Starting test run for Pricing Analysis APIs...', 'info');

            const res = await triggerApiTestRun(filters.page || 'Pricing Analysis');
            if (res && res.success) {
                showToast(`Run initiated (ID: ${res.run_id || 'new'}). Executing tests...`, 'info');

                // Wait 3.5s for runner to complete concurrency batch of 17 APIs
                setTimeout(async () => {
                    await loadFilterOptions(false);
                    await loadSummary(filters);
                    await loadLogs(filters, pageNumber, pageSize, sortBy, sortOrder);
                    setRunningTest(false);
                    showToast('API test run completed! Results updated.', 'success');
                }, 3500);
            } else {
                setRunningTest(false);
                showToast(res?.message || 'Failed to trigger test run.', 'error');
            }
        } catch (err) {
            console.error('[ApiLogsPage] Run now error:', err);
            setRunningTest(false);
            showToast(err.response?.data?.message || 'Error executing test suite.', 'error');
        }
    };

    // Filter Change Handler
    const handleFiltersChange = (newFilters) => {
        setFilters(newFilters);
        setPageNumber(1); // Reset to page 1 on filter change
    };

    // Reset Filters Handler
    const handleResetFilters = () => {
        const defaultDate = availableOptions.dates?.length > 0 ? availableOptions.dates[0] : '';
        setFilters({
            date: defaultDate,
            page: '',
            segment: '',
            status: 'All',
            search: '',
        });
        setPageNumber(1);
        setSortBy('Date');
        setSortOrder('DESC');
    };

    // Row Click Handler
    const handleRowClick = (log) => {
        setSelectedLog(log);
        setDrawerOpen(true);
    };

    return (
        <CommonContainer
            title="API Logs"
            hideFilters={true}
        >
            <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
                
                {/* ─── Top Header Banner ─── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                    API Logs & Health Monitor
                                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                        Automated
                                    </span>
                                </h1>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Continuous daily diagnostic testing and SLA latency monitoring for backend analytical endpoints.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                        {/* Last Run Badge */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                                Last Run: <strong className="text-slate-800 font-semibold">{summary?.lastRunAt || summary?.lastRunTime || 'N/A'}</strong>
                            </span>
                        </div>

                        {/* Refresh Data button */}
                        <Tooltip title="Refresh data table">
                            <button
                                onClick={() => {
                                    loadSummary(filters);
                                    loadLogs(filters, pageNumber, pageSize, sortBy, sortOrder);
                                    showToast('Data refreshed', 'info');
                                }}
                                disabled={loadingLogs}
                                className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors shadow-sm disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin text-blue-600' : ''}`} />
                            </button>
                        </Tooltip>

                        {/* Run Now Trigger Button */}
                        <button
                            onClick={handleRunNow}
                            disabled={runningTest}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all ${
                                runningTest 
                                    ? 'bg-blue-400 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-500/20'
                            }`}
                        >
                            {runningTest ? (
                                <>
                                    <CircularProgress size={14} color="inherit" />
                                    <span>Running Suite...</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    <span>Run Now</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ─── Summary Metric Cards ─── */}
                <SummaryCards summary={summary} loading={loadingSummary} />

                {/* ─── Filter & Search Bar ─── */}
                <FiltersBar
                    filters={filters}
                    availableOptions={availableOptions}
                    onChange={handleFiltersChange}
                    onReset={handleResetFilters}
                />

                {/* ─── Data Table ─── */}
                <LogsTable
                    logs={logs}
                    total={total}
                    pageNumber={pageNumber}
                    pageSize={pageSize}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    loading={loadingLogs}
                    onSortChange={(col, order) => {
                        setSortBy(col);
                        setSortOrder(order);
                        setPageNumber(1);
                    }}
                    onPageChange={(p) => setPageNumber(p)}
                    onRowClick={handleRowClick}
                />

                {/* ─── Side Drawer for Full Log Details ─── */}
                <LogDetailsDrawer
                    log={selectedLog}
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                />

                {/* ─── Toast Notifications ─── */}
                <Snackbar
                    open={toast.open}
                    autoHideDuration={4000}
                    onClose={handleToastClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    <Alert
                        onClose={handleToastClose}
                        severity={toast.severity}
                        variant="filled"
                        sx={{
                            width: '100%',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            borderRadius: '10px',
                            fontWeight: 500,
                            fontSize: '0.85rem'
                        }}
                    >
                        {toast.message}
                    </Alert>
                </Snackbar>

            </div>
        </CommonContainer>
    );
}
