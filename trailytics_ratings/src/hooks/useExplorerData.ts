/**
 * Hooks for the Explorer tab — sources of truth that used to be hardcoded
 * in the component file. Splitting into hooks keeps ActionIntelligenceHub
 * presentational + lets other components reuse the data.
 *
 *   useStakeholderMappings — replaces the hardcoded STAKEHOLDER_CONFIG.
 *                            Pulls /api/ratings/stakeholder-mappings and
 *                            returns a subcategory→stakeholder map.
 *
 *   useIssueStatuses       — replaces the localStorage-only aih_issue_statuses
 *                            blob. GETs on mount, POSTs on mutation, with a
 *                            one-time localStorage→DB migration so users
 *                            don't lose their existing triage state.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Factory, ClipboardCheck, Headphones, Megaphone, Shield, Package, Users } from 'lucide-react';
import { fetchAPI } from './useRatingsAPI';
import { resolveCompanyId } from '../utils/tenant';
import { buildAuthHeaders } from '../utils/auth';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/ratings`;

// ─── STAKEHOLDER MAPPINGS ───────────────────────────────────────────────────
export interface StakeholderMeta {
    key: string;           // raw stakeholder name from DB ("Production", "QC", ...)
    label: string;         // display label (same as key by default)
    icon: React.ElementType;
    color: string;         // tailwind text-* class for icon tint
    subcategories: string[];
}

// Stable icon+colour for known stakeholder names. Anything not in this map
// falls back to a neutral Users icon — no decorative color rotation.
const STAKEHOLDER_PRESENTATION: Record<string, { icon: React.ElementType; color: string }> = {
    Production:          { icon: Factory,         color: 'text-slate-700 dark:text-slate-300' },
    QC:                  { icon: ClipboardCheck,  color: 'text-slate-700 dark:text-slate-300' },
    'Customer Service':  { icon: Headphones,      color: 'text-slate-700 dark:text-slate-300' },
    Marketing:           { icon: Megaphone,       color: 'text-slate-700 dark:text-slate-300' },
    Quality:             { icon: Shield,          color: 'text-slate-700 dark:text-slate-300' },
    'Product Team':      { icon: Package,         color: 'text-slate-700 dark:text-slate-300' },
};

interface StakeholderMappingsResponse {
    mappings: Array<{ id: number; sentiment_subcategory: string; stakeholder: string; display_label: string | null; sort_order: number }>;
    grouped: Record<string, { stakeholder: string; subcategories: string[]; display_labels: Record<string, string> }>;
}

export function useStakeholderMappings() {
    const [stakeholders, setStakeholders] = useState<StakeholderMeta[]>([]);
    const [subcatToStakeholder, setSubcatToStakeholder] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        fetchAPI<StakeholderMappingsResponse>('/stakeholder-mappings', {})
            .then(res => {
                if (!alive) return;
                const meta: StakeholderMeta[] = [];
                const map = new Map<string, string>();
                for (const [name, g] of Object.entries(res.grouped || {})) {
                    if (name === '_unassigned' || !g.stakeholder) continue;
                    const presentation = STAKEHOLDER_PRESENTATION[g.stakeholder] || { icon: Users, color: 'text-slate-700 dark:text-slate-300' };
                    meta.push({
                        key: g.stakeholder,
                        label: g.stakeholder,
                        icon: presentation.icon,
                        color: presentation.color,
                        subcategories: g.subcategories,
                    });
                    for (const subcat of g.subcategories) map.set(subcat, g.stakeholder);
                }
                setStakeholders(meta);
                setSubcatToStakeholder(map);
            })
            .catch(e => console.warn('[stakeholder-mappings] load failed, defaulting to empty:', e.message))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, []);

    const routeOf = useCallback(
        (subcategoryRaw: string | null | undefined): string => {
            if (!subcategoryRaw) return 'Unassigned';
            // Backend stores 'Build_Quality'; reviews may carry 'Build Quality'. Try both.
            const snake = subcategoryRaw.trim().replace(/\s+/g, '_');
            return subcatToStakeholder.get(subcategoryRaw) || subcatToStakeholder.get(snake) || 'Unassigned';
        },
        [subcatToStakeholder]
    );

    return { stakeholders, routeOf, loading };
}

// ─── ISSUE STATUSES ─────────────────────────────────────────────────────────
export type IssueStatus = 'open' | 'in_progress' | 'resolved';
const LEGACY_LOCAL_STORAGE_KEY = 'aih_issue_statuses';

export function useIssueStatuses() {
    const [statuses, setStatuses] = useState<Record<string, IssueStatus>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetchAPI<{ statuses: Record<string, IssueStatus> }>('/issue-statuses', {});
                if (!alive) return;
                let serverMap = res.statuses || {};

                // One-time localStorage → DB migration: if the server has nothing
                // but the browser still has the legacy blob, push it up and clear it.
                let legacy: Record<string, IssueStatus> = {};
                try { legacy = JSON.parse(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY) || '{}'); } catch { /* corrupt blob — skip */ }
                if (Object.keys(serverMap).length === 0 && Object.keys(legacy).length > 0) {
                    const companyId = resolveCompanyId();
                    const headers = buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId);
                    await Promise.allSettled(
                        Object.entries(legacy).map(([issue_key, status]) =>
                            fetch(`${API_BASE}/issue-statuses?company_id=${companyId}`, {
                                method: 'POST', headers, body: JSON.stringify({ issue_key, status }),
                            })
                        )
                    );
                    serverMap = { ...legacy };
                    localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
                    console.log(`[issue-statuses] migrated ${Object.keys(legacy).length} entries from localStorage to DB`);
                }
                setStatuses(serverMap);
            } catch (e) {
                // Fall back to legacy localStorage if the API fails — better than
                // wiping the user's triage state on a transient network blip.
                try {
                    const legacy = JSON.parse(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY) || '{}');
                    if (alive) setStatuses(legacy);
                } catch { /* ignore */ }
                console.warn('[issue-statuses] load failed, using local fallback:', (e as Error).message);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    const updateStatus = useCallback(async (issue_key: string, status: IssueStatus) => {
        // Optimistic update — UI feels instant; if POST fails we revert.
        const prev = statuses[issue_key];
        setStatuses(s => ({ ...s, [issue_key]: status }));
        try {
            const companyId = resolveCompanyId();
            const headers = buildAuthHeaders({ 'Content-Type': 'application/json' }, companyId);
            const res = await fetch(`${API_BASE}/issue-statuses?company_id=${companyId}`, {
                method: 'POST', headers, body: JSON.stringify({ issue_key, status }),
            });
            if (!res.ok) throw new Error(`status ${res.status}`);
        } catch (e) {
            console.warn('[issue-statuses] save failed, rolling back:', (e as Error).message);
            setStatuses(s => {
                const next = { ...s };
                if (prev === undefined) delete next[issue_key]; else next[issue_key] = prev;
                return next;
            });
        }
    }, [statuses]);

    return useMemo(() => ({ statuses, updateStatus, loading }), [statuses, updateStatus, loading]);
}
