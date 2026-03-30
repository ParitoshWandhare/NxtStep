// ============================================================
// NxtStep — Router
// FIX: Removed RequireVerified gate — users go straight to dashboard after login/register.
//      verify-email is accessible when logged in but NOT enforced.
// ============================================================

import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { selectIsAuthenticated } from '@/features/auth/authSlice';
import AppLayout from '@/components/layout/AppLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import PageLoader from '@/components/ui/PageLoader';

// ── Lazy Pages ────────────────────────────────────────────────
const LandingPage         = lazy(() => import('@/pages/LandingPage'));
const LoginPage           = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage        = lazy(() => import('@/pages/auth/RegisterPage'));
const VerifyEmailPage     = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const ForgotPasswordPage  = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage   = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const DashboardPage       = lazy(() => import('@/pages/DashboardPage'));
const NewInterviewPage    = lazy(() => import('@/pages/interview/NewInterviewPage'));
const InterviewSessionPage = lazy(() => import('@/pages/interview/InterviewSessionPage'));
const InterviewResultsPage = lazy(() => import('@/pages/interview/InterviewResultsPage'));
const ScorecardsPage      = lazy(() => import('@/pages/ScorecardsPage'));
const ScorecardDetailPage = lazy(() => import('@/pages/ScorecardDetailPage'));
const NewsPage            = lazy(() => import('@/pages/NewsPage'));
const ProfilePage         = lazy(() => import('@/pages/ProfilePage'));
const NotFoundPage        = lazy(() => import('@/pages/NotFoundPage'));

// ── Guards ────────────────────────────────────────────────────
function RequireAuth() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function GuestOnly() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

// ── Suspense wrapper ──────────────────────────────────────────
function SuspenseRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// ── Router Definition ─────────────────────────────────────────
export const router = createBrowserRouter([
  // Public landing
  {
    path: '/',
    element: (
      <SuspenseRoute>
        <LandingPage />
      </SuspenseRoute>
    ),
  },

  // Guest-only auth routes
  {
    element: <GuestOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: '/login',
            element: (
              <SuspenseRoute>
                <LoginPage />
              </SuspenseRoute>
            ),
          },
          {
            path: '/register',
            element: (
              <SuspenseRoute>
                <RegisterPage />
              </SuspenseRoute>
            ),
          },
          {
            path: '/forgot-password',
            element: (
              <SuspenseRoute>
                <ForgotPasswordPage />
              </SuspenseRoute>
            ),
          },
        ],
      },
    ],
  },

  // Auth required — verify-email accessible but not enforced
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: '/verify-email',
            element: (
              <SuspenseRoute>
                <VerifyEmailPage />
              </SuspenseRoute>
            ),
          },
        ],
      },
    ],
  },

  // Password reset (public)
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/reset-password',
        element: (
          <SuspenseRoute>
            <ResetPasswordPage />
          </SuspenseRoute>
        ),
      },
    ],
  },

  // Protected app routes (auth required, NO email verification gate)
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: '/dashboard',
            element: (
              <SuspenseRoute>
                <DashboardPage />
              </SuspenseRoute>
            ),
          },
          {
            path: '/interview/new',
            element: (
              <SuspenseRoute>
                <NewInterviewPage />
              </SuspenseRoute>
            ),
          },
          {
            path: '/interview/:sessionId',
            element: (
              <SuspenseRoute>
                <InterviewSessionPage />
              </SuspenseRoute>
            ),
          },
          {
            path: '/interview/:sessionId/results',
            element: (
              <SuspenseRoute>
                <InterviewResultsPage />
              </SuspenseRoute>
            ),
          },
          {
            path: '/scores',
            element: (
              <SuspenseRoute>
                <ScorecardsPage />
              </SuspenseRoute>
            ),
          },
          {
            path: '/scores/:sessionId',
            element: (
              <SuspenseRoute>
                <ScorecardDetailPage />
              </SuspenseRoute>
            ),
          },
          {
            path: '/news',
            element: (
              <SuspenseRoute>
                <NewsPage />
              </SuspenseRoute>
            ),
          },
          {
            path: '/profile',
            element: (
              <SuspenseRoute>
                <ProfilePage />
              </SuspenseRoute>
            ),
          },
        ],
      },
    ],
  },

  // 404
  {
    path: '*',
    element: (
      <SuspenseRoute>
        <NotFoundPage />
      </SuspenseRoute>
    ),
  },
]);