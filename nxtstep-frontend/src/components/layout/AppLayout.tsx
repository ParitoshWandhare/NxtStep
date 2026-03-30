// ============================================================
// NxtStep — App Layout (authenticated shell)
// TopNav is always visible on all authenticated pages
// ============================================================

import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNavLayout';
import { useResponsive } from '@/hooks';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/interview/new': 'Start Interview',
  '/scores': 'My Scores',
  '/news': 'News Feed',
  '/profile': 'Profile',
};

function getTitle(pathname: string): string | undefined {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/interview/') && pathname.endsWith('/results')) return 'Interview Results';
  if (pathname.startsWith('/interview/')) return 'Interview Session';
  if (pathname.startsWith('/scores/')) return 'Scorecard Detail';
  return undefined;
}

export default function AppLayout() {
  const { isMobile } = useResponsive();
  const location = useLocation();
  const title = getTitle(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* ── Sidebar (desktop only) ─────────────────────────── */}
      <Sidebar />

      {/* ── Main Content ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TopNav is ALWAYS visible on all authenticated pages */}
        <TopNav title={isMobile ? title : undefined} />
        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}