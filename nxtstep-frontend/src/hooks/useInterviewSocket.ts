// ============================================================
// NxtStep — useInterviewSocket Hook
// Manages Socket.IO connection & dispatches Redux events
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAppDispatch } from '@/app/hooks';
import {
  setCurrentQuestion,
  addEvaluationResult,
  setWaitingForQuestion,
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

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

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

  const connect = useCallback(() => {
    if (!sessionId || !token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:session', sessionId);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    // ── question:ready ────────────────────────────────────────
    socket.on('question:ready', (payload: SocketQuestionReadyPayload) => {
      const question: Question = {
        id: payload.id,
        text: payload.text,
        type: payload.type,
        topic: payload.topic,
        difficulty: payload.difficulty,
        expectedKeywords: payload.expectedKeywords,
        followUpCount: payload.followUpCount,
        parentQuestionId: payload.parentQuestionId,
      };
      dispatch(setCurrentQuestion(question));
    });

    // ── evaluation:complete ───────────────────────────────────
    socket.on('evaluation:complete', (payload: SocketEvaluationCompletePayload) => {
      const result: EvaluationResult = {
        questionId: payload.questionId,
        scores: payload.scores,
        overall: payload.overall,
        feedback: {
          strengths: payload.feedback.strengths,
          weaknesses: payload.feedback.weaknesses,
          improvements: payload.feedback.improvements || [],
        },
      };
      dispatch(addEvaluationResult(result));
      dispatch(setWaitingForQuestion(true));
    });

    // ── scorecard:ready ───────────────────────────────────────
    socket.on('scorecard:ready', (scorecard: SocketScorecardReadyPayload) => {
      dispatch(endSession());
      onScorecardReady?.(scorecard);
      toast.success('Your scorecard is ready!');
    });

    // ── recommendations:ready ─────────────────────────────────
    socket.on('recommendations:ready', () => {
      onRecommendationsReady?.();
    });

    // ── session:terminated ────────────────────────────────────
    socket.on('session:terminated', ({ reason }: { reason: string }) => {
      dispatch(endSession());
      onTerminated?.(reason);
      toast.error(`Session ended: ${reason}`);
      navigate(`/interview/${sessionId}/results`);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    return socket;
  }, [sessionId, token, dispatch, navigate, onScorecardReady, onRecommendationsReady, onTerminated]);

  useEffect(() => {
    const socket = connect();
    return () => {
      if (socket) {
        socket.emit('leave:session', sessionId);
        socket.disconnect();
      }
    };
  }, [connect, sessionId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('leave:session', sessionId);
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [sessionId]);

  return { socket: socketRef.current, disconnect };
}