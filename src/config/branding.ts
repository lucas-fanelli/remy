/**
 * Central branding configuration
 * Change these values to rebrand the entire application
 */

export const BRANDING = {
  // App name
  name: "Remy's",

  // Tagline/description
  tagline: 'Anyone can cook',
  description: 'A social network for chefs and cooking enthusiasts with AI-powered cooking tools',
  taglineExtended:
    'Named after the famous chef rat from Ratatouille, this platform embodies the belief that "anyone can cook" — and everyone has something delicious to share.',

  // Logo paths
  logo: '/chef-logo.png',
  icon: '/chef-logo.png',

  // Color scheme
  colors: {
    primary: '#673AB7', // Rich purple (primary brand color)
    secondary: '#512DA8', // Deep purple
    accent: '#FFC107', // Golden yellow (accent/highlights)
  },

  // Font
  font: '"Pacifico", cursive',

  // Social & contact
  tagPrefix: '@',
  youtube: 'https://www.youtube.com/@9QNA-4I',
  contactEmail: 'lucasarielfanelli@hotmail.com',

  // Creator info
  // Note: Adding an avatar for the creator requires code changes in the About page component.
  // This config only stores text/URL values; avatar rendering is handled in the component.
  creator: {
    name: 'Lucas Fanelli',
    initials: 'LF',
    bio: "Full-stack developer passionate about creating beautiful, functional web applications. Remy's was built as a labor of love, combining a passion for technology and food.",
  },

  // Registration messaging
  registrationMessage: 'Join our community of passionate cooks and food lovers!',

  // Login message
  loginMessage: 'Welcome back, chef!',

  // Tech stack displayed on the About page
  techStack: [
    'Next.js',
    'React',
    'TypeScript',
    'Material UI',
    'Prisma',
    'PostgreSQL',
    'Cloudinary',
    'React Query',
    'Zod',
    'Serwist (PWA)',
  ],
} as const;

export type Branding = typeof BRANDING;

export const THEME_COLORS = {
  darkBackground: '#1E1E1E',
  lightBackground: '#FAFAFA',
} as const;
