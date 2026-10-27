import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
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
    CircularProgress 
} from '@mui/material';
import CommonContainer from '../../components/CommonLayout/CommonContainer';
import SummaryCards from './components/SummaryCards';
import ApiHealthPieChart from './components/ApiHealthPieChart';
import FiltersBar from './components/FiltersBar';
import LogsTable from './components/LogsTable';
import LogDetailsDrawer from './components/LogDetailsDrawer';
import { 
    fetchApiLogs, 
    fetchApiLogsSummary, 
    fetchApiLogsFilters, 
    fetchApiLogsDistribution,
    triggerApiTestRun 
} from '../../api/apiLogsService';

export default function ApiLogsPage({ isEmbedded = false }) {
    // Filter State
    const [filters, setFilters] = useState({
        date: '',
        clientDb: 'All',
        page: '',
        segment: '',
        status: 'All',
        emptyResponse: 'All',
        search: '',
    });

    // Pagination & Sort State
    const [pageNumber, setPageNumber] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [sortBy, setSortBy] = useState('Date');
    const [sortOrder, setSortOrder] = useState('DESC');

    // Data State
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState(null);
    const [distribution, setDistribution] = useState(null);
    const [availableOptions, setAvailableOptions] = useState({
        dates: [],
        clients: [],
        pages: [],
        segments: [],
    });

    // Loading & UX State
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [loadingDistribution, setLoadingDistribution] = useState(true);
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
    const hasAutoRunRef = useRef(false);

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
                const clients = filterData.clients || [];
                const pages = filterData.pages || [];
                const segments = filterData.segments || [];

                setAvailableOptions({ dates, clients, pages, segments });

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
    const loadSummary = useCallback(async (currentFilters, isSilent = false) => {
        try {
            if (!isSilent) setLoadingSummary(true);
            const params = {};
            if (currentFilters.date) params.date = currentFilters.date;
            if (currentFilters.clientDb && currentFilters.clientDb !== 'All') params.clientDb = currentFilters.clientDb;
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
            if (!isSilent) setLoadingSummary(false);
        }
    }, []);

    // 2.5 Fetch 2-Day Health Distribution (Pie Chart & Hover List)
    const loadDistribution = useCallback(async (currentFilters, isSilent = false) => {
        try {
            if (!isSilent) setLoadingDistribution(true);
            const params = { days: 2 };
            if (currentFilters.clientDb && currentFilters.clientDb !== 'All') params.clientDb = currentFilters.clientDb;
            if (currentFilters.page) params.page = currentFilters.page;

            const res = await fetchApiLogsDistribution(params);
            if (res && res.success) {
                setDistribution(res);
            }
        } catch (err) {
            console.error('[ApiLogsPage] Failed to load distribution:', err);
        } finally {
            if (!isSilent) setLoadingDistribution(false);
        }
    }, []);

    // 3. Fetch Logs Table Data
    const loadLogs = useCallback(async (currentFilters, pNum, pSize, sBy, sOrder, isSilent = false) => {
        try {
            if (!isSilent) setLoadingLogs(true);
            const params = {
                pageNumber: pNum,
                pageSize: pSize,
                sortBy: sBy,
                sortOrder: sOrder,
            };

            if (currentFilters.date) params.date = currentFilters.date;
            if (currentFilters.clientDb && currentFilters.clientDb !== 'All') {
                params.clientDb = currentFilters.clientDb;
            }
            if (currentFilters.page) params.page = currentFilters.page;
            if (currentFilters.segment) params.segment = currentFilters.segment;
            if (currentFilters.status && currentFilters.status !== 'All') {
                params.status = currentFilters.status;
            }
            if (currentFilters.emptyResponse && currentFilters.emptyResponse !== 'All') {
                params.emptyResponse = currentFilters.emptyResponse;
            }
            if (currentFilters.search) params.search = currentFilters.search.trim();

            const res = await fetchApiLogs(params);
            if (res && res.success) {
                setLogs(res.data || []);
                setTotal(res.total ?? res.pagination?.total ?? (res.data ? res.data.length : 0));
            } else {
                setLogs([]);
                setTotal(0);
            }
        } catch (err) {
            console.error('[ApiLogsPage] Failed to load logs:', err);
            setLogs([]);
            setTotal(0);
        } finally {
            if (!isSilent) setLoadingLogs(false);
        }
    }, []);

    // Initial Mount: Load filter options and auto-run test suite once on page open
    useEffect(() => {
        isMounted.current = true;
        loadFilterOptions(true);

        // Run tests automatically when user opens this page
        if (!hasAutoRunRef.current) {
            hasAutoRunRef.current = true;
            (async () => {
                try {
                    setRunningTest(true);
                    const res = await triggerApiTestRun('', '');
                    if (res && res.success) {
                        setTimeout(async () => {
                            if (!isMounted.current) return;
                            await loadFilterOptions(false);
                            await loadSummary(filters);
                            await loadDistribution(filters);
                            await loadLogs(filters, pageNumber, pageSize, sortBy, sortOrder);
                            setRunningTest(false);
                            showToast('API diagnostic health check completed. Results updated.', 'success');
                        }, 4500);
                    } else {
                        setRunningTest(false);
                    }
                } catch (err) {
                    console.error('[ApiLogsPage] Auto-run error on page open:', err);
                    setRunningTest(false);
                }
            })();
        }

        return () => {
            isMounted.current = false;
        };
    }, [loadFilterOptions]);

    // React to filter / pagination / sort changes
    useEffect(() => {
        loadLogs(filters, pageNumber, pageSize, sortBy, sortOrder);
    }, [filters, pageNumber, pageSize, sortBy, sortOrder, loadLogs]);

    // React to date/page/segment changes for summary & distribution
    useEffect(() => {
        loadSummary(filters);
        loadDistribution(filters);
    }, [filters, loadSummary, loadDistribution]);

    // 60-Second Auto Refresh (Completely silent in background to prevent page flashing)
    useEffect(() => {
        const interval = setInterval(() => {
            if (!drawerOpen) {
                loadLogs(filters, pageNumber, pageSize, sortBy, sortOrder, true);
                loadSummary(filters, true);
                loadDistribution(filters, true);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [drawerOpen, filters, pageNumber, pageSize, sortBy, sortOrder, loadLogs, loadSummary, loadDistribution]);

    // Filter Change Handler
    const handleFiltersChange = (newFilters) => {
        // If user specifically selects "Failed" status, and the current selected single date has 0 failures,
        // automatically switch date to "All Dates" ('') so all failed APIs across the test window are immediately visible!
        if (newFilters.status === 'Failed' && summary?.failedCount === 0 && newFilters.date) {
            newFilters = {
                ...newFilters,
                date: '',
            };
        }
        setFilters(newFilters);
        setPageNumber(1); // Reset to page 1 on filter change
    };

    // Reset Filters Handler
    const handleResetFilters = () => {
        const defaultDate = availableOptions.dates?.length > 0 ? availableOptions.dates[0] : '';
        setFilters({
            date: defaultDate,
            clientDb: 'All',
            page: '',
            segment: '',
            status: 'All',
            emptyResponse: 'All',
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

    const mainContent = (
        <div className={isEmbedded ? "space-y-6 w-full" : "p-4 md:p-6 max-w-7xl mx-auto space-y-6"}>
                
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

                    {/* Right Status Indicators */}
                    <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                        {/* Auto-Running Health Checks Indicator */}
                        {runningTest && (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold animate-pulse shadow-sm">
                                <CircularProgress size={12} color="inherit" />
                                <span>Running Health Checks...</span>
                            </div>
                        )}

                        {/* Last Run Badge */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                                Last Run: <strong className="text-slate-800 font-semibold">{summary?.lastRunAt || summary?.lastRunTime || 'N/A'}</strong>
                            </span>
                        </div>
                    </div>
                </div>

                {/* ─── Summary Metric Cards ─── */}
                <SummaryCards 
                    summary={summary} 
                    loading={loadingSummary} 
                    selectedStatus={filters.status}
                    onSelectStatus={(status) => {
                        handleFiltersChange({
                            ...filters,
                            status: filters.status === status ? 'All' : status,
                        });
                    }}
                />

                {/* ─── 2-Day Health Distribution Pie Chart & Inspector ─── */}
                <ApiHealthPieChart
                    distribution={distribution}
                    loading={loadingDistribution}
                    selectedStatus={filters.status}
                    selectedEmptyResponse={filters.emptyResponse}
                    onSelectStatus={(status) => {
                        if (status === 'Reset' || status === 'All') {
                            handleFiltersChange({
                                ...filters,
                                status: 'All',
                                emptyResponse: 'All',
                            });
                        } else if (status === 'Empty') {
                            const isCurrentlyEmpty = filters.emptyResponse === '1';
                            handleFiltersChange({
                                ...filters,
                                status: 'All',
                                emptyResponse: isCurrentlyEmpty ? 'All' : '1',
                            });
                        } else {
                            handleFiltersChange({
                                ...filters,
                                status: filters.status === status ? 'All' : status,
                                emptyResponse: 'All',
                            });
                        }
                    }}
                />

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
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setPageNumber(1);
                    }}
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
    );

    if (isEmbedded) {
        return mainContent;
    }

    return (
        <CommonContainer
            title="API Logs"
            hideFilters={true}
        >
            {mainContent}
        </CommonContainer>
    );
}
