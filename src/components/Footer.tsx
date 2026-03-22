'use client';

import { LightMode, DarkMode, YouTube, Email, Close, Info } from '@mui/icons-material';
import {
  Alert,
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Link,
  useTheme,
  Tooltip,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { BRANDING } from '@/config/branding';
import { useThemeMode } from '@/contexts/ThemeContext';

export default function Footer() {
  const theme = useTheme();
  const router = useRouter();
  const { mode, toggleTheme } = useThemeMode();
  const [contactOpen, setContactOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [emailError, setEmailError] = useState('');
  const [mailtoError, setMailtoError] = useState('');
  const [sending, setSending] = useState(false);
  const sendingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (sendingTimeoutRef.current) clearTimeout(sendingTimeoutRef.current);
    };
  }, []);

  const handleOpenContact = () => {
    setContactOpen(true);
  };

  const handleCloseContact = () => {
    setContactOpen(false);
    setFormData({ name: '', email: '', message: '' });
    setEmailError('');
    setMailtoError('');
  };

  const handleInputChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendEmail = () => {
    if (sending) return;
    if (!isValidEmail(formData.email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    // encodeURIComponent is the primary defense — it percent-encodes all special characters.
    // sanitize is a supplementary measure that strips control chars (U+0000–U+001F, U+007F)
    // which have no place in user-facing text and could cause issues in email clients.
    const sanitize = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, '');
    const message = sanitize(formData.message);
    const name = sanitize(formData.name);
    const email = sanitize(formData.email);
    const mailtoLink = `mailto:${BRANDING.contactEmail}?subject=${encodeURIComponent('Contact from ' + name)}&body=${encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    )}`;
    // Check length AFTER encoding — encoded characters expand the URL significantly.
    // 1500 chars is a conservative limit for mailto URIs — IE supported 2083,
    // modern browsers support more, but some email clients have lower limits.
    if (mailtoLink.length > 1500) {
      setMailtoError(
        'Your message is too long for email. Please shorten it or email us directly at ' +
          BRANDING.contactEmail
      );
      return;
    }
    setMailtoError('');
    setSending(true);
    window.location.href = mailtoLink;
    handleCloseContact();
    sendingTimeoutRef.current = setTimeout(() => {
      setSending(false);
    }, 3000);
  };

  return (
    <>
      <Box
        component="footer"
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 4,
          py: 2,
          mt: 'auto',
          borderTop: 1,
          borderColor: 'divider',
          backgroundColor: theme.palette.background.paper,
        }}
      >
        {/* Left: Signature */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            color: 'text.secondary',
          }}
        >
          {BRANDING.creator.name}
        </Typography>

        {/* Center: Contact | About Us */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="text"
            startIcon={<Email />}
            onClick={handleOpenContact}
            sx={{
              textTransform: 'none',
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
              },
            }}
          >
            Contact
          </Button>
          <Typography color="text.disabled">|</Typography>
          <Button
            variant="text"
            startIcon={<Info />}
            onClick={() => router.push('/about')}
            sx={{
              textTransform: 'none',
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
              },
            }}
          >
            About Us
          </Button>
        </Box>

        {/* Right: YouTube + Theme Toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="YouTube Channel">
            <IconButton
              component={Link}
              href={BRANDING.youtube}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              sx={{ color: 'text.secondary', '&:hover': { color: '#FF0000' } }}
            >
              <YouTube />
            </IconButton>
          </Tooltip>
          <Tooltip title={mode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            <IconButton onClick={toggleTheme} size="small" sx={{ color: 'text.secondary' }}>
              {mode === 'dark' ? <LightMode /> : <DarkMode />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Contact Dialog */}
      <Dialog
        open={contactOpen}
        onClose={handleCloseContact}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="h6" component="span">
            Contact
          </Typography>
          <IconButton onClick={handleCloseContact} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {mailtoError && (
              <Alert severity="error" onClose={() => setMailtoError('')}>
                {mailtoError}
              </Alert>
            )}
            <TextField
              label="Your Name"
              value={formData.name}
              onChange={handleInputChange('name')}
              fullWidth
              variant="outlined"
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              label="Your Email"
              type="email"
              value={formData.email}
              onChange={(e) => {
                handleInputChange('email')(e);
                if (emailError) setEmailError('');
              }}
              fullWidth
              variant="outlined"
              inputProps={{ maxLength: 254 }}
              error={!!emailError}
              helperText={emailError}
            />
            <TextField
              label="Message"
              value={formData.message}
              onChange={handleInputChange('message')}
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              inputProps={{ maxLength: 1000 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseContact} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSendEmail}
            variant="contained"
            disabled={!formData.name || !formData.email || !formData.message || sending}
          >
            Send Email
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
