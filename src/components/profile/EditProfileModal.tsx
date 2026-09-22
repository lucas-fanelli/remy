'use client';
import { Close as CloseIcon, InfoOutlined, PhotoCamera } from '@mui/icons-material';
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
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useId } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import { queryKeys } from '@/lib/query/keys';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * The window event the notification poller answers by fetching at once, instead of at its
 * next tick. It is NOTIFICATIONS_REFRESH_EVENT in useNotificationPolling, spelled again here
 * rather than imported so this form does not pull in the poller; the two must stay equal,
 * and EditProfileModal.test.tsx listens on the poller's constant to hold them to it.
 */
const NOTIFICATIONS_REFRESH_EVENT = 'remy:notifications-refresh';

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

/** Which website message the field shows - the form owns the whole closed set. */
type WebsiteError = 'websiteProtocol' | 'websiteCredentials' | 'websiteInvalid';

interface FormErrors {
  website?: WebsiteError;
}

const BIO_LIMIT = 300;

export default function EditProfileModal({ open, onClose, onSuccess }: EditProfileModalProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const { user, isAuthenticated, updateProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const acceptsRequestsNoteId = useId();

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileForm>({
    fullName: '',
    bio: '',
    website: '',
    isPrivate: false,
  });
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

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

  // Revoke object URL on unmount or when preview changes to avoid memory leaks
  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showError(t('edit.errors.invalidImageType'));
        e.target.value = '';
        return;
      }
      if (file.size > MAX_UPLOAD_SIZE) {
        showError(t('edit.errors.imageTooLarge', { max: MAX_UPLOAD_SIZE / (1024 * 1024) }));
        e.target.value = '';
        return;
      }

      try {
        // Client-side validation for fast UX feedback. Server-side validateImageMagicBytes is the security boundary.
        // Only read the first 12 bytes for magic byte validation instead of
        // the entire file, avoiding unnecessary memory usage for large images.
        const headerBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(file.slice(0, 12));
        });
        const bytes = new Uint8Array(headerBuffer);
        if (bytes.length < 12) {
          showError(t('edit.errors.fileTooSmall'));
          e.target.value = '';
          return;
        }
        // JPEG: bytes[0-2], PNG: bytes[0-3], GIF: bytes[0-2]
        const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        const isPng =
          bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
        // WebP needs 12 bytes: bytes[0-3] = RIFF, bytes[8-11] = WEBP
        const isWebp =
          bytes.length >= 12 &&
          bytes[0] === 0x52 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46 &&
          bytes[3] === 0x46 &&
          bytes[8] === 0x57 &&
          bytes[9] === 0x45 &&
          bytes[10] === 0x42 &&
          bytes[11] === 0x50;
        if (!isJpeg && !isPng && !isGif && !isWebp) {
          showError(t('edit.errors.unsupportedImage'));
          e.target.value = '';
          return;
        }

        // Revoke previous blob URL to avoid memory leaks on re-selection
        if (avatarPreview && avatarPreview.startsWith('blob:')) {
          URL.revokeObjectURL(avatarPreview);
        }
        // Use object URL for preview (more efficient than base64, avoids stack overflow)
        const objectUrl = URL.createObjectURL(file);
        if (!objectUrl.startsWith('blob:')) return;
        setAvatarPreview(objectUrl);
      } catch {
        showError(t('edit.errors.readFailed'));
        e.target.value = '';
        return;
      }

      setAvatarFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      showError(t('edit.errors.notLoggedIn'));
      return;
    }

    // Client-side URL validation for website — URL() + protocol check is the primary gate
    const websiteValue = formData.website.trim();
    if (websiteValue) {
      try {
        const parsed = new URL(websiteValue);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          setFormErrors({ website: 'websiteProtocol' });
          return;
        }
        if (parsed.username || parsed.password) {
          setFormErrors({ website: 'websiteCredentials' });
          return;
        }
      } catch {
        setFormErrors({ website: 'websiteInvalid' });
        return;
      }
    }
    setFormErrors({});

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
          throw new Error(apiErrorMessage(errorData, t('edit.errors.uploadFailed')));
        }

        const uploadData = await uploadResponse.json();
        avatarUrl = uploadData.url;
      }

      // Privacy goes only when the switch was flipped in this form. The form starts from this
      // tab's copy of the account, and another tab may have made the account private since:
      // sent with every save, that stale "public" would make it public again on a bio edit,
      // and going public accepts every pending follow request, which cannot be undone.
      const privacyChanged = formData.isPrivate !== (user?.isPrivate || false);

      // Single call: updateProfile sends PUT to /api/users/profile AND updates local state
      await updateProfile({
        fullName: formData.fullName.trim() || null,
        bio: formData.bio.trim() || null,
        website: formData.website.trim() || null,
        avatar: avatarUrl,
        ...(privacyChanged ? { isPrivate: formData.isPrivate } : {}),
      });

      showSuccess(t('edit.success'));
      onSuccess();

      if (privacyChanged && user) {
        // A privacy change moves more than the switch. Going public accepted every pending
        // follow request in that same save, on the server: the owner's follower count grew,
        // each "quiere seguirte" became "empezó a seguirte", and the pinned requests row has
        // nothing left to count. Either way the cached profile still says the old privacy.
        // None of that is on this screen, so it is told, not waited for: the poller fetches
        // now instead of at its next tick, and every cached view of the owner's profile (a
        // prefix, so anything keyed under it too) is stale.
        //
        // After onSuccess, and with cancelRefetch off: the profile page's onSuccess already
        // refetches the profile it shows, and a second refetch would abort that request only
        // to send the same one again. This one joins it and still marks the rest.
        void queryClient.invalidateQueries(
          { queryKey: queryKeys.profile(user.username) },
          { cancelRefetch: false }
        );
        // Going public answered the whole inbox at once. Going private answers nothing.
        if (!formData.isPrivate) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.followRequests() });
        }
        window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      }

      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      showError(error instanceof Error ? error.message : t('edit.errors.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  // Turning a private account public is the one switch here that does more than it says:
  // the same save accepts every pending follow request, and there is nothing to undo it
  // with. So it is said beside the switch, before the save, and only when it is true — a
  // public account has no requests waiting, and one that stays private keeps them.
  const acceptsPendingRequests = user.isPrivate && !formData.isPrivate;

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
          {t('edit.title')}
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
                {t('edit.changePhoto')}
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
              {avatarFile ? t('edit.photoSelected') : t('edit.photoHint')}
            </Typography>
          </Box>

          {/* Form Fields */}
          <TextField
            fullWidth
            label={t('edit.username')}
            value={user.username}
            disabled
            size={isMobile ? 'small' : 'medium'}
            sx={{ mb: { xs: 1.5, md: 2 } }}
            helperText={t('edit.usernameHelper')}
          />

          <TextField
            fullWidth
            label={t('edit.email')}
            value={user.email}
            disabled
            size={isMobile ? 'small' : 'medium'}
            sx={{ mb: { xs: 1.5, md: 2 } }}
            helperText={t('edit.emailHelper')}
          />

          <TextField
            fullWidth
            label={t('edit.fullName')}
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            size={isMobile ? 'small' : 'medium'}
            sx={{ mb: { xs: 1.5, md: 2 } }}
            placeholder={t('edit.fullNamePlaceholder')}
          />

          <TextField
            fullWidth
            label={t('edit.bio')}
            name="bio"
            value={formData.bio}
            onChange={handleInputChange}
            multiline
            rows={isMobile ? 3 : 4}
            size={isMobile ? 'small' : 'medium'}
            sx={{ mb: { xs: 1.5, md: 2 } }}
            placeholder={t('edit.bioPlaceholder')}
            helperText={t('edit.bioCount', { count: formData.bio.length, max: BIO_LIMIT })}
            inputProps={{ maxLength: BIO_LIMIT }}
          />

          <TextField
            fullWidth
            label={t('edit.website')}
            name="website"
            value={formData.website}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              handleInputChange(e);
              if (formErrors.website) setFormErrors({});
            }}
            size={isMobile ? 'small' : 'medium'}
            sx={{ mb: { xs: 1.5, md: 2 } }}
            placeholder={t('edit.websitePlaceholder')}
            type="url"
            error={!!formErrors.website}
            helperText={formErrors.website ? t(`edit.errors.${formErrors.website}`) : undefined}
          />

          <FormControlLabel
            control={
              <Switch
                checked={formData.isPrivate}
                onChange={handleSwitchChange}
                color="primary"
                // The consequence is part of what the switch now means, so a screen reader
                // hears it with the switch, not only if it wanders down to the note.
                inputProps={{
                  'aria-describedby': acceptsPendingRequests ? acceptsRequestsNoteId : undefined,
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body2">{t('edit.private')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('edit.privateDescription')}
                </Typography>
              </Box>
            }
          />
          {/* A polite live region that is there from the first paint: one inserted together
              with its text is not announced, and the note appears exactly when the switch
              is turned off, with focus still on the switch. */}
          <Box aria-live="polite">
            {acceptsPendingRequests && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 1 }}>
                {/* The tone goes on the icon and the words stay in body ink, as in the cook
                    dialog's shortfall rows: it is a heads-up, not an error, and the words
                    are what carry it. The icon is decorative (MUI hides it from readers). */}
                <InfoOutlined sx={{ fontSize: '1rem', color: 'warning.main', mt: '1px' }} />
                <Typography id={acceptsRequestsNoteId} variant="caption" color="text.primary">
                  {t('edit.publicAcceptsRequests')}
                </Typography>
              </Box>
            )}
          </Box>
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
            {tCommon('actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : null}
            fullWidth={isMobile}
            size={isMobile ? 'large' : 'medium'}
          >
            {saving ? tCommon('status.saving') : tCommon('actions.saveChanges')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
