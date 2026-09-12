/**
 * Per-company mailer settings panel.
 *
 * Lets admins flip features on the rating-drop digest without touching code:
 *   - Calendar invite (.ics): on/off + relative schedule preset + time
 *   - Threading (References header)
 *   - High-priority headers (Outlook red exclamation) + threshold
 *   - Action chips (ACK/Investigating/Resolved mailto buttons)
 *   - Gmail action chip (Schema.org JSON-LD)
 *   - List-Unsubscribe header (RFC 8058 one-click)
 *   - Default recipients (used when an alert rule omits its own recipient list)
 *
 * Posts to PUT /api/automation/mailer-settings; the backend deep-merges with
 * stored values so partial patches are safe.
 */
import { useEffect, useState } from 'react';
import { Save, Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useMailerSettings, updateMailerSettings, type MailerSettings } from '../../hooks/useAutomation';

const SCHEDULE_PRESETS: { value: MailerSettings['calendarInvite']['schedulePreset']; label: string }[] = [
  { value: 'next_10am',               label: 'Next occurrence of the scheduled time' },
  { value: 'tomorrow_10am',           label: 'Tomorrow at the scheduled time' },
  { value: 'plus_1_day_10am',         label: '1 day later' },
  { value: 'plus_2_days_10am',        label: '2 days later' },
  { value: 'plus_3_days_10am',        label: '3 days later' },
  { value: 'next_business_day_10am',  label: 'Next business day' },
  { value: 'next_monday_10am',        label: 'Next Monday' },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function Row({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</div>
        {hint && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0 flex items-center gap-3">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4">
      <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export function MailerSettingsPanel() {
  const { data, loading, error, refetch } = useMailerSettings();
  const [draft, setDraft] = useState<MailerSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (data?.settings) setDraft(data.settings);
  }, [data?.settings]);

  if (loading || !draft) {
    return (
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-6">
        <div className="flex items-center gap-2 text-slate-400 py-4 text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading mailer settings…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-6">
        <div className="flex items-center gap-2 text-rose-500 py-4 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      </section>
    );
  }

  const update = <K extends keyof MailerSettings>(key: K, patch: Partial<MailerSettings[K]>) => {
    setDraft({ ...draft, [key]: { ...draft[key], ...patch } });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { settings } = await updateMailerSettings(draft);
      setDraft(settings);
      setSavedAt(new Date());
      refetch();
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Mail size={18} className="text-indigo-500" />
            Mailer settings
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Control the alert-email behaviour for this company. Changes take effect on the next dispatch.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm active:scale-95"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
      </div>

      {savedAt && (
        <div className="mb-4 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={12} /> Saved {savedAt.toLocaleTimeString()}
        </div>
      )}

      <div className="space-y-4">
        <Section title="Calendar invite (.ics)">
          <Row label="Attach a calendar invite to alert emails" hint="Outlook / Apple Calendar / Google Calendar will offer one-click Add-to-Calendar.">
            <Toggle checked={draft.calendarInvite.enabled} onChange={v => update('calendarInvite', { enabled: v })} />
          </Row>
          <Row label="Only attach for CRITICAL alerts" hint="Skip the .ics for medium/high severity to reduce calendar noise.">
            <Toggle checked={draft.calendarInvite.onlyForCritical} onChange={v => update('calendarInvite', { onlyForCritical: v })} disabled={!draft.calendarInvite.enabled} />
          </Row>
          <Row label="When should the review meeting fire?" hint="Relative to when the email is sent — no exact dates.">
            <select
              value={draft.calendarInvite.schedulePreset}
              onChange={e => update('calendarInvite', { schedulePreset: e.target.value as MailerSettings['calendarInvite']['schedulePreset'] })}
              disabled={!draft.calendarInvite.enabled}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 disabled:opacity-50"
            >
              {SCHEDULE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Row>
          <Row label="Time of day (IST)" hint="24-hour clock, e.g. 10:00 or 16:30.">
            <input
              type="time"
              value={draft.calendarInvite.scheduleTimeHHMM}
              onChange={e => update('calendarInvite', { scheduleTimeHHMM: e.target.value })}
              disabled={!draft.calendarInvite.enabled}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 disabled:opacity-50"
            />
          </Row>
          <Row label="Meeting duration (min)" hint="Default 30. Used for VEVENT DTEND.">
            <input
              type="number" min={5} max={240}
              value={draft.calendarInvite.durationMinutes}
              onChange={e => update('calendarInvite', { durationMinutes: parseInt(e.target.value, 10) || 30 })}
              disabled={!draft.calendarInvite.enabled}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 w-20 disabled:opacity-50"
            />
          </Row>
          <Row label="Reminder minutes before" hint="VALARM trigger; calendar app pings the user this long before the event.">
            <input
              type="number" min={0} max={1440}
              value={draft.calendarInvite.reminderMinutes}
              onChange={e => update('calendarInvite', { reminderMinutes: parseInt(e.target.value, 10) || 0 })}
              disabled={!draft.calendarInvite.enabled}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 w-20 disabled:opacity-50"
            />
          </Row>
        </Section>

        <Section title="Severity and priority">
          <Row label="Tag CRITICAL alerts as high-priority" hint="Adds X-Priority:1, Importance:High. Outlook shows a red exclamation in the list.">
            <Toggle checked={draft.highPriority.enabled} onChange={v => update('highPriority', { enabled: v })} />
          </Row>
          <Row label="CRITICAL threshold (rating below)" hint="Worst rating in the digest below this value is treated as CRITICAL.">
            <input
              type="number" min={0.5} max={5} step={0.1}
              value={draft.highPriority.criticalThreshold}
              onChange={e => update('highPriority', { criticalThreshold: parseFloat(e.target.value) || 2 })}
              disabled={!draft.highPriority.enabled}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 w-20 disabled:opacity-50"
            />
          </Row>
        </Section>

        <Section title="Email client integrations">
          <Row label="Thread emails for the same rule" hint="Adds References header so Gmail / Apple Mail group repeated alerts into one conversation.">
            <Toggle checked={draft.threading.enabled} onChange={v => update('threading', { enabled: v })} />
          </Row>
          <Row label="Gmail action chip (Schema.org JSON-LD)" hint='Surfaces an "Open Dashboard" chip in the Gmail inbox view. Needs sender registration with Google to actually display.'>
            <Toggle checked={draft.gmailAction.enabled} onChange={v => update('gmailAction', { enabled: v })} />
          </Row>
          <Row label="Action chips (ACK / Investigating / Resolved)" hint="One-tap mailto buttons that pre-fill a reply for status tracking.">
            <Toggle checked={draft.actionChips.enabled} onChange={v => update('actionChips', { enabled: v })} />
          </Row>
          <Row label="One-click unsubscribe header (RFC 8058)" hint="Gmail / Apple Mail render a native Unsubscribe in the message header.">
            <Toggle checked={draft.listUnsubscribe.enabled} onChange={v => update('listUnsubscribe', { enabled: v })} />
          </Row>
          <Row label="Unsubscribe URL override" hint="Defaults to the /settings page; override only if you have a dedicated unsubscribe endpoint.">
            <input
              type="url" placeholder="(default: /settings)"
              value={draft.listUnsubscribe.overrideUrl || ''}
              onChange={e => update('listUnsubscribe', { overrideUrl: e.target.value || null })}
              disabled={!draft.listUnsubscribe.enabled}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 w-64 disabled:opacity-50"
            />
          </Row>
        </Section>

        <Section title="Defaults">
          <Row label="Default recipients" hint="Comma-separated. Used when an alert rule doesn't list its own recipients. Empty falls back to ALERT_DEFAULT_RECIPIENTS env.">
            <input
              type="text"
              placeholder="alerts@trailytics.com, …"
              value={draft.defaults.defaultRecipients.join(', ')}
              onChange={e => update('defaults', { defaultRecipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 w-96"
            />
          </Row>
        </Section>
      </div>
    </section>
  );
}
