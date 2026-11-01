/** Demo / sample data only — not live assessments or open roles.
 * Identity replaced for QA pass: fictional Demo Student + reserved example.invalid email.
 */

export const studentProfile = {
  name: 'Demo Student',
  email: 'demo.student@example.invalid',
  college: 'Guru Nanak Dev Engineering College (GNDEC)',
  branch: 'Computer Science & Engineering',
  graduationYear: 2027,
  cgpa: '8.42',
  location: 'Ludhiana, Punjab',
  skills: ['DSA', 'React', 'Node.js', 'SQL', 'Aptitude', 'Communication'],
  careerInterests: ['Software Engineering', 'Full-Stack Development', 'Product Internships'],
}

export const dashboardStats = {
  preparationProgress: 62,
  activeRoadmaps: 3,
  skillsTracked: 24,
  savedInternships: 5,
}

export const skillOverview = [
  { name: 'DSA', score: 68, note: 'Demo score' },
  { name: 'Frontend', score: 74, note: 'Demo score' },
  { name: 'Backend', score: 58, note: 'Demo score' },
  { name: 'Aptitude', score: 81, note: 'Demo score' },
  { name: 'Core CS', score: 63, note: 'Demo score' },
  { name: 'Communication', score: 70, note: 'Demo score' },
]

export const roadmaps = [
  {
    id: 'dsa',
    title: 'Data Structures & Algorithms',
    category: 'DSA',
    description: 'Arrays to graphs with weekly problem sets tailored for campus placements.',
    progress: 45,
    modules: 12,
    completedModules: 5,
    accent: 'primary',
  },
  {
    id: 'dev',
    title: 'Full-Stack Development',
    category: 'Development',
    description: 'HTML to React and Node — ship portfolio projects employers can review.',
    progress: 38,
    modules: 10,
    completedModules: 4,
    accent: 'secondary',
  },
  {
    id: 'aptitude',
    title: 'Quantitative & Logical Aptitude',
    category: 'Aptitude',
    description: 'Speed and accuracy drills for common campus aptitude rounds.',
    progress: 72,
    modules: 8,
    completedModules: 6,
    accent: 'primary',
  },
  {
    id: 'core-cs',
    title: 'Computer Science Fundamentals',
    category: 'Core CS',
    description: 'OS, DBMS, Networks, and OOP — interview-ready concept coverage.',
    progress: 28,
    modules: 9,
    completedModules: 2,
    accent: 'secondary',
  },
]

export const recruiters = [
  {
    id: 'acme',
    name: 'Acme Soft Labs',
    initials: 'AS',
    roles: ['SDE Intern', 'Graduate Engineer'],
    skills: ['DSA', 'Java', 'SQL'],
    rounds: ['Online Assessment', 'Technical', 'HR'],
    eligibility: 'Sample data · CGPA ≥ 7.0 · CSE / IT / ECE',
    location: 'Bengaluru (sample)',
  },
  {
    id: 'northstar',
    name: 'Northstar Analytics',
    initials: 'NA',
    roles: ['Data Analyst Intern'],
    skills: ['Python', 'SQL', 'Statistics'],
    rounds: ['Aptitude', 'Case Study', 'HR'],
    eligibility: 'Sample data · Final / pre-final year',
    location: 'Hybrid · Delhi NCR (sample)',
  },
  {
    id: 'pixelcraft',
    name: 'PixelCraft Studio',
    initials: 'PC',
    roles: ['Frontend Intern', 'UI Engineer'],
    skills: ['React', 'JavaScript', 'CSS'],
    rounds: ['Portfolio Review', 'Technical', 'Culture'],
    eligibility: 'Sample data · Strong frontend projects preferred',
    location: 'Remote (sample)',
  },
  {
    id: 'orbit',
    name: 'Orbit Systems',
    initials: 'OS',
    roles: ['Backend Intern'],
    skills: ['Node.js', 'APIs', 'Databases'],
    rounds: ['Coding', 'System Design Lite', 'HR'],
    eligibility: 'Sample data · CSE / IT · 2026–2027 batch',
    location: 'Pune (sample)',
  },
  {
    id: 'lumen',
    name: 'Lumen FinTech',
    initials: 'LF',
    roles: ['SDE', 'QA Intern'],
    skills: ['DSA', 'OOP', 'Testing'],
    rounds: ['OA', 'Technical ×2', 'HR'],
    eligibility: 'Sample data · No active backlogs',
    location: 'Hyderabad (sample)',
  },
]

export const internships = [
  {
    id: 'int-1',
    company: 'Acme Soft Labs',
    role: 'Software Development Intern',
    workMode: 'Hybrid',
    skills: ['DSA', 'Java', 'Git'],
    eligibility: 'Sample listing · Pre-final year CSE/IT',
    deadline: '2026-12-15',
    applyUrl: '#',
  },
  {
    id: 'int-2',
    company: 'PixelCraft Studio',
    role: 'Frontend Engineering Intern',
    workMode: 'Remote',
    skills: ['React', 'Tailwind', 'JavaScript'],
    eligibility: 'Sample listing · Portfolio required',
    deadline: '2026-11-30',
    applyUrl: '#',
  },
  {
    id: 'int-3',
    company: 'Northstar Analytics',
    role: 'Data Analyst Intern',
    workMode: 'On-site',
    skills: ['Python', 'SQL', 'Excel'],
    eligibility: 'Sample listing · Strong aptitude preferred',
    deadline: '2027-01-10',
    applyUrl: '#',
  },
  {
    id: 'int-4',
    company: 'Orbit Systems',
    role: 'Backend Intern',
    workMode: 'Hybrid',
    skills: ['Node.js', 'MongoDB', 'REST'],
    eligibility: 'Sample listing · 2026–2027 batch',
    deadline: '2026-12-01',
    applyUrl: '#',
  },
  {
    id: 'int-5',
    company: 'Lumen FinTech',
    role: 'QA Automation Intern',
    workMode: 'Remote',
    skills: ['Testing', 'JavaScript', 'Cypress'],
    eligibility: 'Sample listing · Detail-oriented',
    deadline: '2026-11-20',
    applyUrl: '#',
  },
]

export const skillCategories = [
  {
    id: 'dsa',
    title: 'DSA',
    description: 'Problem-solving patterns and coding speed',
    skills: [
      { name: 'Arrays & Strings', score: 78 },
      { name: 'Trees & Graphs', score: 55 },
      { name: 'DP Basics', score: 42 },
    ],
  },
  {
    id: 'frontend',
    title: 'Frontend',
    description: 'UI engineering and component design',
    skills: [
      { name: 'HTML/CSS', score: 86 },
      { name: 'JavaScript', score: 74 },
      { name: 'React', score: 68 },
    ],
  },
  {
    id: 'backend',
    title: 'Backend',
    description: 'APIs, auth, and server fundamentals',
    skills: [
      { name: 'Node.js', score: 60 },
      { name: 'REST APIs', score: 58 },
      { name: 'Auth Basics', score: 48 },
    ],
  },
  {
    id: 'databases',
    title: 'Databases',
    description: 'Schema design and querying',
    skills: [
      { name: 'SQL', score: 72 },
      { name: 'NoSQL', score: 50 },
      { name: 'Indexing Basics', score: 40 },
    ],
  },
  {
    id: 'aptitude',
    title: 'Aptitude',
    description: 'Quantitative and logical reasoning',
    skills: [
      { name: 'Quantitative', score: 84 },
      { name: 'Logical', score: 79 },
      { name: 'Verbal', score: 71 },
    ],
  },
  {
    id: 'core-cs',
    title: 'Core CS',
    description: 'Foundational CS theory for interviews',
    skills: [
      { name: 'OS', score: 62 },
      { name: 'DBMS', score: 66 },
      { name: 'Networks', score: 54 },
    ],
  },
  {
    id: 'communication',
    title: 'Communication',
    description: 'Interview presence and written clarity',
    skills: [
      { name: 'Technical Writing', score: 70 },
      { name: 'Interview Speaking', score: 65 },
      { name: 'Team Collaboration', score: 78 },
    ],
  },
]

export const recentActivity = [
  { id: 1, text: 'Completed Arrays module in DSA roadmap', time: '2h ago', type: 'roadmap' },
  { id: 2, text: 'Saved PixelCraft Frontend Intern listing', time: 'Yesterday', type: 'internship' },
  { id: 3, text: 'Updated profile CGPA and skills', time: '2 days ago', type: 'profile' },
  { id: 4, text: 'Reviewed Acme Soft Labs recruitment rounds', time: '3 days ago', type: 'recruiter' },
]

export const navItems = [
  { to: '/dashboard', label: 'Overview', icon: 'LayoutDashboard' },
  { to: '/roadmaps', label: 'My Roadmaps', icon: 'Map' },
  { to: '/recruiters', label: 'Recruiters', icon: 'Building2' },
  { to: '/internships', label: 'Internships', icon: 'Briefcase' },
  { to: '/skills', label: 'My Skills', icon: 'Sparkles' },
  { to: '/profile', label: 'My Profile', icon: 'User' },
]
