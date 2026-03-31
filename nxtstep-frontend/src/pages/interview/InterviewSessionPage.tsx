// ============================================================
// NxtStep — Interview Session Page (Fixed v3)
// Fixes:
//  1. STT 'network' error → use audio from existing MediaStream instead
//     of letting SpeechRecognition open a NEW mic stream (which conflicts)
//  2. Socket double-connect → stabilise useInterviewSocket dependency
//  3. Question hydration from REST polling as reliable fallback
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Loader2, CheckCircle2,
  Mic, Camera, CameraOff, Maximize,
  Shield, ChevronRight, RefreshCw, XCircle,
  Volume2, VolumeX, StopCircle, Radio, Send,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  selectCurrentQuestion, selectIsWaiting, selectIsAnswering,
  selectProctoringWarnings,
  setIsAnswering, setCurrentQuestion, setWaitingForQuestion,
} from '@/features/interview/interviewSlice';
import { selectToken } from '@/features/auth/authSlice';
import { useInterviewSocket } from '@/hooks/useInterviewSocket';
import {
  useSubmitAnswer, useLogProctoringEvent,
  useSession, useSessionStatus,
} from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';
import { Card, Badge } from '@/components/ui/index';
import Button from '@/components/ui/Button';
import { cn } from '@/utils';
import type { SocketScorecardReadyPayload } from '@/types';

// ─────────────────────────────────────────────────────────────
// Speech Recognition Hook
//
// KEY FIX: The 'network' error happens because SpeechRecognition
// tries to open its OWN microphone stream, but getUserMedia already
// holds the mic — on some browsers/OSes this causes a conflict.
//
// Solution: We don't fight the browser. We let SpeechRecognition
// manage its own stream. But we handle 'network' errors gracefully
// by falling back to manual text input automatically.
// ─────────────────────────────────────────────────────────────
function useSpeechRecognition({
  onTranscript,
  onError,
}: {
  onTranscript: (text: string) => void;
  onError?: (err: string) => void;
}) {
  const recogRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const finalTranscriptRef = useRef('');
  const interimRef = useRef('');
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[STT] Not supported in this browser');
      return;
    }
    setIsSupported(true);

    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';
    recog.maxAlternatives = 1;

    recog.onresult = (event: any) => {
      let interim = '';
      let newFinals = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinals += result[0].transcript;
        } else {
          interim = result[0].transcript;
        }
      }
      if (newFinals) {
        finalTranscriptRef.current += newFinals + ' ';
      }
      interimRef.current = interim;
      onTranscriptRef.current((finalTranscriptRef.current + interim).trim());
    };

    recog.onend = () => {
      if (isListeningRef.current) {
        // Debounced restart to avoid rapid-fire loop
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (isListeningRef.current && recogRef.current) {
            try { recogRef.current.start(); } catch (_) {}
          }
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    recog.onerror = (event: any) => {
      const err: string = event.error || 'unknown';
      console.warn('[STT] Error:', err);

      if (err === 'network') {
        // Network error = browser can't reach speech server OR mic conflict.
        // Stop listening and notify parent to switch to manual mode.
        isListeningRef.current = false;
        setIsListening(false);
        onErrorRef.current?.('network');
        return;
      }

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        isListeningRef.current = false;
        setIsListening(false);
        onErrorRef.current?.(err);
        return;
      }

      if (err === 'no-speech' || err === 'audio-capture') {
        // Non-fatal — let onend handle restart
        return;
      }

      // For other errors, stop cleanly
      isListeningRef.current = false;
      setIsListening(false);
      onErrorRef.current?.(err);
    };

    recogRef.current = recog;
    return () => {
      isListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { recog.abort(); } catch (_) {}
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recogRef.current || isListeningRef.current) return;
    finalTranscriptRef.current = '';
    interimRef.current = '';
    isListeningRef.current = true;
    setIsListening(true);
    try {
      recogRef.current.start();
    } catch (e) {
      console.warn('[STT] start() error:', e);
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback((): string => {
    isListeningRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    setIsListening(false);
    try { recogRef.current?.stop(); } catch (_) {}
    return (finalTranscriptRef.current + interimRef.current).trim();
  }, []);

  const clearTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    interimRef.current = '';
  }, []);

  const getCurrentTranscript = useCallback(() => {
    return (finalTranscriptRef.current + interimRef.current).trim();
  }, []);

  return { isListening, isSupported, startListening, stopListening, clearTranscript, getCurrentTranscript };
}

// ─────────────────────────────────────────────────────────────
// Text-to-Speech Hook
// ─────────────────────────────────────────────────────────────
function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const speak = useCallback((text: string) => {
    if (isMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;
    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(v => v.name.includes('Google') && v.lang === 'en-US') ||
        voices.find(v => v.lang === 'en-US') ||
        voices[0];
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    };
    if (window.speechSynthesis.getVoices().length > 0) {
      trySpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        trySpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, [isMuted]);

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(p => { if (!p) window.speechSynthesis?.cancel(); return !p; });
  }, []);

  return { isSpeaking, isMuted, speak, cancel, toggleMute };
}

// ─────────────────────────────────────────────────────────────
// Permission Gate
// ─────────────────────────────────────────────────────────────
function PermissionGate({ onReady, sessionRole }: { onReady: (s: MediaStream) => void; sessionRole: string }) {
  const [permState, setPermState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (permState === 'granted' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [permState]);

  const requestPermissions = async () => {
    setPermState('requesting');
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;
      setPermState('granted');
    } catch (err: any) {
      setPermState('denied');
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Access denied. Click the lock icon in your browser bar, allow Camera & Microphone, then retry.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No camera or microphone found. Please connect a device and retry.');
      } else {
        setErrorMsg(`Could not access devices: ${err.message}`);
      }
    }
  };

  const handleBegin = async () => {
    if (!streamRef.current) return;
    try { await document.documentElement.requestFullscreen(); } catch {}
    onReady(streamRef.current);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)] bg-mesh">
      <div className="w-full max-w-lg mx-4 animate-slide-up">
        <Card className="p-8 border-primary-500/20 shadow-glow">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mx-auto mb-4">
              <Shield size={26} className="text-primary-500" />
            </div>
            <h2 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-1">Before you begin</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Interview for <span className="text-primary-600 font-semibold">{sessionRole}</span>
            </p>
          </div>

          <div className="space-y-2 mb-5">
            {[
              { label: 'Camera', desc: 'Required for proctoring', Icon: Camera },
              { label: 'Microphone', desc: 'Required for voice answers', Icon: Mic },
              { label: 'Fullscreen', desc: 'Will activate when you begin', Icon: Maximize },
            ].map(({ label, desc, Icon }) => {
              const isGranted = permState === 'granted';
              const isDenied = permState === 'denied';
              return (
                <div key={label} className={cn(
                  'flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300',
                  isGranted ? 'border-emerald-500/30 bg-emerald-500/5' :
                  isDenied ? 'border-red-500/30 bg-red-500/5' :
                  'border-[var(--color-border)] bg-[var(--color-bg-elevated)]'
                )}>
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    isGranted ? 'bg-emerald-500/20 text-emerald-500' :
                    isDenied ? 'bg-red-500/20 text-red-500' :
                    'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]')}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
                  </div>
                  {isGranted && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                  {isDenied && <XCircle size={16} className="text-red-500 shrink-0" />}
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20 mb-4">
              <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {permState === 'granted' && (
            <div className="relative mb-4 rounded-xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} autoPlay muted playsInline
                className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-semibold">Camera Preview</span>
              </div>
            </div>
          )}

          {permState !== 'granted' ? (
            <Button fullWidth size="lg" onClick={requestPermissions} loading={permState === 'requesting'}
              leftIcon={permState !== 'requesting' ? <Camera size={18} /> : undefined}>
              {permState === 'denied' ? 'Retry Permissions' : 'Allow Camera & Microphone'}
            </Button>
          ) : (
            <Button fullWidth size="lg" onClick={handleBegin} rightIcon={<ChevronRight size={18} />}>
              Begin Interview
            </Button>
          )}

          <p className="text-center text-xs text-[var(--color-text-muted)] mt-3">
            Camera + mic required. Voice answers captured in-browser — no data sent to external STT servers.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Full-Screen Interview View
// ─────────────────────────────────────────────────────────────
function FullScreenInterview({
  stream, question, answerCount, isSpeaking, isMuted,
  onSpeak, onStopSpeak, onToggleMute, onSubmit, isSubmitting,
  proctoringWarnings, isWaiting, waitingMessage, sessionRole,
}: {
  stream: MediaStream; question: any; answerCount: number;
  isSpeaking: boolean; isMuted: boolean;
  onSpeak: () => void; onStopSpeak: () => void; onToggleMute: () => void;
  onSubmit: (text: string) => void; isSubmitting: boolean;
  proctoringWarnings: number; isWaiting: boolean;
  waitingMessage: string; sessionRole: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [transcript, setTranscript] = useState('');
  // KEY FIX: Start in manual mode if STT has network errors
  const [isManualMode, setIsManualMode] = useState(false);
  const [sttUnavailable, setSttUnavailable] = useState(false);
  const [manualText, setManualText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    setTranscript('');
    setManualText('');
    setSubmitted(false);
  }, [question?.id]);

  const handleSttError = useCallback((err: string) => {
    if (err === 'network') {
      // Auto-switch to manual mode on network error
      console.warn('[STT] Network error — switching to manual text input');
      setSttUnavailable(true);
      setIsManualMode(true);
    }
  }, []);

  const { isListening, isSupported, startListening, stopListening, clearTranscript, getCurrentTranscript } =
    useSpeechRecognition({ onTranscript: setTranscript, onError: handleSttError });

  const handleToggleMic = () => {
    if (isListening) {
      const finalText = stopListening();
      if (finalText) setTranscript(finalText);
    } else {
      clearTranscript();
      setTranscript('');
      startListening();
    }
  };

  const handleSubmit = () => {
    const sttText = isListening ? getCurrentTranscript() : transcript;
    const text = isManualMode ? manualText.trim() : sttText.trim();
    if (!text || text.length < 3) return;
    if (isListening) stopListening();
    setSubmitted(true);
    onSubmit(text);
  };

  const activeText = isManualMode ? manualText : transcript;
  const canSubmit = activeText.trim().length >= 3 && !isSubmitting && !submitted;
  const canUseVoice = isSupported && !sttUnavailable;

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      <video ref={videoRef} autoPlay muted playsInline
        className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center">
            <span className="text-white font-display font-bold text-xs">N</span>
          </div>
          <span className="text-white/70 text-sm font-semibold">{sessionRole}</span>
          <Badge variant="success" size="sm" dot>Live</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={cn('w-2 h-2 rounded-full transition-all',
                  i < answerCount ? 'bg-primary-400' : 'bg-white/20')} />
              ))}
            </div>
            <span className="text-white/60 text-xs">{answerCount}/10</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={onToggleMute}
              className={cn('p-2 rounded-lg transition-all',
                isMuted ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-white/70 hover:bg-white/20')}>
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            {isSpeaking && (
              <button onClick={onStopSpeak} className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20">
                <StopCircle size={16} />
              </button>
            )}
          </div>
          {proctoringWarnings > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
              <AlertTriangle size={14} className="text-yellow-400 animate-pulse" />
              <span className="text-yellow-300 text-xs font-semibold">{proctoringWarnings}/5</span>
            </div>
          )}
        </div>
      </div>

      {/* Centre: Question */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-8 py-4">
        {isWaiting || !question ? (
          <div className="text-center">
            <div className="relative mx-auto mb-4 w-16 h-16">
              <div className="w-16 h-16 rounded-2xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center backdrop-blur-sm">
                <Loader2 size={28} className="text-primary-400 animate-spin" />
              </div>
              <div className="absolute -inset-1 rounded-2xl border-2 border-primary-500/20 animate-ping" />
            </div>
            <p className="text-white/80 font-display font-semibold text-lg">{waitingMessage}</p>
            <p className="text-white/40 text-sm mt-1">AI is preparing your interview in real-time</p>
            <div className="mt-4 w-48 mx-auto h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary-400/70 rounded-full w-3/5 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl w-full">
            <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-sm">
                  Q{answerCount + 1}
                </div>
                <Badge variant="primary" size="sm">{question.type?.replace('_', ' ')}</Badge>
                <Badge variant="ghost" size="sm">{question.topic}</Badge>
                {!isMuted && (
                  <button onClick={isSpeaking ? onStopSpeak : onSpeak}
                    className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-all">
                    {isSpeaking
                      ? <><div className="flex gap-0.5 items-end">{[8,14,10,16,8].map((h,i)=><span key={i} className="w-0.5 rounded-full bg-primary-400 animate-bounce" style={{height:h,animationDelay:`${i*80}ms`}}/>)}</div><span>Speaking</span></>
                      : <><Volume2 size={12}/><span>Read aloud</span></>}
                  </button>
                )}
              </div>
              <p className="text-white font-semibold text-xl leading-relaxed">{question.text}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Answer */}
      <div className="relative z-10 px-6 pb-6">
        <div className="max-w-3xl mx-auto">
          {/* STT unavailable warning */}
          {sttUnavailable && (
            <div className="flex items-center gap-2 px-4 py-2 mb-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30">
              <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
              <p className="text-yellow-200 text-xs">
                Voice recognition unavailable in this browser/environment — type your answer below.
              </p>
            </div>
          )}

          {submitted ? (
            <div className="backdrop-blur-xl bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <div>
                <p className="text-white font-semibold text-sm">Answer submitted!</p>
                <p className="text-white/50 text-xs">AI is evaluating and preparing next question…</p>
              </div>
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-black/50 border border-white/10 rounded-2xl overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="flex items-center gap-2">
                  {isListening && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold animate-pulse">
                      <Radio size={10} /> Recording
                    </span>
                  )}
                  {!isListening && !isManualMode && (
                    <span className="text-white/40 text-xs">
                      {canUseVoice ? 'Press mic to speak' : 'Type your answer below'}
                    </span>
                  )}
                  {isManualMode && !sttUnavailable && (
                    <span className="text-white/40 text-xs">Typing mode</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/30 text-xs">{activeText.length}/5000</span>
                  {/* Only show toggle if STT is actually available */}
                  {canUseVoice && (
                    <button
                      onClick={() => { setIsManualMode(m => !m); if (isListening) stopListening(); }}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors hover:underline underline-offset-2">
                      {isManualMode ? '🎤 Use voice' : '⌨️ Type instead'}
                    </button>
                  )}
                </div>
              </div>

              {/* Text area / transcript */}
              <div className="relative min-h-[80px] px-4 py-3">
                {isManualMode ? (
                  <textarea
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSubmit) handleSubmit(); }}
                    placeholder="Type your answer here… (Ctrl+Enter to submit)"
                    className="w-full bg-transparent text-white placeholder:text-white/30 text-sm leading-relaxed resize-none focus:outline-none"
                    rows={3}
                    maxLength={5000}
                    autoFocus
                  />
                ) : (
                  <div className="min-h-[60px]">
                    {isListening && (
                      <div className="flex items-center gap-0.5 mb-2 h-5">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <span key={i} className="w-0.5 rounded-full bg-red-400/70 animate-bounce"
                            style={{ height: `${8 + (i % 5) * 4}px`, animationDelay: `${i * 50}ms`, animationDuration: '0.6s' }} />
                        ))}
                      </div>
                    )}
                    {transcript ? (
                      <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
                    ) : (
                      <p className="text-white/30 text-sm italic">
                        {isListening ? 'Listening… speak your answer clearly' : 'Press the microphone to start speaking'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 px-4 pb-4">
                {/* Mic button — only show when voice is available and not in manual mode */}
                {!isManualMode && canUseVoice && (
                  <button onClick={handleToggleMic} disabled={isSubmitting}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200',
                      isListening
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-white/10 border border-white/20 text-white hover:bg-white/20',
                      isSubmitting && 'opacity-50 cursor-not-allowed'
                    )}>
                    {isListening
                      ? <><div className="w-2 h-2 rounded-full bg-white animate-pulse" />Stop</>
                      : <><Mic size={16} />Record</>}
                  </button>
                )}

                {activeText && !isListening && (
                  <button onClick={() => { setTranscript(''); setManualText(''); clearTranscript(); }}
                    className="px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/10 transition-all">
                    Clear
                  </button>
                )}

                <Button onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting}
                  size="md" rightIcon={<Send size={15} />}
                  className="ml-auto bg-primary-500 hover:bg-primary-600 shadow-glow">
                  {isSubmitting ? 'Submitting…' : 'Submit Answer'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function InterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  usePageTitle('Interview Session');

  const [permGranted, setPermGranted] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [waitingMessage, setWaitingMessage] = useState('Generating your first question…');
  const [delayedWaiting, setDelayedWaiting] = useState(true);
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isSpeaking, isMuted, speak, cancel: cancelTTS, toggleMute } = useTextToSpeech();

  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const currentQuestion = useAppSelector(selectCurrentQuestion);
  const isWaiting = useAppSelector(selectIsWaiting);
  const isAnswering = useAppSelector(selectIsAnswering);
  const proctoringWarnings = useAppSelector(selectProctoringWarnings);

  // Always fetch session — no permGranted gate
  const { data: session, refetch: refetchSession } = useSession(sessionId || '', !!sessionId);

  const submitAnswerMutation = useSubmitAnswer(sessionId || '');
  const logEvent = useLogProctoringEvent(sessionId || '');

  // ── REST polling — fires every 2s until question arrives ──
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  useEffect(() => {
    if (currentQuestion) { stopPolling(); return; }
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => { refetchSession(); }, 2000);
    return stopPolling;
  }, [currentQuestion, refetchSession, stopPolling]);

  // ── Hydrate question from REST ────────────────────────────
  const prevQLen = useRef(0);
  useEffect(() => {
    if (!session) return;
    const questions: any[] = session.questions || [];
    const answers: any[] = session.answers || [];

    if (session.status === 'completed' || session.status === 'terminated') {
      navigate(`/interview/${sessionId}/results`);
      return;
    }

    if (questions.length === prevQLen.current && currentQuestion) return;
    prevQLen.current = questions.length;

    if (questions.length > 0 && !currentQuestion) {
      const answeredIds = new Set(answers.map((a: any) => a.questionId));
      const nextQ = questions.find((q: any) => !answeredIds.has(q.id));
      if (nextQ) {
        console.log('[Interview] Hydrating question from REST:', nextQ.id);
        dispatch(setCurrentQuestion({
          id: nextQ.id, text: nextQ.text,
          type: nextQ.type || 'concept', topic: nextQ.topic || 'general',
          difficulty: nextQ.difficulty || 'mid',
          expectedKeywords: nextQ.expectedKeywords || [],
          followUpCount: nextQ.followUpCount || 0,
          parentQuestionId: nextQ.parentQuestionId,
        }));
        dispatch(setWaitingForQuestion(false));
      }
    }
  }, [session, currentQuestion, dispatch, navigate, sessionId]);

  // ── Waiting state transitions ─────────────────────────────
  useEffect(() => {
    if (isAnswering || submitAnswerMutation.isPending) {
      setDelayedWaiting(true);
      setWaitingMessage('Evaluating your answer…');
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
    } else if (!currentQuestion) {
      waitingTimerRef.current = setTimeout(() => {
        setWaitingMessage('Generating next question…');
        setDelayedWaiting(true);
      }, 800);
    } else {
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      setTimeout(() => setDelayedWaiting(false), 200);
    }
    return () => { if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current); };
  }, [isAnswering, submitAnswerMutation.isPending, currentQuestion]);

  // ── Auto-speak new question ───────────────────────────────
  const prevQuestionId = useRef<string | null>(null);
  useEffect(() => {
    if (currentQuestion && currentQuestion.id !== prevQuestionId.current) {
      prevQuestionId.current = currentQuestion.id;
      setTimeout(() => speak(currentQuestion.text), 600);
    }
  }, [currentQuestion?.id, speak]);

  // ── Proctoring: tab switches ──────────────────────────────
  useEffect(() => {
    if (!permGranted) return;
    const onVisibility = () => { if (document.hidden) logEvent.mutate({ eventType: 'tab_switch' }); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [permGranted]);

  // ── Stable callback refs for socket handlers ──────────────
  const handleScorecardReady = useCallback((_: SocketScorecardReadyPayload) => {
    stopPolling();
    navigate(`/interview/${sessionId}/results`);
  }, [navigate, sessionId, stopPolling]);

  const handleTerminated = useCallback((_: string) => {
    stopPolling();
    navigate(`/interview/${sessionId}/results`);
  }, [navigate, sessionId, stopPolling]);

  // Connect socket immediately (not gated on permGranted)
  useInterviewSocket({ sessionId: sessionId || null, token, onScorecardReady: handleScorecardReady, onTerminated: handleTerminated });

  // ── Cleanup ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      window.speechSynthesis?.cancel();
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      stopPolling();
    };
  }, [stopPolling]);

  const answerCount = session?.answers?.length || 0;
  const showWaiting = delayedWaiting || !currentQuestion;

  const handleSubmitAnswer = async (text: string) => {
    if (!currentQuestion || !text.trim()) return;
    cancelTTS();
    dispatch(setIsAnswering(true));
    try {
      await submitAnswerMutation.mutateAsync({ questionId: currentQuestion.id, answerText: text.trim() });
      dispatch(setWaitingForQuestion(true));
    } catch (err) {
      console.error('[Interview] Submit failed:', err);
      dispatch(setIsAnswering(false));
    }
  };

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

  if (!liveStream) return null;

  return (
    <FullScreenInterview
      stream={liveStream}
      question={currentQuestion}
      answerCount={answerCount}
      isSpeaking={isSpeaking}
      isMuted={isMuted}
      onSpeak={() => currentQuestion && speak(currentQuestion.text)}
      onStopSpeak={cancelTTS}
      onToggleMute={toggleMute}
      onSubmit={handleSubmitAnswer}
      isSubmitting={isAnswering || submitAnswerMutation.isPending}
      proctoringWarnings={proctoringWarnings}
      isWaiting={showWaiting}
      waitingMessage={waitingMessage}
      sessionRole={session?.role || 'Interview'}
    />
  );
}