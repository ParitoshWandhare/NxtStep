// ============================================================
// NxtStep — Login Page
// ============================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Input } from '@/components/ui/FormFields';
import Button from '@/components/ui/Button';
import { Divider } from '@/components/ui/index';
import { useLogin } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  usePageTitle('Sign In');
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login.mutateAsync(data);
      navigate('/dashboard');
    } catch {
      /* error handled by toast in mutation hook */
    }
  };

  return (
    <div className="card-surface p-8">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-1.5">
          Welcome back
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Sign in to your NxtStep account
        </p>
      </div>

      {/* ── Form ──────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          leftIcon={<Mail size={16} />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type={showPw ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="current-password"
          leftIcon={<Lock size={16} />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPw((p) => !p)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              tabIndex={-1}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Forgot password link */}
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-xs text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={login.isPending}
          className="mt-2"
        >
          Sign in
        </Button>

        {/* Inline error fallback */}
        {login.isError && (
          <p className="text-xs text-center text-red-500 dark:text-red-400 mt-2">
            {login.error instanceof Error
              ? login.error.message
              : 'Invalid email or password. Please try again.'}
          </p>
        )}
      </form>

      {/* ── Divider ───────────────────────────────────────────── */}
      <Divider label="or" className="my-6" />

      {/* ── Register link ─────────────────────────────────────── */}
      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Don't have an account?{' '}
        <Link
          to="/register"
          className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors"
        >
          Sign up for free
        </Link>
      </p>
    </div>
  );
}