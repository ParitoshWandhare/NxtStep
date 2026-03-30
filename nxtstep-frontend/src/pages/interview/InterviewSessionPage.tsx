// ============================================================
// NxtStep — Interview Session Page
// ISSUE 2 FIX:
//   - Mic AND camera are now MANDATORY (not optional).
//   - If either device disconnects mid-session, a 10-second
//     countdown overlay appears.
//   - If the device does not reconnect before the countdown
//     expires, the interview is automatically terminated.
//   - Pre-session gate blocks starting until both are granted.
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Send, AlertTriangle, Loader2, CheckCircle2,
  Mic, MicOff, Camera, CameraOff, Maximize,
  Shield, ChevronRight, RefreshCw, XCircle,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectCurrentQuestion, selectIsWaiting, selectIsAnswering,
  selectPendingAnswer, selectProctoringWarnings, selectIsSessionActive,
  selectEngineState, setIsAnswering, setPendingAnswer, setCurrentQuestion,
  setWaitingForQuestion,
} from '@/features/interview/interviewSlice';
import { selectToken } from '@/features/auth/authSlice';
import { useInterviewSocket } from '@/hooks/useInterviewSocket';
import {
  useSubmitAnswer, useLogProctoringEvent,
  useSession, useSessionStatus,
} from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';
import { Card, Badge, ProgressBar } from '@/components/ui/index';
import Button from '@/components/ui/Button';
import { cn } from '@/utils';
import type { SocketScorecardReadyPayload } from '@/types';

// ─────────────────────────────────────────────────────────────
// Reconnect Overlay — shown when mic or camera disconnects mid-session
// ─────────────────────────────────────────────────────────────
interface ReconnectOverlayProps {
  missingDevice: 'microphone' | 'camera' | 'both';
  secondsLeft: number;
  onRetry: () => void;
}

function ReconnectOverlay({ missingDevice, secondsLeft, onRetry }: ReconnectOverlayProps) {
  const deviceLabel =
    missingDevice === 'both'
      ? 'Microphone & Camera'
      : missingDevice === 'microphone'
      ? 'Microphone'
      : 'Camera';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-sm mx-4 animate-scale-in">
        <Card className="p-8 text-center border-red-500/40 shadow-2xl">
          {/* Countdown ring */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
              {/* Track */}
              <circle
                cx="48" cy="48" r="40"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="6"
              />
              {/* Countdown arc */}
              <circle
                cx="48" cy="48" r="40"
                fill="none"
                stroke="#ef4444"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - secondsLeft / 10)}`}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display font-bold text-2xl text-red-500">{secondsLeft}</span>
              <span className="text-xs text-[var(--color-text-muted)]">sec</span>
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            {missingDevice === 'camera' ? (
              <CameraOff size={22} className="text-red-500" />
            ) : (
              <MicOff size={22} className="text-red-500" />
            )}
          </div>

          <h3 className="font-display font-bold text-xl text-[var(--color-text-primary)] mb-2">
            {deviceLabel} Disconnected
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
            Reconnect your {deviceLabel.toLowerCase()} within{' '}
            <span className="font-bold text-red-500">{secondsLeft} seconds</span> or
            the interview will be terminated automatically.
          </p>

          <Button
            fullWidth
            onClick={onRetry}
            leftIcon={<RefreshCw size={16} />}
            className="transition-all duration-200 hover:scale-[1.01] hover:shadow-glow"
          >
            Reconnect Now
          </Button>

          <p className="text-xs text-[var(--color-text-muted)] mt-4">
            Make sure your device is plugged in and browser permissions are granted.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Permission Gate — mandatory mic + camera before session starts
// ─────────────────────────────────────────────────────────────
interface PermissionGateProps {
  onReady: (stream: MediaStream) => void;
  sessionRole: string;
}

type PermState = 'idle' | 'requesting' | 'granted' | 'denied';

function PermissionGate({ onReady, sessionRole }: PermissionGateProps) {
  const [permState, setPermState] = useState<PermState>('idle');
  const [errorMsg, setErrorMsg]   = useState('');
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const requestPermissions = async () => {
    setPermState('requesting');
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPermState('granted');
    } catch (err: any) {
      setPermState('denied');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg(
          'Camera and microphone access was denied. ' +
          'Click the lock icon in your browser address bar and allow both, then try again.'
        );
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No camera or microphone found. Please connect a device and try again.');
      } else {
        setErrorMsg(`Could not access devices: ${err.message}`);
      }
    }
  };

  const requestFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Not supported — continue anyway
    }
  };

  const handleBegin = async () => {
    if (!streamRef.current) return;
    // Pause camera preview but keep stream alive for mid-session monitoring
    if (videoRef.current) videoRef.current.pause();
    await requestFullscreen();
    onReady(streamRef.current);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)] bg-mesh">
      {/* Animated blobs */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-secondary-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <div className="relative z-10 w-full max-w-lg mx-4 animate-slide-up">
        <Card className="p-8 border-primary-500/20 shadow-glow">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
              <Shield size={26} className="text-primary-500" />
            </div>
            <h2 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-1">
              Before you begin
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Interview for <span className="text-primary-500 font-medium">{sessionRole}</span>
            </p>
          </div>

          {/* Requirements */}
          <div className="space-y-2 mb-5">
            {/* Camera status */}
            <div className={cn(
              'flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300',
              permState === 'granted'
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : permState === 'denied'
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)]'
            )}>
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                permState === 'granted' ? 'bg-emerald-500/20 text-emerald-500'
                  : permState === 'denied' ? 'bg-red-500/20 text-red-500'
                  : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]'
              )}>
                {permState === 'denied' ? <CameraOff size={16} /> : <Camera size={16} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Camera</p>
                <p className="text-xs text-[var(--color-text-muted)]">Required for proctoring</p>
              </div>
              {permState === 'granted' && (
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 animate-scale-in" />
              )}
              {permState === 'denied' && (
                <XCircle size={16} className="text-red-500 shrink-0" />
              )}
            </div>

            {/* Microphone status */}
            <div className={cn(
              'flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300',
              permState === 'granted'
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : permState === 'denied'
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)]'
            )}>
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                permState === 'granted' ? 'bg-emerald-500/20 text-emerald-500'
                  : permState === 'denied' ? 'bg-red-500/20 text-red-500'
                  : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]'
              )}>
                {permState === 'denied' ? <MicOff size={16} /> : <Mic size={16} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Microphone</p>
                <p className="text-xs text-[var(--color-text-muted)]">Required for voice answers</p>
              </div>
              {permState === 'granted' && (
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 animate-scale-in" />
              )}
              {permState === 'denied' && (
                <XCircle size={16} className="text-red-500 shrink-0" />
              )}
            </div>

            {/* Fullscreen status */}
            <div className={cn(
              'flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300',
              isFullscreen
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)]'
            )}>
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                isFullscreen ? 'bg-emerald-500/20 text-emerald-500'
                  : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]'
              )}>
                <Maximize size={16} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Fullscreen</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {isFullscreen ? 'Active' : 'Will activate when you begin'}
                </p>
              </div>
              {isFullscreen && (
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0 animate-scale-in" />
              )}
            </div>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20 mb-4 animate-fade-in">
              <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Camera preview */}
          {permState === 'granted' && (
            <div className="relative mb-4 rounded-xl overflow-hidden bg-black aspect-video animate-fade-in">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/70 text-white text-xs flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Camera preview
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {permState !== 'granted' ? (
              <Button
                fullWidth
                size="lg"
                onClick={requestPermissions}
                loading={permState === 'requesting'}
                leftIcon={permState !== 'requesting' ? <Camera size={18} /> : undefined}
                className="transition-all duration-300 hover:shadow-glow hover:scale-[1.01]"
              >
                {permState === 'denied' ? 'Retry Permissions' : 'Allow Camera & Microphone'}
              </Button>
            ) : (
              <Button
                fullWidth
                size="lg"
                onClick={handleBegin}
                rightIcon={<ChevronRight size={18} />}
                className="transition-all duration-300 hover:shadow-glow hover:scale-[1.01]"
              >
                Begin Interview
              </Button>
            )}
          </div>

          <p className="text-center text-xs text-[var(--color-text-muted)] mt-3">
            Camera and microphone are required for this interview. If disconnected, you will have 10 seconds to reconnect.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Proctoring Bar
// ─────────────────────────────────────────────────────────────
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
      'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium border animate-slide-down',
      warnings >= 4
        ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
        : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400'
    )}>
      <AlertTriangle size={16} className="animate-pulse shrink-0" />
      <span>Tab switch detected ({warnings}/5). {5 - warnings} warning{5 - warnings !== 1 ? 's' : ''} remaining.</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Question Card
// ─────────────────────────────────────────────────────────────
function QuestionCard({ text, type, topic, index }: {
  text: string; type: string; topic: string; index: number;
}) {
  const typeColors: Record<string, string> = {
    concept: 'primary', problem: 'secondary', behavioral: 'accent',
    follow_up: 'warning', technical: 'primary',
  };
  return (
    <Card className="border-primary-500/20 bg-primary-500/3 dark:bg-primary-950/20 animate-slide-down hover:border-primary-500/40 transition-all duration-300">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5 shadow-glow-sm animate-scale-in">
          Q{index}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant={(typeColors[type] as any) || 'primary'} size="sm">{type.replace('_', ' ')}</Badge>
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

// ─────────────────────────────────────────────────────────────
// Answer Input
// ─────────────────────────────────────────────────────────────
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

  return (
    <Card className="space-y-3 animate-slide-up hover:border-primary-500/20 transition-all duration-300">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">Your Answer</label>
        <span className={cn('text-xs transition-colors duration-200',
          value.length > 4500 ? 'text-red-500' : 'text-[var(--color-text-muted)]')}>
          {value.length}/5000 · Ctrl+Enter to submit
        </span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !disabled && value.trim()) onSubmit();
        }}
        disabled={disabled}
        placeholder="Type your answer here…"
        className={cn(
          'w-full min-h-[200px] resize-y input-field text-base leading-relaxed transition-all duration-200 focus:min-h-[240px]',
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
          className="min-w-[160px] transition-all duration-300 hover:shadow-glow hover:scale-[1.02]"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Answer'}
        </Button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Waiting Card
// ─────────────────────────────────────────────────────────────
function WaitingCard({ engineState }: { engineState: string }) {
  return (
    <Card className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center animate-pulse-glow">
          <Loader2 size={28} className="text-primary-500 animate-spin" />
        </div>
        <div className="absolute -inset-2 rounded-2xl border-2 border-primary-500/20 animate-ping" />
      </div>
      <h3 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-2">
        {['GENERATE_Q', 'IDLE'].includes(engineState)
          ? 'Generating your question…'
          : ['PROCESS_ANSWER', 'EVALUATE'].includes(engineState)
          ? 'Evaluating your answer…'
          : 'Processing…'}
      </h3>
      <p className="text-sm text-[var(--color-text-muted)] max-w-xs">
        Our AI is crafting a calibrated question for you. This takes just a moment.
      </p>
      <div className="flex gap-2 mt-6">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-2 h-2 rounded-full bg-primary-500 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function InterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate      = useNavigate();
  usePageTitle('Interview Session');

  // ── Permissions & device monitoring ──────────────────────────
  const [permGranted, setPermGranted]     = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Reconnect overlay state
  const [reconnecting, setReconnecting]   = useState(false);
  const [missingDevice, setMissingDevice] = useState<'microphone' | 'camera' | 'both'>('both');
  const [countdown, setCountdown]         = useState(10);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Redux ─────────────────────────────────────────────────────
  const dispatch         = useAppDispatch();
  const token            = useAppSelector(selectToken);
  const currentQuestion  = useAppSelector(selectCurrentQuestion);
  const isWaiting        = useAppSelector(selectIsWaiting);
  const isAnswering      = useAppSelector(selectIsAnswering);
  const pendingAnswer    = useAppSelector(selectPendingAnswer);
  const proctoringWarnings = useAppSelector(selectProctoringWarnings);
  const isSessionActive  = useAppSelector(selectIsSessionActive);
  const engineState      = useAppSelector(selectEngineState);

  // ── Data hooks ────────────────────────────────────────────────
  const { data: session, refetch: refetchSession }   = useSession(sessionId || '', !!sessionId && permGranted);
  const { data: sessionStatus }                       = useSessionStatus(sessionId || '', !!sessionId && permGranted);
  const submitAnswer                                  = useSubmitAnswer(sessionId || '');
  const logEvent                                      = useLogProctoringEvent(sessionId || '');

  // ── Device monitoring — check tracks every 2 seconds ─────────
  const startDeviceMonitor = useCallback(() => {
    const interval = setInterval(() => {
      const stream = mediaStreamRef.current;
      if (!stream) return;

      const audioLive = stream.getAudioTracks().some(t => t.readyState === 'live' && t.enabled);
      const videoLive = stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled);

      if (!audioLive && !videoLive) triggerReconnect('both');
      else if (!audioLive) triggerReconnect('microphone');
      else if (!videoLive) triggerReconnect('camera');
    }, 2000);
    return interval;
  }, []);

  const deviceMonitorRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Start reconnect countdown ─────────────────────────────────
  const triggerReconnect = useCallback((device: 'microphone' | 'camera' | 'both') => {
    if (reconnecting) return; // already showing overlay
    setMissingDevice(device);
    setCountdown(10);
    setReconnecting(true);
  }, [reconnecting]);

  // Countdown tick
  useEffect(() => {
    if (!reconnecting) return;

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Time expired → terminate
          clearInterval(countdownRef.current!);
          logEvent.mutate({
            eventType: 'termination',
            details: { reason: `${missingDevice} disconnected — reconnect timeout` },
          });
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          navigate(`/interview/${sessionId}/results`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [reconnecting]);

  // ── Retry: re-request media ───────────────────────────────────
  const handleRetryDevices = async () => {
    try {
      // Stop old tracks
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;

      // Check tracks are live
      const audioOk = stream.getAudioTracks().some(t => t.readyState === 'live');
      const videoOk = stream.getVideoTracks().some(t => t.readyState === 'live');

      if (audioOk && videoOk) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setReconnecting(false);
        setCountdown(10);
      }
    } catch {
      // Permission denied again — countdown continues
    }
  };

  // ── Start device monitor after permissions granted ────────────
  useEffect(() => {
    if (!permGranted) return;
    deviceMonitorRef.current = startDeviceMonitor();
    return () => {
      if (deviceMonitorRef.current) clearInterval(deviceMonitorRef.current);
    };
  }, [permGranted, startDeviceMonitor]);

  // ── Fix: hydrate question from REST if socket missed event ────
  useEffect(() => {
    if (!session || !permGranted) return;
    const questions = session.questions || [];
    const answers   = session.answers   || [];

    if (questions.length > 0 && !currentQuestion) {
      const answeredIds = new Set(answers.map((a: any) => a.questionId));
      const nextQ = questions.find((q: any) => !answeredIds.has(q.id));
      if (nextQ) {
        dispatch(setCurrentQuestion({
          id: nextQ.id,
          text: nextQ.text,
          type: nextQ.type,
          topic: nextQ.topic || 'general',
          difficulty: nextQ.difficulty || 'mid',
          expectedKeywords: nextQ.expectedKeywords || [],
          followUpCount: nextQ.followUpCount || 0,
          parentQuestionId: nextQ.parentQuestionId,
        }));
        dispatch(setWaitingForQuestion(false));
      }
    }
  }, [session, currentQuestion, dispatch, permGranted]);

  useEffect(() => {
    if (!sessionStatus || !permGranted) return;
    if (sessionStatus.questionsGenerated > 0 && !currentQuestion) {
      refetchSession();
    }
  }, [sessionStatus?.questionsGenerated, currentQuestion, permGranted]);

  // ── Socket ────────────────────────────────────────────────────
  const handleScorecardReady = useCallback((_: SocketScorecardReadyPayload) => {
    navigate(`/interview/${sessionId}/results`);
  }, [navigate, sessionId]);

  const handleTerminated = useCallback((_: string) => {
    navigate(`/interview/${sessionId}/results`);
  }, [navigate, sessionId]);

  useInterviewSocket({
    sessionId: permGranted ? (sessionId || null) : null,
    token,
    onScorecardReady: handleScorecardReady,
    onTerminated: handleTerminated,
  });

  // Redirect if session finished
  useEffect(() => {
    if (session?.status === 'completed' || session?.status === 'terminated') {
      navigate(`/interview/${sessionId}/results`);
    }
  }, [session?.status, navigate, sessionId]);

  // Exit fullscreen + stop tracks on unmount
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      if (deviceMonitorRef.current) clearInterval(deviceMonitorRef.current);
    };
  }, []);

  const questionCount = session?.questions?.length || 0;
  const answerCount   = session?.answers?.length   || 0;
  const progressPct   = Math.min((answerCount / 10) * 100, 100);

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

  // ── Pre-session: Permission Gate ──────────────────────────────
  if (!permGranted) {
    return (
      <PermissionGate
        sessionRole={session?.role || 'Interview'}
        onReady={(stream) => {
          mediaStreamRef.current = stream;
          setPermGranted(true);
        }}
      />
    );
  }

  return (
    <>
      {/* ── Reconnect overlay ─────────────────────────────────── */}
      {reconnecting && (
        <ReconnectOverlay
          missingDevice={missingDevice}
          secondsLeft={countdown}
          onRetry={handleRetryDevices}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 animate-slide-down">
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

        {/* Progress bar */}
        <div className="animate-slide-down" style={{ animationDelay: '50ms' }}>
          <ProgressBar value={progressPct} size="md" color="primary" />
        </div>

        {/* Tab-switch warning */}
        <ProctoringBar warnings={proctoringWarnings} sessionId={sessionId || ''} />

        {/* ── Question / Waiting ───────────────────────────────── */}
        {!currentQuestion ? (
          <WaitingCard engineState={engineState} />
        ) : (
          <>
            <QuestionCard
              text={currentQuestion.text}
              type={currentQuestion.type}
              topic={currentQuestion.topic}
              index={answerCount + 1}
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

        {/* Submission feedback */}
        {isAnswering && (
          <Card className="border-emerald-500/20 bg-emerald-500/5 animate-slide-up">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-500 animate-scale-in" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Answer submitted!</p>
                <p className="text-xs text-[var(--color-text-muted)]">AI is evaluating your response…</p>
              </div>
            </div>
          </Card>
        )}

        <p className="text-xs text-center text-[var(--color-text-muted)] pb-4">
          💡 Don&apos;t switch tabs — it&apos;s monitored. Keep camera and mic connected throughout.
        </p>
      </div>
    </>
  );
}