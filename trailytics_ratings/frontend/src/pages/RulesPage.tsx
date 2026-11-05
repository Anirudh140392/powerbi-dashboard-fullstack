/**
 * Rules tab — surfaces the alert / mailer / mapping / pipeline UI.
 * Sub-tabs are URL-stateful via ?sub=<key> so links from emails / docs can
 * deep-link straight to e.g. /?tab=rules&sub=alert-rules.
 *
 * Role gating:
 *   everyone  → alert-rules, alert-events
 *   super_admin → everything else (mailer, regex, mappings, pipeline,
 *                 job triggers, run history, user admin)
 *
 * company_admin sees the same as everyone — the pipeline / regex / mapping
 * surfaces are not appropriate to expose at tenant-admin level.
 */
import { useState, useEffect, useMemo } from 'react';
import {
    Bell, Megaphone, Users, Waypoints, Filter, MailCheck,
    History, Zap, Activity, Crown, UserCog,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PipelineStatusHero } from '../components/automation/PipelineStatusHero';
import { AlertRulesTable } from '../components/automation/AlertRulesTable';
import { AlertEventsList } from '../components/automation/AlertEventsList';
import { RunHistoryPanel } from '../components/automation/RunHistoryPanel';
import { JobTriggerPanel } from '../components/automation/JobTriggerPanel';
import { MailerSettingsPanel } from '../components/automation/MailerSettingsPanel';
import StakeholderMappingTable from '../components/master/StakeholderMappingTable';
import CompetitorMappingTable from '../components/master/CompetitorMappingTable';
import CategoryExtractionRules from '../components/master/CategoryExtractionRules';
import { UsersAdminPanel } from '../components/auth/UsersAdminPanel';

type SubKey =
    | 'alert-rules'
    | 'alert-events'
    | 'mailer'
    | 'category-rules'
    | 'stakeholder-map'
    | 'competitor-map'
    | 'job-triggers'
    | 'run-history'
    | 'users';

interface SubTab {
    key: SubKey;
    label: string;
    icon: React.ElementType;
    superAdminOnly?: boolean;
    blurb: string;
}

const ALL_SUBS: SubTab[] = [
    { key: 'alert-rules',     label: 'Alert Rules',       icon: Bell,        blurb: 'Trigger emails on rating drops' },
    { key: 'alert-events',    label: 'Alert Events',      icon: Megaphone,   blurb: 'Recent alerts fired' },
    { key: 'mailer',          label: 'Mailer Settings',   icon: MailCheck,   superAdminOnly: true, blurb: 'Calendar invites, threading, priority' },
    { key: 'category-rules',  label: 'Category Rules',    icon: Filter,      superAdminOnly: true, blurb: 'Keyword classification engine' },
    { key: 'stakeholder-map', label: 'Stakeholder Map',   icon: Users,       superAdminOnly: true, blurb: 'Route issues to owners' },
    { key: 'competitor-map',  label: 'Competitor Map',    icon: Waypoints,   superAdminOnly: true, blurb: 'Pair Prestige SKUs with peer SKUs' },
    { key: 'job-triggers',    label: 'Job Triggers',      icon: Zap,         superAdminOnly: true, blurb: 'Run ML/LLM jobs on demand' },
    { key: 'run-history',     label: 'Run History',       icon: History,     superAdminOnly: true, blurb: 'Past pipeline runs + status' },
    { key: 'users',           label: 'Users',             icon: UserCog,     superAdminOnly: true, blurb: 'Reset MFA, send password resets' },
];

function getInitialSub(): SubKey {
    const params = new URLSearchParams(window.location.search);
    const sub = params.get('sub') as SubKey;
    const allKeys = ALL_SUBS.map(s => s.key);
    return allKeys.includes(sub) ? sub : 'alert-rules';
}

export function RulesPage() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';

    const visibleSubs = useMemo(
        () => ALL_SUBS.filter(s => !s.superAdminOnly || isSuperAdmin),
        [isSuperAdmin]
    );

    const [activeSub, setActiveSub] = useState<SubKey>(getInitialSub);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        params.set('sub', activeSub);
        const newSearch = params.toString();
        if (newSearch !== window.location.search.slice(1)) {
            window.history.replaceState(null, '', `${window.location.pathname}?${newSearch}`);
        }
    }, [activeSub]);

    useEffect(() => {
        const isVisible = visibleSubs.some(s => s.key === activeSub);
        if (!isVisible) setActiveSub('alert-rules');
    }, [visibleSubs, activeSub]);

    const activeMeta = visibleSubs.find(s => s.key === activeSub);

    return (
        <div className="space-y-5">
            {/* Sub-tab strip — horizontal segmented control (no sidebar) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-1 overflow-x-auto">
                <div className="flex gap-1 min-w-max">
                    {visibleSubs.map(sub => {
                        const Icon = sub.icon;
                        const isActive = sub.key === activeSub;
                        return (
                            <button
                                key={sub.key}
                                onClick={() => setActiveSub(sub.key)}
                                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all shrink-0
                                    ${isActive
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                title={sub.blurb}
                            >
                                <Icon size={13} />
                                {sub.label}
                                {sub.superAdminOnly && <Crown size={9} className="opacity-70" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {activeMeta && (
                <div className="px-1">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <activeMeta.icon size={16} className="text-indigo-500" />
                        {activeMeta.label}
                        {activeMeta.superAdminOnly && (
                            <span className="text-[10px] uppercase tracking-wider bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1">
                                <Crown size={9} /> Super Admin
                            </span>
                        )}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activeMeta.blurb}</p>
                </div>
            )}

            {/* Pipeline status banner — super_admin only */}
            {isSuperAdmin && <PipelineStatusHero />}

            <div>
                {activeSub === 'alert-rules' && <AlertRulesTable />}
                {activeSub === 'alert-events' && <AlertEventsList />}
                {activeSub === 'mailer' && isSuperAdmin && <MailerSettingsPanel />}
                {activeSub === 'category-rules' && isSuperAdmin && <CategoryExtractionRules />}
                {activeSub === 'stakeholder-map' && isSuperAdmin && <StakeholderMappingTable />}
                {activeSub === 'competitor-map' && isSuperAdmin && <CompetitorMappingTable />}
                {activeSub === 'job-triggers' && isSuperAdmin && (
                    <div className="space-y-4">
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                            <Activity size={14} className="mt-0.5 shrink-0" />
                            <span>Spawning an ML/LLM job can run for hours and consume Gemini quota. Use sparingly.</span>
                        </div>
                        <JobTriggerPanel />
                    </div>
                )}
                {activeSub === 'run-history' && isSuperAdmin && <RunHistoryPanel />}
                {activeSub === 'users' && isSuperAdmin && <UsersAdminPanel />}
            </div>
        </div>
    );
}
