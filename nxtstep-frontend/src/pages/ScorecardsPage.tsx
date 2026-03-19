// ============================================================
// NxtStep — Scorecards List Page
// ============================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowRight, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { Card, Badge, EmptyState, Skeleton } from '@/components/ui/index';
import Button from '@/components/ui/Button';
import { useScorecards } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';
import { formatDate, getScoreColor, getScoreGrade, getDifficultyColor } from '@/utils';
import type { Scorecard } from '@/types';

function ScorecardRow({ sc }: { sc: Scorecard }) {
  const session = typeof sc.sessionId === 'object' ? sc.sessionId : null;
  const sessionIdStr = typeof sc.sessionId === 'string' ? sc.sessionId : sc.sessionId._id;

  return (
    <Link
      to={`/scores/${sessionIdStr}`}
      className="flex items-center gap-4 p-4 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-colors group"
    >
      <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center shrink-0">
        <BarChart3 size={18} className="text-primary-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--color-text-primary)] truncate">
          {session?.role || 'Interview Session'}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {formatDate(sc.createdAt)} · {sc.questionsEvaluated} questions
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {session && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getDifficultyColor(session.difficulty)}`}>
            {session.difficulty}
          </span>
        )}
        <div className="text-right">
          <p className={`text-lg font-bold font-display ${getScoreColor(sc.overall)}`}>
            {sc.overall.toFixed(1)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{getScoreGrade(sc.overall)}</p>
        </div>
        <ArrowRight size={16} className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

export default function ScorecardsPage() {
  usePageTitle('My Scores');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useScorecards(page);

  const scorecards = data?.scorecards || [];
  const totalPages = data?.pages || 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">My Scores</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {data?.total || 0} scorecards
          </p>
        </div>
        <Link to="/interview/new">
          <Button size="sm" variant="secondary">New Interview</Button>
        </Link>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="w-12 h-8" />
              </div>
            ))}
          </div>
        ) : scorecards.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={28} className="text-primary-400" />}
            title="No scorecards yet"
            description="Complete your first interview to see your performance scorecard here."
            action={<Link to="/interview/new"><Button>Start Interview</Button></Link>}
          />
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)] p-2">
            {scorecards.map(sc => <ScorecardRow key={sc._id} sc={sc} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 p-4 border-t border-[var(--color-border)]">
            <Button variant="ghost" size="sm" disabled={page <= 1}
              leftIcon={<ChevronLeft size={14} />} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-[var(--color-text-muted)]">
              {page} / {totalPages}
            </span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages}
              rightIcon={<ChevronRightIcon size={14} />} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
