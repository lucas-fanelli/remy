'use client';
import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Divider,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Toolbar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
} from '@mui/material';
import {
  Language,
  Notifications,
  Security,
  Palette,
  Cookie,
  VpnKey,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import LoadingWithProgress from '@/components/common/LoadingWithProgress';
import ChangePasswordDialog from '@/components/settings/ChangePasswordDialog';

const MotionPaper = motion.create(Paper);

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const { showSuccess, showInfo } = useToast();

  const [language, setLanguage] = useState('en');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }
  }, [user, router]);

  const handleLanguageChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setLanguage(event.target.value as string);
    showSuccess('Language preference saved');
  };

  const handleThemeToggle = () => {
    toggleTheme();
    showSuccess(`Switched to ${mode === 'dark' ? 'light' : 'dark'} mode`);
  };

  if (!user) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', pb: 8, backgroundColor: 'background.default' }}>
      <Toolbar />

      <Container maxWidth="md" sx={{ pt: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
            Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your account preferences and settings
          </Typography>
        </Box>

        {/* Appearance Settings */}
        <MotionPaper
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          elevation={2}
          sx={{ p: 3, mb: 3 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Palette sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Appearance</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <FormControlLabel
            control={
              <Switch
                checked={mode === 'dark'}
                onChange={handleThemeToggle}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1">Dark Mode</Typography>
                <Typography variant="caption" color="text.secondary">
                  Use dark theme across the app
                </Typography>
              </Box>
            }
          />
        </MotionPaper>

        {/* Language Settings */}
        <MotionPaper
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          elevation={2}
          sx={{ p: 3, mb: 3 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Language sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Language & Region</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <FormControl fullWidth>
            <InputLabel>Language</InputLabel>
            <Select
              value={language}
              label="Language"
              onChange={handleLanguageChange as any}
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="es">Español</MenuItem>
              <MenuItem value="fr">Français</MenuItem>
              <MenuItem value="de">Deutsch</MenuItem>
              <MenuItem value="it">Italiano</MenuItem>
              <MenuItem value="pt">Português</MenuItem>
            </Select>
          </FormControl>
        </MotionPaper>

        {/* Notification Settings */}
        <MotionPaper
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          elevation={2}
          sx={{ p: 3, mb: 3 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Notifications sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Notifications</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <List>
            <ListItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Email Notifications</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Receive email updates about your recipes and activity
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
            <ListItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Push Notifications</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Get push notifications for comments and likes
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
            <ListItem>
              <FormControlLabel
                control={
                  <Switch
                    checked={marketingEmails}
                    onChange={(e) => setMarketingEmails(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">Marketing Emails</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Receive emails about new features and updates
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          </List>
        </MotionPaper>

        {/* Privacy & Security */}
        <MotionPaper
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          elevation={2}
          sx={{ p: 3, mb: 3 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Security sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Privacy & Security</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <List>
            <ListItem
              component="button"
              onClick={() => setChangePasswordOpen(true)}
              sx={{ borderRadius: 1, mb: 1, cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}
            >
              <ListItemIcon>
                <VpnKey />
              </ListItemIcon>
              <ListItemText
                primary="Change Password"
                secondary="Update your password to keep your account secure"
              />
            </ListItem>
            <ListItem
              component="button"
              onClick={() => showInfo('Cookie settings coming soon')}
              sx={{ borderRadius: 1, cursor: 'pointer', border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}
            >
              <ListItemIcon>
                <Cookie />
              </ListItemIcon>
              <ListItemText
                primary="Cookie Preferences"
                secondary="Manage your cookie and tracking preferences"
              />
            </ListItem>
          </List>
        </MotionPaper>

        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: 3 }}>
          These are basic settings for V1. More options will be added in future updates!
        </Alert>
      </Container>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </Box>
  );
}
