/**
 * Central branding configuration
 * Change these values to rebrand the entire application
 */

export const BRANDING = {
  // App name
  name: "Remy's",

  // Tagline/description
  tagline: "Anyone can cook",
  description: "A social network for chefs and cooking enthusiasts with AI-powered cooking tools",

  // Logo paths
  logo: "/chef-logo.png",
  icon: "/chef-logo.png",

  // Color scheme
  colors: {
    primary: "#673AB7", // Rich purple (primary brand color)
    secondary: "#512DA8", // Deep purple
    accent: "#FFC107", // Golden yellow (accent/highlights)
  },

  // Font
  font: '"Pacifico", cursive',

  // Social
  tagPrefix: "@",

  // Registration messaging
  registrationMessage: "Join our community of passionate cooks and food lovers!",

  // Login message
  loginMessage: "Welcome back, chef!",
} as const;

export type Branding = typeof BRANDING;
