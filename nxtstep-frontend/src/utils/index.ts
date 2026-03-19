// ── cn() — tailwind-merge + clsx ─────────────────────────────
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Formatters ────────────────────────────────────────────────
export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function formatScorePercent(score: number, max = 10): string {
  return `${Math.round((score / max) * 100)}%`;
}

export function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
}

export function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);

  if (hours > 0) return `${hours}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

export function formatSalary(min: number, max: number, currency = 'USD'): string {
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  return `${fmt.format(min)} — ${fmt.format(max)}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length).trimEnd() + '…';
}

export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

export function getDifficultyColor(level: string): string {
  switch (level) {
    case 'junior': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40';
    case 'mid': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40';
    case 'senior': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40';
    default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/40';
  }
}

export function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-500';
  if (score >= 6) return 'text-primary-500';
  if (score >= 4) return 'text-yellow-500';
  return 'text-red-500';
}

export function getScoreGrade(score: number): string {
  if (score >= 9) return 'Exceptional';
  if (score >= 7.5) return 'Strong';
  if (score >= 6) return 'Good';
  if (score >= 4.5) return 'Fair';
  return 'Needs Work';
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    tech: '💻',
    ai: '🤖',
    business: '📈',
    finance: '💰',
    startups: '🚀',
    frontend: '🎨',
    backend: '⚙️',
    fullstack: '🔗',
    data: '📊',
    ml: '🧠',
    devops: '🔧',
    mobile: '📱',
    qa: '🧪',
    security: '🔒',
  };
  return icons[category] || '🔖';
}

export function getMatchScoreLabel(score: number): string {
  if (score >= 0.85) return 'Excellent Match';
  if (score >= 0.7) return 'Strong Match';
  if (score >= 0.55) return 'Good Match';
  if (score >= 0.4) return 'Fair Match';
  return 'Partial Match';
}

export function getMatchScoreColor(score: number): string {
  if (score >= 0.85) return 'text-green-500 bg-green-500/10';
  if (score >= 0.7) return 'text-primary-500 bg-primary-500/10';
  if (score >= 0.55) return 'text-accent-500 bg-accent-500/10';
  if (score >= 0.4) return 'text-yellow-500 bg-yellow-500/10';
  return 'text-gray-500 bg-gray-500/10';
}

export function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}