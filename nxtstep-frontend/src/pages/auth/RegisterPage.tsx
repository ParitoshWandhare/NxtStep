// ============================================================
// NxtStep — Register Page
// ============================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
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
      navigate('/verify-email');
    } catch { /* toast handles */ }
  };

  return (
    <div className="card-surface p-8">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-1.5">
          Create your account
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Start your AI interview journey today
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Full name" type="text" placeholder="Jane Smith" autoComplete="name"
          leftIcon={<User size={16} />} error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" placeholder="you@example.com" autoComplete="email"
          leftIcon={<Mail size={16} />} error={errors.email?.message} {...register('email')} />
        <Input label="Password" type={showPw ? 'text' : 'password'} placeholder="Min 8 chars, 1 uppercase, 1 number"
          autoComplete="new-password" leftIcon={<Lock size={16} />}
          rightIcon={
            <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
          error={errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type={showPw ? 'text' : 'password'} placeholder="Re-enter password"
          autoComplete="new-password" leftIcon={<Lock size={16} />}
          error={errors.confirmPassword?.message} {...register('confirmPassword')} />

        <Button type="submit" fullWidth size="lg" loading={register_.isPending} className="mt-2">
          Create account
        </Button>
      </form>

      <Divider label="or" className="my-6" />

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
