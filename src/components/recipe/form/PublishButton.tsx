'use client';
import { Button, CircularProgress } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import { useEffect, useRef } from 'react';
import { PUBLISH_GUARD_MS } from './formMotion';
import { RecipeFormMode } from './types';

export interface PublishButtonProps {
  /** create: 'Publish recipe' / 'Publishing...'; edit: 'Save changes' / 'Saving...' */
  mode: RecipeFormMode;
  /** Called on an accepted activation: never inside the mount guard, never while pending */
  onPublish: () => void;
  /** The request is in flight: spinner + '...ing' label, activation ignored, focus kept */
  pending?: boolean;
  /** Publish can not run now (photos still uploading); FormStatus prints the reason */
  disabled?: boolean;
  /** id of the FormStatus node, so the reason is read together with the button */
  'aria-describedby'?: string;
  sx?: SxProps<Theme>;
}

const LABELS: Record<RecipeFormMode, { idle: string; pending: string }> = {
  create: { idle: 'Publish recipe', pending: 'Publishing...' },
  edit: { idle: 'Save changes', pending: 'Saving...' },
};

/**
 * The primary action of the recipe form. Mount it as its own keyed node
 * (`<PublishButton key="publish" ... />`) so it never inherits the DOM position of a
 * neighbouring 'Next' button: it ignores every activation for PUBLISH_GUARD_MS after it
 * mounts, so the second half of a double-click on that neighbour can not publish (a publish
 * burns one of the daily slots). The guard compares timestamps; no animation is involved.
 */
export default function PublishButton({
  mode,
  onPublish,
  pending = false,
  disabled = false,
  'aria-describedby': describedBy,
  sx,
}: PublishButtonProps) {
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const handleClick = () => {
    if (pending) return;
    // The import binding is read at call time (never copied), so tests can zero the guard
    if (Date.now() - mountedAt.current < PUBLISH_GUARD_MS) return;
    onPublish();
  };

  const labels = LABELS[mode];

  return (
    <Button
      type="button"
      variant="contained"
      size="large"
      onClick={handleClick}
      disabled={disabled}
      // Pending is not `disabled`: a disabled button drops the focus to <body>
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      aria-describedby={describedBy}
      startIcon={pending ? <CircularProgress size={18} color="inherit" /> : undefined}
      sx={[{ minWidth: 168 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {pending ? labels.pending : labels.idle}
    </Button>
  );
}
