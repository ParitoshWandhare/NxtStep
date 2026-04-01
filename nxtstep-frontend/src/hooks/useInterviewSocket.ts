// ============================================================
// NxtStep — useInterviewSocket Hook (Fixed v5)
// Fix: Added setIsAnswering(false) in question:ready handler.
// Previously isAnswering stayed true after submitting, so even
// when the next question arrived the UI stayed on "Evaluating".
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAppDispatch } from '@/app/hooks';
import {
  setCurrentQuestion,
  addEvaluationResult,
  setWaitingForQuestion,
  setIsAnswering,
  endSession,
} from '@/features/interview/interviewSlice';
import type {
  SocketQuestionReadyPayload,
  SocketEvaluationCompletePayload,
  SocketScorecardReadyPayload,
  Question,
  EvaluationResult,
} from '@/types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface UseInterviewSocketOptions {
  sessionId: string | null;
  token: string | null;
  onScorecardReady?: (scorecard: SocketScorecardReadyPayload) => void;
  onRecommendationsReady?: () => void;
  onTerminated?: (reason: string) => void;
}

export function useInterviewSocket({
  sessionId,
  token,
  onScorecardReady,
  onRecommendationsReady,
  onTerminated,
}: UseInterviewSocketOptions) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef(false);

  // Keep callbacks in refs so they don't cause re-connects on re-render
  const onScorecardReadyRef = useRef(onScorecardReady);
  const onRecommendationsReadyRef = useRef(onRecommendationsReady);
  const onTerminatedRef = useRef(onTerminated);
  onScorecardReadyRef.current = onScorecardReady;
  onRecommendationsReadyRef.current = onRecommendationsReady;
  onTerminatedRef.current = onTerminated;

  useEffect(() => {
    if (!sessionId || !token) return;

    console.log('[Socket] Connecting for session:', sessionId);

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;
    joinedRef.current = false;

    const joinSession = () => {
      if (!joinedRef.current && sessionId) {
        socket.emit('join:session', sessionId);
        joinedRef.current = true;
        console.log('[Socket] Joined session room:', sessionId);
      }
    };

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      joinSession();
    });

    socket.on('reconnect', () => {
      console.log('[Socket] Reconnected — rejoining session room');
      joinedRef.current = false;
      joinSession();
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    // ── question:ready ──────────────────────────────────────
    // KEY FIX: dispatch setIsAnswering(false) here so the UI
    // transitions out of the "Evaluating..." waiting state
    // as soon as the next question is available.
    socket.on('question:ready', (payload: SocketQuestionReadyPayload) => {
      console.log('[Socket] question:ready received:', payload.id);
      const question: Question = {
        id: payload.id,
        text: payload.text,
        type: payload.type,
        topic: payload.topic,
        difficulty: payload.difficulty,
        expectedKeywords: payload.expectedKeywords || [],
        followUpCount: payload.followUpCount || 0,
        parentQuestionId: payload.parentQuestionId,
      };
      dispatch(setCurrentQuestion(question));
      dispatch(setWaitingForQuestion(false));
      dispatch(setIsAnswering(false)); // ← THE FIX: clear answering state
    });

    // ── evaluation:complete ─────────────────────────────────
    socket.on('evaluation:complete', (payload: SocketEvaluationCompletePayload) => {
      console.log('[Socket] evaluation:complete received for:', payload.questionId);
      const result: EvaluationResult = {
        questionId: payload.questionId,
        scores: payload.scores,
        overall: payload.overall,
        feedback: {
          strengths: payload.feedback?.strengths || [],
          weaknesses: payload.feedback?.weaknesses || [],
          improvements: payload.feedback?.improvements || [],
        },
      };
      dispatch(addEvaluationResult(result));
      // Keep isWaitingForQuestion = true here — the next question
      // hasn't arrived yet. setIsAnswering(false) will be dispatched
      // when question:ready fires.
      dispatch(setWaitingForQuestion(true));
    });

    // ── scorecard:ready ─────────────────────────────────────
    socket.on('scorecard:ready', (scorecard: SocketScorecardReadyPayload) => {
      console.log('[Socket] scorecard:ready received');
      dispatch(endSession());
      onScorecardReadyRef.current?.(scorecard);
      toast.success('Your scorecard is ready!');
    });

    // ── recommendations:ready ───────────────────────────────
    socket.on('recommendations:ready', () => {
      console.log('[Socket] recommendations:ready received');
      onRecommendationsReadyRef.current?.();
    });

    // ── session:terminated ──────────────────────────────────
    socket.on('session:terminated', ({ reason }: { reason: string }) => {
      console.log('[Socket] session:terminated:', reason);
      dispatch(endSession());
      onTerminatedRef.current?.(reason);
      toast.error(`Session ended: ${reason}`);
      navigate(`/interview/${sessionId}/results`);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      joinedRef.current = false;
    });

    return () => {
      console.log('[Socket] Cleaning up for session:', sessionId);
      if (socket.connected) {
        socket.emit('leave:session', sessionId);
      }
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current = false;
    };
  }, [sessionId, token, dispatch, navigate]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (socketRef.current.connected) {
        socketRef.current.emit('leave:session', sessionId);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [sessionId]);

  return { socket: socketRef.current, disconnect };
}