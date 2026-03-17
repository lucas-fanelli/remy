'use client';

import { Restaurant, Kitchen, People, Search, Favorite, Share, YouTube } from '@mui/icons-material';
import {
  Box,
  Container,
  Typography,
  Paper,
  Avatar,
  Chip,
  Divider,
  Link,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import NextLink from 'next/link';
import React from 'react';
import { BRANDING } from '@/config/branding';

const MotionBox = motion.create(Box);
const MotionPaper = motion.create(Paper);

const features = [
  {
    icon: <Restaurant sx={{ fontSize: 40 }} />,
    title: 'Share Recipes',
    description:
      'Create and share your favorite recipes with the community. Add photos, ingredients, and step-by-step instructions.',
  },
  {
    icon: <Kitchen sx={{ fontSize: 40 }} />,
    title: 'Smart Pantry',
    description:
      'Track ingredients in your pantry and discover recipes you can make with what you already have.',
  },
  {
    icon: <Search sx={{ fontSize: 40 }} />,
    title: 'Discover',
    description:
      'Explore recipes from other home cooks. Filter by ingredients, cuisine, or dietary preferences.',
  },
  {
    icon: <Favorite sx={{ fontSize: 40 }} />,
    title: 'Save Favorites',
    description:
      'Save recipes you love to your profile for quick access anytime you need inspiration.',
  },
  {
    icon: <People sx={{ fontSize: 40 }} />,
    title: 'Connect',
    description:
      'Follow your favorite home cooks, comment on recipes, and build a community around food.',
  },
  {
    icon: <Share sx={{ fontSize: 40 }} />,
    title: 'Share',
    description: 'Share your culinary creations with friends and family through social features.',
  },
];

const techStack = [
  'Next.js',
  'React',
  'TypeScript',
  'Material-UI',
  'Prisma',
  'PostgreSQL',
  'Framer Motion',
];

export default function AboutPage() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        pt: { xs: 12, md: 14 },
        pb: { xs: 12, md: 6 },
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Container maxWidth="lg">
        {/* Hero Section */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          sx={{ textAlign: 'center', mb: 8 }}
        >
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 700,
              mb: 2,
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            About Remy&apos;s
          </Typography>
          <Typography
            variant="h5"
            color="text.secondary"
            sx={{ maxWidth: 600, mx: 'auto', fontSize: { xs: '1rem', sm: '1.25rem' } }}
          >
            A modern recipe sharing platform where home cooks come together to discover, create, and
            share delicious recipes.
          </Typography>
        </MotionBox>

        {/* What is Remy's */}
        <MotionPaper
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            mb: 6,
            borderRadius: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="h4" fontWeight={600} gutterBottom color="text.primary">
            What is Remy&apos;s?
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Remy&apos;s is a recipe sharing social platform inspired by the love of cooking and
            community. Named after the famous chef rat from Ratatouille, this platform embodies the
            belief that &quot;anyone can cook&quot; — and everyone has something delicious to share.
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Whether you&apos;re a beginner learning your first recipes or a seasoned home cook with
            family recipes passed down through generations, Remy&apos;s provides a space to
            document, discover, and connect with fellow food enthusiasts.
          </Typography>
        </MotionPaper>

        {/* Features Grid */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          sx={{ mb: 6 }}
        >
          <Typography
            variant="h4"
            fontWeight={600}
            textAlign="center"
            gutterBottom
            color="text.primary"
          >
            Features
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            textAlign="center"
            sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}
          >
            Everything you need to organize your recipes and connect with other food lovers.
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 3,
            }}
          >
            {features.map((feature, index) => (
              <MotionPaper
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * index }}
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  textAlign: 'center',
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    transform: 'translateY(-4px)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <Box sx={{ color: 'primary.main', mb: 2 }}>{feature.icon}</Box>
                <Typography variant="h6" fontWeight={600} gutterBottom color="text.primary">
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </MotionPaper>
            ))}
          </Box>
        </MotionBox>

        <Divider sx={{ my: 6 }} />

        {/* Creator Section */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          sx={{ textAlign: 'center', mb: 6 }}
        >
          <Typography variant="h4" fontWeight={600} gutterBottom color="text.primary">
            Created By
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              mt: 3,
            }}
          >
            <Avatar
              sx={{
                width: 120,
                height: 120,
                fontSize: '3rem',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              }}
            >
              LF
            </Avatar>
            <Typography variant="h5" fontWeight={600} color="text.primary">
              Lucas Fanelli
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500 }}>
              Full-stack developer passionate about creating beautiful, functional web applications.
              Remy&apos;s was built as a labor of love, combining a passion for technology and food.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Link
                href={BRANDING.youtube}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'text.secondary', '&:hover': { color: '#FF0000' } }}
              >
                <YouTube />
              </Link>
            </Box>
          </Box>
        </MotionBox>

        {/* Tech Stack */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          sx={{ textAlign: 'center' }}
        >
          <Typography variant="h5" fontWeight={600} gutterBottom color="text.primary">
            Built With
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 1,
              mt: 2,
            }}
          >
            {techStack.map((tech) => (
              <Chip
                key={tech}
                label={tech}
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  fontWeight: 500,
                }}
              />
            ))}
          </Box>
        </MotionBox>

        {/* Back to Home */}
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Link
            component={NextLink}
            href="/"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              fontWeight: 500,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            ← Back to Home
          </Link>
        </Box>
      </Container>
    </Box>
  );
}
