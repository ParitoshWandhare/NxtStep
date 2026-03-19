// ============================================================
// NxtStep — Profile Page
// ============================================================

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Shield, BarChart3, Star, X, Plus } from 'lucide-react';
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

const INTEREST_OPTIONS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Machine Learning',
  'System Design', 'Cloud Computing', 'Kubernetes', 'Web Security', 'Data Science',
];

export default function ProfilePage() {
  usePageTitle('Profile');
  const user = useAppSelector(selectCurrentUser);
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const [prefInput, setPrefInput] = useState('');
  const [interestInput, setInterestInput] = useState('');

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<FormData>({
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="page-title mb-1">Profile</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Manage your account and preferences</p>
      </div>

      {/* Account Info (read-only) */}
      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary-500/20 flex items-center justify-center text-primary-500 font-bold text-2xl font-display">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)]">
              {user?.name}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={user?.isEmailVerified ? 'success' : 'warning'} size="sm" dot>
                {user?.isEmailVerified ? 'Email verified' : 'Email unverified'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--color-border)]">
          <div className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)]">
            <User size={16} className="text-primary-500 mx-auto mb-1" />
            <p className="text-xs text-[var(--color-text-muted)]">Member since</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {user?.createdAt ? formatDate(user.createdAt) : '—'}
            </p>
          </div>
          <div className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)]">
            <Shield size={16} className="text-emerald-500 mx-auto mb-1" />
            <p className="text-xs text-[var(--color-text-muted)]">Login count</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {user?.loginCount || 0}
            </p>
          </div>
          <div className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)]">
            <BarChart3 size={16} className="text-secondary-500 mx-auto mb-1" />
            <p className="text-xs text-[var(--color-text-muted)]">Role preferences</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {prefs.length}
            </p>
          </div>
        </div>
      </Card>

      {/* Edit form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <h2 className="section-title mb-4">Personal Information</h2>
          <Input label="Full name" error={errors.name?.message} {...register('name')} />
        </Card>

        <Card>
          <h2 className="section-title mb-1.5">Role Preferences</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Tell us what roles you're targeting (up to 10). Used to personalise recommendations.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={prefInput}
              onChange={e => setPrefInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault();
                  const t = prefInput.trim();
                  if (t && !prefs.includes(t) && prefs.length < 10) {
                    setValue('rolePreferences', [...prefs, t], { shouldDirty: true });
                    setPrefInput('');
                  }
                }
              }}
              placeholder="Add a role and press Enter…"
              className="input-field flex-1 text-sm"
            />
          </div>
          {prefs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {prefs.map(p => (
                <span key={p} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-500/10 text-primary-500 text-sm font-medium">
                  {p}
                  <button type="button" onClick={() => setValue('rolePreferences', prefs.filter(x => x !== p), { shouldDirty: true })} className="hover:text-primary-700">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.filter(r => !prefs.includes(r)).map(r => (
              <button key={r} type="button"
                onClick={() => prefs.length < 10 && setValue('rolePreferences', [...prefs, r], { shouldDirty: true })}
                disabled={prefs.length >= 10}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-primary-500 hover:text-primary-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                + {r}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="section-title mb-1.5">Tech Interests</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Topics you're interested in. Used to personalise your news feed.
          </p>
          {interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {interests.map(i => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-500/10 text-accent-600 dark:text-accent-400 text-sm font-medium">
                  {i}
                  <button type="button" onClick={() => setValue('interests', interests.filter(x => x !== i), { shouldDirty: true })}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.filter(o => !interests.includes(o)).map(o => (
              <button key={o} type="button"
                onClick={() => interests.length < 20 && setValue('interests', [...interests, o], { shouldDirty: true })}
                disabled={interests.length >= 20}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-accent-500 hover:text-accent-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                + {o}
              </button>
            ))}
          </div>
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
