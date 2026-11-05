import { useState, useEffect, useRef } from 'react';
import { Play, Activity, Terminal, AlertTriangle, CheckCircle2, XCircle, Sparkles, Brain, Network, Cpu } from 'lucide-react';
import { resolveCompanyId } from '../utils/tenant';
import { buildAuthHeaders } from '../utils/auth';

interface MLJob {
    id: string;
    job_name: string;
    status: 'RUNNING' | 'COMPLETED' | 'FAILED';
    logs: string;
    started_at: string;
}

export function MLControlCenter() {
    const [jobs, setJobs] = useState<MLJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [spawning, setSpawning] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);
    // ML pipelines spawn Python processes — these MUST route to Railway (Docker),
    // not Vercel serverless which has no Python runtime.
    const railwayUrl = import.meta.env.VITE_RAILWAY_URL || '';

    // Default company ID — same source as useRatingsAPI.ts
    const getCompanyId = () => resolveCompanyId();

    const fetchJobs = async () => {
        try {
            const companyId = getCompanyId();
            const res = await fetch(`${railwayUrl}/api/ml/jobs`, { headers: buildAuthHeaders(undefined, companyId) });
            const data = await res.json();
            setJobs(data.jobs || []);
        } catch (error) {
            console.error('Failed to fetch ML jobs', error);
        } finally {
            setLoading(false);
        }
    };

    // Poll every 2 seconds if any job is RUNNING
    const hasRunning = jobs.some(j => j.status === 'RUNNING');
    useEffect(() => {
        fetchJobs();
        // Always poll — picks up new jobs and running status
        const interval = setInterval(fetchJobs, hasRunning ? 2000 : 10000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasRunning]);

    // Auto scroll bottom for the active terminal
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [jobs]);

    const handleSpawn = async (jobName: string) => {
        setSpawning(true);
        try {
            const companyId = getCompanyId();
            const res = await fetch(`${railwayUrl}/api/ml/jobs/spawn`, {
                method: 'POST',
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
                body: JSON.stringify({ jobName })
            });
            if (res.ok) {
                // Immediately fetch to show the new job, then polling takes over
                setTimeout(fetchJobs, 500);
            } else {
                const text = await res.text();
                alert(`Error starting pipeline: ${text}`);
            }
        } catch (error: any) {
            console.error('Spawn error', error);
            alert(`Network Error: ${error.message}`);
        } finally {
            setSpawning(false);
        }
    };

    return (
        <div className="p-8 space-y-8 bg-slate-50 dark:bg-[#0b0f19] min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <Activity className="text-indigo-500" size={28} />
                        Intelligence Command Grid
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed max-w-2xl">
                        Real-time execution matrix for background intelligence workers. Select a pipeline below to initiate local neural networks or external APIs for massive data enrichment.
                    </p>
                </div>
            </div>

            {/* Intelligence Command Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Card 1 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5 hover:shadow-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 group flex flex-col transform hover:-translate-y-1">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                            <Sparkles size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Gemini AI Audit</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400/90 mb-6 flex-1 leading-relaxed">
                        Triggers high-fidelity API requests against pending raw reviews in controlled chunks (10 rows/batch) to extract deep product anomalies and sentiment reasoning safely.
                    </p>
                    <button 
                        onClick={() => handleSpawn('Gemini Audit')}
                        disabled={spawning || jobs.some(j => j.status === 'RUNNING')}
                        className="w-full bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500 dark:hover:text-white disabled:opacity-50 disabled:hover:scale-100 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm active:scale-95"
                    >
                        <Play size={16} /> Execute Pipeline
                    </button>
                </div>

                {/* Card 2 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5 hover:shadow-lg hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-300 group flex flex-col transform hover:-translate-y-1">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-purple-100 dark:bg-purple-500/20 rounded-lg text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                            <Brain size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">DeBERTa Taxonomy</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400/90 mb-6 flex-1 leading-relaxed">
                        Runs local zero-shot neural networks against pending reviews in batches of 20 to strictly assign Master Catalog categories mathematically without using API credits.
                    </p>
                    <button 
                        onClick={() => handleSpawn('DeBERTa Taxonomy')}
                        disabled={spawning || jobs.some(j => j.status === 'RUNNING')}
                        className="w-full bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-600 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500 dark:hover:text-white disabled:opacity-50 disabled:hover:scale-100 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm active:scale-95"
                    >
                        <Play size={16} /> Execute Taxonomy
                    </button>
                </div>

                {/* Card 3 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5 hover:shadow-lg hover:border-amber-400 dark:hover:border-amber-500 transition-all duration-300 group flex flex-col transform hover:-translate-y-1">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                            <Network size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Matrix Matching</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400/90 mb-6 flex-1 leading-relaxed">
                        Performs an entire database sweep mapping Prestige-to-Competitors using the 15% physical tolerance limits. Highly intensive, executes on all unmapped catalogue relationships.
                    </p>
                    <button 
                        onClick={() => handleSpawn('Competitor Matrix Match')}
                        disabled={spawning || jobs.some(j => j.status === 'RUNNING')}
                        className="w-full bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500 dark:hover:text-white disabled:opacity-50 disabled:hover:scale-100 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm active:scale-95"
                    >
                        <Play size={16} /> Execute Mapping
                    </button>
                </div>

                {/* Card 4 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5 hover:shadow-lg hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-300 group flex flex-col transform hover:-translate-y-1">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                            <Cpu size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Local BERT Engine</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400/90 mb-6 flex-1 leading-relaxed">
                        Deploys a local fast BERT classification model offline to infer missing review-rating suggestions in batches of 20. <strong className="text-emerald-500 block mt-2">Results go to QC audit and still require approval.</strong>
                    </p>
                    <button 
                        onClick={() => handleSpawn('BERT Inference')}
                        disabled={spawning || jobs.some(j => j.status === 'RUNNING')}
                        className="w-full bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500 dark:hover:text-white disabled:opacity-50 disabled:hover:scale-100 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm active:scale-95"
                    >
                        <Play size={16} /> Execute BERT
                    </button>
                </div>

                {/* Card 5 - Master Spec Enrichment */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5 hover:shadow-lg hover:border-cyan-400 dark:hover:border-cyan-500 transition-all duration-300 group flex flex-col transform hover:-translate-y-1">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-cyan-100 dark:bg-cyan-500/20 rounded-lg text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                            <Cpu size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Telemetry Skimmer</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400/90 mb-6 flex-1 leading-relaxed">
                        Runs a high-speed Gemini preview loop for missing <strong className="text-slate-600 dark:text-slate-200">Material and Wattage</strong> candidates on SKU masters. This remains preview-only until a dedicated audited master QC store exists.
                    </p>
                    <button 
                        onClick={() => handleSpawn('Master Spec Enrichment')}
                        disabled={spawning || jobs.some(j => j.status === 'RUNNING')}
                        className="w-full bg-cyan-50 hover:bg-cyan-600 hover:text-white text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500 dark:hover:text-white disabled:opacity-50 disabled:hover:scale-100 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm active:scale-95"
                    >
                        <Play size={16} /> Execute Skimmer
                    </button>
                </div>

                {/* Card 6 - Sentiment Backfill */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5 hover:shadow-lg hover:border-orange-400 dark:hover:border-orange-500 transition-all duration-300 group flex flex-col transform hover:-translate-y-1">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-orange-100 dark:bg-orange-500/20 rounded-lg text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                            <Activity size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Feedback Taxonomist</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400/90 mb-6 flex-1 leading-relaxed">
                        Rapidly assigns analytical intelligence models to target completely un-categorized feedback chunks. Automatically fills <strong className="text-slate-600 dark:text-slate-200">Feedback Category</strong> and Sentiment arrays safely without API caps.
                    </p>
                    <button 
                        onClick={() => handleSpawn('Sentiment Backfill')}
                        disabled={spawning || jobs.some(j => j.status === 'RUNNING')}
                        className="w-full bg-orange-50 hover:bg-orange-600 hover:text-white text-orange-600 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500 dark:hover:text-white disabled:opacity-50 disabled:hover:scale-100 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all text-sm active:scale-95"
                    >
                        <Play size={16} /> Execute Taxonomist
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Historical Ledger */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <h2 className="font-semibold text-slate-700 dark:text-slate-300">Execution History</h2>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {loading && <div className="p-4 text-center text-slate-400">Loading...</div>}
                        {jobs.map(job => (
                            <div key={job.id} className={`p-3 rounded-lg border transition-colors ${
                                job.status === 'RUNNING' ? 'border-blue-400 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-900/20' : 
                                job.status === 'FAILED' ? 'border-rose-300 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-900/10' : 
                                job.status === 'COMPLETED' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-900/10' : 
                                'border-slate-200 dark:border-slate-700'
                            }`}>
                                <div className="flex justify-between items-start">
                                    <span className={`font-medium ${
                                        job.status === 'FAILED' ? 'text-rose-800 dark:text-rose-200' :
                                        job.status === 'COMPLETED' ? 'text-emerald-800 dark:text-emerald-200' :
                                        'text-slate-800 dark:text-slate-200'
                                    }`}>{job.job_name}</span>
                                    {job.status === 'RUNNING' && <Activity size={16} className="text-blue-500 animate-pulse" />}
                                    {job.status === 'COMPLETED' && <CheckCircle2 size={16} className="text-emerald-500" />}
                                    {job.status === 'FAILED' && <XCircle size={16} className="text-rose-500" />}
                                </div>
                                <div className={`text-xs mt-2 flex justify-between ${
                                    job.status === 'FAILED' ? 'text-rose-600 dark:text-rose-400/80' :
                                    job.status === 'COMPLETED' ? 'text-emerald-600 dark:text-emerald-400/80' :
                                    'text-slate-500 dark:text-slate-400'
                                }`}>
                                    <span>{new Date(job.started_at).toLocaleTimeString()}</span>
                                    <span className="font-semibold">{job.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Live Terminal */}
                <div className="lg:col-span-2 bg-[#0d1117] rounded-xl border border-slate-700 shadow-xl overflow-hidden flex flex-col h-[600px]">
                    <div className="px-4 py-2 border-b border-slate-700 bg-slate-800 flex items-center gap-2">
                        <Terminal size={14} className="text-slate-400" />
                        <span className="text-xs font-mono text-slate-300">live-stdout.log</span>
                        <div className="ml-auto flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                        </div>
                    </div>
                    <div className="p-4 font-mono text-sm overflow-y-auto flex-1 select-text">
                        {jobs.length === 0 ? (
                            <div className="text-slate-500 mt-10 text-center">No jobs found in the matrix. Initiate a sequence.</div>
                        ) : (
                            <div className="text-green-400 break-words whitespace-pre-wrap">
                                {jobs[0]?.logs ? jobs[0].logs : <span className="text-slate-500">Awaiting process stream...</span>}
                                {jobs[0]?.status === 'RUNNING' && <span className="animate-pulse">_</span>}
                                <div ref={logsEndRef} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Context Notice */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg flex gap-3 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="shrink-0" />
                <div className="text-sm">
                    <strong>Administrative Access Notice:</strong> This terminal executes processes synchronously on the Railway application server. Triggering the LLM or BERT heavily consumes CPU credits. Leave page open to track active tailing logs.
                </div>
            </div>
        </div>
    );
}
