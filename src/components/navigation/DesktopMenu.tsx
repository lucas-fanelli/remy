'use client';
import { Logout, Settings, Person, Login, AdminPanelSettings } from '@mui/icons-material';
import { Menu, MenuItem, ListItemIcon, Divider } from '@mui/material';
import React from 'react';

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
              Profile
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
              Settings
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
                    Admin
                  </MenuItem>,
                ]
              : []),
            <MenuItem key="logout" onClick={onLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>,
          ]
        : [
            // Guest menu
            <MenuItem key="guest" disabled>
              <strong>Guest</strong>
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
              Sign In
            </MenuItem>,
          ]}
    </Menu>
  );
}
