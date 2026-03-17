'use client';

import { LightMode, DarkMode, YouTube, Email, Close, Info } from '@mui/icons-material';
import {
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
import React, { useState } from 'react';
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
    subject: '',
  });

  const handleOpenContact = () => {
    setContactOpen(true);
  };

  const handleCloseContact = () => {
    setContactOpen(false);
    setFormData({ name: '', email: '', subject: '' });
  };

  const handleInputChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSendEmail = () => {
    const mailtoLink = `mailto:${BRANDING.contactEmail}?subject=${encodeURIComponent(formData.subject)}&body=${encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.subject}`
    )}`;
    window.open(mailtoLink, '_blank');
    handleCloseContact();
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
            <TextField
              label="Your Name"
              value={formData.name}
              onChange={handleInputChange('name')}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Your Email"
              type="email"
              value={formData.email}
              onChange={handleInputChange('email')}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Subject / Message"
              value={formData.subject}
              onChange={handleInputChange('subject')}
              fullWidth
              multiline
              rows={4}
              variant="outlined"
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
            disabled={!formData.name || !formData.email || !formData.subject}
          >
            Send Email
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
