/**
 * Bulk import for master_category / NPD designation.
 *
 * Accepts a CSV with columns: web_pid, master_category, is_npd
 *   web_pid          — required, must exist in masters.products
 *   master_category  — optional, must be one of the allowed taxonomy values
 *   is_npd           — optional, "true"/"1"/true marks as NPD, else "Non-Pareto"
 *
 * Parses client-side, shows a 10-row preview + count, then POSTs in one go.
 * Backend returns per-row status so we can highlight errors.
 */
import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, Download } from 'lucide-react';
import { resolveCompanyId } from '../../utils/tenant';
import { buildAuthHeaders } from '../../utils/auth';
import { RATINGS_API_BASE } from '../../config/apiBase';

interface CsvRow {
  web_pid: string;
  master_category?: string;
  is_npd?: boolean | string;
}

interface ImportResult {
  totalRows: number;
  updated: number;
  errored: number;
  skipped: number;
  allowedCategories: string[];
  results: { web_pid: string; status: 'updated' | 'error' | 'skipped'; reason?: string; changes?: Record<string, unknown> }[];
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Header row
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const wpidIdx = headers.findIndex(h => h === 'web_pid' || h === 'asin' || h === 'product_external_id' || h === 'sku');
  const catIdx  = headers.findIndex(h => h === 'master_category' || h === 'category' || h === 'type');
  const npdIdx  = headers.findIndex(h => h === 'is_npd' || h === 'npd');
  if (wpidIdx === -1) {
    throw new Error('CSV must have a web_pid (or asin/sku) column in the header row');
  }
  const out: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Tolerate quoted fields with commas inside.
    const cols = lines[i].match(/(?:"([^"]*)"|([^,]*))(?:,|$)/g)?.map(c =>
      c.replace(/,$/, '').replace(/^"|"$/g, '')
    ) || [];
    const row: CsvRow = { web_pid: (cols[wpidIdx] || '').trim() };
    if (catIdx >= 0 && cols[catIdx]) row.master_category = cols[catIdx].trim();
    if (npdIdx >= 0 && cols[npdIdx] !== undefined) row.is_npd = cols[npdIdx].trim();
    if (row.web_pid) out.push(row);
  }
  return out;
}

export function BulkImportPanel() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    setRows([]);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) throw new Error('No data rows found.');
      setRows(parsed);
      setFilename(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const companyId = resolveCompanyId();
      const backendUrl = RATINGS_API_BASE;
      const res = await fetch(`${backendUrl}/api/ratings/products/bulk-import?company_id=${encodeURIComponent(companyId)}`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId),
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'web_pid,master_category,is_npd\nB0EXAMPLE1,Kadai,false\nB0EXAMPLE2,Pressure Cooker,true\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'master_category_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Upload size={18} className="text-indigo-500" /> Bulk master import
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            CSV with <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">web_pid, master_category, is_npd</code>.
            Closes the master-category gap in one shot.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <Download size={12} /> Template
        </button>
      </div>

      {!rows.length && !result && (
        <div
          className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
        >
          <Upload size={32} className="mx-auto text-slate-400 mb-2" />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Drop a CSV here, or click to choose</div>
          <div className="text-xs text-slate-400 mt-1">Up to 10,000 rows</div>
          <input
            ref={fileRef} type="file" accept=".csv,text/csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-rose-500 py-3 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {rows.length > 0 && !result && (
        <>
          <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3 mb-3 flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <FileText size={14} /> <strong>{filename}</strong> · {rows.length} rows ready
            </div>
            <button
              onClick={() => { setRows([]); setFilename(null); setError(null); }}
              className="text-slate-400 hover:text-rose-500"
              aria-label="Cancel"
            ><X size={16} /></button>
          </div>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left p-2 font-semibold text-slate-600 dark:text-slate-300">web_pid</th>
                  <th className="text-left p-2 font-semibold text-slate-600 dark:text-slate-300">master_category</th>
                  <th className="text-left p-2 font-semibold text-slate-600 dark:text-slate-300">is_npd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td className="p-2 font-mono text-slate-700 dark:text-slate-300">{r.web_pid}</td>
                    <td className="p-2 text-slate-700 dark:text-slate-300">{r.master_category || '—'}</td>
                    <td className="p-2 text-slate-700 dark:text-slate-300">{r.is_npd === undefined ? '—' : String(r.is_npd)}</td>
                  </tr>
                ))}
                {rows.length > 10 && (
                  <tr><td colSpan={3} className="p-2 text-xs text-slate-400 italic">…and {rows.length - 10} more</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 text-sm active:scale-95"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Apply {rows.length} rows
          </button>
        </>
      )}

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
              <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold uppercase tracking-wide">Updated</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{result.updated}</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3">
              <div className="text-xs text-rose-700 dark:text-rose-300 font-semibold uppercase tracking-wide">Errored</div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{result.errored}</div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-3">
              <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wide">Skipped</div>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{result.skipped}</div>
            </div>
          </div>
          {result.errored > 0 && (
            <div className="border border-rose-200 dark:border-rose-900/50 rounded-lg overflow-hidden">
              <div className="bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">Errors</div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-rose-100 dark:divide-rose-900/30">
                    {result.results.filter(r => r.status === 'error').slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 font-mono text-slate-700 dark:text-slate-300">{r.web_pid}</td>
                        <td className="p-2 text-rose-600 dark:text-rose-400">{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <button
            onClick={() => { setRows([]); setFilename(null); setResult(null); }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <CheckCircle2 size={14} /> Import another file
          </button>
        </div>
      )}
    </section>
  );
}
