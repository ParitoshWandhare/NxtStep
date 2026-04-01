// // ============================================================
// // NxtStep — Scorecard Detail Page
// // ============================================================

// import { useParams, Link } from 'react-router-dom';
// import { ArrowLeft, Target } from 'lucide-react';
// import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
// import { Card, ScoreRing, ProgressBar, Skeleton, EmptyState } from '@/components/ui/index';
// import Button from '@/components/ui/Button';
// import { useScorecard, useRecommendations } from '@/hooks/useApi';
// import { usePageTitle } from '@/hooks';
// import { getScoreColor, getScoreGrade, getDifficultyColor, getCategoryIcon, formatSalary } from '@/utils';

// const DIMENSIONS = [
//   { key: 'technical', label: 'Technical' },
//   { key: 'problemSolving', label: 'Problem Solving' },
//   { key: 'communication', label: 'Communication' },
//   { key: 'confidence', label: 'Confidence' },
//   { key: 'conceptDepth', label: 'Concept Depth' },
// ];

// export default function ScorecardDetailPage() {
//   const { sessionId } = useParams<{ sessionId: string }>();
//   usePageTitle('Scorecard Detail');

//   const { data: sc, isLoading } = useScorecard(sessionId || '');
//   const { data: recs } = useRecommendations(sessionId || '', !!sc);

//   if (isLoading) {
//     return (
//       <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
//         <Skeleton className="h-8 w-48" />
//         <div className="grid sm:grid-cols-2 gap-6">
//           <Skeleton className="h-64 rounded-2xl" />
//           <Skeleton className="h-64 rounded-2xl" />
//         </div>
//       </div>
//     );
//   }

//   if (!sc) {
//     return (
//       <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
//         <EmptyState title="Scorecard not found" description="This scorecard may still be processing." />
//       </div>
//     );
//   }

//   const radarData = DIMENSIONS.map(d => ({
//     subject: d.label,
//     value: (sc as Record<string, unknown>)[d.key] as number || 0,
//     fullMark: 10,
//   }));

//   const barData = DIMENSIONS.map(d => ({
//     name: d.label.split(' ')[0],
//     score: (sc as Record<string, unknown>)[d.key] as number || 0,
//   }));

//   return (
//     <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
//       {/* Back */}
//       <Link to="/scores" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
//         <ArrowLeft size={16} /> All scorecards
//       </Link>

//       {/* Overall */}
//       <Card className="bg-gradient-to-br from-primary-500/8 to-secondary-500/5">
//         <div className="flex flex-col sm:flex-row items-center gap-6">
//           <ScoreRing score={sc.overall} size={140} label="Overall Score" sublabel={getScoreGrade(sc.overall)} />
//           <div className="flex-1 space-y-4 w-full">
//             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
//               {DIMENSIONS.map(d => {
//                 const val = (sc as Record<string, unknown>)[d.key] as number || 0;
//                 return (
//                   <div key={d.key} className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)]">
//                     <p className={`text-2xl font-bold font-display ${getScoreColor(val)}`}>{val.toFixed(1)}</p>
//                     <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{d.label}</p>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         </div>
//       </Card>

//       {/* Charts */}
//       <div className="grid sm:grid-cols-2 gap-6">
//         <Card>
//           <h2 className="section-title mb-4">Radar View</h2>
//           <ResponsiveContainer width="100%" height={240}>
//             <RadarChart data={radarData}>
//               <PolarGrid stroke="var(--color-border)" />
//               <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
//               <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
//               <RechartsTooltip contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' }} />
//             </RadarChart>
//           </ResponsiveContainer>
//         </Card>

//         <Card>
//           <h2 className="section-title mb-4">Bar View</h2>
//           <ResponsiveContainer width="100%" height={240}>
//             <BarChart data={barData} margin={{ left: -20 }}>
//               <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
//               <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
//               <YAxis domain={[0, 10]} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
//               <RechartsTooltip contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' }} />
//               <Bar dataKey="score" fill="#6366f1" radius={[6, 6, 0, 0]} />
//             </BarChart>
//           </ResponsiveContainer>
//         </Card>
//       </div>

//       {/* Feedback */}
//       {(sc.strengths.length > 0 || sc.weaknesses.length > 0 || sc.suggestions.length > 0) && (
//         <div className="grid sm:grid-cols-3 gap-4">
//           {sc.strengths.length > 0 && (
//             <Card>
//               <h3 className="font-semibold text-emerald-500 text-sm mb-3">✅ Strengths</h3>
//               <ul className="space-y-2">
//                 {sc.strengths.map((s, i) => (
//                   <li key={i} className="text-sm text-[var(--color-text-secondary)]">• {s}</li>
//                 ))}
//               </ul>
//             </Card>
//           )}
//           {sc.weaknesses.length > 0 && (
//             <Card>
//               <h3 className="font-semibold text-red-500 text-sm mb-3">⚠️ Improve</h3>
//               <ul className="space-y-2">
//                 {sc.weaknesses.map((w, i) => (
//                   <li key={i} className="text-sm text-[var(--color-text-secondary)]">• {w}</li>
//                 ))}
//               </ul>
//             </Card>
//           )}
//           {sc.suggestions.length > 0 && (
//             <Card>
//               <h3 className="font-semibold text-primary-500 text-sm mb-3">💡 Suggestions</h3>
//               <ul className="space-y-2">
//                 {sc.suggestions.map((s, i) => (
//                   <li key={i} className="text-sm text-[var(--color-text-secondary)]">→ {s}</li>
//                 ))}
//               </ul>
//             </Card>
//           )}
//         </div>
//       )}

//       {/* Role Recommendations */}
//       {recs && recs.roles.length > 0 && (
//         <Card>
//           <div className="flex items-center justify-between mb-4">
//             <h2 className="section-title">Matched Roles</h2>
//             <Link to={`/interview/${sessionId}/results`}>
//               <Button variant="ghost" size="sm" rightIcon={<Target size={14} />}>Full report</Button>
//             </Link>
//           </div>
//           <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
//             {recs.roles.slice(0, 3).map(role => (
//               <div key={role.roleId} className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
//                 <div className="flex items-center gap-2 mb-1.5">
//                   <span className="text-lg">{getCategoryIcon(role.category)}</span>
//                   <p className="font-medium text-sm text-[var(--color-text-primary)] truncate">{role.title}</p>
//                 </div>
//                 <div className="flex items-center justify-between">
//                   <span className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyColor(role.level)}`}>{role.level}</span>
//                   <span className="text-sm font-bold text-primary-500">{Math.round(role.matchScore * 100)}%</span>
//                 </div>
//                 {role.salaryRange && (
//                   <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
//                     {formatSalary(role.salaryRange.min, role.salaryRange.max, role.salaryRange.currency)}
//                   </p>
//                 )}
//               </div>
//             ))}
//           </div>
//         </Card>
//       )}
//     </div>
//   );
// }




// ============================================================
// NxtStep — Scorecard Detail Page (FULL FIXED FILE)
// ============================================================

import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Target } from 'lucide-react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import {
  Card,
  ScoreRing,
  ProgressBar,
  Skeleton,
  EmptyState,
} from '@/components/ui/index';

import Button from '@/components/ui/Button';
import { useScorecard, useRecommendations } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks';
import {
  getScoreColor,
  getScoreGrade,
  getDifficultyColor,
  getCategoryIcon,
  formatSalary,
} from '@/utils';

/**
 * ✅ Strict key typing for Scorecard fields used dynamically
 */
type ScorecardKey =
  | 'technical'
  | 'problemSolving'
  | 'communication'
  | 'confidence'
  | 'conceptDepth';

const DIMENSIONS: { key: ScorecardKey; label: string }[] = [
  { key: 'technical', label: 'Technical' },
  { key: 'problemSolving', label: 'Problem Solving' },
  { key: 'communication', label: 'Communication' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'conceptDepth', label: 'Concept Depth' },
];

export default function ScorecardDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  usePageTitle('Scorecard Detail');

  const { data: sc, isLoading } = useScorecard(sessionId || '');
  const { data: recs } = useRecommendations(sessionId || '', !!sc);

  // =============================
  // Loading State
  // =============================
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid sm:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  // =============================
  // Empty State
  // =============================
  if (!sc) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <EmptyState
          title="Scorecard not found"
          description="This scorecard may still be processing."
        />
      </div>
    );
  }

  // =============================
  // Chart Data (Type-safe)
  // =============================
  const radarData = DIMENSIONS.map((d) => ({
    subject: d.label,
    value: (sc[d.key] as number) || 0,
    fullMark: 10,
  }));

  const barData = DIMENSIONS.map((d) => ({
    name: d.label.split(' ')[0],
    score: (sc[d.key] as number) || 0,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* =============================
          Back Navigation
      ============================= */}
      <Link
        to="/scores"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <ArrowLeft size={16} /> All scorecards
      </Link>

      {/* =============================
          Overall Score Section
      ============================= */}
      <Card className="bg-gradient-to-br from-primary-500/8 to-secondary-500/5">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing
            score={sc.overall}
            size={140}
            label="Overall Score"
            sublabel={getScoreGrade(sc.overall)}
          />

          <div className="flex-1 space-y-4 w-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DIMENSIONS.map((d) => {
                const val = (sc[d.key] as number) || 0;

                return (
                  <div
                    key={d.key}
                    className="text-center p-3 rounded-xl bg-[var(--color-bg-elevated)]"
                  >
                    <p
                      className={`text-2xl font-bold font-display ${getScoreColor(
                        val
                      )}`}
                    >
                      {val.toFixed(1)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {d.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* =============================
          Charts Section
      ============================= */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Card>
          <h2 className="section-title mb-4">Radar View</h2>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{
                  fill: 'var(--color-text-muted)',
                  fontSize: 11,
                }}
              />
              <Radar
                dataKey="value"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <RechartsTooltip
                contentStyle={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        {/* Bar Chart */}
        <Card>
          <h2 className="section-title mb-4">Bar View</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ left: -20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="name"
                tick={{
                  fill: 'var(--color-text-muted)',
                  fontSize: 11,
                }}
              />
              <YAxis
                domain={[0, 10]}
                tick={{
                  fill: 'var(--color-text-muted)',
                  fontSize: 11,
                }}
              />
              <RechartsTooltip
                contentStyle={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey="score"
                fill="#6366f1"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* =============================
          Feedback Section
      ============================= */}
      {(sc.strengths.length > 0 ||
        sc.weaknesses.length > 0 ||
        sc.suggestions.length > 0) && (
        <div className="grid sm:grid-cols-3 gap-4">
          {sc.strengths.length > 0 && (
            <Card>
              <h3 className="font-semibold text-emerald-500 text-sm mb-3">
                ✅ Strengths
              </h3>
              <ul className="space-y-2">
                {sc.strengths.map((s, i) => (
                  <li
                    key={i}
                    className="text-sm text-[var(--color-text-secondary)]"
                  >
                    • {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {sc.weaknesses.length > 0 && (
            <Card>
              <h3 className="font-semibold text-red-500 text-sm mb-3">
                ⚠️ Improve
              </h3>
              <ul className="space-y-2">
                {sc.weaknesses.map((w, i) => (
                  <li
                    key={i}
                    className="text-sm text-[var(--color-text-secondary)]"
                  >
                    • {w}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {sc.suggestions.length > 0 && (
            <Card>
              <h3 className="font-semibold text-primary-500 text-sm mb-3">
                💡 Suggestions
              </h3>
              <ul className="space-y-2">
                {sc.suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="text-sm text-[var(--color-text-secondary)]"
                  >
                    → {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* =============================
          Role Recommendations
      ============================= */}
      {recs && recs.roles.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Matched Roles</h2>
            <Link to={`/interview/${sessionId}/results`}>
              <Button
                variant="ghost"
                size="sm"
                rightIcon={<Target size={14} />}
              >
                Full report
              </Button>
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recs.roles.slice(0, 3).map((role) => (
              <div
                key={role.roleId}
                className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">
                    {getCategoryIcon(role.category)}
                  </span>
                  <p className="font-medium text-sm truncate">
                    {role.title}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyColor(
                      role.level
                    )}`}
                  >
                    {role.level}
                  </span>
                  <span className="text-sm font-bold text-primary-500">
                    {Math.round(role.matchScore * 100)}%
                  </span>
                </div>

                {role.salaryRange && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                    {formatSalary(
                      role.salaryRange.min,
                      role.salaryRange.max,
                      role.salaryRange.currency
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}