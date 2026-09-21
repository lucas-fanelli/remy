'use client';
import {
  Logout,
  Settings,
  DarkMode,
  LightMode,
  YouTube,
  Email,
  Info,
  Login,
  AdminPanelSettings,
} from '@mui/icons-material';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import React from 'react';
import { BRANDING } from '@/config/branding';
import LanguageSwitcher from '../common/LanguageSwitcher';

/**
 * The drawer is the ACCOUNT menu, not a second copy of the navigation. Home, Search,
 * New recipe and Pantry live in the bottom bar, one thumb away; repeating them here was
 * the duplication that made the menu feel redundant. What belongs here is everything the
 * bottom bar has no room for: who you are, your own profile, and the app's settings.
 */
interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  user: { username?: string; avatar?: string | null } | null;
  isAdmin: boolean;
  mode: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
  onNavigate: (path: string) => void;
}

export default function MobileDrawer({
  open,
  onClose,
  user,
  isAdmin,
  mode,
  onToggleTheme,
  onLogout,
  onNavigate,
}: MobileDrawerProps) {
  const t = useTranslations('nav');

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          backgroundColor: (theme) => theme.palette.background.paper,
        },
      }}
    >
      <Box
        sx={{
          width: { xs: 280, sm: 320 },
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        role="presentation"
      >
        {/* Main content */}
        <List>
          {/* Tapping your own name and avatar goes to your profile — the affordance was
              wired for signed-OUT visitors only, so signed-in users had a header that
              looked tappable and did nothing. No separate "Profile" row: the bottom bar
              already has one, and repeating destinations here is what made this menu
              feel redundant in the first place. */}
          <ListItem disablePadding>
            <ListItemButton
              sx={{ py: 2 }}
              onClick={() => {
                onNavigate(user?.username ? `/profile/${user.username}` : '/auth');
                onClose();
              }}
            >
              <ListItemIcon>
                <Avatar
                  src={user?.avatar || undefined}
                  sx={{ width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 } }}
                >
                  {user ? user.username?.charAt(0).toUpperCase() : '?'}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={user?.username || t('menu.guest')}
                secondary={user ? t('menu.viewProfile') : t('menu.tapToSignIn')}
                primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
                secondaryTypographyProps={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
              />
            </ListItemButton>
          </ListItem>
          <Divider />
        </List>

        {/* Spacer to push bottom section down */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Bottom section - Contact, YouTube, Theme, Settings, Logout */}
        <List>
          <Divider />
          {/* Contact */}
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                window.open(`mailto:${BRANDING.contactEmail}`, '_blank');
                onClose();
              }}
              sx={{ py: { xs: 1.5, sm: 2 } }}
            >
              <ListItemIcon>
                <Email sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
              </ListItemIcon>
              <ListItemText
                primary={t('menu.contact')}
                primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
              />
            </ListItemButton>
          </ListItem>
          {/* About Us */}
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                onNavigate('/about');
                onClose();
              }}
              sx={{ py: { xs: 1.5, sm: 2 } }}
            >
              <ListItemIcon>
                <Info sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
              </ListItemIcon>
              <ListItemText
                primary={t('menu.about')}
                primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
              />
            </ListItemButton>
          </ListItem>
          {/* YouTube */}
          <ListItem disablePadding>
            <ListItemButton
              component="a"
              href={BRANDING.youtube}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onClose()}
              sx={{ py: { xs: 1.5, sm: 2 } }}
            >
              <ListItemIcon>
                {/* YouTube's own red, not one of ours: it is the mark's colour, so it
                    does not follow the theme and there is no token for it. */}
                <YouTube sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' }, color: '#FF0000' }} />
              </ListItemIcon>
              <ListItemText
                primary={t('menu.youtube')}
                primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
              />
            </ListItemButton>
          </ListItem>
          {/* Theme Toggle */}
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                onToggleTheme();
                onClose();
              }}
              sx={{ py: { xs: 1.5, sm: 2 } }}
            >
              <ListItemIcon>
                {mode === 'dark' ? (
                  <LightMode sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                ) : (
                  <DarkMode sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={mode === 'dark' ? t('menu.lightMode') : t('menu.darkMode')}
                primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
              />
            </ListItemButton>
          </ListItem>
          {/* Language - next to the theme toggle, because it is the same kind of choice.
              It sits above the auth block so a logged-out visitor can reach it too. */}
          <ListItem sx={{ py: { xs: 1.5, sm: 2 }, display: 'block' }}>
            <LanguageSwitcher showLabel onChanged={onClose} />
          </ListItem>
          <Divider />
          {user ? (
            // Authenticated user options
            <>
              {/* Settings */}
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    onNavigate('/settings');
                    onClose();
                  }}
                  sx={{ py: { xs: 1.5, sm: 2 } }}
                >
                  <ListItemIcon>
                    <Settings sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('menu.settings')}
                    primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
                  />
                </ListItemButton>
              </ListItem>
              {/* Admin Panel - only for admins */}
              {isAdmin && (
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => {
                      onNavigate('/admin');
                      onClose();
                    }}
                    sx={{ py: { xs: 1.5, sm: 2 } }}
                  >
                    <ListItemIcon>
                      <AdminPanelSettings
                        sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' }, color: 'warning.main' }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={t('menu.admin')}
                      primaryTypographyProps={{
                        fontSize: { xs: '1rem', sm: '1.125rem' },
                        color: 'warning.main',
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              )}
              {/* Logout */}
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  sx={{ py: { xs: 1.5, sm: 2 } }}
                >
                  <ListItemIcon>
                    <Logout sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('menu.logout')}
                    primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
                  />
                </ListItemButton>
              </ListItem>
            </>
          ) : (
            // Guest options
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  onNavigate('/auth');
                  onClose();
                }}
                sx={{ py: { xs: 1.5, sm: 2 } }}
              >
                <ListItemIcon>
                  <Login sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                </ListItemIcon>
                <ListItemText
                  primary={t('menu.signIn')}
                  primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
                />
              </ListItemButton>
            </ListItem>
          )}
          {/* Signature */}
          <Divider />
          <ListItem sx={{ py: 1, justifyContent: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {BRANDING.creator.name}
            </Typography>
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
}
