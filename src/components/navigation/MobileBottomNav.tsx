'use client';
import { NotificationsNone, Menu as MenuIcon } from '@mui/icons-material';
import { AppBar, Toolbar, Box, IconButton, Avatar, Badge, Tooltip } from '@mui/material';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import React from 'react';
import { BRANDING } from '@/config/branding';
import { useBrandLogo } from '@/config/useBrandLogo';
import { cloudinaryImage } from '@/lib/utils/cloudinary';

interface NavItem {
  id: string;
  icon: React.ElementType;
  activeIcon: React.ElementType;
  label: string;
}

interface MobileBottomNavProps {
  activeTab: string;
  mobileNavItems: NavItem[];
  user: { username?: string; avatar?: string | null } | null;
  unreadNotifications: number;
  onTabClick: (tabId: string) => void;
  onProfileClick: () => void;
  onDrawerOpen: () => void;
  onNotificationsOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onNavigateHome: () => void;
}

export default function MobileBottomNav({
  activeTab,
  mobileNavItems,
  user,
  unreadNotifications,
  onTabClick,
  onProfileClick,
  onDrawerOpen,
  onNotificationsOpen,
  onNavigateHome,
}: MobileBottomNavProps) {
  const brandLogo = useBrandLogo();
  const t = useTranslations('nav');

  return (
    <>
      {/* Top Bar */}
      <AppBar
        position="fixed"
        sx={{
          backgroundColor: (theme) => theme.palette.background.paper,
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ px: { xs: 1, sm: 2 }, minHeight: { xs: 56, sm: 64 } }}>
          <IconButton
            edge="start"
            onClick={onDrawerOpen}
            size="small"
            aria-label={t('menu.openMenu')}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0.5, sm: 1 },
                cursor: 'pointer',
              }}
              onClick={onNavigateHome}
            >
              <Box
                component="img"
                src={brandLogo}
                alt={BRANDING.name}
                sx={{ height: { xs: 24, sm: 28 }, width: { xs: 24, sm: 28 } }}
              />
              <Box
                sx={{
                  fontFamily: BRANDING.font,
                  fontSize: { xs: '16px', sm: '20px' },
                  fontWeight: 600,
                  color: (theme) =>
                    theme.palette.mode === 'dark'
                      ? theme.palette.primary.main
                      : BRANDING.colors.primary,
                }}
              >
                {BRANDING.name}
              </Box>
            </Box>
          </Box>
          <IconButton
            onClick={onNotificationsOpen}
            size="small"
            aria-label={t('menu.notifications')}
          >
            <Badge badgeContent={unreadNotifications} color="error">
              {/* A bell, not a heart — the heart means "like" everywhere else */}
              <NotificationsNone sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Bottom Bar */}
      <AppBar
        position="fixed"
        sx={{
          top: 'auto',
          bottom: 0,
          backgroundColor: 'background.paper',
          color: 'text.primary',
          borderTop: 1,
          borderColor: 'divider',
          boxShadow: 'none',
        }}
      >
        <Toolbar
          sx={{
            justifyContent: 'space-around',
            minHeight: { xs: 56, sm: 64 },
            px: { xs: 0.5, sm: 2 },
          }}
        >
          {mobileNavItems.map((item) => {
            const Icon = activeTab === item.id ? item.activeIcon : item.icon;
            return (
              <motion.div key={item.id} whileTap={{ scale: 0.9 }}>
                <Tooltip title={item.label}>
                  <IconButton
                    onClick={() => onTabClick(item.id)}
                    size="small"
                    aria-label={item.label}
                    sx={{ p: { xs: 0.5, sm: 1 } }}
                  >
                    <Icon
                      sx={{
                        color: activeTab === item.id ? 'text.primary' : 'text.secondary',
                        fontSize: { xs: '1.25rem', sm: '1.5rem' },
                      }}
                    />
                  </IconButton>
                </Tooltip>
              </motion.div>
            );
          })}
          <motion.div whileTap={{ scale: 0.9 }}>
            <IconButton
              size="small"
              aria-label={t('menu.profile')}
              sx={{ p: { xs: 0.5, sm: 1 } }}
              onClick={onProfileClick}
            >
              <Avatar
                sx={{ width: { xs: 20, sm: 24 }, height: { xs: 20, sm: 24 } }}
                src={cloudinaryImage(user?.avatar, 'avatar') || undefined}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </motion.div>
        </Toolbar>
      </AppBar>
    </>
  );
}
