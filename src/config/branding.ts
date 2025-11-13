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
    primary: "#D84315", // Cooking/warm orange-red
    secondary: "#F57C00", // Warm orange
    accent: "#FF6F00", // Bright orange
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
