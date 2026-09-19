'use client';
import { Logout, Settings, Person, Login, AdminPanelSettings } from '@mui/icons-material';
import { Menu, MenuItem, ListItemIcon, Divider, Box } from '@mui/material';
import { useTranslations } from 'next-intl';
import React from 'react';
import LanguageSwitcher from '../common/LanguageSwitcher';

interface DesktopMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  user: { username?: string } | null;
  isAdmin: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export default function DesktopMenu({
  anchorEl,
  onClose,
  user,
  isAdmin,
  onNavigate,
  onLogout,
}: DesktopMenuProps) {
  const t = useTranslations('nav');

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
    >
      {user
        ? [
            // Authenticated user menu
            <MenuItem key="username" disabled>
              <strong>@{user.username}</strong>
            </MenuItem>,
            <Divider key="divider1" />,
            <MenuItem
              key="profile"
              onClick={() => {
                onNavigate(`/profile/${user.username}`);
                onClose();
              }}
            >
              <ListItemIcon>
                <Person fontSize="small" />
              </ListItemIcon>
              {t('menu.profile')}
            </MenuItem>,
            <MenuItem
              key="settings"
              onClick={() => {
                onNavigate('/settings');
                onClose();
              }}
            >
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              {t('menu.settings')}
            </MenuItem>,
            ...(isAdmin
              ? [
                  <MenuItem
                    key="admin"
                    onClick={() => {
                      onNavigate('/admin');
                      onClose();
                    }}
                  >
                    <ListItemIcon>
                      <AdminPanelSettings fontSize="small" />
                    </ListItemIcon>
                    {t('menu.admin')}
                  </MenuItem>,
                ]
              : []),
            <MenuItem key="logout" onClick={onLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              {t('menu.logout')}
            </MenuItem>,
          ]
        : [
            // Guest menu
            <MenuItem key="guest" disabled>
              <strong>{t('menu.guest')}</strong>
            </MenuItem>,
            <Divider key="divider2" />,
            <MenuItem
              key="signin"
              onClick={() => {
                onNavigate('/auth');
                onClose();
              }}
            >
              <ListItemIcon>
                <Login fontSize="small" />
              </ListItemIcon>
              {t('menu.signIn')}
            </MenuItem>,
          ]}
      {/* Last, and outside the ternary: a guest has to be able to pick a language too */}
      <Divider key="divider-language" />
      <Box key="language" sx={{ px: 2, py: 1 }}>
        <LanguageSwitcher onChanged={onClose} />
      </Box>
    </Menu>
  );
}
