// ============================================================
// NxtStep — Role Database v2.0
// 45 curated role templates across 9 categories.
// Used by the Recommendation Engine matching algorithm.
// ============================================================

export interface SkillEntry {
  name: string;
  weight: number; // 0.5–2.5; higher = more important for role
}

export interface RoleTemplate {
  id: string;
  title: string;
  category: RoleCategory;
  level: DifficultyLevel;
  skills: SkillEntry[];
  responsibilities: string[];
  minThresholds: {
    technical: number;
    problemSolving: number;
    communication: number;
  };
  salaryRange?: { min: number; max: number; currency: string };
  growthPath?: string[];
}

export type RoleCategory = 'frontend' | 'backend' | 'fullstack' | 'data' | 'ml' | 'devops' | 'mobile' | 'qa' | 'security';
export type DifficultyLevel = 'junior' | 'mid' | 'senior';

// ─── Frontend ────────────────────────────────────────────────

const FRONTEND: RoleTemplate[] = [
  {
    id: 'fe_jun_001',
    title: 'Junior Frontend Developer',
    category: 'frontend', level: 'junior',
    skills: [
      { name: 'HTML', weight: 1.2 }, { name: 'CSS', weight: 1.2 },
      { name: 'JavaScript', weight: 1.8 }, { name: 'React', weight: 1.5 },
      { name: 'Git', weight: 1.0 }, { name: 'Responsive Design', weight: 1.0 },
    ],
    responsibilities: ['Build UI components', 'Fix bugs', 'Participate in code reviews', 'Write unit tests'],
    minThresholds: { technical: 4, problemSolving: 3, communication: 4 },
    salaryRange: { min: 60000, max: 85000, currency: 'USD' },
    growthPath: ['React Developer', 'Mid Frontend Engineer'],
  },
  {
    id: 'fe_mid_001',
    title: 'React Developer',
    category: 'frontend', level: 'mid',
    skills: [
      { name: 'React', weight: 2.0 }, { name: 'TypeScript', weight: 1.8 },
      { name: 'Redux / Zustand', weight: 1.2 }, { name: 'REST APIs', weight: 1.2 },
      { name: 'CSS / Tailwind', weight: 1.0 }, { name: 'Testing (Jest / RTL)', weight: 1.2 },
      { name: 'Performance Optimization', weight: 1.0 },
    ],
    responsibilities: ['Build complex SPAs', 'Manage client-side state', 'Optimize rendering', 'Integrate APIs', 'Mentor juniors'],
    minThresholds: { technical: 6, problemSolving: 5, communication: 5 },
    salaryRange: { min: 85000, max: 120000, currency: 'USD' },
    growthPath: ['Senior Frontend Engineer', 'Frontend Tech Lead'],
  },
  {
    id: 'fe_mid_002',
    title: 'Vue.js Developer',
    category: 'frontend', level: 'mid',
    skills: [
      { name: 'Vue.js', weight: 2.0 }, { name: 'JavaScript', weight: 1.8 },
      { name: 'Pinia / Vuex', weight: 1.2 }, { name: 'TypeScript', weight: 1.2 },
      { name: 'REST APIs', weight: 1.0 }, { name: 'CSS', weight: 1.0 },
    ],
    responsibilities: ['Build Vue.js SPAs', 'Manage state', 'Create component libraries', 'Write E2E tests'],
    minThresholds: { technical: 5, problemSolving: 5, communication: 4 },
    salaryRange: { min: 80000, max: 115000, currency: 'USD' },
    growthPath: ['Senior Vue Developer', 'Frontend Architect'],
  },
  {
    id: 'fe_sen_001',
    title: 'Senior Frontend Engineer',
    category: 'frontend', level: 'senior',
    skills: [
      { name: 'React / Next.js', weight: 2.0 }, { name: 'TypeScript', weight: 2.0 },
      { name: 'System Design (Frontend)', weight: 1.8 }, { name: 'Performance & Web Vitals', weight: 1.5 },
      { name: 'Design Systems', weight: 1.2 }, { name: 'Mentoring', weight: 1.0 },
      { name: 'Micro-frontends', weight: 1.0 },
    ],
    responsibilities: ['Lead frontend architecture', 'Define design system', 'Drive performance', 'Mentor engineers'],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 130000, max: 175000, currency: 'USD' },
    growthPath: ['Frontend Architect', 'Engineering Manager'],
  },
  {
    id: 'fe_sen_002',
    title: 'Frontend Architect',
    category: 'frontend', level: 'senior',
    skills: [
      { name: 'Architecture Patterns', weight: 2.0 }, { name: 'React / Next.js', weight: 1.8 },
      { name: 'TypeScript', weight: 1.8 }, { name: 'Build Systems (Webpack / Vite)', weight: 1.5 },
      { name: 'Micro-frontends', weight: 1.5 }, { name: 'Security (XSS / CSRF)', weight: 1.2 },
      { name: 'Technical Leadership', weight: 1.5 },
    ],
    responsibilities: ['Define frontend platform strategy', 'Evaluate new technologies', 'Cross-team consistency', 'Own performance budgets'],
    minThresholds: { technical: 8, problemSolving: 8, communication: 7 },
    salaryRange: { min: 150000, max: 200000, currency: 'USD' },
    growthPath: ['Principal Engineer', 'VP Engineering'],
  },
];

// ─── Backend ──────────────────────────────────────────────────

const BACKEND: RoleTemplate[] = [
  {
    id: 'be_jun_001',
    title: 'Junior Backend Developer',
    category: 'backend', level: 'junior',
    skills: [
      { name: 'Node.js', weight: 1.8 }, { name: 'REST APIs', weight: 1.8 },
      { name: 'SQL', weight: 1.2 }, { name: 'Git', weight: 1.0 },
      { name: 'Express.js', weight: 1.5 }, { name: 'Basic Authentication', weight: 1.0 },
    ],
    responsibilities: ['Build API endpoints', 'Write DB queries', 'Implement auth flows', 'Write unit tests'],
    minThresholds: { technical: 4, problemSolving: 3, communication: 3 },
    salaryRange: { min: 60000, max: 85000, currency: 'USD' },
    growthPath: ['Node.js Developer', 'Mid Backend Engineer'],
  },
  {
    id: 'be_mid_001',
    title: 'Node.js Backend Developer',
    category: 'backend', level: 'mid',
    skills: [
      { name: 'Node.js', weight: 2.0 }, { name: 'TypeScript', weight: 1.8 },
      { name: 'MongoDB / PostgreSQL', weight: 1.5 }, { name: 'Redis', weight: 1.2 },
      { name: 'REST APIs / GraphQL', weight: 1.5 }, { name: 'JWT / OAuth2', weight: 1.2 },
      { name: 'Message Queues (BullMQ / RabbitMQ)', weight: 1.0 },
    ],
    responsibilities: ['Build scalable APIs', 'Design DB schemas', 'Implement caching', 'Handle auth', 'Write test suites'],
    minThresholds: { technical: 6, problemSolving: 5, communication: 4 },
    salaryRange: { min: 90000, max: 130000, currency: 'USD' },
    growthPath: ['Senior Backend Engineer', 'Platform Engineer'],
  },
  {
    id: 'be_mid_002',
    title: 'Python Backend Developer',
    category: 'backend', level: 'mid',
    skills: [
      { name: 'Python', weight: 2.0 }, { name: 'Django / FastAPI', weight: 1.8 },
      { name: 'PostgreSQL', weight: 1.5 }, { name: 'REST APIs', weight: 1.5 },
      { name: 'Celery', weight: 1.2 }, { name: 'Docker', weight: 1.0 },
    ],
    responsibilities: ['Build Django/FastAPI services', 'Optimize SQL queries', 'Implement async tasks', 'Write API docs'],
    minThresholds: { technical: 5, problemSolving: 5, communication: 4 },
    salaryRange: { min: 85000, max: 125000, currency: 'USD' },
    growthPath: ['Senior Python Engineer', 'Backend Tech Lead'],
  },
  {
    id: 'be_sen_001',
    title: 'Senior Backend Engineer',
    category: 'backend', level: 'senior',
    skills: [
      { name: 'System Design', weight: 2.0 }, { name: 'Node.js / Python', weight: 1.8 },
      { name: 'Distributed Systems', weight: 1.8 }, { name: 'Database Optimization', weight: 1.5 },
      { name: 'Microservices', weight: 1.5 }, { name: 'Security Best Practices', weight: 1.2 },
      { name: 'Observability', weight: 1.2 },
    ],
    responsibilities: ['Architect distributed systems', 'Lead performance tuning', 'Drive API design', 'Mentor engineers'],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 140000, max: 185000, currency: 'USD' },
    growthPath: ['Principal Engineer', 'Backend Architect'],
  },
];

// ─── Fullstack ────────────────────────────────────────────────

const FULLSTACK: RoleTemplate[] = [
  {
    id: 'fs_jun_001',
    title: 'Junior Fullstack Developer',
    category: 'fullstack', level: 'junior',
    skills: [
      { name: 'React', weight: 1.5 }, { name: 'Node.js', weight: 1.5 },
      { name: 'SQL / MongoDB', weight: 1.2 }, { name: 'REST APIs', weight: 1.5 },
      { name: 'JavaScript', weight: 1.8 }, { name: 'Git', weight: 1.0 },
    ],
    responsibilities: ['Build end-to-end features', 'Integrate frontend with APIs', 'Write DB queries', 'Debug across stack'],
    minThresholds: { technical: 4, problemSolving: 3, communication: 4 },
    salaryRange: { min: 65000, max: 90000, currency: 'USD' },
    growthPath: ['MERN Stack Developer', 'Mid Fullstack Engineer'],
  },
  {
    id: 'fs_mid_001',
    title: 'MERN Stack Developer',
    category: 'fullstack', level: 'mid',
    skills: [
      { name: 'MongoDB', weight: 1.5 }, { name: 'Express.js', weight: 1.5 },
      { name: 'React', weight: 1.8 }, { name: 'Node.js', weight: 1.8 },
      { name: 'TypeScript', weight: 1.5 }, { name: 'Redux / Context API', weight: 1.2 },
      { name: 'REST APIs', weight: 1.5 },
    ],
    responsibilities: ['Own full feature delivery', 'Design MongoDB models', 'Build React component libraries', 'Implement real-time with Socket.IO'],
    minThresholds: { technical: 6, problemSolving: 5, communication: 5 },
    salaryRange: { min: 90000, max: 130000, currency: 'USD' },
    growthPath: ['Senior Fullstack Engineer', 'Tech Lead'],
  },
  {
    id: 'fs_mid_002',
    title: 'Next.js Fullstack Developer',
    category: 'fullstack', level: 'mid',
    skills: [
      { name: 'Next.js', weight: 2.0 }, { name: 'React', weight: 1.8 },
      { name: 'TypeScript', weight: 1.8 }, { name: 'Prisma / Drizzle', weight: 1.5 },
      { name: 'PostgreSQL', weight: 1.5 }, { name: 'Server Components', weight: 1.5 },
      { name: 'tRPC / REST', weight: 1.2 },
    ],
    responsibilities: ['Build full-stack Next.js apps', 'Design server actions', 'Implement SSR/SSG/ISR', 'Optimize Core Web Vitals'],
    minThresholds: { technical: 6, problemSolving: 5, communication: 5 },
    salaryRange: { min: 95000, max: 135000, currency: 'USD' },
    growthPath: ['Senior Fullstack Engineer', 'Platform Engineer'],
  },
  {
    id: 'fs_sen_001',
    title: 'Senior Fullstack Engineer',
    category: 'fullstack', level: 'senior',
    skills: [
      { name: 'React / Next.js', weight: 1.8 }, { name: 'Node.js', weight: 1.8 },
      { name: 'System Design', weight: 2.0 }, { name: 'TypeScript', weight: 1.8 },
      { name: 'DevOps (CI/CD, Docker)', weight: 1.2 }, { name: 'Database Architecture', weight: 1.5 },
      { name: 'Technical Leadership', weight: 1.5 },
    ],
    responsibilities: ['Drive end-to-end architecture', 'Own delivery DB to UI', 'Establish code quality standards', 'Mentor team members'],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 140000, max: 185000, currency: 'USD' },
    growthPath: ['Principal Engineer', 'Engineering Manager'],
  },
];

// ─── Data Engineering ─────────────────────────────────────────

const DATA: RoleTemplate[] = [
  {
    id: 'da_jun_001',
    title: 'Data Analyst',
    category: 'data', level: 'junior',
    skills: [
      { name: 'SQL', weight: 2.0 }, { name: 'Python (pandas)', weight: 1.5 },
      { name: 'Excel / Google Sheets', weight: 1.2 }, { name: 'Data Visualization (Tableau / Power BI)', weight: 1.5 },
      { name: 'Statistics Fundamentals', weight: 1.5 },
    ],
    responsibilities: ['Write SQL queries', 'Build dashboards', 'Identify trends', 'Validate data quality'],
    minThresholds: { technical: 4, problemSolving: 4, communication: 5 },
    salaryRange: { min: 60000, max: 85000, currency: 'USD' },
    growthPath: ['Data Scientist', 'Data Engineer'],
  },
  {
    id: 'da_mid_001',
    title: 'Data Engineer',
    category: 'data', level: 'mid',
    skills: [
      { name: 'Python', weight: 2.0 }, { name: 'SQL', weight: 1.8 },
      { name: 'Apache Spark', weight: 1.5 }, { name: 'ETL Pipelines (Airflow)', weight: 1.8 },
      { name: 'Data Warehousing (Snowflake / BigQuery)', weight: 1.5 }, { name: 'dbt', weight: 1.2 },
      { name: 'Cloud (AWS / GCP)', weight: 1.2 },
    ],
    responsibilities: ['Build data pipelines', 'Maintain data warehouse', 'Implement data quality checks', 'Collaborate with data scientists'],
    minThresholds: { technical: 6, problemSolving: 6, communication: 4 },
    salaryRange: { min: 100000, max: 140000, currency: 'USD' },
    growthPath: ['Senior Data Engineer', 'Data Architect'],
  },
  {
    id: 'da_sen_001',
    title: 'Senior Data Engineer',
    category: 'data', level: 'senior',
    skills: [
      { name: 'Python', weight: 2.0 }, { name: 'Apache Spark / Flink', weight: 2.0 },
      { name: 'Data Architecture', weight: 2.0 }, { name: 'Real-time Streaming (Kafka)', weight: 1.5 },
      { name: 'Cloud Data Platforms', weight: 1.8 }, { name: 'Data Governance', weight: 1.2 },
    ],
    responsibilities: ['Design data platform architecture', 'Build streaming pipelines at scale', 'Lead infrastructure modernization', 'Define best practices'],
    minThresholds: { technical: 7, problemSolving: 7, communication: 5 },
    salaryRange: { min: 150000, max: 195000, currency: 'USD' },
    growthPath: ['Data Architect', 'Head of Data Engineering'],
  },
];

// ─── Machine Learning / AI ────────────────────────────────────

const ML: RoleTemplate[] = [
  {
    id: 'ml_jun_001',
    title: 'Junior ML Engineer',
    category: 'ml', level: 'junior',
    skills: [
      { name: 'Python', weight: 2.0 }, { name: 'Scikit-learn', weight: 1.8 },
      { name: 'Statistics & Probability', weight: 1.8 }, { name: 'Data Preprocessing', weight: 1.5 },
      { name: 'Jupyter Notebooks', weight: 1.2 }, { name: 'SQL', weight: 1.0 },
    ],
    responsibilities: ['Train classic ML models', 'Feature engineering', 'Run and track experiments', 'Present findings'],
    minThresholds: { technical: 4, problemSolving: 5, communication: 3 },
    salaryRange: { min: 85000, max: 110000, currency: 'USD' },
    growthPath: ['ML Engineer', 'Data Scientist'],
  },
  {
    id: 'ml_mid_001',
    title: 'Machine Learning Engineer',
    category: 'ml', level: 'mid',
    skills: [
      { name: 'Python', weight: 2.0 }, { name: 'PyTorch / TensorFlow', weight: 1.8 },
      { name: 'ML Algorithms', weight: 2.0 }, { name: 'Feature Engineering', weight: 1.5 },
      { name: 'Model Deployment (MLflow / BentoML)', weight: 1.5 }, { name: 'Statistics', weight: 1.8 },
      { name: 'Docker / Cloud', weight: 1.0 },
    ],
    responsibilities: ['Design deep learning models', 'Deploy models to production', 'Run A/B tests', 'Collaborate on ML features'],
    minThresholds: { technical: 6, problemSolving: 7, communication: 4 },
    salaryRange: { min: 130000, max: 170000, currency: 'USD' },
    growthPath: ['Senior ML Engineer', 'Research Engineer'],
  },
  {
    id: 'ml_sen_001',
    title: 'Senior ML Engineer / AI Research Engineer',
    category: 'ml', level: 'senior',
    skills: [
      { name: 'Python', weight: 2.0 }, { name: 'Deep Learning', weight: 2.0 },
      { name: 'LLMs / Transformers', weight: 2.0 }, { name: 'Research & Paper Implementation', weight: 1.8 },
      { name: 'Mathematics (Linear Algebra, Calculus)', weight: 1.8 }, { name: 'Production ML Systems', weight: 1.5 },
      { name: 'MLOps', weight: 1.2 },
    ],
    responsibilities: ['Lead ML research', 'Implement SOTA architectures', 'Own production ML reliability', 'Publish research findings'],
    minThresholds: { technical: 8, problemSolving: 8, communication: 5 },
    salaryRange: { min: 170000, max: 220000, currency: 'USD' },
    growthPath: ['Staff ML Engineer', 'Principal Scientist'],
  },
];

// ─── DevOps / Platform / SRE ──────────────────────────────────

const DEVOPS: RoleTemplate[] = [
  {
    id: 'do_mid_001',
    title: 'DevOps Engineer',
    category: 'devops', level: 'mid',
    skills: [
      { name: 'Docker / Kubernetes', weight: 2.0 }, { name: 'CI/CD (GitHub Actions / Jenkins)', weight: 2.0 },
      { name: 'Terraform / IaC', weight: 1.8 }, { name: 'Cloud (AWS / GCP / Azure)', weight: 1.8 },
      { name: 'Linux Administration', weight: 1.5 }, { name: 'Monitoring (Prometheus / Grafana)', weight: 1.5 },
      { name: 'Bash / Python scripting', weight: 1.2 },
    ],
    responsibilities: ['Build CI/CD pipelines', 'Manage cloud infrastructure', 'Monitor system health', 'Automate operational tasks'],
    minThresholds: { technical: 6, problemSolving: 6, communication: 4 },
    salaryRange: { min: 100000, max: 145000, currency: 'USD' },
    growthPath: ['Senior DevOps Engineer', 'Platform Engineer', 'SRE'],
  },
  {
    id: 'do_sen_001',
    title: 'Site Reliability Engineer (SRE)',
    category: 'devops', level: 'senior',
    skills: [
      { name: 'Kubernetes', weight: 2.0 }, { name: 'Observability (Traces / Metrics / Logs)', weight: 2.0 },
      { name: 'System Design', weight: 1.8 }, { name: 'SLO / SLA Management', weight: 1.8 },
      { name: 'Incident Management', weight: 1.5 }, { name: 'Performance Engineering', weight: 1.5 },
      { name: 'Go / Python', weight: 1.2 },
    ],
    responsibilities: ['Define SLOs and error budgets', 'Lead blameless post-mortems', 'Drive reliability improvements', 'Build platform observability tooling'],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 150000, max: 195000, currency: 'USD' },
    growthPath: ['Principal SRE', 'Director of Infrastructure'],
  },
  {
    id: 'do_sen_002',
    title: 'Platform Engineer',
    category: 'devops', level: 'senior',
    skills: [
      { name: 'Kubernetes / Helm', weight: 2.0 }, { name: 'Developer Tooling & DX', weight: 1.8 },
      { name: 'Terraform / Pulumi', weight: 1.8 }, { name: 'Service Mesh (Istio / Linkerd)', weight: 1.5 },
      { name: 'Internal Developer Platform', weight: 1.8 }, { name: 'Go / Python', weight: 1.2 },
    ],
    responsibilities: ['Build internal developer platform', 'Reduce cognitive load for app engineers', 'Design golden-path deployment workflows', 'Implement security standards'],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 145000, max: 195000, currency: 'USD' },
    growthPath: ['Staff Engineer', 'Head of Platform'],
  },
];

// ─── Mobile ───────────────────────────────────────────────────

const MOBILE: RoleTemplate[] = [
  {
    id: 'mo_mid_001',
    title: 'React Native Developer',
    category: 'mobile', level: 'mid',
    skills: [
      { name: 'React Native', weight: 2.0 }, { name: 'JavaScript / TypeScript', weight: 1.8 },
      { name: 'Redux / Zustand', weight: 1.2 }, { name: 'iOS & Android deployment', weight: 1.2 },
      { name: 'Native Modules', weight: 1.2 }, { name: 'Offline-first / Storage', weight: 1.0 },
      { name: 'REST APIs', weight: 1.2 },
    ],
    responsibilities: ['Build cross-platform apps', 'Integrate native modules', 'Manage app store releases', 'Optimize app performance'],
    minThresholds: { technical: 5, problemSolving: 5, communication: 4 },
    salaryRange: { min: 90000, max: 130000, currency: 'USD' },
    growthPath: ['Senior Mobile Engineer', 'Mobile Tech Lead'],
  },
  {
    id: 'mo_sen_001',
    title: 'Senior Mobile Engineer (iOS / Android)',
    category: 'mobile', level: 'senior',
    skills: [
      { name: 'Swift / Kotlin', weight: 2.0 }, { name: 'Mobile Architecture (MVVM / Clean)', weight: 1.8 },
      { name: 'Performance Profiling', weight: 1.5 }, { name: 'Security (Keychain / Biometrics)', weight: 1.5 },
      { name: 'CI/CD for Mobile', weight: 1.2 }, { name: 'Accessibility (a11y)', weight: 1.2 },
    ],
    responsibilities: ['Own native app architecture', 'Lead mobile platform decisions', 'Drive crash-free improvements', 'Build mobile CI/CD workflows'],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 140000, max: 185000, currency: 'USD' },
    growthPath: ['Mobile Architect', 'Engineering Manager'],
  },
];

// ─── QA Engineering ───────────────────────────────────────────

const QA: RoleTemplate[] = [
  {
    id: 'qa_mid_001',
    title: 'QA Engineer / SDET',
    category: 'qa', level: 'mid',
    skills: [
      { name: 'Test Automation (Playwright / Cypress)', weight: 2.0 },
      { name: 'API Testing (Postman / REST Assured)', weight: 1.8 },
      { name: 'JavaScript / Python', weight: 1.5 }, { name: 'CI/CD Integration', weight: 1.5 },
      { name: 'Performance Testing (k6 / JMeter)', weight: 1.2 }, { name: 'Test Strategy & Planning', weight: 1.5 },
    ],
    responsibilities: ['Design automated test suites', 'Build API and E2E frameworks', 'Integrate tests in CI/CD', 'Report defects with clear steps'],
    minThresholds: { technical: 5, problemSolving: 5, communication: 5 },
    salaryRange: { min: 80000, max: 120000, currency: 'USD' },
    growthPath: ['Senior SDET', 'QA Lead'],
  },
];

// ─── Security ─────────────────────────────────────────────────

const SECURITY: RoleTemplate[] = [
  {
    id: 'sec_mid_001',
    title: 'Application Security Engineer',
    category: 'security', level: 'mid',
    skills: [
      { name: 'OWASP Top 10', weight: 2.0 }, { name: 'Penetration Testing', weight: 1.8 },
      { name: 'Secure Code Review', weight: 1.8 }, { name: 'SAST / DAST Tools', weight: 1.5 },
      { name: 'Python / Go', weight: 1.2 }, { name: 'Cloud Security (IAM / Policies)', weight: 1.5 },
    ],
    responsibilities: ['Conduct security reviews', 'Perform penetration testing', 'Implement SAST/DAST in CI/CD', 'Train developers on secure coding'],
    minThresholds: { technical: 6, problemSolving: 6, communication: 5 },
    salaryRange: { min: 110000, max: 155000, currency: 'USD' },
    growthPath: ['Senior AppSec Engineer', 'Security Architect'],
  },
];

// ─── Exported Database ────────────────────────────────────────

export const ROLE_DATABASE: RoleTemplate[] = [
  ...FRONTEND,
  ...BACKEND,
  ...FULLSTACK,
  ...DATA,
  ...ML,
  ...DEVOPS,
  ...MOBILE,
  ...QA,
  ...SECURITY,
];

export const ROLE_COUNT = ROLE_DATABASE.length;

export const getRolesByCategory = (category: RoleCategory): RoleTemplate[] =>
  ROLE_DATABASE.filter(r => r.category === category);

export const getRolesByLevel = (level: DifficultyLevel): RoleTemplate[] =>
  ROLE_DATABASE.filter(r => r.level === level);

export const getRoleById = (id: string): RoleTemplate | undefined =>
  ROLE_DATABASE.find(r => r.id === id);
