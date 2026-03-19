// ============================================================
// NxtStep — New Interview Page
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Zap, Target, ChevronRight, X, Plus } from 'lucide-react';
import { Card, Badge } from '@/components/ui/index';
import { Input, Select, Textarea } from '@/components/ui/FormFields';
import Button from '@/components/ui/Button';
import { useStartInterview } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';
import type { Difficulty } from '@/types';

const ROLE_SUGGESTIONS = [
  'Frontend Developer', 'React Developer', 'Backend Engineer', 'Node.js Developer',
  'Full Stack Developer', 'MERN Stack Developer', 'Data Engineer', 'ML Engineer',
  'DevOps Engineer', 'Site Reliability Engineer', 'Mobile Developer', 'QA Engineer',
];

const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  default: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'System Design', 'Data Structures', 'SQL', 'REST APIs'],
};

const schema = z.object({
  role: z.string().min(2, 'Role is required').max(100),
  difficulty: z.enum(['junior', 'mid', 'senior']),
  topics: z.array(z.string()).max(5).optional(),
  customJobDescription: z.string().max(2000).optional(),
});
type FormData = z.infer<typeof schema>;

const DIFFICULTY_INFO: Record<Difficulty, { label: string; desc: string; color: string }> = {
  junior: { label: 'Junior', desc: '0-2 years experience', color: 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' },
  mid: { label: 'Mid-level', desc: '2-5 years experience', color: 'border-yellow-500 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400' },
  senior: { label: 'Senior', desc: '5+ years experience', color: 'border-red-500 bg-red-500/5 text-red-600 dark:text-red-400' },
};

export default function NewInterviewPage() {
  usePageTitle('Start Interview');
  const navigate = useNavigate();
  const startInterview = useStartInterview();
  const [topicInput, setTopicInput] = useState('');

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { difficulty: 'mid', topics: [] },
  });

  const difficulty = watch('difficulty');
  const topics = watch('topics') || [];

  const addTopic = (t: string) => {
    const trimmed = t.trim();
    if (!trimmed || topics.includes(trimmed) || topics.length >= 5) return;
    setValue('topics', [...topics, trimmed]);
    setTopicInput('');
  };

  const removeTopic = (t: string) => setValue('topics', topics.filter(x => x !== t));

  const onSubmit = async (data: FormData) => {
    try {
      const result = await startInterview.mutateAsync({
        role: data.role,
        difficulty: data.difficulty,
        topics: data.topics?.length ? data.topics : undefined,
        customJobDescription: data.customJobDescription || undefined,
      });
      navigate(`/interview/${result.sessionId}`);
    } catch { /* toast */ }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <Zap size={20} className="text-primary-500" />
          </div>
          <div>
            <h1 className="page-title">Configure Interview</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Set up your AI interview session
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Role */}
        <Card>
          <h2 className="section-title mb-4">Target Role</h2>
          <Input
            label="Job title / Role"
            placeholder="e.g. React Developer, Backend Engineer…"
            error={errors.role?.message}
            {...register('role')}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {ROLE_SUGGESTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setValue('role', r)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-primary-500 hover:text-primary-500 transition-all duration-150"
              >
                {r}
              </button>
            ))}
          </div>
        </Card>

        {/* Difficulty */}
        <Card>
          <h2 className="section-title mb-4">Experience Level</h2>
          <Controller
            name="difficulty"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => {
                  const info = DIFFICULTY_INFO[d];
                  const selected = field.value === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => field.onChange(d)}
                      className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        selected
                          ? info.color
                          : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <p className="font-semibold text-sm mb-0.5">{info.label}</p>
                      <p className="text-xs opacity-70">{info.desc}</p>
                    </button>
                  );
                })}
              </div>
            )}
          />
        </Card>

        {/* Topics */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Focus Topics</h2>
            <Badge variant="ghost" size="sm">{topics.length}/5</Badge>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(topicInput); } }}
              placeholder="Add a topic and press Enter…"
              className="input-field flex-1"
            />
            <Button type="button" variant="secondary" size="md" leftIcon={<Plus size={16} />}
              onClick={() => addTopic(topicInput)} disabled={topics.length >= 5}>
              Add
            </Button>
          </div>

          {topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {topics.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-500/10 text-primary-500 text-sm font-medium">
                  {t}
                  <button type="button" onClick={() => removeTopic(t)} className="hover:text-primary-700 transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-[var(--color-text-muted)] mb-3">Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {TOPIC_SUGGESTIONS.default
              .filter((s) => !topics.includes(s))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTopic(s)}
                  disabled={topics.length >= 5}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-primary-500 hover:text-primary-500 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + {s}
                </button>
              ))}
          </div>
        </Card>

        {/* Optional JD */}
        <Card>
          <h2 className="section-title mb-1.5">Job Description <span className="text-xs font-normal text-[var(--color-text-muted)]">(optional)</span></h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">Paste the job description to get more targeted questions.</p>
          <Textarea
            placeholder="Paste the full job description here…"
            showCount maxLength={2000}
            className="min-h-[120px]"
            {...register('customJobDescription')}
          />
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-xs text-[var(--color-text-muted)]">
            Questions are generated in real-time by AI
          </div>
          <Button type="submit" size="lg" loading={startInterview.isPending}
            leftIcon={<Zap size={18} />} rightIcon={<ChevronRight size={18} />}
            className="shadow-glow hover:shadow-glow-lg min-w-[180px]">
            {startInterview.isPending ? 'Starting…' : 'Start Interview'}
          </Button>
        </div>
      </form>
    </div>
  );
}
