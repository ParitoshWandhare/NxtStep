// ============================================================
// NxtStep — Register Page
// FIX: After register redirect to /dashboard directly (no verify gate)
// ADDED: Animations and hover effects
// ============================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User, Zap } from 'lucide-react';
import { Input } from '@/components/ui/FormFields';
import Button from '@/components/ui/Button';
import { Divider } from '@/components/ui/index';
import { useRegister } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  usePageTitle('Create Account');
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const register_ = useRegister();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await register_.mutateAsync({ name: data.name, email: data.email, password: data.password });
      // Go directly to dashboard — no email verification gate
      navigate('/dashboard');
    } catch { /* toast handles */ }
  };

  return (
    <div className="card-surface p-8 animate-slide-up">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center shadow-glow animate-pulse-glow">
          <Zap size={22} className="text-white" />
        </div>
      </div>

      <div className="mb-8 text-center">
        <h1 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-1.5">
          Create your account
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Start your AI interview journey today
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Full name"
          type="text"
          placeholder="Jane Smith"
          autoComplete="name"
          leftIcon={<User size={16} />}
          error={errors.name?.message}
          className="transition-all duration-200 hover:border-primary-400/60"
          {...register('name')}
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          leftIcon={<Mail size={16} />}
          error={errors.email?.message}
          className="transition-all duration-200 hover:border-primary-400/60"
          {...register('email')}
        />
        <Input
          label="Password"
          type={showPw ? 'text' : 'password'}
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          autoComplete="new-password"
          leftIcon={<Lock size={16} />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              tabIndex={-1}
              className="text-[var(--color-text-muted)] hover:text-primary-500 transition-colors duration-200"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
          error={errors.password?.message}
          className="transition-all duration-200 hover:border-primary-400/60"
          {...register('password')}
        />
        <Input
          label="Confirm password"
          type={showPw ? 'text' : 'password'}
          placeholder="Re-enter password"
          autoComplete="new-password"
          leftIcon={<Lock size={16} />}
          error={errors.confirmPassword?.message}
          className="transition-all duration-200 hover:border-primary-400/60"
          {...register('confirmPassword')}
        />

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={register_.isPending}
          className="mt-2 transition-all duration-300 hover:shadow-glow hover:scale-[1.01] active:scale-[0.99]"
        >
          Create account
        </Button>
      </form>

      <Divider label="or" className="my-6" />

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Already have an account?{' '}
        <Link
          to="/login"
          className="text-primary-500 hover:text-primary-400 font-medium transition-colors duration-200 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}