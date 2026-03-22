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
import React from 'react';
import { BRANDING } from '@/config/branding';

interface NavItem {
  id: string;
  icon: React.ElementType;
  activeIcon: React.ElementType;
  label: string;
}

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  user: { username?: string; avatar?: string | null } | null;
  isAdmin: boolean;
  mode: 'light' | 'dark';
  mobileNavItems: NavItem[];
  onTabClick: (tabId: string) => void;
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
  mobileNavItems,
  onTabClick,
  onToggleTheme,
  onLogout,
  onNavigate,
}: MobileDrawerProps) {
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
          <ListItem
            sx={{ py: 2, cursor: !user ? 'pointer' : 'default' }}
            onClick={
              !user
                ? () => {
                    onNavigate('/auth');
                    onClose();
                  }
                : undefined
            }
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
              primary={user?.username || 'Guest'}
              secondary={user ? `@${user.username}` : 'Tap to sign in'}
              primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
              secondaryTypographyProps={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
            />
          </ListItem>
          <Divider />
          {mobileNavItems.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                onClick={() => {
                  onTabClick(item.id);
                  onClose();
                }}
                sx={{ py: { xs: 1.5, sm: 2 } }}
              >
                <ListItemIcon>
                  <item.icon sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
                />
              </ListItemButton>
            </ListItem>
          ))}
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
                primary="Contact"
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
                primary="About Us"
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
                <YouTube sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' }, color: '#FF0000' }} />
              </ListItemIcon>
              <ListItemText
                primary="YouTube"
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
                primary={mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
                primaryTypographyProps={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}
              />
            </ListItemButton>
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
                    primary="Settings"
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
                      primary="Admin"
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
                    primary="Logout"
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
                  primary="Sign In"
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
