// ============================================================
// NxtStep — Profile Page
// CHANGES:
//   1. Tech Interests: added free-text input field (type + Enter)
//   2. Member Since + Login Count: fixed to use profile data from API
//      (not just Redux user which may be stale)
// ============================================================

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Shield, BarChart3, Star, X, Plus, Calendar, Hash, Tag } from 'lucide-react';
import { Card, Badge } from '@/components/ui/index';
import { Input } from '@/components/ui/FormFields';
import Button from '@/components/ui/Button';
import { useProfile, useUpdateProfile } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { formatDate, capitalise } from '@/utils';
import { useState } from 'react';

const schema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(100),
  rolePreferences: z.array(z.string()).max(10).optional(),
  interests: z.array(z.string()).max(20).optional(),
});
type FormData = z.infer<typeof schema>;

const ROLE_OPTIONS = [
  'Frontend Developer', 'Backend Engineer', 'Full Stack Developer',
  'Data Engineer', 'ML Engineer', 'DevOps Engineer', 'Mobile Developer',
  'QA Engineer', 'Security Engineer', 'React Developer', 'Node.js Developer',
];

const INTEREST_SUGGESTIONS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Machine Learning',
  'System Design', 'Cloud Computing', 'Kubernetes', 'Web Security', 'Data Science',
  'GraphQL', 'Docker', 'Rust', 'Go', 'Flutter', 'AWS', 'LLMs', 'DevOps',
];

export default function ProfilePage() {
  usePageTitle('Profile');

  // Always use profile from API (has loginCount, createdAt, etc.)
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  // Redux user as fallback only
  const user = useAppSelector(selectCurrentUser);

  // Use API profile data preferentially for display fields
  const displayUser = profile || user;

  const [prefInput, setPrefInput] = useState('');
  const [interestInput, setInterestInput] = useState('');

  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      name: profile?.name || user?.name || '',
      rolePreferences: profile?.rolePreferences || user?.rolePreferences || [],
      interests: profile?.interests || user?.interests || [],
    },
  });

  const prefs = watch('rolePreferences') || [];
  const interests = watch('interests') || [];

  const onSubmit = async (data: FormData) => {
    await updateProfile.mutateAsync(data);
  };

  const addInterest = (val: string) => {
    const t = val.trim();
    if (!t || interests.includes(t) || interests.length >= 20) return;
    setValue('interests', [...interests, t], { shouldDirty: true });
    setInterestInput('');
  };

  const addPref = (val: string) => {
    const t = val.trim();
    if (!t || prefs.includes(t) || prefs.length >= 10) return;
    setValue('rolePreferences', [...prefs, t], { shouldDirty: true });
    setPrefInput('');
  };

  // Format login count with comma for readability
  const loginCount = (displayUser as any)?.loginCount ?? 0;
  const createdAt = (displayUser as any)?.createdAt;
  const lastLoginAt = (displayUser as any)?.lastLoginAt;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="page-title mb-1">Profile</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Manage your account and preferences</p>
      </div>

      {/* ── Account Info ────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center text-primary-500 font-bold text-2xl font-display shrink-0">
            {displayUser?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)] truncate">
              {displayUser?.name}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] truncate">{displayUser?.email}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant={displayUser?.isEmailVerified ? 'success' : 'warning'} size="sm" dot>
                {displayUser?.isEmailVerified ? 'Email verified' : 'Email unverified'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[var(--color-border)]">
          {/* Member Since */}
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-[var(--color-bg-elevated)] gap-1.5">
            <Calendar size={16} className="text-primary-500" />
            <p className="text-xs text-[var(--color-text-muted)]">Member since</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {isLoading ? (
                <span className="skeleton h-4 w-16 rounded inline-block" />
              ) : createdAt ? (
                formatDate(createdAt)
              ) : (
                '—'
              )}
            </p>
          </div>

          {/* Login Count */}
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-[var(--color-bg-elevated)] gap-1.5">
            <Hash size={16} className="text-emerald-500" />
            <p className="text-xs text-[var(--color-text-muted)]">Total logins</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {isLoading ? (
                <span className="skeleton h-4 w-8 rounded inline-block" />
              ) : (
                loginCount.toLocaleString()
              )}
            </p>
          </div>

          {/* Last Login */}
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-[var(--color-bg-elevated)] gap-1.5">
            <Shield size={16} className="text-secondary-500" />
            <p className="text-xs text-[var(--color-text-muted)]">Last login</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {isLoading ? (
                <span className="skeleton h-4 w-16 rounded inline-block" />
              ) : lastLoginAt ? (
                formatDate(lastLoginAt)
              ) : (
                '—'
              )}
            </p>
          </div>

          {/* Role Preferences count */}
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-[var(--color-bg-elevated)] gap-1.5">
            <Tag size={16} className="text-accent-500" />
            <p className="text-xs text-[var(--color-text-muted)]">Role prefs</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{prefs.length}/10</p>
          </div>
        </div>
      </Card>

      {/* ── Edit Form ────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Personal Info */}
        <Card>
          <h2 className="section-title mb-4">Personal Information</h2>
          <Input label="Full name" error={errors.name?.message} {...register('name')} />
        </Card>

        {/* Role Preferences */}
        <Card>
          <h2 className="section-title mb-1.5">Role Preferences</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Target roles (up to 10). Used to personalise recommendations.
          </p>

          {/* Input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={prefInput}
              onChange={e => setPrefInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPref(prefInput);
                }
              }}
              placeholder="Type a role and press Enter…"
              className="input-field flex-1 text-sm"
              disabled={prefs.length >= 10}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => addPref(prefInput)}
              disabled={prefs.length >= 10 || !prefInput.trim()}
            >
              Add
            </Button>
          </div>

          {/* Selected tags */}
          {prefs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {prefs.map(p => (
                <span key={p} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-500/10 text-primary-500 text-sm font-medium">
                  {p}
                  <button type="button" onClick={() => setValue('rolePreferences', prefs.filter(x => x !== p), { shouldDirty: true })} className="hover:text-primary-700 transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Quick-add suggestions */}
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Quick add:</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.filter(r => !prefs.includes(r)).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => addPref(r)}
                disabled={prefs.length >= 10}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-primary-500 hover:text-primary-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + {r}
              </button>
            ))}
          </div>
        </Card>

        {/* Tech Interests */}
        <Card>
          <h2 className="section-title mb-1.5">Tech Interests</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Topics you care about (up to 20). Used to personalise your news feed.
          </p>

          {/* ── Free-text input field (NEW) ─────────────────── */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={interestInput}
              onChange={e => setInterestInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addInterest(interestInput);
                }
              }}
              placeholder="Type an interest and press Enter… e.g. WebAssembly, Bun, LangChain"
              className="input-field flex-1 text-sm"
              disabled={interests.length >= 20}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => addInterest(interestInput)}
              disabled={interests.length >= 20 || !interestInput.trim()}
            >
              Add
            </Button>
          </div>

          {/* Selected interest tags */}
          {interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {interests.map(i => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-500/10 text-accent-600 dark:text-accent-400 text-sm font-medium">
                  {i}
                  <button type="button" onClick={() => setValue('interests', interests.filter(x => x !== i), { shouldDirty: true })} className="hover:opacity-70 transition-opacity">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Suggestion chips */}
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Popular suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {INTEREST_SUGGESTIONS.filter(o => !interests.includes(o)).map(o => (
              <button
                key={o}
                type="button"
                onClick={() => addInterest(o)}
                disabled={interests.length >= 20}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-accent-500 hover:text-accent-600 dark:hover:text-accent-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + {o}
              </button>
            ))}
          </div>

          {interests.length >= 20 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
              Maximum 20 interests reached.
            </p>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="submit"
            loading={updateProfile.isPending}
            disabled={!isDirty}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}