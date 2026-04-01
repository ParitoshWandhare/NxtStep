// ============================================================
// NxtStep — Interview Results Page (Fixed)
// FIX: Scorecard takes ~10s to generate after session ends.
//      Previously the page fetched once, got 404, and showed
//      a permanent "not found" state. Now it polls every 3s
//      until the scorecard arrives (up to 2 minutes).
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BarChart3, Target, ArrowRight, CheckCircle2,
  AlertCircle, Lightbulb, RefreshCw, ThumbsUp,
  ThumbsDown, Bookmark, Loader2,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import { Card, Badge, ScoreRing, ProgressBar, EmptyState, Skeleton } from '@/components/ui/index';
import Button from '@/components/ui/Button';
import { useScorecard, useRecommendations, useSubmitRoleFeedback } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';
import {
  getScoreColor, getScoreGrade, formatSalary,
  getCategoryIcon, getDifficultyColor, cn,
} from '@/utils';
import type { RoleMatch, FeedbackSignal } from '@/types';

// ── Radar Chart ───────────────────────────────────────────────
function ScorecardRadar({ scores }: { scores: Record<string, number> }) {
  const data = [
    { subject: 'Technical',       value: scores.technical      || 0, fullMark: 10 },
    { subject: 'Problem Solving', value: scores.problemSolving || 0, fullMark: 10 },
    { subject: 'Communication',   value: scores.communication  || 0, fullMark: 10 },
    { subject: 'Confidence',      value: scores.confidence     || 0, fullMark: 10 },
    { subject: 'Concept Depth',   value: scores.conceptDepth   || 0, fullMark: 10 },
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="var(--color-border)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} />
        <Radar name="Score" dataKey="value" stroke="#d4a017" fill="#d4a017" fillOpacity={0.25} strokeWidth={2} />
        <RechartsTooltip
          contentStyle={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            fontSize: '13px',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Dimension Bar ─────────────────────────────────────────────
function DimensionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
        <span className={`text-sm font-bold font-mono ${getScoreColor(value)}`}>{value.toFixed(1)}</span>
      </div>
      <ProgressBar
        value={value}
        max={10}
        color={value >= 7 ? 'success' : value >= 5 ? 'primary' : value >= 3 ? 'warning' : 'error'}
        size="md"
      />
    </div>
  );
}

// ── Role Card ─────────────────────────────────────────────────
function RoleCard({ role, sessionId }: { role: RoleMatch; sessionId: string }) {
  const [sent, setSent] = useState<FeedbackSignal | null>(null);
  const submitFeedback = useSubmitRoleFeedback(sessionId);

  const sendFeedback = async (signal: FeedbackSignal) => {
    setSent(signal);
    await submitFeedback.mutateAsync({
      roleTitle: role.title,
      roleCategory: role.category,
      roleLevel: role.level,
      signal,
      matchScore: role.matchScore,
    });
  };

  const pct = Math.round(role.matchScore * 100);
  const scoreClass =
    pct >= 85 ? 'text-green-500 bg-green-500/10' :
    pct >= 70 ? 'text-primary-500 bg-primary-500/10' :
    pct >= 55 ? 'text-yellow-500 bg-yellow-500/10' :
    'text-gray-500 bg-gray-500/10';

  return (
    <Card hover className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center text-xl">
            {getCategoryIcon(role.category)}
          </div>
          <div>
            <h3 className="font-display font-semibold text-base text-[var(--color-text-primary)]">
              {role.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getDifficultyColor(role.level)}`}>
                {role.level}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] capitalize">{role.category}</span>
            </div>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${scoreClass}`}>
          {pct}%
        </div>
      </div>

      {/* Description */}
      {role.description && (
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{role.description}</p>
      )}

      {/* Why match */}
      {role.whyMatch && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-primary-500/5 border border-primary-500/10">
          <Target size={14} className="text-primary-500 mt-0.5 shrink-0" />
          <p className="text-xs text-[var(--color-text-secondary)]">{role.whyMatch}</p>
        </div>
      )}

      {/* Match breakdown */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(role.breakdown).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--color-bg-elevated)]">
            <span className="text-[var(--color-text-muted)] capitalize">
              {k.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <span className={`font-bold ${v >= 0.7 ? 'text-emerald-500' : v >= 0.5 ? 'text-primary-500' : 'text-yellow-500'}`}>
              {Math.round(v * 100)}%
            </span>
          </div>
        ))}
      </div>

      {/* Salary */}
      {role.salaryRange && (
        <p className="text-xs text-[var(--color-text-muted)]">
          💰 {formatSalary(role.salaryRange.min, role.salaryRange.max, role.salaryRange.currency)} / year
        </p>
      )}

      {/* Interview tips */}
      {role.interviewTips && role.interviewTips.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
            <Lightbulb size={12} /> Interview Tips
          </p>
          {role.interviewTips.slice(0, 2).map((tip, i) => (
            <p key={i} className="text-xs text-[var(--color-text-secondary)] pl-4 border-l-2 border-primary-500/30">
              {tip}
            </p>
          ))}
        </div>
      )}

      {/* Feedback */}
      {!sent ? (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-[var(--color-text-muted)]">Is this a good fit?</span>
          <button
            onClick={() => sendFeedback('relevant')}
            className="p-1.5 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 text-[var(--color-text-muted)] transition-colors"
          >
            <ThumbsUp size={14} />
          </button>
          <button
            onClick={() => sendFeedback('not_relevant')}
            className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-[var(--color-text-muted)] transition-colors"
          >
            <ThumbsDown size={14} />
          </button>
          <button
            onClick={() => sendFeedback('saved')}
            className="ml-auto p-1.5 rounded-lg hover:bg-primary-500/10 hover:text-primary-500 text-[var(--color-text-muted)] transition-colors"
          >
            <Bookmark size={14} />
          </button>
        </div>
      ) : (
        <p className="text-xs text-emerald-500 flex items-center gap-1.5 pt-1">
          <CheckCircle2 size={12} /> Feedback recorded
        </p>
      )}
    </Card>
  );
}

// ── Polling Scorecard Loader ──────────────────────────────────
// Retries every 3s for up to 2 minutes while the backend
// generates the scorecard asynchronously via BullMQ worker.
function useScorecardWithPolling(sessionId: string) {
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLLS = 40; // 40 × 3s = 2 minutes

  const query = useScorecard(sessionId, !!sessionId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Stop polling once we have data or exceeded max attempts
    if (query.data || pollCount >= MAX_POLLS) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // If the query returned a 404 (scorecard not ready yet), retry after 3s
    const isNotFound =
      (query.error as any)?.response?.status === 404 || !query.data;

    if (isNotFound && !query.isFetching) {
      timerRef.current = setTimeout(() => {
        setPollCount(c => c + 1);
        query.refetch();
      }, 3000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query.data, query.error, query.isFetching, pollCount]);

  const timedOut = pollCount >= MAX_POLLS && !query.data;

  return { ...query, pollCount, timedOut };
}

// ── Main Page ─────────────────────────────────────────────────
export default function InterviewResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  usePageTitle('Interview Results');
  const [activeTab, setActiveTab] = useState<'scorecard' | 'recommendations'>('scorecard');

  const { data: scorecard, isLoading: scLoading, isFetching, pollCount, timedOut, refetch } =
    useScorecardWithPolling(sessionId || '');

  const { data: recommendations, isLoading: recLoading } =
    useRecommendations(sessionId || '', !!scorecard);

  // ── Still waiting for scorecard ───────────────────────────
  if (!scorecard && !timedOut) {
    const elapsed = pollCount * 3;
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <Card className="text-center py-16">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
              <Loader2 size={28} className="text-primary-500 animate-spin" />
            </div>
            <div className="absolute -inset-1 rounded-2xl border-2 border-primary-500/20 animate-ping" />
          </div>
          <h2 className="font-display font-bold text-xl text-[var(--color-text-primary)] mb-2">
            Generating your scorecard…
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto mb-2">
            Your interview is being evaluated across 5 dimensions. This usually takes 10–20 seconds.
          </p>
          {elapsed > 10 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {elapsed}s elapsed — almost there…
            </p>
          )}
          <div className="mt-6 w-48 mx-auto h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min((pollCount / MAX_POLLS) * 100, 95)}%` }}
            />
          </div>
        </Card>
      </div>
    );
  }

  // ── Timed out ─────────────────────────────────────────────
  if (timedOut) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <Card className="text-center py-12">
          <AlertCircle size={32} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="font-display font-bold text-xl text-[var(--color-text-primary)] mb-2">
            Taking longer than expected
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto mb-6">
            The scorecard is still being generated. Please try refreshing in a moment.
          </p>
          <Button onClick={() => refetch()} leftIcon={<RefreshCw size={16} />}>
            Refresh
          </Button>
        </Card>
      </div>
    );
  }

  // ── Scorecard arrived ─────────────────────────────────────
  const scores = {
    technical:      scorecard!.technical,
    problemSolving: scorecard!.problemSolving,
    communication:  scorecard!.communication,
    confidence:     scorecard!.confidence,
    conceptDepth:   scorecard!.conceptDepth,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 animate-slide-down">
        <div>
          <h1 className="page-title">Interview Results</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {scorecard!.questionsEvaluated} questions evaluated
          </p>
        </div>
        <Link to="/interview/new">
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />}>
            New Interview
          </Button>
        </Link>
      </div>

      {/* ── Overall Score Banner ─────────────────────────────── */}
      <Card className="bg-gradient-to-br from-primary-500/10 to-secondary-500/5 border-primary-500/20 animate-slide-up">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing
            score={scorecard!.overall}
            size={130}
            label="Overall"
            sublabel={getScoreGrade(scorecard!.overall)}
          />
          <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-3 w-full">
            {Object.entries(scores).map(([k, v]) => (
              <DimensionBar
                key={k}
                label={k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                value={v}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-[var(--color-bg-elevated)] rounded-xl w-fit">
        {(['scorecard', 'recommendations'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === tab
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            )}
          >
            {tab === 'scorecard' ? '📊 Scorecard' : '🎯 Roles'}
          </button>
        ))}
      </div>

      {/* ── Scorecard Tab ───────────────────────────────────── */}
      {activeTab === 'scorecard' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Radar */}
            <Card>
              <h2 className="section-title mb-4">Performance Radar</h2>
              <ScorecardRadar scores={scores} />
            </Card>

            {/* Feedback */}
            <div className="space-y-4">
              {scorecard!.strengths.length > 0 && (
                <Card>
                  <h3 className="font-semibold text-sm text-emerald-500 flex items-center gap-1.5 mb-3">
                    <CheckCircle2 size={14} /> Strengths
                  </h3>
                  <ul className="space-y-2">
                    {scorecard!.strengths.slice(0, 5).map((s, i) => (
                      <li key={i} className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {scorecard!.weaknesses.length > 0 && (
                <Card>
                  <h3 className="font-semibold text-sm text-red-500 flex items-center gap-1.5 mb-3">
                    <AlertCircle size={14} /> Areas to Improve
                  </h3>
                  <ul className="space-y-2">
                    {scorecard!.weaknesses.slice(0, 5).map((w, i) => (
                      <li key={i} className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span> {w}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {scorecard!.suggestions.length > 0 && (
                <Card>
                  <h3 className="font-semibold text-sm text-primary-500 flex items-center gap-1.5 mb-3">
                    <Lightbulb size={14} /> Suggestions
                  </h3>
                  <ul className="space-y-2">
                    {scorecard!.suggestions.slice(0, 4).map((s, i) => (
                      <li key={i} className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2">
                        <span className="text-primary-500 mt-0.5">→</span> {s}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Recommendations Tab ─────────────────────────────── */}
      {activeTab === 'recommendations' && (
        <div className="space-y-5 animate-fade-in">
          {recLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          ) : !recommendations?.roles?.length ? (
            <Card>
              <EmptyState
                icon={<Target size={24} className="text-primary-400" />}
                title="Matching your profile…"
                description="Role recommendations are being computed. Check back in a moment."
                action={
                  <Button onClick={() => window.location.reload()} variant="secondary" size="sm">
                    Refresh
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {recommendations.roles.map((role) => (
                <RoleCard key={role.roleId} role={role} sessionId={sessionId || ''} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// expose constant for the hook
const MAX_POLLS = 40;