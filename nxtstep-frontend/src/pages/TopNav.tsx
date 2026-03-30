// ============================================================
// NxtStep — Top Navigation Header (Global)
// ============================================================

import { Menu, Sun, Moon, Zap, LayoutDashboard, BarChart3, Newspaper, User, LogOut } from 'lucide-react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { toggleSidebar } from '@/features/ui/uiSlice';
import { useTheme, useResponsive } from '@/hooks';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { useLogout } from '@/hooks/useApi';
import { cn } from '@/utils';

interface TopNavProps {
  title?: string;
}

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/interview/new', icon: Zap, label: 'Interview' },
  { to: '/scores', icon: BarChart3, label: 'Scores' },
  { to: '/news', icon: Newspaper, label: 'News' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function TopNav({ title }: TopNavProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const { isMobile } = useResponsive();
  const user = useAppSelector(selectCurrentUser);
  const handleLogout = useLogout();

  const onLogout = () => {
    handleLogout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 h-14 bg-[var(--color-bg)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
      {/* ── Mobile menu toggle ────────────────────────────── */}
      {isMobile && (
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="p-2 rounded-xl hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* ── Logo (always visible) ─────────────────────────── */}
      <Link to="/dashboard" className="flex items-center gap-2 group shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all duration-300 group-hover:scale-110">
          <span className="text-white font-display font-bold text-xs">N</span>
        </div>
        {!isMobile && (
          <span className="font-display font-bold text-sm text-[var(--color-text-primary)] group-hover:text-primary-500 transition-colors duration-200">
            NxtStep
          </span>
        )}
      </Link>

      {/* ── Desktop nav links ─────────────────────────────── */}
      {!isMobile && (
        <nav className="flex items-center gap-0.5 ml-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary-500/10 text-primary-500'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]'
                )
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      {/* ── Page title on mobile ──────────────────────────── */}
      {isMobile && title && (
        <h1 className="font-display font-semibold text-sm text-[var(--color-text-primary)] flex-1 truncate">
          {title}
        </h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* ── Theme toggle ──────────────────────────────────── */}
        <button
          onClick={toggle}
          className="p-2 rounded-xl transition-all duration-200 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* ── User avatar + logout ──────────────────────────── */}
        {!isMobile && user && (
          <div className="flex items-center gap-2">
            <Link
              to="/profile"
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[var(--color-bg-elevated)] transition-all duration-200 group"
            >
              <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500 font-semibold text-xs group-hover:bg-primary-500/30 transition-all duration-200">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors max-w-[120px] truncate">
                {user.name}
              </span>
            </Link>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all duration-200"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}