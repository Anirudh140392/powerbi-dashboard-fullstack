/**
 * AlertRuleModal — right-side slide-in panel for creating / editing
 * rating-drop alert rules. 75% screen width.
 *
 * Three sections in order:
 *   1. WHEN: trigger mode (schedule / on event / manual only)
 *   2. WHO: scope + filters (product/brand/category, classification, sentiment cat, platform)
 *   3. WHAT: conditions (rating floor, drop delta, min counts, comparison window)
 *   4. ACTIONS: email + slack toggles, recipients
 *   5. TEST: inline preview + send-real-email
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2, FlaskConical, Mail, CheckCircle2, AlertCircle, Search,
  Clock, Zap, MousePointerClick, Target, Layers, BarChart3,
  AtSign, Bell, ChevronRight, Building2, ShoppingBag,
} from 'lucide-react';
import type {
  AlertRule, AlertRuleInput, ComparisonWindow,
  Classification, TriggerMode, AlertAction, TestRuleResult,
  CompetitorScope,
} from '../../types/automation';
import { MultiSelectDropdown, type MultiSelectOption } from '../ui/MultiSelectDropdown';
import { useProductCategories, useBrandConfig, usePlatformOptions } from '../../hooks/useRatingsAPI';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COMPETITOR_SCOPES: { value: CompetitorScope; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'prestige',    label: 'Prestige only',     desc: 'Watch our own catalogue', icon: ShoppingBag },
  { value: 'competitors', label: 'Competitors only',  desc: 'Watch peer brands',       icon: Building2 },
  { value: 'all',         label: 'Both',              desc: 'Prestige + competitors',   icon: Target },
];

const TRIGGER_MODES: { value: TriggerMode; icon: React.ElementType; title: string; desc: string }[] = [
  { value: 'on_schedule', icon: Clock,             title: 'On schedule',     desc: 'Fires during the daily 07:30 IST pipeline run' },
  { value: 'on_event',    icon: Zap,               title: 'On every sync',   desc: 'Fires immediately after each MySQL→Postgres sync completes' },
  { value: 'custom_cron', icon: Clock,             title: 'Custom schedule', desc: 'Pick your own cadence (every hour, twice daily, weekly)' },
  { value: 'manual_only', icon: MousePointerClick, title: 'Manual only',     desc: 'Never auto-fires; only when you click "Send real email"' },
];

const CRON_PRESETS: { value: string; label: string }[] = [
  { value: '0 * * * *',     label: 'Every hour, on the hour' },
  { value: '0 */6 * * *',   label: 'Every 6 hours' },
  { value: '0 2,14 * * *',  label: 'Twice daily — 02:00 + 14:00 UTC' },
  { value: '0 9 * * 1-5',   label: 'Weekdays 09:00 UTC' },
  { value: '0 9 * * 1',     label: 'Mondays 09:00 UTC' },
];

const CLASSIFICATIONS: { value: Classification | ''; label: string; desc: string }[] = [
  { value: '',           label: 'All SKUs',     desc: 'No classification filter' },
  { value: 'Pareto',     label: 'Pareto',       desc: 'Top sellers driving 80% revenue' },
  { value: 'Non-Pareto', label: 'Non-Pareto',   desc: 'Standard catalogue (the tail)' },
  { value: 'NPD',        label: 'NPD',          desc: 'New Product Development' },
];

const ACTIONS: { value: AlertAction; icon: React.ElementType; title: string; desc: string }[] = [
  { value: 'email',  icon: AtSign, title: 'Email',   desc: 'Send a digest to the recipients below' },
  { value: 'in_app', icon: Bell,   title: 'In-app',  desc: 'Show in the header notification bell' },
];

interface Props {
  rule: AlertRule | null;
  onClose: () => void;
  onSave: (input: AlertRuleInput) => Promise<void>;
  onTest?: (id: string, send?: boolean) => Promise<TestRuleResult & { sent?: boolean; sentTo?: string | string[]; sendError?: string }>;
}

type TestState = {
  result: TestRuleResult | null;
  loading: 'preview' | 'send' | null;
  notice: { kind: 'success' | 'error' | 'info'; text: string } | null;
};

function SectionHeader({ step, icon: Icon, title, hint }: { step: number; icon: React.ElementType; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <div className="shrink-0 w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-bold">
        {step}
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Icon size={14} className="text-indigo-500" /> {title}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
      {children}
    </label>
  );
}

export function AlertRuleModal({ rule, onClose, onSave, onTest }: Props) {
  const isNew = !rule;

  // Core
  const [name, setName] = useState(rule?.name ?? '');
  const [absoluteFloor, setAbsoluteFloor] = useState<string>(
    rule?.absolute_floor != null ? String(rule.absolute_floor) : '3.5',
  );
  const [dropDelta, setDropDelta] = useState<string>(
    rule?.drop_delta != null ? String(rule.drop_delta) : '0.3',
  );
  const [useFloor, setUseFloor] = useState(isNew ? true : rule!.absolute_floor != null);
  const [useDelta, setUseDelta] = useState(isNew ? true : rule!.drop_delta != null);
  const [comparisonWindow, setComparisonWindow] = useState<ComparisonWindow>(
    rule?.comparison_window ?? 'previous_snapshot',
  );
  const [minRatingCount, setMinRatingCount] = useState<string>(String(rule?.min_rating_count ?? 0));
  const [minReviewCount, setMinReviewCount] = useState<string>(String(rule?.min_review_count ?? 0));
  const [recipientsRaw, setRecipientsRaw] = useState((rule?.recipients ?? []).join(', '));
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);

  // v4 multi-select arrays + competitor scope
  const initialPlatforms = rule?.platforms?.length ? rule.platforms : (rule?.platform ? [rule.platform] : []);
  const initialBrands     = rule?.brands?.length    ? rule.brands    : (rule?.brand_filter ? [rule.brand_filter] : []);
  const initialCategories = rule?.categories?.length ? rule.categories : (rule?.category_filter ? [rule.category_filter] : []);
  const initialWebPids    = rule?.web_pids?.length  ? rule.web_pids  : (rule?.scope_type === 'product' && rule?.scope_value ? [rule.scope_value] : []);

  const [competitorScope, setCompetitorScope] = useState<CompetitorScope>(rule?.is_competitor_scope ?? 'prestige');
  const [platforms, setPlatforms]   = useState<string[]>(initialPlatforms);
  const [brands, setBrands]         = useState<string[]>(initialBrands);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [webPidsRaw, setWebPidsRaw] = useState<string>(initialWebPids.join(', '));
  const [classification, setClassification] = useState<Classification | ''>(
    (rule?.classification as Classification | '' | null | undefined) ?? '',
  );

  const [triggerMode, setTriggerMode] = useState<TriggerMode>(rule?.trigger_mode ?? 'on_schedule');
  const [cronExpression, setCronExpression] = useState<string>(rule?.cron_expression ?? '0 * * * *');
  const [actions, setActions] = useState<AlertAction[]>(rule?.actions ?? ['email']);

  // OR-group
  const [orGroupEnabled, setOrGroupEnabled] = useState<boolean>(!!rule?.or_group);
  const [orBrand, setOrBrand]               = useState(rule?.or_group?.brand_filter ?? '');
  const [orCategory, setOrCategory]         = useState(rule?.or_group?.category_filter ?? '');
  const [orClassification, setOrClassification] = useState<Classification | ''>(
    (rule?.or_group?.classification as Classification | '' | null | undefined) ?? '',
  );

  // Live dropdown sources
  const { data: catData, loading: catLoading } = useProductCategories({});
  const { brands: brandConfigData, loading: brandsLoading } = useBrandConfig();
  const { platforms: platformOpts, loading: platformsLoading } = usePlatformOptions(
    competitorScope === 'competitors' ? true : competitorScope === 'prestige' ? false : undefined
  );

  const categoryOptions: MultiSelectOption[] = catData.map(c => ({
    value: c.category,
    label: c.category,
    hint: c.count.toLocaleString(),
  }));
  const brandOptions: MultiSelectOption[] = (brandConfigData || [])
    .filter(b => {
      if (competitorScope === 'prestige')    return b.is_own_brand;
      if (competitorScope === 'competitors') return !b.is_own_brand;
      return true;
    })
    .map(b => ({
      value: b.brand_name,
      label: b.brand_name,
      pill: b.is_own_brand ? { text: 'Own', color: 'indigo' } : undefined,
    }));
  const platformOptions: MultiSelectOption[] = (platformOpts || []).map(p => ({ value: p, label: p }));

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [test, setTest] = useState<TestState>({ result: null, loading: null, notice: null });

  const recipients = recipientsRaw.split(',').map((r) => r.trim()).filter(Boolean);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function validate(): string | null {
    if (!name.trim()) return 'Rule name is required';
    if (!useFloor && !useDelta) return 'Enable at least one condition (floor or drop delta)';
    if (useFloor) {
      const f = Number(absoluteFloor);
      if (Number.isNaN(f) || f < 1 || f > 5) return 'Absolute floor must be between 1 and 5';
    }
    if (useDelta) {
      const d = Number(dropDelta);
      if (Number.isNaN(d) || d <= 0) return 'Drop delta must be greater than 0';
    }
    if (actions.length === 0) return 'Choose at least one action (Email, Slack, or In-app)';
    if (actions.includes('email')) {
      const bad = recipients.find((r) => !EMAIL_RE.test(r));
      if (bad) return `Invalid recipient email: ${bad}`;
    }
    return null;
  }

  const webPids = webPidsRaw.split(',').map(s => s.trim()).filter(Boolean);

  function buildInput(): AlertRuleInput {
    return {
      name: name.trim(),
      // scope_type/scope_value are now legacy but still required by older
      // schema validators. Send safe defaults.
      scope_type: 'product',
      scope_value: null,
      platform: null,
      absolute_floor: useFloor ? Number(absoluteFloor) : null,
      drop_delta: useDelta ? Number(dropDelta) : null,
      comparison_window: comparisonWindow,
      min_rating_count: Math.max(0, parseInt(minRatingCount, 10) || 0),
      recipients,
      enabled,
      brand_filter: null,
      category_filter: null,
      classification: classification || null,
      sentiment_category: null,
      min_review_count: Math.max(0, parseInt(minReviewCount, 10) || 0),
      trigger_mode: triggerMode,
      actions,
      cron_expression: triggerMode === 'custom_cron' ? cronExpression.trim() : null,
      or_group: orGroupEnabled
        ? {
            brand_filter: orBrand.trim() || null,
            category_filter: orCategory.trim() || null,
            classification: orClassification || null,
          }
        : null,
      is_competitor_scope: competitorScope,
      platforms,
      brands,
      categories,
      web_pids: webPids,
    };
  }

  const handleSave = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }
    setFormError(null);
    setSaving(true);
    try {
      await onSave(buildInput());
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!rule || !onTest) return;
    setTest({ result: null, loading: 'preview', notice: null });
    try {
      const result = await onTest(rule.id, false);
      setTest({
        result,
        loading: null,
        notice: result.wouldTrigger === 0
          ? { kind: 'info', text: 'No SKUs would trigger right now.' }
          : null,
      });
    } catch (e) {
      setTest({ result: null, loading: null, notice: { kind: 'error', text: `Preview failed: ${e instanceof Error ? e.message : e}` } });
    }
  };

  const handleSendReal = async () => {
    if (!rule || !onTest) return;
    setTest((t) => ({ ...t, loading: 'send', notice: null }));
    try {
      const result = await onTest(rule.id, true);
      if (result.sent) {
        const to = Array.isArray(result.sentTo) ? result.sentTo.join(', ') : result.sentTo;
        setTest({ result, loading: null, notice: { kind: 'success', text: `Email sent to ${to}. Check inbox in ~30s.` } });
      } else if (result.wouldTrigger === 0) {
        setTest({ result, loading: null, notice: { kind: 'info', text: 'Nothing to send — no SKUs match.' } });
      } else {
        setTest({ result, loading: null, notice: { kind: 'error', text: result.sendError || 'Email failed.' } });
      }
    } catch (e) {
      setTest((t) => ({ ...t, loading: null, notice: { kind: 'error', text: `Send failed: ${e instanceof Error ? e.message : e}` } }));
    }
  };

  const toggleAction = (a: AlertAction) => {
    setActions((curr) => curr.includes(a) ? curr.filter((x) => x !== a) : [...curr, a]);
  };

  const panel = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 220 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 w-[75vw] max-w-[1100px] min-w-[600px] bg-white dark:bg-slate-950 shadow-2xl flex flex-col"
        >
          {/* HEADER */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell size={18} className="text-indigo-500" />
                {isNew ? 'New alert rule' : `Edit · ${rule?.name}`}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isNew ? 'Configure when, who, what, and how this alert fires.' : 'Changes take effect on next pipeline run.'}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* BODY — two-column grid */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── LEFT COLUMN ─────────────────────────────────── */}
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <FieldLabel>Rule name</FieldLabel>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Pareto SKUs below 3.5"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                {/* 1. WHEN */}
                <section>
                  <SectionHeader step={1} icon={Clock} title="When to trigger" hint="Pick how often this rule re-evaluates." />
                  <div className="space-y-2">
                    {TRIGGER_MODES.map((m) => {
                      const active = triggerMode === m.value;
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setTriggerMode(m.value)}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3
                            ${active
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'}`}
                        >
                          <div className={`mt-0.5 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                            <Icon size={16} />
                          </div>
                          <div className="flex-1">
                            <div className={`text-xs font-bold ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>{m.title}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{m.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom-cron editor */}
                  {triggerMode === 'custom_cron' && (
                    <div className="mt-3 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/40 dark:bg-indigo-900/10 space-y-2">
                      <FieldLabel>Cron expression (UTC)</FieldLabel>
                      <input
                        value={cronExpression}
                        onChange={(e) => setCronExpression(e.target.value)}
                        placeholder="0 * * * *  (minute hour day month weekday)"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Presets</div>
                      <div className="flex flex-wrap gap-1.5">
                        {CRON_PRESETS.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setCronExpression(p.value)}
                            className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-all
                              ${cronExpression === p.value
                                ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}
                            title={p.label}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                        Note: custom cron persists today but execution is wired in a follow-up — for now the value is stored and the rule still re-evaluates on the daily pipeline. Use "Send real email" to fire on-demand.
                      </p>
                    </div>
                  )}
                </section>

                {/* 2. WHO — scope + multi-select filters */}
                <section>
                  <SectionHeader step={2} icon={Target} title="Which products to watch" hint="All filters combine with AND. Leave a filter empty to match all values of that field." />
                  <div className="space-y-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30">

                    {/* Competitor / Prestige scope — top filter */}
                    <div>
                      <FieldLabel>Catalogue</FieldLabel>
                      <div className="grid grid-cols-3 gap-1.5">
                        {COMPETITOR_SCOPES.map((s) => {
                          const active = competitorScope === s.value;
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => {
                                setCompetitorScope(s.value);
                                // Clear brand selections if they no longer match the new scope
                                if (s.value === 'prestige') {
                                  setBrands(brands.filter(b => brandConfigData?.find(bc => bc.brand_name === b)?.is_own_brand));
                                } else if (s.value === 'competitors') {
                                  setBrands(brands.filter(b => !brandConfigData?.find(bc => bc.brand_name === b)?.is_own_brand));
                                }
                              }}
                              title={s.desc}
                              className={`p-2 rounded-lg border text-left transition-all
                                ${active
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'}`}
                            >
                              <div className={`flex items-center gap-1 ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                <Icon size={12} />
                                <span className="text-[11px] font-bold">{s.label}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{s.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <MultiSelectDropdown
                      label="Platforms (multi-select)"
                      options={platformOptions}
                      value={platforms}
                      onChange={setPlatforms}
                      loading={platformsLoading}
                      placeholder="All platforms"
                    />

                    <MultiSelectDropdown
                      label={`Brands (multi-select)${competitorScope === 'prestige' ? ' — Prestige catalogue' : competitorScope === 'competitors' ? ' — competitor catalogue' : ''}`}
                      options={brandOptions}
                      value={brands}
                      onChange={setBrands}
                      loading={brandsLoading}
                      placeholder="All brands"
                    />

                    <MultiSelectDropdown
                      label="Categories (multi-select)"
                      options={categoryOptions}
                      value={categories}
                      onChange={setCategories}
                      loading={catLoading}
                      placeholder="All categories"
                    />

                    <div>
                      <FieldLabel><Layers size={10} className="inline mr-1" /> Classification</FieldLabel>
                      <div className="grid grid-cols-4 gap-1.5">
                        {CLASSIFICATIONS.map((c) => {
                          const active = classification === c.value;
                          return (
                            <button
                              key={c.value || 'all'}
                              type="button"
                              onClick={() => setClassification(c.value)}
                              title={c.desc}
                              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all border
                                ${active
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Specific SKUs (optional, comma-separated web_pids)</FieldLabel>
                      <input
                        value={webPidsRaw}
                        onChange={(e) => setWebPidsRaw(e.target.value)}
                        placeholder="e.g. B07ABC123, FQABC456 — leave blank to match all SKUs"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>

                    {/* OR-group toggle */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setOrGroupEnabled(v => !v)}
                        className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center gap-1.5"
                      >
                        {orGroupEnabled ? '− Remove OR group' : '+ Add OR group (also match…)'}
                      </button>
                      {orGroupEnabled && (
                        <div className="mt-2 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-900/10 space-y-3">
                          <div className="text-[11px] text-amber-700 dark:text-amber-400">
                            Rule will trip if either the primary filters above <strong>OR</strong> this secondary set matches.
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <FieldLabel>Brand =</FieldLabel>
                              <input
                                value={orBrand}
                                onChange={(e) => setOrBrand(e.target.value)}
                                placeholder="e.g. Bajaj"
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                              />
                            </div>
                            <div>
                              <FieldLabel>Category =</FieldLabel>
                              <input
                                value={orCategory}
                                onChange={(e) => setOrCategory(e.target.value)}
                                placeholder="e.g. Mixer Grinder"
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                              />
                            </div>
                          </div>
                          <div>
                            <FieldLabel>Classification</FieldLabel>
                            <div className="grid grid-cols-4 gap-1.5">
                              {CLASSIFICATIONS.map((c) => {
                                const active = orClassification === c.value;
                                return (
                                  <button
                                    key={c.value || 'all'}
                                    type="button"
                                    onClick={() => setOrClassification(c.value)}
                                    title={c.desc}
                                    className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all border
                                      ${active
                                        ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}
                                  >
                                    {c.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* ── RIGHT COLUMN ─────────────────────────────────── */}
              <div className="space-y-6">
                {/* 3. WHAT — conditions */}
                <section>
                  <SectionHeader step={3} icon={BarChart3} title="What triggers the alert" hint="Both conditions can fire; both must be enabled to trip on either." />
                  <div className="space-y-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={useFloor} onChange={(e) => setUseFloor(e.target.checked)} className="rounded text-indigo-500" />
                      <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">Rating falls below</span>
                      <input
                        type="number" step="0.1" min="1" max="5"
                        value={absoluteFloor} disabled={!useFloor}
                        onChange={(e) => setAbsoluteFloor(e.target.value)}
                        className="w-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <span className="text-sm text-slate-400">★</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={useDelta} onChange={(e) => setUseDelta(e.target.checked)} className="rounded text-indigo-500" />
                      <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">Rating drops by ≥</span>
                      <input
                        type="number" step="0.05" min="0"
                        value={dropDelta} disabled={!useDelta}
                        onChange={(e) => setDropDelta(e.target.value)}
                        className="w-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <span className="text-sm text-slate-400">★</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div>
                        <FieldLabel>Compare against</FieldLabel>
                        <select
                          value={comparisonWindow}
                          onChange={(e) => setComparisonWindow(e.target.value as ComparisonWindow)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        >
                          <option value="previous_snapshot">Previous snapshot</option>
                          <option value="7day_avg">7-day average</option>
                          <option value="30day_avg">30-day average (monthly)</option>
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Min rating count</FieldLabel>
                        <input
                          type="number" min="0"
                          value={minRatingCount}
                          onChange={(e) => setMinRatingCount(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          title="SKUs with fewer total ratings than this are skipped (noise filter)"
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Min review count</FieldLabel>
                      <input
                        type="number" min="0"
                        value={minReviewCount}
                        onChange={(e) => setMinReviewCount(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        title="SKUs with fewer text reviews than this are skipped (lets you ignore newly-listed SKUs)"
                      />
                    </div>
                  </div>
                </section>

                {/* 4. ACTIONS */}
                <section>
                  <SectionHeader step={4} icon={Zap} title="What to do when it fires" hint="At least one action required." />
                  <div className="grid grid-cols-2 gap-2">
                    {ACTIONS.map((a) => {
                      const active = actions.includes(a.value);
                      const Icon = a.icon;
                      return (
                        <button
                          key={a.value}
                          type="button"
                          onClick={() => toggleAction(a.value)}
                          title={a.desc}
                          className={`p-3 rounded-xl border text-left transition-all
                            ${active
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'}`}
                        >
                          <Icon size={16} className={active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                          <div className={`text-xs font-bold mt-2 ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>
                            {a.title}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{a.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  {actions.includes('email') && (
                    <div className="mt-3">
                      <FieldLabel>Email recipients (comma-separated)</FieldLabel>
                      <input
                        value={recipientsRaw}
                        onChange={(e) => setRecipientsRaw(e.target.value)}
                        placeholder="ops@trailytics.com, lead@... — blank = default recipients from mailer settings"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      {recipients.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {recipients.map((r) => (
                            <span key={r} className={`text-[11px] px-2 py-0.5 rounded-full border ${
                              EMAIL_RE.test(r)
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800'
                                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800'
                            }`}>{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* Enable toggle */}
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="rounded text-indigo-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Rule enabled</span>
                  <span className="text-[10px] text-slate-500 ml-auto">{enabled ? 'Will evaluate' : 'Paused — saved but won\'t fire'}</span>
                </label>

                {/* Test panel — only when editing */}
                {!isNew && onTest && (test.notice || test.result) && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {test.notice && (
                      <div className={`flex items-start gap-2 px-3 py-2 text-xs border-b border-slate-200 dark:border-slate-700 ${
                        test.notice.kind === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-900/15 text-emerald-700 dark:text-emerald-400'
                          : test.notice.kind === 'error'
                          ? 'bg-rose-50 dark:bg-rose-900/15 text-rose-700 dark:text-rose-400'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {test.notice.kind === 'success' ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                          : test.notice.kind === 'error' ? <AlertCircle size={13} className="shrink-0 mt-0.5" />
                          : <Search size={13} className="shrink-0 mt-0.5" />}
                        <span>{test.notice.text}</span>
                      </div>
                    )}
                    {test.result && test.result.events.length > 0 && (
                      <div className="p-3 bg-white dark:bg-slate-900">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                          Would trigger {test.result.wouldTrigger} SKU{test.result.wouldTrigger === 1 ? '' : 's'} · showing first {Math.min(5, test.result.events.length)}
                        </div>
                        <table className="w-full text-xs">
                          <tbody>
                            {test.result.events.slice(0, 5).map((ev, i) => (
                              <tr key={i} className="border-t border-slate-100 dark:border-slate-800 first:border-t-0">
                                <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-200 truncate max-w-[260px]">
                                  {ev.product_name || ev.web_pid || '—'}
                                  <div className="text-[10px] text-slate-500">{ev.platform || '—'}</div>
                                </td>
                                <td className="py-1.5 px-1 text-slate-500 tabular-nums text-right">
                                  {ev.previous_rating ?? '—'}★
                                </td>
                                <td className="py-1.5 pl-1 text-rose-600 dark:text-rose-400 font-bold tabular-nums text-right">
                                  {ev.current_rating ?? '—'}★
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                {formError}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3 sticky bottom-0">
            {!isNew && onTest ? (
              <div className="flex gap-2">
                <button
                  onClick={handlePreview}
                  disabled={test.loading !== null}
                  className="px-3 py-2 font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg flex items-center gap-1.5 disabled:opacity-50 text-sm"
                >
                  {test.loading === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
                  Preview matches
                </button>
                <button
                  onClick={handleSendReal}
                  disabled={test.loading !== null}
                  className="px-3 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50 text-sm"
                >
                  {test.loading === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Send real email
                </button>
              </div>
            ) : <span />}
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <>Save rule <ChevronRight size={14} /></>}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
}
