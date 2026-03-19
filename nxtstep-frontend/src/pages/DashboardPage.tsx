// ============================================================
// NxtStep — Dashboard Page
// ============================================================

import { Link } from 'react-router-dom';
import { Zap, BarChart3, ArrowRight, Clock, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { Card, Badge, SkeletonCard, EmptyState } from '@/components/ui/index';
import { usePageTitle } from '@/hooks';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { useSessions, useScorecards } from '@/hooks/useApi';
import { formatRelativeTime, getDifficultyColor, getScoreColor, getScoreGrade } from '@/utils';
import type { InterviewSession, Scorecard } from '@/types';
import Button from '@/components/ui/Button';

function StatCard({ label, value, icon, sub, color = 'primary' }: {
  label: string; value: string | number; icon: React.ReactNode; sub?: string; color?: string;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-${color}-500/10 text-${color}-500`}>
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

function SessionItem({ session }: { session: InterviewSession }) {
  const statusConfig = {
    completed: { icon: <CheckCircle2 size={14} />, color: 'success' as const, label: 'Completed' },
    in_progress: { icon: <Clock size={14} />, color: 'warning' as const, label: 'In progress' },
    terminated: { icon: <AlertCircle size={14} />, color: 'error' as const, label: 'Terminated' },
    pending: { icon: <Clock size={14} />, color: 'ghost' as const, label: 'Pending' },
  };
  const cfg = statusConfig[session.status] || statusConfig.pending;

  return (
    <Link
      to={session.status === 'completed' ? `/scores/${session._id}` : `/interview/${session._id}`}
      className="flex items-center justify-between gap-4 p-4 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
          <Zap size={16} className="text-primary-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{session.role}</p>
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
        <ArrowRight size={14} className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

function ScorecardItem({ sc }: { sc: Scorecard }) {
  const session = typeof sc.sessionId === 'object' ? sc.sessionId : null;
  return (
    <Link
      to={`/scores/${typeof sc.sessionId === 'string' ? sc.sessionId : sc.sessionId._id}`}
      className="flex items-center justify-between gap-4 p-4 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-colors group"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {session?.role || 'Interview Session'}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">{formatRelativeTime(sc.createdAt)}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className={`text-lg font-bold font-display ${getScoreColor(sc.overall)}`}>
            {sc.overall.toFixed(1)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{getScoreGrade(sc.overall)}</p>
        </div>
        <ArrowRight size={14} className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[var(--color-text-primary)]">
            {greeting}, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Ready to level up your interview skills?
          </p>
        </div>
        <Link to="/interview/new">
          <Button size="lg" leftIcon={<Zap size={18} />} className="shadow-glow hover:shadow-glow-lg">
            Start Interview
          </Button>
        </Link>
      </div>

      {/* ── Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total sessions" value={sessionsData?.total || 0} icon={<Zap size={20} />} color="primary" />
        <StatCard label="Completed" value={sessions.filter(s => s.status === 'completed').length} icon={<CheckCircle2 size={20} />} color="green" />
        <StatCard label="Avg. score" value={avgScore} icon={<TrendingUp size={20} />} sub="out of 10" color="secondary" />
        <StatCard label="Scorecards" value={scorecardsData?.total || 0} icon={<BarChart3 size={20} />} color="accent" />
      </div>

      {/* ── Content Grid ────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Sessions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Sessions</h2>
            <Link to="/scores" className="text-xs text-primary-500 hover:text-primary-600 font-medium transition-colors">
              View all
            </Link>
          </div>
          {sessionsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
          ) : sessions.length === 0 ? (
            <EmptyState icon={<Zap size={24} className="text-primary-400" />}
              title="No sessions yet" description="Start your first AI interview to see it here."
              action={<Link to="/interview/new"><Button size="sm">Start Interview</Button></Link>} />
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {sessions.slice(0, 5).map(s => <SessionItem key={s._id} session={s} />)}
            </div>
          )}
        </Card>

        {/* Recent Scores */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Scores</h2>
            <Link to="/scores" className="text-xs text-primary-500 hover:text-primary-600 font-medium transition-colors">
              View all
            </Link>
          </div>
          {scoresLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
          ) : scorecards.length === 0 ? (
            <EmptyState icon={<BarChart3 size={24} className="text-primary-400" />}
              title="No scores yet" description="Complete an interview to see your scorecard." />
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {scorecards.slice(0, 5).map(sc => <ScorecardItem key={sc._id} sc={sc} />)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
