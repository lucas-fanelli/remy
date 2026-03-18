'use client';
import { Close as CloseIcon, PhotoCamera } from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Box,
  Avatar,
  Typography,
  CircularProgress,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProfileForm {
  fullName: string;
  bio: string;
  website: string;
  isPrivate: boolean;
}

export default function EditProfileModal({ open, onClose, onSuccess }: EditProfileModalProps) {
  const { user, isAuthenticated, updateProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileForm>({
    fullName: '',
    bio: '',
    website: '',
    isPrivate: false,
  });
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    if (user && open) {
      setFormData({
        fullName: user.fullName || '',
        bio: user.bio || '',
        website: user.website || '',
        isPrivate: user.isPrivate || false,
      });
      setAvatarPreview(user.avatar || '');
      setAvatarFile(null);
    }
  }, [user, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      isPrivate: e.target.checked,
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      showError('You must be logged in to update your profile');
      return;
    }

    try {
      setSaving(true);

      let avatarUrl = user?.avatar || null;

      // Upload avatar if a new file was selected
      if (avatarFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('avatar', avatarFile);

        const uploadResponse = await fetch('/api/upload/avatar', {
          method: 'POST',
          headers: { 'X-Requested-With': 'fetch' },
          body: formDataUpload,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload avatar');
        }

        const uploadData = await uploadResponse.json();
        avatarUrl = uploadData.url;
      }

      // Update profile with all data including avatar
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName.trim() || null,
          bio: formData.bio.trim() || null,
          website: formData.website.trim() || null,
          avatar: avatarUrl,
          isPrivate: formData.isPrivate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update auth context with new data
      await updateProfile({ ...formData, avatar: avatarUrl });

      showSuccess('Profile updated successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      showError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: { xs: 1, md: 2 },
        }}
      >
        <Typography
          component="span"
          variant="h6"
          sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}
        >
          Edit Profile
        </Typography>
        <IconButton onClick={onClose} size={isMobile ? 'small' : 'medium'}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ px: { xs: 2, md: 3 } }}>
          {/* Avatar Section */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mb: { xs: 2, md: 3 },
            }}
          >
            <Avatar
              src={avatarPreview}
              sx={{
                width: { xs: 80, sm: 100, md: 120 },
                height: { xs: 80, sm: 100, md: 120 },
                mb: { xs: 1.5, md: 2 },
                border: { xs: '2px solid', md: '3px solid' },
                borderColor: 'primary.main',
              }}
            >
              {user.username.charAt(0).toUpperCase()}
            </Avatar>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="avatar-upload-modal"
              type="file"
              onChange={handleAvatarChange}
            />
            <label htmlFor="avatar-upload-modal">
              <Button
                variant="outlined"
                component="span"
                startIcon={<PhotoCamera />}
                size={isMobile ? 'small' : 'medium'}
                fullWidth={isMobile}
              >
                Change Photo
              </Button>
            </label>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                mt: 1,
                textAlign: 'center',
                fontSize: { xs: '0.7rem', md: '0.75rem' },
                px: { xs: 2, md: 0 },
              }}
            >
              {avatarFile
                ? 'New photo selected - will be uploaded when you save'
                : 'Click to change your profile photo'}
            </Typography>
          </Box>

          {/* Form Fields */}
          <TextField
            fullWidth
            label="Username"
            value={user.username}
            disabled
            size={isMobile ? 'small' : 'medium'}
            sx={{ mb: { xs: 1.5, md: 2 } }}
            helperText="Username cannot be changed"
          />

          <TextField
            fullWidth
            label="Email"
            value={user.email}
            disabled
            size={isMobile ? 'small' : 'medium'}
            sx={{ mb: { xs: 1.5, md: 2 } }}
            helperText="Email cannot be changed"
          />

          <TextField
            fullWidth
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            size={isMobile ? 'small' : 'medium'}
            sx={{ mb: { xs: 1.5, md: 2 } }}
            placeholder="Enter your full name"
          />

          <TextField
            fullWidth
            label="Bio"
            name="bio"
            value={formData.bio}
            onChange={handleInputChange}
            multiline
            rows={isMobile ? 3 : 4}
            size={isMobile ? 'small' : 'medium'}
            sx={{ mb: { xs: 1.5, md: 2 } }}
            placeholder="Tell us about yourself..."
            helperText={`${formData.bio.length}/300 characters`}
            inputProps={{ maxLength: 300 }}
          />

          <TextField
            fullWidth
            label="Website"
            name="website"
            value={formData.website}
            onChange={handleInputChange}
            size={isMobile ? 'small' : 'medium'}
            sx={{ mb: { xs: 1.5, md: 2 } }}
            placeholder="https://yourwebsite.com"
            type="url"
          />

          <FormControlLabel
            control={
              <Switch checked={formData.isPrivate} onChange={handleSwitchChange} color="primary" />
            }
            label={
              <Box>
                <Typography variant="body2">Private Account</Typography>
                <Typography variant="caption" color="text.secondary">
                  Only approved followers can see your recipes
                </Typography>
              </Box>
            }
          />
        </DialogContent>

        <DialogActions
          sx={{
            px: { xs: 2, md: 3 },
            pb: { xs: 2, md: 3 },
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            gap: { xs: 1, sm: 0 },
          }}
        >
          <Button
            onClick={onClose}
            disabled={saving}
            fullWidth={isMobile}
            size={isMobile ? 'large' : 'medium'}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : null}
            fullWidth={isMobile}
            size={isMobile ? 'large' : 'medium'}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
