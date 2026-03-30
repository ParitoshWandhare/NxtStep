// ============================================================
// NxtStep — Dashboard Page
// ADDED: Entrance animations, hover effects on cards, stat counters
// ============================================================

import { Link } from 'react-router-dom';
import { Zap, BarChart3, ArrowRight, Clock, CheckCircle2, AlertCircle, TrendingUp, Plus } from 'lucide-react';
import { Card, Badge, SkeletonCard, EmptyState } from '@/components/ui/index';
import { usePageTitle } from '@/hooks';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { useSessions, useScorecards } from '@/hooks/useApi';
import { formatRelativeTime, getDifficultyColor, getScoreColor, getScoreGrade } from '@/utils';
import type { InterviewSession, Scorecard } from '@/types';
import Button from '@/components/ui/Button';
import { cn } from '@/utils';

function StatCard({ label, value, icon, sub, color = 'primary', delay = '0ms' }: {
  label: string; value: string | number; icon: React.ReactNode;
  sub?: string; color?: string; delay?: string;
}) {
  return (
    <Card
      className={cn(
        'flex items-center gap-4 animate-slide-up',
        'hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-default',
        `hover:border-${color}-500/30`
      )}
      style={{ animationDelay: delay, animationFillMode: 'both' }}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-${color}-500/10 text-${color}-500 transition-all duration-300 group-hover:scale-110`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-[var(--color-text-primary)]">{value}</p>
        <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
        {sub && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

function SessionItem({ session, index }: { session: InterviewSession; index: number }) {
  const statusConfig = {
    completed:   { icon: <CheckCircle2 size={14} />, color: 'success' as const,  label: 'Completed' },
    in_progress: { icon: <Clock size={14} />,        color: 'warning' as const,  label: 'In progress' },
    terminated:  { icon: <AlertCircle size={14} />,  color: 'error' as const,    label: 'Terminated' },
    pending:     { icon: <Clock size={14} />,        color: 'ghost' as const,    label: 'Pending' },
  };
  const cfg = statusConfig[session.status] || statusConfig.pending;

  return (
    <Link
      to={session.status === 'completed' ? `/scores/${session._id}` : `/interview/${session._id}`}
      className="flex items-center justify-between gap-4 p-4 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-all duration-200 group hover:translate-x-0.5 animate-fade-in"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0 transition-all duration-200 group-hover:bg-primary-500/20 group-hover:scale-110">
          <Zap size={16} className="text-primary-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate group-hover:text-primary-500 transition-colors duration-200">
            {session.role}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{formatRelativeTime(session.createdAt)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={cfg.color} size="sm">
          {cfg.icon}
          {cfg.label}
        </Badge>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getDifficultyColor(session.difficulty)}`}>
          {session.difficulty}
        </span>
        <ArrowRight
          size={14}
          className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
        />
      </div>
    </Link>
  );
}

function ScorecardItem({ sc, index }: { sc: Scorecard; index: number }) {
  const session = typeof sc.sessionId === 'object' ? sc.sessionId : null;
  return (
    <Link
      to={`/scores/${typeof sc.sessionId === 'string' ? sc.sessionId : sc.sessionId._id}`}
      className="flex items-center justify-between gap-4 p-4 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-all duration-200 group hover:translate-x-0.5 animate-fade-in"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate group-hover:text-primary-500 transition-colors duration-200">
          {session?.role || 'Interview Session'}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">{formatRelativeTime(sc.createdAt)}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className={`text-lg font-bold font-display transition-all duration-200 group-hover:scale-110 inline-block ${getScoreColor(sc.overall)}`}>
            {sc.overall.toFixed(1)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{getScoreGrade(sc.overall)}</p>
        </div>
        <ArrowRight
          size={14}
          className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
        />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const user = useAppSelector(selectCurrentUser);
  const { data: sessionsData, isLoading: sessionsLoading } = useSessions(1);
  const { data: scorecardsData, isLoading: scoresLoading } = useScorecards(1);

  const sessions = sessionsData?.sessions || [];
  const scorecards = scorecardsData?.scorecards || [];
  const avgScore = scorecards.length
    ? (scorecards.reduce((s, c) => s + c.overall, 0) / scorecards.length).toFixed(1)
    : '—';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* ── Welcome ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-slide-down">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[var(--color-text-primary)]">
            {greeting}, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Ready to level up your interview skills?
          </p>
        </div>
        <Link to="/interview/new">
          <Button
            size="lg"
            leftIcon={<Zap size={18} />}
            className="shadow-glow hover:shadow-glow-lg hover:scale-105 transition-all duration-300"
          >
            Start Interview
          </Button>
        </Link>
      </div>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total sessions"
          value={sessionsData?.total || 0}
          icon={<Zap size={20} />}
          color="primary"
          delay="0ms"
        />
        <StatCard
          label="Completed"
          value={sessions.filter(s => s.status === 'completed').length}
          icon={<CheckCircle2 size={20} />}
          color="green"
          delay="60ms"
        />
        <StatCard
          label="Avg. score"
          value={avgScore}
          icon={<TrendingUp size={20} />}
          sub="out of 10"
          color="secondary"
          delay="120ms"
        />
        <StatCard
          label="Scorecards"
          value={scorecardsData?.total || 0}
          icon={<BarChart3 size={20} />}
          color="accent"
          delay="180ms"
        />
      </div>

      {/* ── Content Grid ────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Sessions */}
        <Card className="animate-slide-up hover:border-primary-500/20 transition-all duration-300" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Sessions</h2>
            <Link
              to="/scores"
              className="text-xs text-primary-500 hover:text-primary-400 font-medium transition-colors duration-200 flex items-center gap-1 group"
            >
              View all
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform duration-200" />
            </Link>
          </div>
          {sessionsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={<Zap size={24} className="text-primary-400" />}
              title="No sessions yet"
              description="Start your first AI interview to see it here."
              action={
                <Link to="/interview/new">
                  <Button size="sm" leftIcon={<Plus size={14} />}>Start Interview</Button>
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {sessions.slice(0, 5).map((s, i) => <SessionItem key={s._id} session={s} index={i} />)}
            </div>
          )}
        </Card>

        {/* Recent Scores */}
        <Card className="animate-slide-up hover:border-primary-500/20 transition-all duration-300" style={{ animationDelay: '160ms', animationFillMode: 'both' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Scores</h2>
            <Link
              to="/scores"
              className="text-xs text-primary-500 hover:text-primary-400 font-medium transition-colors duration-200 flex items-center gap-1 group"
            >
              View all
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform duration-200" />
            </Link>
          </div>
          {scoresLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
          ) : scorecards.length === 0 ? (
            <EmptyState
              icon={<BarChart3 size={24} className="text-primary-400" />}
              title="No scores yet"
              description="Complete an interview to see your scorecard."
            />
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {scorecards.slice(0, 5).map((sc, i) => <ScorecardItem key={sc._id} sc={sc} index={i} />)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}