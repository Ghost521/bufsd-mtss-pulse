import React from 'react';
import {
  Activity,
  AlertCircle,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MessageSquare,
  Send,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardData, UserRole } from '../types';
import { MetricCard } from './MetricCard';
import { ActionItemsList } from './ActionItemsList';
import { TierDistribution } from './TierDistribution';
import { MonitoringPulse } from './MonitoringPulse';
import { SidebarToggleButton } from './SidebarToggleButton';
import { iconSize } from '../lib/ui/icons';
import { Button } from './ui/Button';
import { SimpleBarChart } from './SimpleCharts';

type DashboardSectionKey = 'quickTasks' | 'metrics' | 'aiBriefing' | 'chart' | 'tierDistribution' | 'monitoring';

type HeaderAction = {
  id: string;
  label: string;
  enabled: boolean;
  tooltip?: string;
  onClick: () => void;
  icon: React.ElementType;
};

type FlashMessage = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

type TopTask = {
  id: string;
  label: string;
  onClick: () => void;
};

type PrincipalPriority = {
  id: string;
  label: string;
  detail: string;
  stat: string;
  onClick: () => void;
};

type StructuredBriefing = {
  keyRisks: string[];
  recommendedActions: string[];
};

type DashboardViewProps = {
  currentRole: UserRole;
  data: DashboardData;
  mascotName: string;
  roleHeadline: string;
  roleScopeLabel: string;
  currentDateLabel: string;
  freshnessStatus: 'fresh' | 'stale' | 'unknown';
  freshnessStatusLabel: string;
  freshnessLabel: string;
  flashMessage: FlashMessage | null;
  primaryAction: HeaderAction | null;
  moreActions: HeaderAction[];
  isMoreMenuOpen: boolean;
  moreMenuRef: React.RefObject<HTMLDivElement | null>;
  topTasks: TopTask[];
  principalPriorities: PrincipalPriority[];
  mobileSections: Record<DashboardSectionKey, boolean>;
  showBriefing: boolean;
  isGenerating: boolean;
  briefing: string | null;
  briefingError: string | null;
  briefingGeneratedAt: string | null;
  structuredBriefing: StructuredBriefing;
  briefingReviewDeadline: string;
  feedbackSubmitted: boolean;
  showFeedbackInput: boolean;
  feedbackText: string;
  onOpenMobileMenu: () => void;
  onToggleMoreMenu: () => void;
  onCloseMoreMenu: () => void;
  onToggleMobileSection: (section: DashboardSectionKey) => void;
  onGenerateInsight: () => void | Promise<void>;
  onFeedbackClick: (sentiment: 'positive' | 'negative') => void;
  onFeedbackTextChange: (value: string) => void;
  onSubmitFeedback: () => void;
  onCloseFeedbackInput: () => void;
  onStudentClick: (studentName: string) => void;
  onViewAllActionItems: () => void;
  onViewAllMonitoring: () => void;
};

const iconMap: Record<string, LucideIcon> = {
  Activity,
  Zap,
  AlertCircle,
  Users,
  Calendar,
};

export function DashboardView({
  currentRole,
  data,
  mascotName,
  roleHeadline,
  roleScopeLabel,
  currentDateLabel,
  freshnessStatus,
  freshnessStatusLabel,
  freshnessLabel,
  flashMessage,
  primaryAction,
  moreActions,
  isMoreMenuOpen,
  moreMenuRef,
  topTasks,
  principalPriorities,
  mobileSections,
  showBriefing,
  isGenerating,
  briefing,
  briefingError,
  briefingGeneratedAt,
  structuredBriefing,
  briefingReviewDeadline,
  feedbackSubmitted,
  showFeedbackInput,
  feedbackText,
  onOpenMobileMenu,
  onToggleMoreMenu,
  onCloseMoreMenu,
  onToggleMobileSection,
  onGenerateInsight,
  onFeedbackClick,
  onFeedbackTextChange,
  onSubmitFeedback,
  onCloseFeedbackInput,
  onStudentClick,
  onViewAllActionItems,
  onViewAllMonitoring,
}: DashboardViewProps) {
  const renderMobileSectionHeader = (
    section: DashboardSectionKey,
    label: string,
    subtitle: string,
    hint?: string,
  ) => (
    <Button
      variant="secondary"
      onClick={() => onToggleMobileSection(section)}
      fullWidth
      className="app-button-secondary justify-between px-4 py-3 text-left lg:hidden"
      aria-expanded={mobileSections[section]}
    >
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{subtitle}</span>
      </span>
      <span className="flex items-center gap-2">
        {hint ? (
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {hint}
          </span>
        ) : null}
        <ChevronDown size={16} className={`text-slate-500 transition-transform ${mobileSections[section] ? 'rotate-180' : ''}`} />
      </span>
    </Button>
  );

  const renderAIBriefing = () => (
    showBriefing && (
      <div className="mb-8 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-indigo-900">
            <Bot size={20} className="text-indigo-600" />
            {currentRole === 'Parent' ? 'AI Assistant' : 'AI Summary'}
          </h3>
          {!isGenerating && briefing && !feedbackSubmitted && !showFeedbackInput ? (
            <div className="flex items-center gap-2 text-sm text-indigo-400">
              <span className="hidden text-xs sm:inline">Helpful?</span>
              <button type="button" aria-label="Mark AI summary as helpful" onClick={() => onFeedbackClick('positive')} className="rounded-full p-1 transition-colors hover:bg-indigo-100 hover:text-indigo-600"><ThumbsUp size={16} /></button>
              <button type="button" aria-label="Mark AI summary as not helpful" onClick={() => onFeedbackClick('negative')} className="rounded-full p-1 transition-colors hover:bg-indigo-100 hover:text-indigo-600"><ThumbsDown size={16} /></button>
            </div>
          ) : null}
        </div>

        {isGenerating ? (
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <Loader2 size={16} className="animate-spin" />
            Building summary from current dashboard context...
          </div>
        ) : null}

        {briefingError ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p className="font-semibold">AI summary unavailable.</p>
            <p className="mt-1">{briefingError}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onGenerateInsight()}
              className="mt-2 border-rose-200 bg-white text-rose-700 hover:bg-rose-100"
            >
              Retry Summary
            </Button>
          </div>
        ) : null}

        {!isGenerating && !briefingError ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-indigo-100 bg-white/80 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-indigo-700">Key Risks</h4>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {structuredBriefing.keyRisks.map((risk, index) => (
                  <li key={`risk-${index}`} className="flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-indigo-100 bg-white/80 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-indigo-700">Recommended Actions</h4>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {structuredBriefing.recommendedActions.map((action, index) => (
                  <li key={`action-${index}`} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {!isGenerating && !briefingError ? (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-white/80 p-4 text-xs text-slate-600">
            <p><span className="font-semibold text-slate-700">Owner:</span> {data.userName}</p>
            <p><span className="font-semibold text-slate-700">Due Date:</span> {briefingReviewDeadline}</p>
            <p>
              <span className="font-semibold text-slate-700">Generated:</span>{' '}
              {briefingGeneratedAt
                ? new Date(briefingGeneratedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                : 'Not generated yet'}
            </p>
            <p><span className="font-semibold text-slate-700">Source:</span> AI + live tenant data</p>
          </div>
        ) : null}

        {!isGenerating && (showFeedbackInput || feedbackSubmitted) ? (
          <div className="mt-4 border-t border-indigo-100/70 pt-4">
            {feedbackSubmitted ? (
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600"><ThumbsUp size={16} /> Thank you for your feedback!</div>
            ) : (
              <div className="flex max-w-2xl flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <MessageSquare size={16} className="absolute left-3 top-3 text-indigo-400" />
                  <input
                    type="text"
                    placeholder="Improve this summary?..."
                    value={feedbackText}
                    onChange={(e) => onFeedbackTextChange(e.target.value)}
                    className="w-full rounded-lg border border-indigo-200 bg-white/80 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => e.key === 'Enter' && onSubmitFeedback()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="primary" onClick={onSubmitFeedback} className="flex-1 gap-2 sm:flex-none">Submit <Send size={14} /></Button>
                  <button type="button" aria-label="Close feedback input" onClick={onCloseFeedbackInput} className="rounded-lg border border-indigo-100 bg-white p-2 text-indigo-400 hover:text-indigo-600 sm:border-none sm:bg-transparent"><X size={18} /></button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    )
  );

  return (
    <>
      <header className="app-card mb-8 rounded-xl p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <SidebarToggleButton
                onClick={onOpenMobileMenu}
                className="-ml-2 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Workspace</p>
                <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{roleHeadline}</h2>
                <p className="mt-1 text-sm font-medium text-slate-600">Signed in as {data.userName}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                    Role: {currentRole}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                    Scope: {roleScopeLabel}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                    Date: {currentDateLabel}
                  </span>
                  <span
                    className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                    style={{
                      borderColor: 'var(--tenant-color-secondary)',
                      color: 'var(--tenant-color-secondary)',
                      backgroundColor: 'color-mix(in srgb, var(--tenant-color-surface) 88%, #ffffff 12%)',
                    }}
                  >
                    Mascot: {mascotName}
                  </span>
                </div>
                <p
                  className={`mt-2 text-xs font-semibold ${
                    freshnessStatus === 'stale'
                      ? 'text-amber-700'
                      : freshnessStatus === 'fresh'
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                  }`}
                >
                  Data status: {freshnessStatusLabel} ({freshnessLabel})
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {primaryAction ? (
              <Button
                variant="primary"
                onClick={primaryAction.onClick}
                disabled={!primaryAction.enabled}
                title={primaryAction.tooltip}
                className="app-button-primary gap-2 shadow-sm"
              >
                <primaryAction.icon size={iconSize('md')} />
                {primaryAction.label}
              </Button>
            ) : null}

            <div className="relative" ref={moreMenuRef}>
              <Button
                variant="secondary"
                onClick={onToggleMoreMenu}
                className="app-button-secondary gap-2"
                aria-expanded={isMoreMenuOpen}
                aria-haspopup="menu"
              >
                Actions
                <ChevronDown size={iconSize('md')} className={`transition-transform ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
              </Button>

              {isMoreMenuOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-xl" role="menu">
                  {moreActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        action.onClick();
                        onCloseMoreMenu();
                      }}
                      disabled={!action.enabled}
                      title={action.tooltip}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <action.icon size={iconSize('sm')} />
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {flashMessage ? (
        <div
          className={`mb-4 rounded-lg border px-4 py-2.5 text-sm font-medium ${
            flashMessage.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : flashMessage.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-indigo-200 bg-indigo-50 text-indigo-700'
          }`}
          role="status"
          aria-live="polite"
        >
          {flashMessage.text}
        </div>
      ) : null}

      <div className="mb-6 space-y-2">
        {renderMobileSectionHeader('quickTasks', 'Context Actions', 'High-value jumps for this role', `${topTasks.length} actions`)}
        <div className={`${mobileSections.quickTasks ? 'block' : 'hidden'} lg:block`}>
          <div className="app-card rounded-xl p-4">
            {topTasks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topTasks.map((task) => (
                  <Button
                    key={task.id}
                    onClick={task.onClick}
                    variant="secondary"
                    size="sm"
                    className="app-chip-action rounded-full text-xs transition-colors"
                  >
                    {task.label}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No additional context actions for this view.</p>
            )}
          </div>
        </div>
      </div>

      {currentRole === 'Principal' ? (
        <div className="mb-6 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-indigo-700">Top Priorities</p>
              <p className="text-sm text-slate-600">Operational items that need leadership action this week.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {principalPriorities.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className="group rounded-xl border border-white/80 bg-white/90 p-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-indigo-700">{item.stat}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 group-hover:text-indigo-800">{item.label}</p>
                <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-6 space-y-2">
        {renderMobileSectionHeader('metrics', 'Performance Metrics', 'Intervention and student outcome indicators', `${data.metrics.length} KPIs`)}
        <div className={`${mobileSections.metrics ? 'block' : 'hidden'} lg:block`}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {data.metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} icon={iconMap[metric.icon] || Activity} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 md:gap-8">
        <div className={`col-span-12 ${currentRole === 'Parent' ? 'lg:col-span-7' : 'lg:col-span-8'} min-w-0 space-y-6 md:space-y-8`}>
          <div className="min-h-[360px] max-h-[70vh]">
            <ActionItemsList
              items={data.actionItems}
              onStudentClick={onStudentClick}
              onViewAll={onViewAllActionItems}
              totalCount={data.actionItems.length}
            />
          </div>

          {showBriefing ? (
            <div className="space-y-2">
              {renderMobileSectionHeader(
                'aiBriefing',
                currentRole === 'Parent' ? 'Assistant Summary' : 'AI Summary',
                'Top risks and recommended next steps',
                briefing ? 'Ready' : 'Optional',
              )}
              <div className={`${mobileSections.aiBriefing ? 'block' : 'hidden'} lg:block`}>{renderAIBriefing()}</div>
            </div>
          ) : null}

          <div className="space-y-2">
            {renderMobileSectionHeader('chart', 'Intervention Outcomes', 'Trend view by support tier', `${data.chartData.length} bars`)}
            <div className={`${mobileSections.chart ? 'block' : 'hidden'} lg:block`}>
              <div className="app-card rounded-xl p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">Intervention Outcomes</h3>
                    <p className="text-sm text-slate-500">{data.chartTitle}</p>
                  </div>
                </div>

                <div className="h-56 w-full min-w-0 md:h-64">
                  <SimpleBarChart data={data.chartData} />
                </div>
                <p className="mt-3 text-xs text-slate-500">Bars represent number of students by tier category.</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`col-span-12 ${currentRole === 'Parent' ? 'lg:col-span-5' : 'lg:col-span-4'} space-y-6 md:space-y-8`}>
          {currentRole !== 'Parent' && data.tierDistribution ? (
            <div className="space-y-2">
              {renderMobileSectionHeader('tierDistribution', 'Tier Distribution', 'Students in Tier 1, Tier 2, and Tier 3 supports', `${data.tierDistribution.length} tiers`)}
              <div className={`${mobileSections.tierDistribution ? 'block' : 'hidden'} lg:block`}>
                <TierDistribution data={data.tierDistribution} />
              </div>
            </div>
          ) : null}

          <div className="space-y-2 md:sticky md:top-8">
            {renderMobileSectionHeader('monitoring', 'Monitoring Queue', 'Students flagged for progress follow-up', `${data.monitoringPulse.length} students`)}
            <div className={`${mobileSections.monitoring ? 'block' : 'hidden'} lg:block`}>
              <MonitoringPulse
                students={data.monitoringPulse}
                onStudentClick={onStudentClick}
                onViewAll={onViewAllMonitoring}
                subtitle="Students currently flagged for progress follow-up."
              />
            </div>
          </div>

          {currentRole === 'Parent' ? (
            <div className="app-card rounded-xl p-6">
              <h3 className="mb-4 font-bold text-slate-800">Teacher Feedback</h3>
              <div className="space-y-4">
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">"Leo is showing great improvement in reading comprehension." - Mr. Davis</div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">"Please remember to sign the permission slip for the museum trip." - Admin</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
