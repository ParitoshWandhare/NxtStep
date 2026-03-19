// ============================================================
// NxtStep — Interview Session Page
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, AlertTriangle, Loader2, CheckCircle2, Mic } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectCurrentQuestion, selectIsWaiting, selectIsAnswering,
  selectPendingAnswer, selectProctoringWarnings, selectIsSessionActive,
  selectEngineState, setIsAnswering, setPendingAnswer,
} from '@/features/interview/interviewSlice';
import { selectToken } from '@/features/auth/authSlice';
import { useInterviewSocket } from '@/hooks/useInterviewSocket';
import { useSubmitAnswer, useLogProctoringEvent, useSession } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';
import { Card, Badge, ProgressBar } from '@/components/ui/index';
import Button from '@/components/ui/Button';
import { cn, formatRelativeTime } from '@/utils';
import type { SocketScorecardReadyPayload } from '@/types';

// ── Proctoring Bar ─────────────────────────────────────────
function ProctoringBar({ warnings, sessionId }: { warnings: number; sessionId: string }) {
  const logEvent = useLogProctoringEvent(sessionId);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) logEvent.mutate({ eventType: 'tab_switch' });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (warnings === 0) return null;

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium border',
      warnings >= 4
        ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
        : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400'
    )}>
      <AlertTriangle size={16} />
      <span>
        Tab switch detected ({warnings}/5). {5 - warnings} warning{5 - warnings !== 1 ? 's' : ''} remaining before session ends.
      </span>
    </div>
  );
}

// ── Question Card ──────────────────────────────────────────
function QuestionCard({ text, type, topic, index }: {
  text: string; type: string; topic: string; index: number;
}) {
  const typeColors: Record<string, string> = {
    concept: 'primary', problem: 'secondary', behavioral: 'accent',
    follow_up: 'warning', technical: 'primary',
  };

  return (
    <Card className="border-primary-500/20 bg-primary-500/3 dark:bg-primary-950/20">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5">
          Q
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant={(typeColors[type] as 'primary' | 'secondary' | 'accent') || 'primary'} size="sm">
              {type.replace('_', ' ')}
            </Badge>
            <Badge variant="ghost" size="sm">{topic}</Badge>
          </div>
          <p className="text-[var(--color-text-primary)] font-medium leading-relaxed text-base">
            {text}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ── Answer Input ───────────────────────────────────────────
function AnswerInput({
  value, onChange, onSubmit, isSubmitting, disabled,
}: {
  value: string; onChange: (v: string) => void;
  onSubmit: () => void; isSubmitting: boolean; disabled: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && ref.current) ref.current.focus();
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !disabled && value.trim()) {
      onSubmit();
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">Your Answer</label>
        <span className="text-xs text-[var(--color-text-muted)]">{value.length}/5000 · Ctrl+Enter to submit</span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type your answer here. Be clear and thorough — the AI evaluates technical depth, communication, and problem-solving…"
        className={cn(
          'w-full min-h-[200px] resize-y input-field text-base leading-relaxed',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
        maxLength={5000}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Mic size={12} /> Voice input coming soon
        </div>
        <Button
          onClick={onSubmit}
          disabled={disabled || !value.trim() || value.trim().length < 10}
          loading={isSubmitting}
          leftIcon={<Send size={16} />}
          size="lg"
          className="min-w-[160px]"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Answer'}
        </Button>
      </div>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function InterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  usePageTitle('Interview Session');

  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const currentQuestion = useAppSelector(selectCurrentQuestion);
  const isWaiting = useAppSelector(selectIsWaiting);
  const isAnswering = useAppSelector(selectIsAnswering);
  const pendingAnswer = useAppSelector(selectPendingAnswer);
  const proctoringWarnings = useAppSelector(selectProctoringWarnings);
  const isSessionActive = useAppSelector(selectIsSessionActive);
  const engineState = useAppSelector(selectEngineState);

  const { data: session } = useSession(sessionId || '', !!sessionId);
  const submitAnswer = useSubmitAnswer(sessionId || '');

  const handleScorecardReady = useCallback((_: SocketScorecardReadyPayload) => {
    navigate(`/interview/${sessionId}/results`);
  }, [navigate, sessionId]);

  const handleTerminated = useCallback((_: string) => {
    navigate(`/interview/${sessionId}/results`);
  }, [navigate, sessionId]);

  useInterviewSocket({
    sessionId: sessionId || null,
    token,
    onScorecardReady: handleScorecardReady,
    onTerminated: handleTerminated,
  });

  const questionCount = session?.questions?.length || 0;
  const answerCount = session?.answers?.length || 0;
  const progressPct = Math.min((answerCount / 10) * 100, 100);

  const onSubmitAnswer = async () => {
    if (!currentQuestion || !pendingAnswer.trim()) return;
    dispatch(setIsAnswering(true));
    try {
      await submitAnswer.mutateAsync({
        questionId: currentQuestion.id,
        answerText: pendingAnswer.trim(),
      });
    } catch {
      dispatch(setIsAnswering(false));
    }
  };

  // If session already completed/terminated, redirect
  useEffect(() => {
    if (session?.status === 'completed' || session?.status === 'terminated') {
      navigate(`/interview/${sessionId}/results`);
    }
  }, [session?.status, navigate, sessionId]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-1">
            {session?.role || 'AI Interview Session'}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant={isSessionActive ? 'success' : 'ghost'} dot>
              {isSessionActive ? 'Live' : 'Loading'}
            </Badge>
            <span className="text-xs text-[var(--color-text-muted)]">
              {answerCount}/10 answered
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Progress</p>
          <p className="text-sm font-bold font-display text-[var(--color-text-primary)]">
            {Math.round(progressPct)}%
          </p>
        </div>
      </div>

      {/* Progress */}
      <ProgressBar value={progressPct} size="md" color="primary" />

      {/* Proctoring warning */}
      <ProctoringBar warnings={proctoringWarnings} sessionId={sessionId || ''} />

      {/* ── Question / Waiting State ─────────────────────────── */}
      {isWaiting || !currentQuestion ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center">
              <Loader2 size={28} className="text-primary-500 animate-spin" />
            </div>
          </div>
          <h3 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-2">
            {engineState === 'GENERATE_Q' ? 'Generating your question…' : 'Evaluating your answer…'}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-xs">
            Our AI is crafting a calibrated question for you. This takes just a moment.
          </p>
          <div className="flex gap-2 mt-6">
            <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-primary-600 animate-bounce [animation-delay:300ms]" />
          </div>
        </Card>
      ) : (
        <>
          <QuestionCard
            text={currentQuestion.text}
            type={currentQuestion.type}
            topic={currentQuestion.topic}
            index={questionCount}
          />
          <AnswerInput
            value={pendingAnswer}
            onChange={(v) => dispatch(setPendingAnswer(v))}
            onSubmit={onSubmitAnswer}
            isSubmitting={isAnswering || submitAnswer.isPending}
            disabled={isAnswering}
          />
        </>
      )}

      {/* ── Evaluation Feedback (last) ───────────────────────── */}
      {isAnswering && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Answer submitted!</p>
              <p className="text-xs text-[var(--color-text-muted)]">AI is evaluating your response…</p>
            </div>
          </div>
        </Card>
      )}

      {/* Tip */}
      <p className="text-xs text-center text-[var(--color-text-muted)]">
        💡 Tip: Don't switch tabs — it's monitored. Take your time, be thorough.
      </p>
    </div>
  );
}
