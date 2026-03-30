// ============================================================
// NxtStep — Interview Session Page (Fixed)
// Fixes:
//  1. Camera preview black screen → proper stream → video ref wiring
//  2. STT stops immediately → restart loop on onend
//  3. Full-screen camera view with question overlay
//  4. Removed duplicate useState/useEffect imports (lines 48,65,83 errors)
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Loader2, CheckCircle2,
  Mic, MicOff, Camera, CameraOff, Maximize,
  Shield, ChevronRight, RefreshCw, XCircle,
  Volume2, VolumeX, StopCircle, Radio, Send,
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
// Speech Recognition Hook — with restart on silence
// ─────────────────────────────────────────────────────────────
function useSpeechRecognition({
  onTranscript,
}: {
  onTranscript: (text: string, isFinal: boolean) => void;
}) {
  const recogRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setIsSupported(true);

    const createRecognition = () => {
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'en-US';
      recog.maxAlternatives = 1;

      recog.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscriptRef.current += result[0].transcript + ' ';
          } else {
            interim = result[0].transcript;
          }
        }
        onTranscript(
          (finalTranscriptRef.current + interim).trim(),
          false
        );
      };

      recog.onend = () => {
        // Auto-restart if user hasn't explicitly stopped
        if (isListeningRef.current) {
          try {
            recog.start();
          } catch {
            // Already started, ignore
          }
        } else {
          setIsListening(false);
        }
      };

      recog.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          isListeningRef.current = false;
          setIsListening(false);
        }
        // For other errors (network, aborted), let onend handle restart
      };

      return recog;
    };

    recogRef.current = createRecognition();

    return () => {
      isListeningRef.current = false;
      recogRef.current?.abort();
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recogRef.current || isListeningRef.current) return;
    finalTranscriptRef.current = '';
    isListeningRef.current = true;
    setIsListening(true);
    try {
      recogRef.current.start();
    } catch {
      // Already started
    }
  }, []);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    recogRef.current?.stop();
  }, []);

  const clearTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
  }, []);

  return { isListening, isSupported, startListening, stopListening, clearTranscript };
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
  }, [isMuted]);

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(p => {
      if (!p) window.speechSynthesis?.cancel();
      return !p;
    });
  }, []);

  return { isSpeaking, isMuted, speak, cancel, toggleMute };
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

  // Wire stream to video element when both are ready
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
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setPermState('granted');
    } catch (err: any) {
      setPermState('denied');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera and microphone access was denied. Click the lock icon in your browser address bar, allow both, then try again.');
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

  const checkItems = [
    {
      key: 'camera',
      icon: Camera,
      iconOff: CameraOff,
      label: 'Camera',
      desc: 'Required for proctoring & visibility',
    },
    {
      key: 'microphone',
      icon: Mic,
      iconOff: MicOff,
      label: 'Microphone',
      desc: 'Required for voice answers',
    },
    {
      key: 'fullscreen',
      icon: Maximize,
      iconOff: Maximize,
      label: 'Fullscreen',
      desc: isFullscreen ? 'Active' : 'Will activate when you begin',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)] bg-mesh">
      <div className="w-full max-w-lg mx-4 animate-slide-up">
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
            {checkItems.map(item => {
              const isGranted = item.key === 'fullscreen' ? isFullscreen : permState === 'granted';
              const isDenied = permState === 'denied' && item.key !== 'fullscreen';
              const IconComp = isDenied ? item.iconOff : item.icon;

              return (
                <div key={item.key} className={cn(
                  'flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300',
                  isGranted ? 'border-emerald-500/30 bg-emerald-500/5' :
                  isDenied ? 'border-red-500/30 bg-red-500/5' :
                  'border-[var(--color-border)] bg-[var(--color-bg-elevated)]'
                )}>
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    isGranted ? 'bg-emerald-500/20 text-emerald-500' :
                    isDenied ? 'bg-red-500/20 text-red-500' :
                    'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]')}>
                    <IconComp size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.label}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{item.desc}</p>
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

          {/* Camera preview — use autoPlay + playsInline, no srcObject in JSX */}
          {permState === 'granted' && (
            <div className="relative mb-4 rounded-xl overflow-hidden bg-black aspect-video animate-fade-in">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
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
            Camera + mic required throughout. Questions read aloud; answer by voice.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Full-Screen Interview View
// ─────────────────────────────────────────────────────────────
interface FullScreenInterviewProps {
  stream: MediaStream;
  question: any;
  answerCount: number;
  isSpeaking: boolean;
  isMuted: boolean;
  onSpeak: () => void;
  onStopSpeak: () => void;
  onToggleMute: () => void;
  onSubmit: (text: string) => void;
  isSubmitting: boolean;
  proctoringWarnings: number;
  engineState: string;
  isWaiting: boolean;
  sessionRole: string;
}

function FullScreenInterview({
  stream, question, answerCount, isSpeaking, isMuted,
  onSpeak, onStopSpeak, onToggleMute, onSubmit, isSubmitting,
  proctoringWarnings, engineState, isWaiting, sessionRole,
}: FullScreenInterviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [transcript, setTranscript] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualText, setManualText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Wire camera stream to video
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Reset on new question
  useEffect(() => {
    setTranscript('');
    setManualText('');
    setSubmitted(false);
  }, [question?.id]);

  const { isListening, isSupported, startListening, stopListening, clearTranscript } =
    useSpeechRecognition({
      onTranscript: (text) => setTranscript(text),
    });

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      clearTranscript();
      setTranscript('');
      startListening();
    }
  };

  const handleSubmit = () => {
    const text = isManualMode ? manualText.trim() : transcript.trim();
    if (!text || text.length < 3) return;
    if (isListening) stopListening();
    setSubmitted(true);
    onSubmit(text);
  };

  const activeText = isManualMode ? manualText : transcript;
  const canSubmit = activeText.trim().length >= 3 && !isSubmitting && !submitted;

  const progressPct = Math.min((answerCount / 10) * 100, 100);

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      {/* ── Full-screen camera ─────────────────────────────── */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* ── Dark overlay ───────────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />

      {/* ── Top bar ────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center shadow-glow-sm">
            <span className="text-white font-display font-bold text-xs">N</span>
          </div>
          <span className="text-white/70 text-sm font-medium">{sessionRole}</span>
          <Badge variant="success" size="sm" dot>Live</Badge>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    i < answerCount ? 'bg-primary-400' : 'bg-white/20'
                  )}
                />
              ))}
            </div>
            <span className="text-white/60 text-xs">{answerCount}/10</span>
          </div>

          {/* TTS controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleMute}
              className={cn(
                'p-2 rounded-lg transition-all',
                isMuted ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-white/70 hover:bg-white/20'
              )}
              title={isMuted ? 'Unmute' : 'Mute TTS'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            {isSpeaking && (
              <button onClick={onStopSpeak} className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-all">
                <StopCircle size={16} />
              </button>
            )}
          </div>

          {/* Proctoring warning */}
          {proctoringWarnings > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
              <AlertTriangle size={14} className="text-yellow-400 animate-pulse" />
              <span className="text-yellow-300 text-xs font-medium">
                {proctoringWarnings}/5 tab switches
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Centre: Question display ────────────────────────── */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-8 py-4">
        {isWaiting || !question ? (
          <div className="text-center">
            <div className="relative mx-auto mb-4 w-16 h-16">
              <div className="w-16 h-16 rounded-2xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center backdrop-blur-sm">
                <Loader2 size={28} className="text-primary-400 animate-spin" />
              </div>
              <div className="absolute -inset-1 rounded-2xl border-2 border-primary-500/20 animate-ping" />
            </div>
            <p className="text-white/80 font-display font-medium text-lg">
              {engineState === 'EVALUATE' ? 'Evaluating your answer…' : 'Generating next question…'}
            </p>
            <p className="text-white/40 text-sm mt-1">AI is preparing your interview in real-time</p>
          </div>
        ) : (
          <div className="max-w-3xl w-full">
            {/* Question card */}
            <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-8 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-sm shadow-glow-sm">
                  Q{answerCount + 1}
                </div>
                <Badge variant="primary" size="sm">{question.type?.replace('_', ' ')}</Badge>
                <Badge variant="ghost" size="sm">{question.topic}</Badge>
                {!isMuted && (
                  <button
                    onClick={isSpeaking ? onStopSpeak : onSpeak}
                    className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-all"
                  >
                    {isSpeaking ? (
                      <>
                        <div className="flex gap-0.5 items-end">
                          {[8, 14, 10, 16, 8].map((h, i) => (
                            <span key={i} className="w-0.5 rounded-full bg-primary-400 animate-bounce"
                              style={{ height: h, animationDelay: `${i * 80}ms` }} />
                          ))}
                        </div>
                        <span>Speaking</span>
                      </>
                    ) : (
                      <>
                        <Volume2 size={12} />
                        <span>Read aloud</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className="text-white font-medium text-xl leading-relaxed">
                {question.text}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom: Answer input ────────────────────────────── */}
      <div className="relative z-10 px-6 pb-6">
        <div className="max-w-3xl mx-auto">
          {submitted ? (
            <div className="backdrop-blur-xl bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400 animate-scale-in" />
              <div>
                <p className="text-white font-medium text-sm">Answer submitted!</p>
                <p className="text-white/50 text-xs">AI is evaluating and preparing next question…</p>
              </div>
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-black/50 border border-white/10 rounded-2xl overflow-hidden">
              {/* Mode toggle */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="flex items-center gap-2">
                  {isListening && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium animate-pulse">
                      <Radio size={10} />
                      Recording
                    </span>
                  )}
                  {!isListening && !isManualMode && (
                    <span className="text-white/40 text-xs">
                      {isSupported ? 'Press mic to speak' : 'Voice not supported'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/30 text-xs">{activeText.length}/5000</span>
                  <button
                    onClick={() => {
                      setIsManualMode(m => !m);
                      if (isListening) stopListening();
                    }}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors underline-offset-2 hover:underline"
                  >
                    {isManualMode ? '🎤 Use voice' : '⌨️ Type instead'}
                  </button>
                </div>
              </div>

              {/* Transcript / text area */}
              <div className="relative min-h-[80px] px-4 py-3">
                {isManualMode ? (
                  <textarea
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSubmit) handleSubmit();
                    }}
                    placeholder="Type your answer here… (Ctrl+Enter to submit)"
                    className="w-full bg-transparent text-white placeholder:text-white/30 text-sm leading-relaxed resize-none focus:outline-none"
                    rows={3}
                    maxLength={5000}
                  />
                ) : (
                  <div className="min-h-[60px]">
                    {/* Waveform when recording */}
                    {isListening && (
                      <div className="flex items-center gap-1 mb-2 h-5">
                        {Array.from({ length: 24 }).map((_, i) => (
                          <span
                            key={i}
                            className="w-0.5 rounded-full bg-red-400/60 animate-bounce"
                            style={{
                              height: Math.random() * 16 + 4,
                              animationDelay: `${i * 40}ms`,
                              animationDuration: `${0.4 + Math.random() * 0.4}s`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {transcript ? (
                      <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
                    ) : (
                      <p className="text-white/30 text-sm italic">
                        {isListening ? 'Listening… speak your answer' : 'Press the microphone to start speaking'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 px-4 pb-4">
                {/* Mic button */}
                {!isManualMode && (
                  <button
                    onClick={handleToggleMic}
                    disabled={!isSupported || isSubmitting}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200',
                      isListening
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-[1.02] hover:bg-red-600'
                        : 'bg-white/10 border border-white/20 text-white hover:bg-white/20',
                      (!isSupported || isSubmitting) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isListening ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Mic size={16} />
                        {isSupported ? 'Record' : 'No mic'}
                      </>
                    )}
                  </button>
                )}

                {/* Clear */}
                {activeText && !isListening && (
                  <button
                    onClick={() => {
                      setTranscript('');
                      setManualText('');
                      clearTranscript();
                    }}
                    className="px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                  >
                    Clear
                  </button>
                )}

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  loading={isSubmitting}
                  size="md"
                  rightIcon={<Send size={15} />}
                  className="ml-auto bg-primary-500 hover:bg-primary-600 shadow-glow transition-all"
                >
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
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);

  const { isSpeaking, isMuted, speak, cancel: cancelTTS, toggleMute } = useTextToSpeech();

  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const currentQuestion = useAppSelector(selectCurrentQuestion);
  const isWaiting = useAppSelector(selectIsWaiting);
  const isAnswering = useAppSelector(selectIsAnswering);
  const proctoringWarnings = useAppSelector(selectProctoringWarnings);
  const isSessionActive = useAppSelector(selectIsSessionActive);
  const engineState = useAppSelector(selectEngineState);

  const { data: session, refetch: refetchSession } = useSession(sessionId || '', !!sessionId && permGranted);
  const { data: sessionStatus } = useSessionStatus(sessionId || '', !!sessionId && permGranted);
  const submitAnswerMutation = useSubmitAnswer(sessionId || '');
  const logEvent = useLogProctoringEvent(sessionId || '');

  // Proctoring: tab switch detection
  useEffect(() => {
    if (!permGranted) return;
    const onVisibility = () => {
      if (document.hidden) logEvent.mutate({ eventType: 'tab_switch' });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [permGranted]);

  // Auto-speak new question
  const prevQuestionId = useRef<string | null>(null);
  useEffect(() => {
    if (currentQuestion && currentQuestion.id !== prevQuestionId.current) {
      prevQuestionId.current = currentQuestion.id;
      setTimeout(() => speak(currentQuestion.text), 500);
    }
  }, [currentQuestion?.id]);

  // Hydrate question from REST if socket missed it
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  const answerCount = session?.answers?.length || 0;

  const handleSubmitAnswer = async (text: string) => {
    if (!currentQuestion || !text.trim()) return;
    cancelTTS();
    dispatch(setIsAnswering(true));
    try {
      await submitAnswerMutation.mutateAsync({
        questionId: currentQuestion.id,
        answerText: text.trim(),
      });
    } catch {
      dispatch(setIsAnswering(false));
    }
  };

  // Pre-session permission gate
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
      engineState={engineState}
      isWaiting={isWaiting || !currentQuestion}
      sessionRole={session?.role || 'Interview'}
    />
  );
}