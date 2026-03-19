// ============================================================
// NxtStep — Sidebar Navigation
// ============================================================

import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, BarChart3, Newspaper,
  User, LogOut, ChevronRight, X, Zap,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectSidebarOpen, setSidebarOpen } from '@/features/ui/uiSlice';
import { useLogout } from '@/hooks/useApi';
import { useResponsive } from '@/hooks';
import { selectCurrentUser } from '@/features/auth/authSlice';
import Button from '../ui/Button';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/interview/new', icon: Zap, label: 'Start Interview' },
  { to: '/scores', icon: BarChart3, label: 'My Scores' },
  { to: '/news', icon: Newspaper, label: 'News Feed' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function Sidebar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isOpen = useAppSelector(selectSidebarOpen);
  const { isMobile } = useResponsive();
  const user = useAppSelector(selectCurrentUser);
  const handleLogout = useLogout();

  const close = () => dispatch(setSidebarOpen(false));

  const onLogout = () => {
    close();
    handleLogout();
    navigate('/login');
  };

  return (
    <>
      {/* ── Mobile Backdrop ─────────────────────────────────── */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar Panel ───────────────────────────────────── */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 w-64 flex flex-col',
          'bg-[var(--color-bg-card)] border-r border-[var(--color-border)]',
          'transition-transform duration-300 ease-spring',
          isMobile
            ? isOpen
              ? 'translate-x-0'
              : '-translate-x-full'
            : 'translate-x-0',
          'lg:relative lg:translate-x-0 lg:z-auto'
        )}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <NavLink to="/dashboard" className="flex items-center gap-2.5" onClick={close}>
            <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center shadow-glow-sm">
              <span className="text-white font-display font-bold text-sm">N</span>
            </div>
            <span className="font-display font-bold text-base text-[var(--color-text-primary)]">
              NxtStep
            </span>
          </NavLink>
          {isMobile && (
            <button
              onClick={close}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── Navigation ──────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={close}
              className={({ isActive }) =>
                cn(
                  'nav-link group',
                  isActive && 'nav-link-active'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    className={cn(
                      'shrink-0 transition-colors',
                      isActive
                        ? 'text-primary-500 dark:text-primary-400'
                        : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]'
                    )}
                  />
                  <span className="flex-1">{label}</span>
                  {isActive && (
                    <ChevronRight
                      size={14}
                      className="text-primary-500 dark:text-primary-400 opacity-60"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── User Footer ─────────────────────────────────────── */}
        <div className="border-t border-[var(--color-border)] p-3 space-y-1">
          {/* User info */}
          <NavLink
            to="/profile"
            onClick={close}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500 font-semibold text-sm shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] truncate">
                {user?.email || ''}
              </p>
            </div>
          </NavLink>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="nav-link w-full text-red-500 hover:bg-red-500/10 hover:text-red-500"
          >
            <LogOut size={18} className="shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}