/** Types for the Automation Settings page (/settings). */

export type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL' | 'PENDING' | 'SKIPPED';

export interface AutomationRun {
  id: string;
  company_id: string;
  workflow_id: string | null;
  run_id: string | null;
  trigger_type: 'scheduled' | 'manual';
  status: RunStatus;
  sync_status: RunStatus | null;
  ml_status: RunStatus | null;
  alert_status: RunStatus | null;
  stages: Record<string, unknown>;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface MlJobRow {
  id: string;
  job_name: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  started_at: string;
  completed_at: string | null;
}

export interface ScheduleHealth {
  status: 'active' | 'paused' | 'unreachable';
  nextActionTimes?: string[];
  recentActions?: unknown[];
  detail?: string;
}

export interface AutomationStatus {
  lastRun: AutomationRun | null;
  recentJobs: MlJobRow[];
  schedule: ScheduleHealth;
}

export type ScopeType = 'product' | 'brand' | 'category';
export type ComparisonWindow = 'previous_snapshot' | '7day_avg' | '30day_avg';
export type Classification = 'Pareto' | 'Non-Pareto' | 'NPD';
export type TriggerMode = 'on_schedule' | 'on_event' | 'manual_only' | 'custom_cron';
export type AlertAction = 'email' | 'in_app';

export interface AlertRuleOrGroup {
  scope_type?: ScopeType | null;
  scope_value?: string | null;
  platform?: string | null;
  brand_filter?: string | null;
  category_filter?: string | null;
  classification?: Classification | null;
}

export interface AlertRule {
  id: string;
  company_id: string;
  name: string;
  scope_type: ScopeType;
  scope_value: string | null;
  platform: string | null;
  absolute_floor: number | null;
  drop_delta: number | null;
  comparison_window: ComparisonWindow;
  min_rating_count: number;
  recipients: string[];
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // v2 filters + actions
  brand_filter?: string | null;
  category_filter?: string | null;
  classification?: Classification | null;
  sentiment_category?: string | null;
  min_review_count?: number;
  trigger_mode?: TriggerMode;
  actions?: AlertAction[];
  cron_expression?: string | null;
  or_group?: AlertRuleOrGroup | null;
  // v4 multi-select arrays
  is_competitor_scope?: CompetitorScope;
  platforms?: string[];
  brands?: string[];
  categories?: string[];
  web_pids?: string[];
}

export type CompetitorScope = 'all' | 'prestige' | 'competitors';

export interface AlertRuleInput {
  name: string;
  scope_type: ScopeType;
  scope_value: string | null;
  platform: string | null;
  absolute_floor: number | null;
  drop_delta: number | null;
  comparison_window: ComparisonWindow;
  min_rating_count: number;
  recipients: string[];
  enabled: boolean;
  // v2 filters + actions
  brand_filter?: string | null;
  category_filter?: string | null;
  classification?: Classification | null;
  sentiment_category?: string | null;
  min_review_count?: number;
  trigger_mode?: TriggerMode;
  actions?: AlertAction[];
  cron_expression?: string | null;
  or_group?: AlertRuleOrGroup | null;
  // v4 multi-select arrays
  is_competitor_scope?: CompetitorScope;
  platforms?: string[];
  brands?: string[];
  categories?: string[];
  web_pids?: string[];
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  link_url: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export interface AlertEvent {
  id: string;
  rule_id: string;
  company_id: string;
  run_id: string | null;
  scope_type: ScopeType;
  scope_value: string | null;
  web_pid: string | null;
  product_name: string | null;
  platform: string | null;
  previous_rating: number | null;
  current_rating: number | null;
  delta: number | null;
  reason: 'absolute_floor' | 'drop_delta' | 'both';
  snapshot_date: string;
  email_sent: boolean;
  email_error: string | null;
  triggered_at: string;
}

export interface TestRuleResult {
  rule: { id: string; name: string; scope_type: ScopeType; scope_value: string | null };
  wouldTrigger: number;
  events: Array<{
    web_pid: string | null;
    platform: string | null;
    product_name: string | null;
    previous_rating: number | null;
    current_rating: number | null;
    delta: number | null;
    reason: string;
    snapshot_date: string;
  }>;
}
