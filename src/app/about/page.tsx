// 'use client' required: MUI components need ThemeProvider context, motion.create needs client-side JS
'use client';

import Favorite from '@mui/icons-material/Favorite';
import Kitchen from '@mui/icons-material/Kitchen';
import People from '@mui/icons-material/People';
import Restaurant from '@mui/icons-material/Restaurant';
import Search from '@mui/icons-material/Search';
import Share from '@mui/icons-material/Share';
import YouTube from '@mui/icons-material/YouTube';
import { Box, Container, Typography, Avatar, Chip, Divider, Link } from '@mui/material';
import { useReducedMotion } from 'framer-motion';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { MotionBox, MotionPaper } from '@/components/motion';
import { BRANDING } from '@/config/branding';

// The copy is not here any more: each feature's `id` IS its key under about.features, and the
// ids are a closed union, which is the one case where a key may be built from a variable.
const FEATURES = [
  { id: 'shareRecipes', icon: Restaurant },
  { id: 'smartPantry', icon: Kitchen },
  { id: 'discover', icon: Search },
  { id: 'saveFavorites', icon: Favorite },
  { id: 'connect', icon: People },
  { id: 'share', icon: Share },
] as const;

const { techStack } = BRANDING;

export default function AboutPage() {
  const t = useTranslations('shell');
  const shouldReduceMotion = useReducedMotion();
  const fadeUp = shouldReduceMotion
    ? { transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        pt: { xs: 12, md: 14 },
        pb: { xs: 12, md: 6 },
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        {/* Hero Section */}
        <MotionBox
          {...fadeUp}
          transition={shouldReduceMotion ? undefined : { duration: 0.6 }}
          sx={{ textAlign: 'center', mb: 8 }}
        >
          <Typography
            variant="h2"
            component="h1"
            sx={(theme) => ({
              fontWeight: 700,
              mb: 2,
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            })}
          >
            {t('about.hero.title', { name: BRANDING.name })}
          </Typography>
          <Typography
            variant="h5"
            color="text.secondary"
            sx={{ maxWidth: 600, mx: 'auto', fontSize: { xs: '1rem', sm: '1.25rem' } }}
          >
            {t('about.hero.subtitle')}
          </Typography>
        </MotionBox>

        {/* What is Remy's */}
        <MotionPaper
          {...fadeUp}
          transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: 0.1 }}
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            mb: 6,
            borderRadius: 3,
            backgroundColor: 'background.paper',
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h4" fontWeight={600} gutterBottom color="text.primary">
            {t('about.intro.title', { name: BRANDING.name })}
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            {t('about.intro.lead', { name: BRANDING.name })}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('about.intro.body', { name: BRANDING.name })}
          </Typography>
        </MotionPaper>

        {/* Features Grid */}
        <MotionBox
          {...fadeUp}
          transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: 0.2 }}
          sx={{ mb: 6 }}
        >
          <Typography
            variant="h4"
            fontWeight={600}
            textAlign="center"
            gutterBottom
            color="text.primary"
          >
            {t('about.features.title')}
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            textAlign="center"
            sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}
          >
            {t('about.features.subtitle')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 3,
            }}
          >
            {FEATURES.map((feature, index) => (
              <MotionPaper
                key={feature.id}
                {...fadeUp}
                transition={
                  shouldReduceMotion
                    ? undefined
                    : { duration: 0.4, delay: Math.min(0.08 * index, 0.5) }
                }
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  textAlign: 'center',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-4px)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <Box sx={{ color: 'primary.main', mb: 2 }}>
                  <feature.icon sx={{ fontSize: 40 }} />
                </Box>
                <Typography variant="h6" fontWeight={600} gutterBottom color="text.primary">
                  {t(`about.features.${feature.id}.title`)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(`about.features.${feature.id}.description`)}
                </Typography>
              </MotionPaper>
            ))}
          </Box>
        </MotionBox>

        <Divider sx={{ my: 6 }} />

        {/* Creator Section */}
        <MotionBox
          {...fadeUp}
          transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: 0.3 }}
          sx={{ textAlign: 'center', mb: 6 }}
        >
          <Typography variant="h4" fontWeight={600} gutterBottom color="text.primary">
            {t('about.creator.title')}
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
              sx={(theme) => ({
                width: 120,
                height: 120,
                fontSize: '3rem',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              })}
            >
              {BRANDING.creator.initials}
            </Avatar>
            <Typography variant="h5" fontWeight={600} color="text.primary">
              {BRANDING.creator.name}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500 }}>
              {t('about.creator.bio', { name: BRANDING.name })}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Link
                href={BRANDING.youtube}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
              >
                <YouTube />
              </Link>
            </Box>
          </Box>
        </MotionBox>

        {/* Tech Stack */}
        <MotionBox
          {...fadeUp}
          transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: 0.4 }}
          sx={{ textAlign: 'center' }}
        >
          <Typography variant="h5" fontWeight={600} gutterBottom color="text.primary">
            {t('about.techStack.title')}
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
            {t('about.backHome')}
          </Link>
        </Box>
      </Container>
    </Box>
  );
}
