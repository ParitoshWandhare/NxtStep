// ============================================================
// NxtStep — Login Page
// FIX: Always redirect to /dashboard after login (skip verify-email gate)
// ============================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, Zap } from 'lucide-react';
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
      // Always go to dashboard — skip email verification gate
      navigate('/dashboard');
    } catch {
      /* error handled by toast in mutation hook */
    }
  };

  return (
    <div className="card-surface p-8 animate-slide-up">
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className="flex justify-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center shadow-glow animate-pulse-glow">
          <Zap size={22} className="text-white" />
        </div>
      </div>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <h1 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-1.5">
          Welcome back
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Sign in to your NxtStep account
        </p>
      </div>

      {/* ── Form ──────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="group">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            leftIcon={<Mail size={16} />}
            error={errors.email?.message}
            className="transition-all duration-200 group-hover:border-primary-400"
            {...register('email')}
          />
        </div>

        <div className="group">
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
                className="text-[var(--color-text-muted)] hover:text-primary-500 transition-colors duration-200"
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            error={errors.password?.message}
            className="transition-all duration-200 group-hover:border-primary-400"
            {...register('password')}
          />
        </div>

        {/* Forgot password link */}
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-xs text-primary-500 hover:text-primary-400 font-medium transition-colors duration-200 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={login.isPending}
          className="mt-2 transition-all duration-300 hover:shadow-glow hover:scale-[1.01] active:scale-[0.99]"
        >
          Sign in
        </Button>

        {/* Inline error fallback */}
        {login.isError && (
          <p className="text-xs text-center text-red-500 dark:text-red-400 mt-2 animate-fade-in">
            {login.error instanceof Error
              ? login.error.message
              : 'Invalid email or password. Please try again.'}
          </p>
        )}
      </form>

      <Divider label="or" className="my-6" />

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="text-primary-500 hover:text-primary-400 font-medium transition-colors duration-200 hover:underline"
        >
          Sign up for free
        </Link>
      </p>
    </div>
  );
}