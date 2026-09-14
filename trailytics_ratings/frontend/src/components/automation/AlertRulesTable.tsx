import { useState } from 'react';
import { Loader2, AlertCircle, Plus, Edit2, Trash2, Bell, Check } from 'lucide-react';
import { useAlertRules } from '../../hooks/useAutomation';
import { AlertRuleModal } from './AlertRuleModal';
import type { AlertRule, AlertRuleInput } from '../../types/automation';

function describeConditions(rule: AlertRule): string {
  const parts: string[] = [];
  if (rule.absolute_floor != null) parts.push(`< ${rule.absolute_floor}`);
  if (rule.drop_delta != null) parts.push(`drop ≥ ${rule.drop_delta}`);
  return parts.join('  •  ') || '—';
}

export function AlertRulesTable() {
  const { data, loading, error, createRule, updateRule, deleteRule, testRule } = useAlertRules();
  const rules = data?.rules || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (rule: AlertRule) => {
    setEditing(rule);
    setModalOpen(true);
  };

  const handleSave = async (input: AlertRuleInput) => {
    if (editing) await updateRule(editing.id, input);
    else await createRule(input);
  };

  const handleToggle = async (rule: AlertRule) => {
    setBusyId(rule.id);
    try {
      await updateRule(rule.id, {
        name: rule.name,
        scope_type: rule.scope_type,
        scope_value: rule.scope_value,
        platform: rule.platform,
        absolute_floor: rule.absolute_floor,
        drop_delta: rule.drop_delta,
        comparison_window: rule.comparison_window,
        min_rating_count: rule.min_rating_count,
        recipients: rule.recipients,
        enabled: !rule.enabled,
      });
    } catch (e) {
      alert(`Could not update rule: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteRule(id);
      setDeleteConfirmId(null);
    } catch (e) {
      alert(`Could not delete rule: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-rose-500" />
          <h2 className="font-semibold text-slate-700 dark:text-slate-200">Rating-drop alert rules</h2>
        </div>
        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Plus size={14} /> New rule
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 p-6 text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading rules…
        </div>
      )}
      {error && !loading && (
        <div className="flex items-center gap-2 text-rose-500 p-6 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {!loading && !error && rules.length === 0 && (
        <div className="p-8 text-center text-slate-400 text-sm">
          No alert rules yet. Create one to get emailed when ratings drop.
        </div>
      )}

      {!loading && !error && rules.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Scope</th>
                <th className="text-left p-3">Conditions</th>
                <th className="text-left p-3">Recipients</th>
                <th className="text-center p-3">Enabled</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{rule.name}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">
                    <span className="capitalize">{rule.scope_type}</span>
                    {rule.scope_value ? `: ${rule.scope_value}` : ' (all)'}
                    {rule.platform ? ` · ${rule.platform}` : ''}
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{describeConditions(rule)}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={rule.recipients.join(', ')}>
                    {rule.recipients.length ? rule.recipients.join(', ') : <span className="italic">default</span>}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleToggle(rule)}
                      disabled={busyId === rule.id}
                      className={`w-10 h-5 rounded-full relative transition-colors ${
                        rule.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                      title={rule.enabled ? 'Disable' : 'Enable'}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                          rule.enabled ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(rule)}
                        className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      {deleteConfirmId === rule.id ? (
                        <button
                          onClick={() => handleDelete(rule.id)}
                          disabled={busyId === rule.id}
                          className="p-1.5 text-white bg-rose-500 hover:bg-rose-600 rounded transition-colors"
                          title="Confirm delete"
                        >
                          {busyId === rule.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <AlertRuleModal
          rule={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onTest={testRule}
        />
      )}
    </section>
  );
}
