import { Settings, ArrowLeft } from 'lucide-react';
import { PipelineStatusHero } from '../components/automation/PipelineStatusHero';
import { AutomationInventoryGrid } from '../components/automation/AutomationInventoryGrid';
import { AlertRulesTable } from '../components/automation/AlertRulesTable';
import { AlertEventsList } from '../components/automation/AlertEventsList';
import { RunHistoryPanel } from '../components/automation/RunHistoryPanel';
import { JobTriggerPanel } from '../components/automation/JobTriggerPanel';
import { MailerSettingsPanel } from '../components/automation/MailerSettingsPanel';
import { BulkImportPanel } from '../components/automation/BulkImportPanel';

export function AutomationSettings() {
  return (
    <div className="p-8 space-y-8 bg-slate-50 dark:bg-[#0b0f19] min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <Settings className="text-indigo-500" size={28} />
            Automation &amp; Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed max-w-2xl">
            Status of scheduled data ingestion and ML, an inventory of every automation in the app,
            and configurable rating-drop email alerts.
          </p>
        </div>
        <button
          onClick={() => window.location.assign('/')}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      <PipelineStatusHero />
      <JobTriggerPanel />
      <AutomationInventoryGrid />
      <AlertRulesTable />
      <BulkImportPanel />
      <MailerSettingsPanel />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <AlertEventsList />
        <RunHistoryPanel />
      </div>
    </div>
  );
}
