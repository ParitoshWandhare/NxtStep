// ============================================================
// NxtStep — Interview Session Page
// CHANGES:
//   1. Text-to-speech for questions (browser SpeechSynthesis)
//   2. Speech-to-text for answers (browser SpeechRecognition)
//   3. Live camera view visible to user (PiP-style overlay)
//   4. Questions generated in real-time via Socket.IO (no pre-seeding)
//   5. Mic + Camera mandatory with reconnect overlay
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Loader2, CheckCircle2,
  Mic, MicOff, Camera, CameraOff, Maximize,
  Shield, ChevronRight, RefreshCw, XCircle,
  Volume2, VolumeX, StopCircle, Radio,
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
// Speech Recognition Hook
// ─────────────────────────────────────────────────────────────
function useSpeechRecognition({
  onTranscript,
  onEnd,
}: {
  onTranscript: (text: string) => void;
  onEnd: () => void;
}) {
  const recogRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'en-US';
      recog.maxAlternatives = 1;

      let finalTranscript = '';

      recog.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interim = result[0].transcript;
          }
        }
        onTranscript((finalTranscript + interim).trim());
      };

      recog.onend = () => {
        setIsListening(false);
        onEnd();
      };

      recog.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== 'aborted') {
          setIsListening(false);
        }
      };

      recogRef.current = recog;
    }

    return () => {
      recogRef.current?.abort();
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recogRef.current) return;
    try {
      recogRef.current.start();
      setIsListening(true);
    } catch { /* already running */ }
  }, []);

  const stopListening = useCallback(() => {
    if (!recogRef.current) return;
    recogRef.current.stop();
    setIsListening(false);
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}

// ─────────────────────────────────────────────────────────────
// Text-to-Speech Hook
// ─────────────────────────────────────────────────────────────
function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (isMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Prefer a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Neural')
    ) || voices.find(v => v.lang === 'en-US') || voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!isMuted) cancel();
    setIsMuted(p => !p);
  }, [isMuted, cancel]);

  return { isSpeaking, isMuted, speak, cancel, toggleMute };
}

// ─────────────────────────────────────────────────────────────
// Camera Overlay (PiP-style)
// ─────────────────────────────────────────────────────────────
function CameraOverlay({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 group cursor-default">
      <div className="relative w-44 h-32 rounded-2xl overflow-hidden border-2 border-primary-500/40 shadow-2xl bg-black transition-all duration-300 group-hover:scale-105 group-hover:border-primary-500/70">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover mirror"
          style={{ transform: 'scaleX(-1)' }}
        />
        {/* Live indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-xs font-medium">LIVE</span>
        </div>
        {/* Camera icon */}
        <div className="absolute bottom-2 right-2 p-1 rounded-lg bg-black/50 backdrop-blur-sm">
          <Camera size={10} className="text-white/70" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reconnect Overlay
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
          <div className="relative w-24 h-24 mx-auto mb-6">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="40" fill="none" stroke="var(--color-border)" strokeWidth="6" />
              <circle
                cx="48" cy="48" r="40" fill="none" stroke="#ef4444" strokeWidth="6"
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
            {missingDevice === 'camera' ? <CameraOff size={22} className="text-red-500" /> : <MicOff size={22} className="text-red-500" />}
          </div>
          <h3 className="font-display font-bold text-xl text-[var(--color-text-primary)] mb-2">{deviceLabel} Disconnected</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
            Reconnect within <span className="font-bold text-red-500">{secondsLeft} seconds</span> or the interview will be terminated.
          </p>
          <Button fullWidth onClick={onRetry} leftIcon={<RefreshCw size={16} />}>Reconnect Now</Button>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Permission Gate
// ─────────────────────────────────────────────────────────────
interface PermissionGateProps {
  onReady: (stream: MediaStream) => void;
  sessionRole: string;
}

type PermState = 'idle' | 'requesting' | 'granted' | 'denied';

function PermissionGate({ onReady, sessionRole }: PermissionGateProps) {
  const [permState, setPermState] = useState<PermState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const videoRef = useRef<HTMLVideoElement>(null);
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPermState('granted');
    } catch (err: any) {
      setPermState('denied');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera and microphone access was denied. Click the lock icon in your browser address bar and allow both, then try again.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No camera or microphone found. Please connect a device and try again.');
      } else {
        setErrorMsg(`Could not access devices: ${err.message}`);
      }
    }
  };

  const handleBegin = async () => {
    if (!streamRef.current) return;
    try { await document.documentElement.requestFullscreen(); } catch { }
    onReady(streamRef.current);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)] bg-mesh">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-secondary-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>
      <div className="relative z-10 w-full max-w-lg mx-4 animate-slide-up">
        <Card className="p-8 border-primary-500/20 shadow-glow">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
              <Shield size={26} className="text-primary-500" />
            </div>
            <h2 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-1">Before you begin</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Interview for <span className="text-primary-500 font-medium">{sessionRole}</span>
            </p>
          </div>

          <div className="space-y-2 mb-5">
            {(['camera', 'microphone', 'fullscreen'] as const).map(device => {
              const isGranted = device === 'fullscreen' ? isFullscreen : permState === 'granted';
              const isDenied = permState === 'denied' && device !== 'fullscreen';
              const Icon = device === 'camera' ? (isDenied ? CameraOff : Camera) : device === 'microphone' ? (isDenied ? MicOff : Mic) : Maximize;
              const label = device === 'camera' ? 'Camera' : device === 'microphone' ? 'Microphone' : 'Fullscreen';
              const desc = device === 'camera' ? 'Required for proctoring & visibility' : device === 'microphone' ? 'Required for voice answers' : (isFullscreen ? 'Active' : 'Will activate when you begin');

              return (
                <div key={device} className={cn(
                  'flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300',
                  isGranted ? 'border-emerald-500/30 bg-emerald-500/5' : isDenied ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)]'
                )}>
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    isGranted ? 'bg-emerald-500/20 text-emerald-500' : isDenied ? 'bg-red-500/20 text-red-500' : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]')}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
                  </div>
                  {isGranted && <CheckCircle2 size={16} className="text-emerald-500 shrink-0 animate-scale-in" />}
                  {isDenied && <XCircle size={16} className="text-red-500 shrink-0" />}
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20 mb-4 animate-fade-in">
              <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {permState === 'granted' && (
            <div className="relative mb-4 rounded-xl overflow-hidden bg-black aspect-video animate-fade-in">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-medium">Camera Preview</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {permState !== 'granted' ? (
              <Button fullWidth size="lg" onClick={requestPermissions} loading={permState === 'requesting'}
                leftIcon={permState !== 'requesting' ? <Camera size={18} /> : undefined}
                className="transition-all duration-300 hover:shadow-glow hover:scale-[1.01]">
                {permState === 'denied' ? 'Retry Permissions' : 'Allow Camera & Microphone'}
              </Button>
            ) : (
              <Button fullWidth size="lg" onClick={handleBegin} rightIcon={<ChevronRight size={18} />}
                className="transition-all duration-300 hover:shadow-glow hover:scale-[1.01]">
                Begin Interview
              </Button>
            )}
          </div>

          <p className="text-center text-xs text-[var(--color-text-muted)] mt-3">
            Your camera and mic are required throughout. Questions will be read aloud; answer by voice.
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
    const onVisibility = () => { if (document.hidden) logEvent.mutate({ eventType: 'tab_switch' }); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  if (warnings === 0) return null;
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium border animate-slide-down',
      warnings >= 4 ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400')}>
      <AlertTriangle size={16} className="animate-pulse shrink-0" />
      <span>Tab switch detected ({warnings}/5). {5 - warnings} warning{5 - warnings !== 1 ? 's' : ''} remaining.</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Question Card with TTS
// ─────────────────────────────────────────────────────────────
function QuestionCard({
  text, type, topic, index, isSpeaking, isMuted, onSpeak, onStop, onToggleMute,
}: {
  text: string; type: string; topic: string; index: number;
  isSpeaking: boolean; isMuted: boolean;
  onSpeak: () => void; onStop: () => void; onToggleMute: () => void;
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
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant={(typeColors[type] as any) || 'primary'} size="sm">{type.replace('_', ' ')}</Badge>
              <Badge variant="ghost" size="sm">{topic}</Badge>
            </div>
            {/* TTS controls */}
            <div className="flex items-center gap-1.5">
              {isSpeaking ? (
                <button onClick={onStop}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-500/10 border border-primary-500/30 text-primary-500 text-xs font-medium hover:bg-primary-500/20 transition-all">
                  <div className="flex gap-0.5">
                    {[0, 150, 300].map(d => <span key={d} className="w-0.5 h-3 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                  </div>
                  Speaking…
                  <StopCircle size={12} />
                </button>
              ) : (
                <button onClick={onSpeak}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs hover:text-primary-500 hover:border-primary-500/50 transition-all">
                  <Volume2 size={12} />
                  Read aloud
                </button>
              )}
              <button onClick={onToggleMute}
                className={cn('p-1.5 rounded-lg transition-all', isMuted
                  ? 'bg-red-500/10 text-red-500 border border-red-500/30'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]')}>
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>
          </div>
          <p className="text-[var(--color-text-primary)] font-medium leading-relaxed text-base">{text}</p>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Voice Answer Input (STT)
// ─────────────────────────────────────────────────────────────
function VoiceAnswerInput({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  disabled: boolean;
}) {
  const [manualMode, setManualMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onTranscript: onChange,
    onEnd: () => { },
  });

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      onChange(''); // clear before new recording
      startListening();
    }
  };

  const handleSubmit = () => {
    if (isListening) stopListening();
    onSubmit();
  };

  return (
    <Card className="space-y-4 animate-slide-up hover:border-primary-500/20 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">Your Answer</label>
          {isListening && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium animate-pulse">
              <Radio size={10} />
              Recording
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setManualMode(m => !m)}
            className="text-xs text-[var(--color-text-muted)] hover:text-primary-500 transition-colors underline-offset-2 hover:underline"
          >
            {manualMode ? 'Use voice' : 'Type instead'}
          </button>
          {!manualMode && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {value.length}/5000
            </span>
          )}
        </div>
      </div>

      {/* Voice visualizer */}
      {!manualMode && (
        <div className={cn(
          'relative rounded-2xl border-2 transition-all duration-300 overflow-hidden',
          isListening
            ? 'border-red-500/50 bg-red-500/3'
            : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)]'
        )}>
          {/* Waveform animation when listening */}
          {isListening && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-1">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-red-500/40 animate-bounce"
                    style={{
                      height: `${Math.random() * 24 + 8}px`,
                      animationDelay: `${i * 50}ms`,
                      animationDuration: `${0.4 + Math.random() * 0.4}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className={cn('min-h-[140px] p-4 transition-opacity duration-200', isListening && 'opacity-40')}>
            {value ? (
              <p className="text-[var(--color-text-primary)] leading-relaxed text-sm whitespace-pre-wrap">{value}</p>
            ) : (
              <p className="text-[var(--color-text-muted)] text-sm italic">
                {isListening ? 'Listening… speak your answer' : 'Press the microphone button to start speaking'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Manual text input */}
      {manualMode && (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !disabled && value.trim()) handleSubmit(); }}
          disabled={disabled}
          placeholder="Type your answer here… (Ctrl+Enter to submit)"
          className={cn('w-full min-h-[160px] resize-y input-field text-base leading-relaxed', disabled && 'opacity-60 cursor-not-allowed')}
          maxLength={5000}
        />
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Mic toggle */}
          {!manualMode && (
            <button
              onClick={handleToggleListening}
              disabled={disabled || !isSupported}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200',
                isListening
                  ? 'bg-red-500 text-white shadow-lg scale-[1.02] hover:bg-red-600'
                  : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-primary-500/50 hover:bg-primary-500/5',
                (disabled || !isSupported) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isListening ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic size={16} />
                  {isSupported ? 'Start Speaking' : 'Voice Unavailable'}
                </>
              )}
            </button>
          )}

          {/* Clear button */}
          {value && !isListening && (
            <button
              onClick={() => onChange('')}
              className="px-3 py-2 rounded-xl text-sm text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/5 transition-all border border-transparent hover:border-red-500/20"
            >
              Clear
            </button>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={disabled || !value.trim() || value.trim().length < 5}
          loading={isSubmitting}
          size="lg"
          className="min-w-[160px] transition-all duration-300 hover:shadow-glow hover:scale-[1.02]"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Answer'}
        </Button>
      </div>

      {!isSupported && !manualMode && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
          <AlertTriangle size={12} />
          Speech recognition not supported in your browser. Switched to text input.
        </p>
      )}
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
        Your AI interviewer is preparing the next question in real-time.
      </p>
      <div className="flex gap-2 mt-6">
        {[0, 150, 300].map(delay => (
          <span key={delay} className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
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
  const navigate = useNavigate();
  usePageTitle('Interview Session');

  // ── Device state ─────────────────────────────────────────────
  const [permGranted, setPermGranted] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);

  // Reconnect overlay
  const [reconnecting, setReconnecting] = useState(false);
  const [missingDevice, setMissingDevice] = useState<'microphone' | 'camera' | 'both'>('both');
  const [countdown, setCountdown] = useState(10);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── TTS ───────────────────────────────────────────────────────
  const { isSpeaking, isMuted, speak, cancel: cancelTTS, toggleMute } = useTextToSpeech();

  // ── Redux ─────────────────────────────────────────────────────
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const currentQuestion = useAppSelector(selectCurrentQuestion);
  const isWaiting = useAppSelector(selectIsWaiting);
  const isAnswering = useAppSelector(selectIsAnswering);
  const pendingAnswer = useAppSelector(selectPendingAnswer);
  const proctoringWarnings = useAppSelector(selectProctoringWarnings);
  const isSessionActive = useAppSelector(selectIsSessionActive);
  const engineState = useAppSelector(selectEngineState);

  // ── Data ──────────────────────────────────────────────────────
  const { data: session, refetch: refetchSession } = useSession(sessionId || '', !!sessionId && permGranted);
  const { data: sessionStatus } = useSessionStatus(sessionId || '', !!sessionId && permGranted);
  const submitAnswer = useSubmitAnswer(sessionId || '');
  const logEvent = useLogProctoringEvent(sessionId || '');

  // ── Auto-speak when new question arrives ─────────────────────
  const prevQuestionId = useRef<string | null>(null);
  useEffect(() => {
    if (currentQuestion && currentQuestion.id !== prevQuestionId.current) {
      prevQuestionId.current = currentQuestion.id;
      // Small delay to let the card render first
      setTimeout(() => speak(currentQuestion.text), 600);
    }
  }, [currentQuestion?.id]);

  // ── Device monitor ────────────────────────────────────────────
  const triggerReconnect = useCallback((device: 'microphone' | 'camera' | 'both') => {
    if (reconnecting) return;
    setMissingDevice(device);
    setCountdown(10);
    setReconnecting(true);
  }, [reconnecting]);

  const startDeviceMonitor = useCallback(() => {
    return setInterval(() => {
      const stream = mediaStreamRef.current;
      if (!stream) return;
      const audioLive = stream.getAudioTracks().some(t => t.readyState === 'live' && t.enabled);
      const videoLive = stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled);
      if (!audioLive && !videoLive) triggerReconnect('both');
      else if (!audioLive) triggerReconnect('microphone');
      else if (!videoLive) triggerReconnect('camera');
    }, 2000);
  }, [triggerReconnect]);

  const deviceMonitorRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!reconnecting) return;
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          logEvent.mutate({ eventType: 'termination', details: { reason: `${missingDevice} disconnected — reconnect timeout` } });
          if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
          navigate(`/interview/${sessionId}/results`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [reconnecting]);

  const handleRetryDevices = async () => {
    try {
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      setLiveStream(stream);
      const audioOk = stream.getAudioTracks().some(t => t.readyState === 'live');
      const videoOk = stream.getVideoTracks().some(t => t.readyState === 'live');
      if (audioOk && videoOk) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setReconnecting(false);
        setCountdown(10);
      }
    } catch { }
  };

  useEffect(() => {
    if (!permGranted) return;
    deviceMonitorRef.current = startDeviceMonitor();
    return () => { if (deviceMonitorRef.current) clearInterval(deviceMonitorRef.current); };
  }, [permGranted, startDeviceMonitor]);

  // ── Hydrate question from REST if socket missed it ────────────
  useEffect(() => {
    if (!session || !permGranted) return;
    const questions = session.questions || [];
    const answers = session.answers || [];
    if (questions.length > 0 && !currentQuestion) {
      const answeredIds = new Set(answers.map((a: any) => a.questionId));
      const nextQ = questions.find((q: any) => !answeredIds.has(q.id));
      if (nextQ) {
        dispatch(setCurrentQuestion({
          id: nextQ.id, text: nextQ.text, type: nextQ.type,
          topic: nextQ.topic || 'general', difficulty: nextQ.difficulty || 'mid',
          expectedKeywords: nextQ.expectedKeywords || [], followUpCount: nextQ.followUpCount || 0,
          parentQuestionId: nextQ.parentQuestionId,
        }));
        dispatch(setWaitingForQuestion(false));
      }
    }
  }, [session, currentQuestion, dispatch, permGranted]);

  useEffect(() => {
    if (!sessionStatus || !permGranted) return;
    if (sessionStatus.questionsGenerated > 0 && !currentQuestion) refetchSession();
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

  useEffect(() => {
    if (session?.status === 'completed' || session?.status === 'terminated') {
      navigate(`/interview/${sessionId}/results`);
    }
  }, [session?.status, navigate, sessionId]);

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      if (deviceMonitorRef.current) clearInterval(deviceMonitorRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const questionCount = session?.questions?.length || 0;
  const answerCount = session?.answers?.length || 0;
  const progressPct = Math.min((answerCount / 10) * 100, 100);

  const onSubmitAnswer = async () => {
    if (!currentQuestion || !pendingAnswer.trim()) return;
    cancelTTS();
    dispatch(setIsAnswering(true));
    try {
      await submitAnswer.mutateAsync({ questionId: currentQuestion.id, answerText: pendingAnswer.trim() });
    } catch {
      dispatch(setIsAnswering(false));
    }
  };

  // ── Pre-session gate ──────────────────────────────────────────
  if (!permGranted) {
    return (
      <PermissionGate
        sessionRole={session?.role || 'Interview'}
        onReady={stream => {
          mediaStreamRef.current = stream;
          setLiveStream(stream);
          setPermGranted(true);
        }}
      />
    );
  }

  return (
    <>
      {reconnecting && (
        <ReconnectOverlay missingDevice={missingDevice} secondsLeft={countdown} onRetry={handleRetryDevices} />
      )}

      {/* Live camera PiP overlay */}
      <CameraOverlay stream={liveStream} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 animate-slide-down">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">{session?.role || 'AI Interview Session'}</p>
            <div className="flex items-center gap-2">
              <Badge variant={isSessionActive ? 'success' : 'ghost'} dot>
                {isSessionActive ? 'Live' : 'Loading'}
              </Badge>
              <span className="text-xs text-[var(--color-text-muted)]">{answerCount}/10 answered</span>
              <span className="text-xs text-[var(--color-text-muted)]">·</span>
              <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                <Mic size={10} /> Voice mode
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Progress</p>
            <p className="text-sm font-bold font-display text-[var(--color-text-primary)]">{Math.round(progressPct)}%</p>
          </div>
        </div>

        <div className="animate-slide-down" style={{ animationDelay: '50ms' }}>
          <ProgressBar value={progressPct} size="md" color="primary" />
        </div>

        <ProctoringBar warnings={proctoringWarnings} sessionId={sessionId || ''} />

        {/* Question / Waiting */}
        {!currentQuestion ? (
          <WaitingCard engineState={engineState} />
        ) : (
          <>
            <QuestionCard
              text={currentQuestion.text}
              type={currentQuestion.type}
              topic={currentQuestion.topic}
              index={answerCount + 1}
              isSpeaking={isSpeaking}
              isMuted={isMuted}
              onSpeak={() => speak(currentQuestion.text)}
              onStop={cancelTTS}
              onToggleMute={toggleMute}
            />
            <VoiceAnswerInput
              value={pendingAnswer}
              onChange={v => dispatch(setPendingAnswer(v))}
              onSubmit={onSubmitAnswer}
              isSubmitting={isAnswering || submitAnswer.isPending}
              disabled={isAnswering}
            />
          </>
        )}

        {isAnswering && (
          <Card className="border-emerald-500/20 bg-emerald-500/5 animate-slide-up">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-500 animate-scale-in" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Answer submitted!</p>
                <p className="text-xs text-[var(--color-text-muted)]">AI is evaluating your response and preparing the next question…</p>
              </div>
            </div>
          </Card>
        )}

        <p className="text-xs text-center text-[var(--color-text-muted)] pb-20">
          💡 Keep camera and mic connected. Questions are generated in real-time by AI.
        </p>
      </div>
    </>
  );
}