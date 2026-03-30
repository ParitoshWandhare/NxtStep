// ============================================================
// NxtStep — Router (Updated)
// ADDED: /about and /contact routes resolved inside LandingPage
// ============================================================

import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { selectIsAuthenticated } from '@/features/auth/authSlice';
import AppLayout from '@/components/layout/AppLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import PageLoader from '@/components/ui/PageLoader';

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

function SuspenseRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  // Public landing + About + Contact (all rendered inside LandingPage shell)
  {
    path: '/',
    element: <SuspenseRoute><LandingPage /></SuspenseRoute>,
  },
  {
    path: '/about',
    element: <SuspenseRoute><LandingPage /></SuspenseRoute>,
  },
  {
    path: '/contact',
    element: <SuspenseRoute><LandingPage /></SuspenseRoute>,
  },

  // Guest-only auth
  {
    element: <GuestOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <SuspenseRoute><LoginPage /></SuspenseRoute> },
          { path: '/register', element: <SuspenseRoute><RegisterPage /></SuspenseRoute> },
          { path: '/forgot-password', element: <SuspenseRoute><ForgotPasswordPage /></SuspenseRoute> },
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
          { path: '/verify-email', element: <SuspenseRoute><VerifyEmailPage /></SuspenseRoute> },
        ],
      },
    ],
  },

  // Password reset (public)
  {
    element: <AuthLayout />,
    children: [
      { path: '/reset-password', element: <SuspenseRoute><ResetPasswordPage /></SuspenseRoute> },
    ],
  },

  // Protected app routes
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <SuspenseRoute><DashboardPage /></SuspenseRoute> },
          { path: '/interview/new', element: <SuspenseRoute><NewInterviewPage /></SuspenseRoute> },
          { path: '/interview/:sessionId', element: <SuspenseRoute><InterviewSessionPage /></SuspenseRoute> },
          { path: '/interview/:sessionId/results', element: <SuspenseRoute><InterviewResultsPage /></SuspenseRoute> },
          { path: '/scores', element: <SuspenseRoute><ScorecardsPage /></SuspenseRoute> },
          { path: '/scores/:sessionId', element: <SuspenseRoute><ScorecardDetailPage /></SuspenseRoute> },
          { path: '/news', element: <SuspenseRoute><NewsPage /></SuspenseRoute> },
          { path: '/profile', element: <SuspenseRoute><ProfilePage /></SuspenseRoute> },
        ],
      },
    ],
  },

  // 404
  { path: '*', element: <SuspenseRoute><NotFoundPage /></SuspenseRoute> },
]);