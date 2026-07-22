import { Database, Brain, Sparkles, Network, Filter, Users, ScanSearch, Bell } from 'lucide-react';
import { AutomationCard } from './AutomationCard';
import type { AutomationCardData } from './AutomationCard';

// Every automation surface in the app — including the ones buried in pages and
// the ones that are broken/local-only (flagged with a warn note).
const INVENTORY: AutomationCardData[] = [
  {
    title: 'MySQL → Postgres sync',
    kind: 'Data sync',
    icon: Database,
    accent: 'indigo',
    blurb: 'Daily Temporal stage: pulls products, reviews and price snapshots from the Prestige MySQL crawl DB into adsauto Postgres.',
    href: '#',
  },
  {
    title: 'ML pipelines (6)',
    kind: 'ML',
    icon: Brain,
    accent: 'purple',
    blurb: 'Gemini Audit, DeBERTa Taxonomy, Competitor Matrix Match, BERT Inference, Master Spec Enrichment, Sentiment Backfill.',
    href: '/ml-control',
  },
  {
    title: 'ML QC audit queue',
    kind: 'ML',
    icon: ScanSearch,
    accent: 'emerald',
    blurb: 'Human review of ML predictions — approve/reject sentiment, category, rating and spec inferences before they hit master data.',
    href: '/?tab=master',
  },
  {
    title: 'Rating-drop email alerts',
    kind: 'Alerting',
    icon: Bell,
    accent: 'rose',
    blurb: 'Configurable rules (absolute floor + drop delta, scoped to product / brand / category) that email a digest when ratings fall.',
    href: '#',
  },
  {
    title: 'Category classification rules',
    kind: 'Regex / rules',
    icon: Filter,
    accent: 'cyan',
    blurb: 'Include/exclude keyword rules with priority that drive product categorisation. Edit inline; saves auto-persist.',
    href: '/?tab=master',
  },
  {
    title: 'Stakeholder mapping rules',
    kind: 'Regex / rules',
    icon: Users,
    accent: 'amber',
    blurb: 'Maps NLP-extracted issue subcategories to internal departments. Dropdown auto-saves on change.',
    href: '/?tab=master',
  },
  {
    title: 'Competitor matching & mentions',
    kind: 'Regex / rules',
    icon: Network,
    accent: 'amber',
    blurb: 'SKU↔SKU competitor mapping (15% physical tolerance) plus an in-browser regex engine that detects competitor mentions in review text.',
    href: '/?tab=master',
  },
  {
    title: 'Master spec enrichment',
    kind: 'ML',
    icon: Sparkles,
    accent: 'cyan',
    blurb: 'Extracts material / wattage candidates for SKU masters — preview-only, results land in the QC audit queue.',
    href: '/ml-control',
  },
];

export function AutomationInventoryGrid() {
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Automation inventory</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Every automated process in the app — ML, regex/rule engines, data sync and alerting.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {INVENTORY.map((item) => (
          <AutomationCard key={item.title} data={item} />
        ))}
      </div>
    </section>
  );
}
