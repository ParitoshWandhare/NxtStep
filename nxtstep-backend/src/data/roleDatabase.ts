// ============================================================
// NxtStep — Role Database
// 40+ curated role templates across frontend, backend,
// fullstack, data, ML, DevOps, mobile, and QA.
// Each role has skills (with weights), minThresholds, and
// responsibilities used by the matching algorithm.
// ============================================================

export interface SkillEntry {
  name: string;
  weight: number; // 0.5 – 2.0; higher = more important for this role
}

export interface RoleTemplate {
  id: string;
  title: string;
  category: RoleCategory;
  level: DifficultyLevel;
  skills: SkillEntry[];
  responsibilities: string[];
  minThresholds: {
    technical: number;       // 0–10
    problemSolving: number;  // 0–10
    communication: number;   // 0–10
  };
  salaryRange?: { min: number; max: number; currency: string };
  growthPath?: string[];     // Next roles in career progression
}

export type RoleCategory =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'data'
  | 'ml'
  | 'devops'
  | 'mobile'
  | 'qa'
  | 'security';

export type DifficultyLevel = 'junior' | 'mid' | 'senior';

// ─── Frontend ────────────────────────────────────────────────

const FRONTEND: RoleTemplate[] = [
  {
    id: 'frontend_junior_001',
    title: 'Junior Frontend Developer',
    category: 'frontend',
    level: 'junior',
    skills: [
      { name: 'HTML', weight: 1.2 },
      { name: 'CSS', weight: 1.2 },
      { name: 'JavaScript', weight: 1.8 },
      { name: 'React', weight: 1.5 },
      { name: 'Git', weight: 1.0 },
      { name: 'Responsive Design', weight: 1.0 },
    ],
    responsibilities: [
      'Build and maintain UI components',
      'Fix bugs and implement feature requests',
      'Participate in code reviews',
      'Write unit tests for components',
    ],
    minThresholds: { technical: 4, problemSolving: 3, communication: 4 },
    salaryRange: { min: 60000, max: 85000, currency: 'USD' },
    growthPath: ['React Developer', 'Mid Frontend Engineer'],
  },
  {
    id: 'frontend_mid_001',
    title: 'React Developer',
    category: 'frontend',
    level: 'mid',
    skills: [
      { name: 'React', weight: 2.0 },
      { name: 'TypeScript', weight: 1.8 },
      { name: 'Redux / Zustand', weight: 1.2 },
      { name: 'REST APIs', weight: 1.2 },
      { name: 'CSS / Tailwind', weight: 1.0 },
      { name: 'Testing (Jest / RTL)', weight: 1.2 },
      { name: 'Performance Optimization', weight: 1.0 },
    ],
    responsibilities: [
      'Architect and build complex SPAs',
      'Manage client-side state effectively',
      'Optimize rendering performance',
      'Integrate with backend APIs',
      'Mentor junior developers',
    ],
    minThresholds: { technical: 6, problemSolving: 5, communication: 5 },
    salaryRange: { min: 85000, max: 120000, currency: 'USD' },
    growthPath: ['Senior Frontend Engineer', 'Frontend Tech Lead'],
  },
  {
    id: 'frontend_mid_002',
    title: 'Vue.js Developer',
    category: 'frontend',
    level: 'mid',
    skills: [
      { name: 'Vue.js', weight: 2.0 },
      { name: 'JavaScript', weight: 1.8 },
      { name: 'Pinia / Vuex', weight: 1.2 },
      { name: 'TypeScript', weight: 1.2 },
      { name: 'REST APIs', weight: 1.0 },
      { name: 'CSS', weight: 1.0 },
    ],
    responsibilities: [
      'Build Vue.js single-page applications',
      'Manage application state with Pinia/Vuex',
      'Create reusable component libraries',
      'Write end-to-end tests with Cypress',
    ],
    minThresholds: { technical: 5, problemSolving: 5, communication: 4 },
    salaryRange: { min: 80000, max: 115000, currency: 'USD' },
    growthPath: ['Senior Vue Developer', 'Frontend Architect'],
  },
  {
    id: 'frontend_senior_001',
    title: 'Senior Frontend Engineer',
    category: 'frontend',
    level: 'senior',
    skills: [
      { name: 'React / Next.js', weight: 2.0 },
      { name: 'TypeScript', weight: 2.0 },
      { name: 'System Design (Frontend)', weight: 1.8 },
      { name: 'Performance & Web Vitals', weight: 1.5 },
      { name: 'Design Systems', weight: 1.2 },
      { name: 'Mentoring', weight: 1.0 },
      { name: 'Micro-frontends', weight: 1.0 },
    ],
    responsibilities: [
      'Lead frontend architecture decisions',
      'Define and maintain design system standards',
      'Drive performance initiatives across web properties',
      'Mentor and grow junior/mid engineers',
      'Partner with product and design on feasibility',
    ],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 130000, max: 175000, currency: 'USD' },
    growthPath: ['Frontend Architect', 'Engineering Manager'],
  },
  {
    id: 'frontend_senior_002',
    title: 'Frontend Architect',
    category: 'frontend',
    level: 'senior',
    skills: [
      { name: 'Architecture Patterns', weight: 2.0 },
      { name: 'React / Next.js', weight: 1.8 },
      { name: 'TypeScript', weight: 1.8 },
      { name: 'Build Systems (Webpack / Vite)', weight: 1.5 },
      { name: 'Micro-frontends', weight: 1.5 },
      { name: 'Security (XSS / CSRF)', weight: 1.2 },
      { name: 'Technical Leadership', weight: 1.5 },
    ],
    responsibilities: [
      'Define frontend platform strategy',
      'Evaluate and adopt new technologies',
      'Drive cross-team architectural consistency',
      'Own frontend performance budgets',
    ],
    minThresholds: { technical: 8, problemSolving: 8, communication: 7 },
    salaryRange: { min: 150000, max: 200000, currency: 'USD' },
    growthPath: ['Principal Engineer', 'VP of Engineering'],
  },
];

// ─── Backend ──────────────────────────────────────────────────

const BACKEND: RoleTemplate[] = [
  {
    id: 'backend_junior_001',
    title: 'Junior Backend Developer',
    category: 'backend',
    level: 'junior',
    skills: [
      { name: 'Node.js', weight: 1.8 },
      { name: 'REST APIs', weight: 1.8 },
      { name: 'SQL', weight: 1.2 },
      { name: 'Git', weight: 1.0 },
      { name: 'Express.js', weight: 1.5 },
      { name: 'Basic Authentication', weight: 1.0 },
    ],
    responsibilities: [
      'Build and maintain REST API endpoints',
      'Write database queries and migrations',
      'Implement basic authentication flows',
      'Write unit and integration tests',
    ],
    minThresholds: { technical: 4, problemSolving: 3, communication: 3 },
    salaryRange: { min: 60000, max: 85000, currency: 'USD' },
    growthPath: ['Node.js Developer', 'Mid Backend Engineer'],
  },
  {
    id: 'backend_mid_001',
    title: 'Node.js Backend Developer',
    category: 'backend',
    level: 'mid',
    skills: [
      { name: 'Node.js', weight: 2.0 },
      { name: 'TypeScript', weight: 1.8 },
      { name: 'MongoDB / PostgreSQL', weight: 1.5 },
      { name: 'Redis', weight: 1.2 },
      { name: 'REST APIs / GraphQL', weight: 1.5 },
      { name: 'JWT / OAuth2', weight: 1.2 },
      { name: 'Message Queues (BullMQ / RabbitMQ)', weight: 1.0 },
    ],
    responsibilities: [
      'Build scalable, secure API services',
      'Design database schemas and optimize queries',
      'Implement caching strategies with Redis',
      'Handle authentication and authorization',
      'Write comprehensive test suites',
    ],
    minThresholds: { technical: 6, problemSolving: 5, communication: 4 },
    salaryRange: { min: 90000, max: 130000, currency: 'USD' },
    growthPath: ['Senior Backend Engineer', 'Platform Engineer'],
  },
  {
    id: 'backend_mid_002',
    title: 'Python Backend Developer',
    category: 'backend',
    level: 'mid',
    skills: [
      { name: 'Python', weight: 2.0 },
      { name: 'Django / FastAPI', weight: 1.8 },
      { name: 'PostgreSQL', weight: 1.5 },
      { name: 'REST APIs', weight: 1.5 },
      { name: 'Celery', weight: 1.2 },
      { name: 'Docker', weight: 1.0 },
    ],
    responsibilities: [
      'Build Django/FastAPI web services',
      'Design and optimize SQL queries with Django ORM',
      'Implement async task processing with Celery',
      'Write and maintain API documentation',
    ],
    minThresholds: { technical: 5, problemSolving: 5, communication: 4 },
    salaryRange: { min: 85000, max: 125000, currency: 'USD' },
    growthPath: ['Senior Python Engineer', 'Backend Tech Lead'],
  },
  {
    id: 'backend_senior_001',
    title: 'Senior Backend Engineer',
    category: 'backend',
    level: 'senior',
    skills: [
      { name: 'System Design', weight: 2.0 },
      { name: 'Node.js / Python', weight: 1.8 },
      { name: 'Distributed Systems', weight: 1.8 },
      { name: 'Database Optimization', weight: 1.5 },
      { name: 'Microservices', weight: 1.5 },
      { name: 'Security Best Practices', weight: 1.2 },
      { name: 'Observability', weight: 1.2 },
    ],
    responsibilities: [
      'Architect distributed backend systems',
      'Lead performance tuning and capacity planning',
      'Drive API design and versioning strategy',
      'Mentor engineers on scalability patterns',
    ],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 140000, max: 185000, currency: 'USD' },
    growthPath: ['Principal Engineer', 'Backend Architect'],
  },
];

// ─── Fullstack ────────────────────────────────────────────────

const FULLSTACK: RoleTemplate[] = [
  {
    id: 'fullstack_junior_001',
    title: 'Junior Fullstack Developer',
    category: 'fullstack',
    level: 'junior',
    skills: [
      { name: 'React', weight: 1.5 },
      { name: 'Node.js', weight: 1.5 },
      { name: 'SQL / MongoDB', weight: 1.2 },
      { name: 'REST APIs', weight: 1.5 },
      { name: 'JavaScript', weight: 1.8 },
      { name: 'Git', weight: 1.0 },
    ],
    responsibilities: [
      'Build end-to-end features across frontend and backend',
      'Integrate frontend with API services',
      'Write database queries and maintain schemas',
      'Debug and fix issues across the full stack',
    ],
    minThresholds: { technical: 4, problemSolving: 3, communication: 4 },
    salaryRange: { min: 65000, max: 90000, currency: 'USD' },
    growthPath: ['MERN Stack Developer', 'Mid Fullstack Engineer'],
  },
  {
    id: 'fullstack_mid_001',
    title: 'MERN Stack Developer',
    category: 'fullstack',
    level: 'mid',
    skills: [
      { name: 'MongoDB', weight: 1.5 },
      { name: 'Express.js', weight: 1.5 },
      { name: 'React', weight: 1.8 },
      { name: 'Node.js', weight: 1.8 },
      { name: 'TypeScript', weight: 1.5 },
      { name: 'Redux / Context API', weight: 1.2 },
      { name: 'REST APIs', weight: 1.5 },
    ],
    responsibilities: [
      'Own complete feature delivery across the MERN stack',
      'Design MongoDB data models and aggregation pipelines',
      'Build and maintain React component libraries',
      'Implement real-time features with Socket.IO',
    ],
    minThresholds: { technical: 6, problemSolving: 5, communication: 5 },
    salaryRange: { min: 90000, max: 130000, currency: 'USD' },
    growthPath: ['Senior Fullstack Engineer', 'Tech Lead'],
  },
  {
    id: 'fullstack_mid_002',
    title: 'Next.js Fullstack Developer',
    category: 'fullstack',
    level: 'mid',
    skills: [
      { name: 'Next.js', weight: 2.0 },
      { name: 'React', weight: 1.8 },
      { name: 'TypeScript', weight: 1.8 },
      { name: 'Prisma / Drizzle', weight: 1.5 },
      { name: 'PostgreSQL', weight: 1.5 },
      { name: 'Server Components', weight: 1.5 },
      { name: 'tRPC / REST', weight: 1.2 },
    ],
    responsibilities: [
      'Build full-stack Next.js applications with App Router',
      'Design server actions and API routes',
      'Implement SSR, SSG, and ISR strategies',
      'Optimize Core Web Vitals',
    ],
    minThresholds: { technical: 6, problemSolving: 5, communication: 5 },
    salaryRange: { min: 95000, max: 135000, currency: 'USD' },
    growthPath: ['Senior Fullstack Engineer', 'Platform Engineer'],
  },
  {
    id: 'fullstack_senior_001',
    title: 'Senior Fullstack Engineer',
    category: 'fullstack',
    level: 'senior',
    skills: [
      { name: 'React / Next.js', weight: 1.8 },
      { name: 'Node.js', weight: 1.8 },
      { name: 'System Design', weight: 2.0 },
      { name: 'TypeScript', weight: 1.8 },
      { name: 'DevOps (CI/CD, Docker)', weight: 1.2 },
      { name: 'Database Architecture', weight: 1.5 },
      { name: 'Technical Leadership', weight: 1.5 },
    ],
    responsibilities: [
      'Drive end-to-end feature architecture',
      'Own delivery from database to UI',
      'Establish code quality standards and best practices',
      'Mentor full-stack team members',
    ],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 140000, max: 185000, currency: 'USD' },
    growthPath: ['Principal Engineer', 'Engineering Manager'],
  },
];

// ─── Data Engineering ─────────────────────────────────────────

const DATA: RoleTemplate[] = [
  {
    id: 'data_junior_001',
    title: 'Data Analyst',
    category: 'data',
    level: 'junior',
    skills: [
      { name: 'SQL', weight: 2.0 },
      { name: 'Python (pandas)', weight: 1.5 },
      { name: 'Excel / Google Sheets', weight: 1.2 },
      { name: 'Data Visualization (Tableau / Power BI)', weight: 1.5 },
      { name: 'Statistics Fundamentals', weight: 1.5 },
    ],
    responsibilities: [
      'Write SQL queries to extract and analyze data',
      'Build dashboards and reports for stakeholders',
      'Identify trends and provide actionable insights',
      'Validate data quality and flag anomalies',
    ],
    minThresholds: { technical: 4, problemSolving: 4, communication: 5 },
    salaryRange: { min: 60000, max: 85000, currency: 'USD' },
    growthPath: ['Data Scientist', 'Data Engineer'],
  },
  {
    id: 'data_mid_001',
    title: 'Data Engineer',
    category: 'data',
    level: 'mid',
    skills: [
      { name: 'Python', weight: 2.0 },
      { name: 'SQL', weight: 1.8 },
      { name: 'Apache Spark', weight: 1.5 },
      { name: 'ETL Pipelines (Airflow)', weight: 1.8 },
      { name: 'Data Warehousing (Snowflake / BigQuery)', weight: 1.5 },
      { name: 'dbt', weight: 1.2 },
      { name: 'Cloud (AWS / GCP)', weight: 1.2 },
    ],
    responsibilities: [
      'Design and build scalable data pipelines',
      'Maintain and optimize data warehouse models',
      'Implement data quality checks and monitoring',
      'Collaborate with data scientists on data needs',
    ],
    minThresholds: { technical: 6, problemSolving: 6, communication: 4 },
    salaryRange: { min: 100000, max: 140000, currency: 'USD' },
    growthPath: ['Senior Data Engineer', 'Data Architect'],
  },
  {
    id: 'data_senior_001',
    title: 'Senior Data Engineer',
    category: 'data',
    level: 'senior',
    skills: [
      { name: 'Python', weight: 2.0 },
      { name: 'Apache Spark / Flink', weight: 2.0 },
      { name: 'Data Architecture', weight: 2.0 },
      { name: 'Real-time Streaming (Kafka)', weight: 1.5 },
      { name: 'Cloud Data Platforms', weight: 1.8 },
      { name: 'Data Governance', weight: 1.2 },
    ],
    responsibilities: [
      'Design the data platform architecture',
      'Build real-time streaming pipelines at scale',
      'Lead data infrastructure modernization',
      'Define data engineering best practices',
    ],
    minThresholds: { technical: 7, problemSolving: 7, communication: 5 },
    salaryRange: { min: 150000, max: 195000, currency: 'USD' },
    growthPath: ['Data Architect', 'Head of Data Engineering'],
  },
];

// ─── Machine Learning / AI ────────────────────────────────────

const ML: RoleTemplate[] = [
  {
    id: 'ml_junior_001',
    title: 'Junior ML Engineer',
    category: 'ml',
    level: 'junior',
    skills: [
      { name: 'Python', weight: 2.0 },
      { name: 'Scikit-learn', weight: 1.8 },
      { name: 'Statistics & Probability', weight: 1.8 },
      { name: 'Data Preprocessing', weight: 1.5 },
      { name: 'Jupyter Notebooks', weight: 1.2 },
      { name: 'SQL', weight: 1.0 },
    ],
    responsibilities: [
      'Train and evaluate classic ML models',
      'Perform feature engineering and data preprocessing',
      'Run and track experiments',
      'Present findings to technical stakeholders',
    ],
    minThresholds: { technical: 4, problemSolving: 5, communication: 3 },
    salaryRange: { min: 85000, max: 110000, currency: 'USD' },
    growthPath: ['ML Engineer', 'Data Scientist'],
  },
  {
    id: 'ml_mid_001',
    title: 'Machine Learning Engineer',
    category: 'ml',
    level: 'mid',
    skills: [
      { name: 'Python', weight: 2.0 },
      { name: 'PyTorch / TensorFlow', weight: 1.8 },
      { name: 'ML Algorithms', weight: 2.0 },
      { name: 'Feature Engineering', weight: 1.5 },
      { name: 'Model Deployment (MLflow / BentoML)', weight: 1.5 },
      { name: 'Statistics', weight: 1.8 },
      { name: 'Docker / Cloud', weight: 1.0 },
    ],
    responsibilities: [
      'Design and train deep learning models',
      'Deploy models to production with proper monitoring',
      'Run A/B tests to validate model performance',
      'Collaborate with product on ML-driven features',
    ],
    minThresholds: { technical: 6, problemSolving: 7, communication: 4 },
    salaryRange: { min: 130000, max: 170000, currency: 'USD' },
    growthPath: ['Senior ML Engineer', 'Research Engineer'],
  },
  {
    id: 'ml_senior_001',
    title: 'Senior ML Engineer / AI Research Engineer',
    category: 'ml',
    level: 'senior',
    skills: [
      { name: 'Python', weight: 2.0 },
      { name: 'Deep Learning', weight: 2.0 },
      { name: 'LLMs / Transformers', weight: 2.0 },
      { name: 'Research & Paper Implementation', weight: 1.8 },
      { name: 'Mathematics (Linear Algebra, Calculus)', weight: 1.8 },
      { name: 'Production ML Systems', weight: 1.5 },
      { name: 'MLOps', weight: 1.2 },
    ],
    responsibilities: [
      'Lead ML research and model development',
      'Implement state-of-the-art architectures',
      'Own production ML system reliability',
      'Publish internal and external research findings',
    ],
    minThresholds: { technical: 8, problemSolving: 8, communication: 5 },
    salaryRange: { min: 170000, max: 220000, currency: 'USD' },
    growthPath: ['Staff ML Engineer', 'Principal Scientist'],
  },
];

// ─── DevOps / Platform / SRE ──────────────────────────────────

const DEVOPS: RoleTemplate[] = [
  {
    id: 'devops_mid_001',
    title: 'DevOps Engineer',
    category: 'devops',
    level: 'mid',
    skills: [
      { name: 'Docker / Kubernetes', weight: 2.0 },
      { name: 'CI/CD (GitHub Actions / Jenkins)', weight: 2.0 },
      { name: 'Terraform / IaC', weight: 1.8 },
      { name: 'Cloud (AWS / GCP / Azure)', weight: 1.8 },
      { name: 'Linux Administration', weight: 1.5 },
      { name: 'Monitoring (Prometheus / Grafana)', weight: 1.5 },
      { name: 'Bash / Python scripting', weight: 1.2 },
    ],
    responsibilities: [
      'Build and maintain CI/CD pipelines',
      'Manage cloud infrastructure with Terraform',
      'Monitor system health and respond to incidents',
      'Automate operational tasks and runbooks',
    ],
    minThresholds: { technical: 6, problemSolving: 6, communication: 4 },
    salaryRange: { min: 100000, max: 145000, currency: 'USD' },
    growthPath: ['Senior DevOps Engineer', 'Platform Engineer', 'SRE'],
  },
  {
    id: 'devops_senior_001',
    title: 'Site Reliability Engineer (SRE)',
    category: 'devops',
    level: 'senior',
    skills: [
      { name: 'Kubernetes', weight: 2.0 },
      { name: 'Observability (Traces / Metrics / Logs)', weight: 2.0 },
      { name: 'System Design', weight: 1.8 },
      { name: 'SLO / SLA Management', weight: 1.8 },
      { name: 'Incident Management', weight: 1.5 },
      { name: 'Performance Engineering', weight: 1.5 },
      { name: 'Go / Python', weight: 1.2 },
    ],
    responsibilities: [
      'Define and own SLOs and error budgets',
      'Lead blameless post-mortems and implement remediations',
      'Drive reliability improvements across services',
      'Build internal tooling for platform observability',
    ],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 150000, max: 195000, currency: 'USD' },
    growthPath: ['Principal SRE', 'Director of Infrastructure'],
  },
  {
    id: 'devops_senior_002',
    title: 'Platform Engineer',
    category: 'devops',
    level: 'senior',
    skills: [
      { name: 'Kubernetes / Helm', weight: 2.0 },
      { name: 'Developer Tooling & DX', weight: 1.8 },
      { name: 'Terraform / Pulumi', weight: 1.8 },
      { name: 'Service Mesh (Istio / Linkerd)', weight: 1.5 },
      { name: 'Internal Developer Platform', weight: 1.8 },
      { name: 'Go / Python', weight: 1.2 },
    ],
    responsibilities: [
      'Build and own internal developer platform',
      'Reduce cognitive load for application engineers',
      'Design golden-path deployment workflows',
      'Implement platform security standards',
    ],
    minThresholds: { technical: 7, problemSolving: 7, communication: 6 },
    salaryRange: { min: 145000, max: 195000, currency: 'USD' },
    growthPath: ['Staff Engineer', 'Head of Platform'],
  },
];

// ─── Mobile ───────────────────────────────────────────────────

const MOBILE: RoleTemplate[] = [
  {
    id: 'mobile_mid_001',
    title: 'React Native Developer',
    category: 'mobile',
    level: 'mid',
    skills: [
      { name: 'React Native', weight: 2.0 },
      { name: 'JavaScript / TypeScript', weight: 1.8 },
      { name: 'Redux / Zustand', weight: 1.2 },
      { name: 'iOS & Android deployment', weight: 1.2 },
      { name: 'Native Modules', weight: 1.2 },
      { name: 'Offline-first / Storage', weight: 1.0 },
      { name: 'REST APIs', weight: 1.2 },
    ],
    responsibilities: [
      'Build cross-platform iOS and Android apps',
      'Integrate native modules and third-party SDKs',
      'Manage app store submissions and releases',
      'Optimize app startup time and render performance',
    ],
    minThresholds: { technical: 5, problemSolving: 5, communication: 4 },
    salaryRange: { min: 90000, max: 130000, currency: 'USD' },
    growthPath: ['Senior Mobile Engineer', 'Mobile Tech Lead'],
  },
  {
    id: 'mobile_senior_001',
    title: 'Senior Mobile Engineer (iOS / Android)',
    category: 'mobile',
    level: 'senior',
    skills: [
      { name: 'Swift / Kotlin', weight: 2.0 },
      { name: 'Mobile Architecture (MVVM / Clean)', weight: 1.8 },
      { name: 'Performance Profiling', weight: 1.5 },
      { name: 'Security (Keychain / Biometrics)', weight: 1.5 },
      { name: 'CI/CD for Mobile', weight: 1.2 },
      { name: 'Accessibility (a11y)', weight: 1.2 },
    ],
    responsibilities: [
      'Own native iOS or Android application architecture',
      'Lead mobile platform technical decisions',
      'Drive app performance and crash-free improvements',
      'Build scalable mobile CI/CD workflows',
    ],
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
    category: 'qa',
    level: 'mid',
    skills: [
      { name: 'Test Automation (Playwright / Cypress)', weight: 2.0 },
      { name: 'API Testing (Postman / REST Assured)', weight: 1.8 },
      { name: 'JavaScript / Python', weight: 1.5 },
      { name: 'CI/CD Integration', weight: 1.5 },
      { name: 'Performance Testing (k6 / JMeter)', weight: 1.2 },
      { name: 'Test Strategy & Planning', weight: 1.5 },
    ],
    responsibilities: [
      'Design and maintain automated test suites',
      'Build API and E2E test frameworks from scratch',
      'Integrate tests into CI/CD pipelines',
      'Report and track defects with clear reproduction steps',
    ],
    minThresholds: { technical: 5, problemSolving: 5, communication: 5 },
    salaryRange: { min: 80000, max: 120000, currency: 'USD' },
    growthPath: ['Senior SDET', 'QA Lead'],
  },
];

// ─── Security ─────────────────────────────────────────────────

const SECURITY: RoleTemplate[] = [
  {
    id: 'security_mid_001',
    title: 'Application Security Engineer',
    category: 'security',
    level: 'mid',
    skills: [
      { name: 'OWASP Top 10', weight: 2.0 },
      { name: 'Penetration Testing', weight: 1.8 },
      { name: 'Secure Code Review', weight: 1.8 },
      { name: 'SAST / DAST Tools', weight: 1.5 },
      { name: 'Python / Go', weight: 1.2 },
      { name: 'Cloud Security (IAM / Policies)', weight: 1.5 },
    ],
    responsibilities: [
      'Conduct security reviews and threat modeling',
      'Perform penetration testing on web applications',
      'Implement and maintain SAST/DAST in CI/CD',
      'Educate developers on secure coding practices',
    ],
    minThresholds: { technical: 6, problemSolving: 6, communication: 5 },
    salaryRange: { min: 110000, max: 155000, currency: 'USD' },
    growthPath: ['Senior AppSec Engineer', 'Security Architect'],
  },
];

// ─── Exported database ───────────────────────────────────────

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
  ROLE_DATABASE.filter((r) => r.category === category);

export const getRolesByLevel = (level: DifficultyLevel): RoleTemplate[] =>
  ROLE_DATABASE.filter((r) => r.level === level);

export const getRoleById = (id: string): RoleTemplate | undefined =>
  ROLE_DATABASE.find((r) => r.id === id);