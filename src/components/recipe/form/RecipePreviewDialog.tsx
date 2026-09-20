'use client';
import { Close } from '@mui/icons-material';
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import SlideUp from '@/components/common/SlideUp';
import RecipePreview from './RecipePreview';
import { RecipeFieldPath, RecipeFormSection, RecipePayload } from './types';

export interface RecipePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  /** `form.toPayload()`: the preview prints exactly what Publish will send */
  payload: RecipePayload;
  /** An [Edit] button of the preview: the shell closes this dialog and goes to the field */
  onEditSection: (section: RecipeFormSection, path?: RecipeFieldPath) => void;
}

/**
 * The faithful preview, on top of the editor: the recipe as it will be published, built
 * from the same display blocks as the recipe page. Read-only; every section has an [Edit]
 * that returns to the matching field.
 */
export default function RecipePreviewDialog({
  open,
  onClose,
  payload,
  onEditSection,
}: RecipePreviewDialogProps) {
  const t = useTranslations('recipeForm');
  const theme = useTheme();
  // Same allowed flag as FormDialog: it only exists after the author opened the preview
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      TransitionComponent={isMobile ? SlideUp : undefined}
      aria-labelledby={titleId}
    >
      <Box
        sx={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pl: { xs: 2, sm: 3 },
          pr: { xs: 1, sm: 1.5 },
          pt: { xs: 'calc(8px + env(safe-area-inset-top))', sm: 1.5 },
          pb: { xs: 1, sm: 1.5 },
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography id={titleId} component="h2" variant="h6" sx={{ fontWeight: 600 }}>
          {t('preview.title')}
        </Typography>
        <IconButton type="button" aria-label={t('preview.close')} onClick={onClose}>
          <Close />
        </IconButton>
      </Box>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        <RecipePreview
          payload={payload}
          placeholders
          compact
          sectionLabels={{
            basics: t('preview.dialogSections.basics'),
            ingredients: t('preview.dialogSections.ingredients'),
            steps: t('preview.dialogSections.steps'),
            presentation: t('preview.dialogSections.presentation'),
          }}
          onEditSection={onEditSection}
        />
      </DialogContent>
    </Dialog>
  );
}
