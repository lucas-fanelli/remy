'use client';
import { Close } from '@mui/icons-material';
import { Alert, Button, IconButton } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { text, useTextDescriptor } from '@/i18n/text';
import type { TextDescriptor } from '@/i18n/text';

export interface DraftRestoredBarProps {
  /** `draft.savedAt` of the draft that was loaded (ms since epoch) */
  savedAt: number;
  /**
   * The author confirmed 'Start over' - the only destructive action of the editor. The
   * shell then cancels running uploads FIRST (`coverHandleRef.current?.cancel()`, see
   * PresentationFields), calls `clearDraft()` and `form.reset()`, hides this bar and moves
   * the focus to the first field.
   */
  onStartOver: () => void;
  /** The X: hide the bar, keep the draft. The shell moves the focus to its section heading */
  onDismiss: () => void;
  /** A submit is in flight */
  disabled?: boolean;
  /** Clock override for tests; read once, when the bar mounts */
  now?: number;
  sx?: SxProps<Theme>;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * 'a moment ago', '10 min ago', '3 hours ago', 'yesterday', '5 days ago' - as a descriptor,
 * because this is a pure function with no locale of its own (docs/I18N.md).
 */
export function formatDraftAge(savedAt: number, now: number): TextDescriptor {
  const age = now - savedAt;
  // A clock that went backwards, or a broken timestamp, is not worth a sentence of its own
  if (!Number.isFinite(age) || age < MINUTE) return text('recipeForm.draft.ageMoment');
  if (age < HOUR) return text('recipeForm.draft.ageMinutes', { count: Math.floor(age / MINUTE) });
  if (age < DAY) return text('recipeForm.draft.ageHours', { count: Math.floor(age / HOUR) });
  const days = Math.floor(age / DAY);
  return days === 1
    ? text('recipeForm.draft.ageYesterday')
    : text('recipeForm.draft.ageDays', { count: days });
}

/**
 * Sits at the top of the editor's body after a draft was restored automatically:
 * 'Draft restored from 10 min ago' [Start over] [x]. Informational, so it is a polite
 * status - never an alert.
 */
export default function DraftRestoredBar({
  savedAt,
  onStartOver,
  onDismiss,
  disabled = false,
  now,
  sx,
}: DraftRestoredBarProps) {
  const t = useTranslations('recipeForm');
  const renderText = useTextDescriptor();
  const [mountedAt] = useState(() => now ?? Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = () => {
    setConfirmOpen(false);
    onStartOver();
  };

  return (
    <>
      <Alert
        severity="info"
        variant="outlined"
        role="status"
        sx={[{ alignItems: 'center' }, ...(Array.isArray(sx) ? sx : [sx])]}
        action={
          <>
            <Button
              type="button"
              color="inherit"
              size="small"
              onClick={() => setConfirmOpen(true)}
              disabled={disabled}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {t('draft.startOver')}
            </Button>
            <IconButton
              type="button"
              aria-label={t('draft.dismiss')}
              color="inherit"
              size="small"
              onClick={onDismiss}
              disabled={disabled}
            >
              <Close fontSize="small" />
            </IconButton>
          </>
        }
      >
        {t('draft.restored', { age: renderText(formatDraftAge(savedAt, mountedAt)) })}
      </Alert>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title={t('draft.startOverTitle')}
        message={t('draft.startOverMessage')}
        confirmText={t('draft.startOver')}
        cancelText={t('draft.keepDraft')}
        confirmColor="error"
      />
    </>
  );
}
